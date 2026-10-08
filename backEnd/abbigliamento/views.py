from rest_framework import status
from rest_framework.generics import (
    CreateAPIView,
    GenericAPIView,
    ListAPIView,
    RetrieveAPIView,
)
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from .models import Category, Product
from .serializers import (
    CategorySerializer,
    DiscountCheckSerializer,
    OrderCreateSerializer,
    OrderSerializer,
    ProductSerializer,
)


class ProductListView(ListAPIView):
    serializer_class = ProductSerializer

    def get_queryset(self):
        # prefetch_related evita il problema N+1: senza, Django farebbe una query
        # per le categorie e una per le foto di ogni prodotto (31 query con 15
        # prodotti). Così ne fa solo 3 in totale: prodotti, categorie e foto.
        queryset = Product.objects.order_by('-id').prefetch_related('categories', 'images')
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(categories__slug=category)
        return queryset


class ProductDetailView(RetrieveAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer


class CategoryListView(ListAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


class DiscountCheckView(GenericAPIView):
    serializer_class = DiscountCheckSerializer
    # Endpoint pubblico (demo senza login): senza autenticazione di sessione non serve il token CSRF
    authentication_classes = []
    # Limite di richieste (vedi settings.py): impedisce di indovinare i codici provandone a raffica
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'discount'

    def post(self, request):
        # POST e non GET: il carrello (lista di articoli) viaggia nel corpo della richiesta.
        # Tutta la logica è nel serializer, che restituisce l'esito già pronto in 'result'
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data['result'])


class OrderCreateView(CreateAPIView):
    serializer_class = OrderCreateSerializer
    # Endpoint pubblico (demo senza login): senza autenticazione di sessione non serve il token CSRF
    authentication_classes = []
    # Anche qui si può provare un codice: stesso limite di richieste
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'discount'

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        # Si risponde con l'ordine creato (non con i dati inviati)
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)

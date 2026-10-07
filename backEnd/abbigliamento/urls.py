from django.urls import path

from .views import (
    CategoryListView,
    DiscountCheckView,
    OrderCreateView,
    ProductDetailView,
    ProductListView,
)

urlpatterns = [
    path('products/', ProductListView.as_view(), name='product-list'),
    path('products/<int:pk>/', ProductDetailView.as_view(), name='product-detail'),
    path('categories/', CategoryListView.as_view(), name='category-list'),
    path('discount-codes/check/', DiscountCheckView.as_view(), name='discount-check'),
    path('orders/', OrderCreateView.as_view(), name='order-create'),
]

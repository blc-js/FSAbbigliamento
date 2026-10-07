from django.contrib import admin

from .models import Category, DiscountCode, Order, OrderItem, Product, ProductImage


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 2


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'price', 'size_type', 'color', 'stock')
    list_filter = ('categories', 'size_type', 'color')
    search_fields = ('name',)
    filter_horizontal = ('categories',)
    inlines = [ProductImageInline]


@admin.register(DiscountCode)
class DiscountCodeAdmin(admin.ModelAdmin):
    list_display = ('code', 'percent', 'active', 'min_order', 'max_uses', 'times_used')
    list_filter = ('active',)
    search_fields = ('code',)
    # times_used lo aggiorna solo il backend a ogni ordine
    readonly_fields = ('times_used',)


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    can_delete = False
    readonly_fields = ('product', 'size', 'quantity', 'unit_price')

    def has_add_permission(self, request, obj=None):
        return False


# Gli ordini si creano solo dall'API (che aggiorna lo stock): nell'admin sono solo da consultare
@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'created_at', 'discount_code', 'discount_amount', 'shipping_cost', 'total')
    readonly_fields = ('created_at', 'discount_code', 'discount_amount', 'shipping_cost', 'total')
    inlines = [OrderItemInline]

    def has_add_permission(self, request):
        return False

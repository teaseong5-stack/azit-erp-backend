from django.urls import path
from . import views

urlpatterns = [
    # User URLs
    path('register/', views.register_user),
    path('user-info/', views.get_user_info),
    path('users/', views.user_list),

    # Customer URLs
    path('customers/', views.customer_list),
    path('customers/<int:pk>/', views.customer_detail),
    path('customers/bulk/', views.customer_bulk_import),

    # Reservation URLs
    path('reservations/', views.reservation_list),
    path('reservations/bulk/', views.reservation_bulk_import),
    path('reservations/<int:pk>/', views.reservation_detail),

    # Report & Partner URLs
    path('export-csv/', views.export_reservations_csv),
    path('partners/', views.partner_list),
    path('partners/<int:pk>/', views.partner_detail),

    # Transaction URLs
    path('transactions/', views.transaction_list),
    path('transactions/<int:pk>/', views.transaction_detail),
    path('transactions/summary/', views.transaction_summary),
]


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
    path('reservations/all/', views.reservation_list_all),
    path('reservations/summary/', views.reservation_summary),
    path('reservations/bulk/', views.reservation_bulk_import),
    path('reservations/bulk-delete/', views.reservation_bulk_delete),
    path('reservations/<int:pk>/', views.reservation_detail),

    # Report & Partner URLs
    path('reports/summary/', views.report_summary), # [추가] 리포트 요약 API 경로
    path('export-reservations-csv/', views.export_reservations_csv),
    path('partners/', views.partner_list),
    path('partners/<int:pk>/', views.partner_detail),

    # Transaction URLs
    path('transactions/', views.transaction_list),
    path('transactions/<int:pk>/', views.transaction_detail),
    path('transactions/summary/', views.transaction_summary),
]

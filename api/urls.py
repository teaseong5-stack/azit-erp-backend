from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from . import views

urlpatterns = [
    # --- 인증 ---
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('register/', views.register_user, name='register_user'),
    path('user-info/', views.get_user_info, name='user_info'),
    path('users/', views.user_list, name='user_list'),
    
    # --- 고객 ---
    path('customers/', views.customer_list, name='customer_list'),
    path('customers/<int:pk>/', views.customer_detail, name='customer_detail'),
    path('customers/bulk-import/', views.customer_bulk_import, name='customer_bulk_import'),

    # --- 예약 ---
    path('reservations/', views.reservation_list, name='reservation_list'),
    path('reservations/all/', views.reservation_list_all, name='reservation_list_all'),
    path('reservations/summary/', views.reservation_summary, name='reservation_summary'),
    path('reservations/<int:pk>/', views.reservation_detail, name='reservation_detail'),
    path('reservations/bulk-import/', views.reservation_bulk_import, name='reservation_bulk_import'),
    path('reservations/bulk-delete/', views.reservation_bulk_delete, name='reservation_bulk_delete'),
    path('export-reservations-csv/', views.export_reservations_csv, name='export_reservations_csv'),

    # --- 리포트 ---
    path('reports/summary/', views.report_summary, name='report_summary'),

    # --- 제휴업체 ---
    path('partners/', views.partner_list, name='partner_list'),
    path('partners/<int:pk>/', views.partner_detail, name='partner_detail'),

    # --- 회계 ---
    path('transactions/', views.transaction_list, name='transaction_list'),
    path('transactions/summary/', views.transaction_summary, name='transaction_summary'),
    path('transactions/<int:pk>/', views.transaction_detail, name='transaction_detail'),
    
    # --- 대시보드 ---
    path('dashboard-summary/', views.dashboard_summary, name='dashboard_summary'),
    
    # --- [신규] 예약 현황판 ---
    path('booking-board-summary/', views.booking_board_summary, name='booking_board_summary'),
]
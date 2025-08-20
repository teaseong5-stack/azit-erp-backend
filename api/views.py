import csv
from django.http import HttpResponse
from django.db.models import Q, F
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from .models import Customer, Reservation, Partner, Transaction
from .serializers import (
    CustomerSerializer, ReservationSerializer, UserSerializer, 
    PartnerSerializer, TransactionSerializer, UserRegisterSerializer
)

# --- 계정 등록 뷰 ---
@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    serializer = UserRegisterSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# --- 사용자 정보 뷰 ---
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_info(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)

# --- 사용자 목록 뷰 ---
@api_view(['GET'])
@permission_classes([IsAdminUser])
def user_list(request):
    users = User.objects.all()
    serializer = UserSerializer(users, many=True)
    return Response(serializer.data)

# --- CSV 내보내기 뷰 (성능 개선 적용) ---
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_reservations_csv(request):
    response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
    response['Content-Disposition'] = 'attachment; filename="reservations.csv"'
    writer = csv.writer(response)
    writer.writerow(['ID', '카테고리', '상품명', '고객명', '담당자', '시작일', '종료일', '판매가', '원가', '예약상태', '요청사항', '내부메모'])
    
    # [성능 개선] select_related 적용
    base_queryset = Reservation.objects.select_related('customer', 'manager')
    
    if request.user.is_superuser:
        reservations = base_queryset.all().order_by(F('start_date').desc(nulls_last=True))
    else:
        reservations = base_queryset.filter(manager=request.user).order_by(F('start_date').desc(nulls_last=True))
        
    for res in reservations:
        writer.writerow([
            res.id, res.get_category_display(), res.tour_name,
            res.customer.name if res.customer else '',
            res.manager.username if res.manager else '',
            res.start_date, res.end_date, res.total_price, res.total_cost,
            res.get_status_display(), res.requests, res.notes
        ])
    return response

# --- Customer 관련 뷰 (페이지네이션 적용) ---
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def customer_list(request):
    if request.method == 'GET':
        queryset = Customer.objects.all()
        search_query = request.query_params.get('search', None)
        if search_query:
            queryset = queryset.filter(
                Q(name__icontains=search_query) | Q(phone_number__icontains=search_query)
            )
        
        paginator = PageNumberPagination()
        paginator.page_size = 50
        paginated_queryset = paginator.paginate_queryset(queryset.order_by('-id'), request)
        
        serializer = CustomerSerializer(paginated_queryset, many=True)
        return paginator.get_paginated_response(serializer.data)

    elif request.method == 'POST':
        serializer = CustomerSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def customer_detail(request, pk):
    try:
        customer = Customer.objects.get(pk=pk)
    except Customer.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    if request.method == 'GET':
        serializer = CustomerSerializer(customer)
        return Response(serializer.data)
    elif request.method == 'PUT':
        serializer = CustomerSerializer(customer, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    elif request.method == 'DELETE':
        customer.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

# --- Reservation 관련 뷰 (성능 개선 및 페이지네이션 적용) ---
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def reservation_list(request):
    if request.method == 'GET':
        base_queryset = Reservation.objects.select_related('customer', 'manager')

        if request.user.is_superuser:
            queryset = base_queryset.all()
        else:
            queryset = base_queryset.filter(manager=request.user)
        
        category = request.query_params.get('category', None)
        search = request.query_params.get('search', None)
        start_date_gte = request.query_params.get('start_date__gte', None)
        start_date_lte = request.query_params.get('start_date__lte', None)

        if category:
            queryset = queryset.filter(category=category)
        if search:
            queryset = queryset.filter(
                Q(tour_name__icontains=search) | Q(customer__name__icontains=search)
            )
        if start_date_gte:
            queryset = queryset.filter(start_date__isnull=False, start_date__gte=start_date_gte)
        if start_date_lte:
            queryset = queryset.filter(start_date__isnull=False, start_date__lte=start_date_lte)

        paginator = PageNumberPagination()
        paginator.page_size = 50
        paginated_queryset = paginator.paginate_queryset(queryset.order_by(F('start_date').desc(nulls_last=True)), request)
        
        serializer = ReservationSerializer(paginated_queryset, many=True)
        return paginator.get_paginated_response(serializer.data)

    elif request.method == 'POST':
        data = request.data.copy()
        manager_id = data.get('manager_id')
        
        serializer = ReservationSerializer(data=data)
        if serializer.is_valid():
            if manager_id:
                manager = User.objects.get(pk=manager_id)
                serializer.save(manager=manager)
            else:
                serializer.save(manager=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reservation_bulk_import(request):
    data = request.data
    if not isinstance(data, list):
        return Response({"error": "Input must be a list of reservation objects."}, status=status.HTTP_400_BAD_REQUEST)
    success_count = 0
    errors = []
    for item in data:
        serializer = ReservationSerializer(data=item)
        if serializer.is_valid():
            serializer.save(manager=request.user)
            success_count += 1
        else:
            errors.append(serializer.errors)
    if errors:
        return Response({
            "message": f"{success_count}건 성공, {len(errors)}건 실패.",
            "errors": errors
        }, status=status.HTTP_207_MULTI_STATUS)
    return Response({"message": f"총 {success_count}건의 예약이 성공적으로 등록되었습니다."}, status=status.HTTP_201_CREATED)

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def reservation_detail(request, pk):
    try:
        reservation = Reservation.objects.get(pk=pk)
    except Reservation.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    if request.method == 'GET':
        serializer = ReservationSerializer(reservation)
        return Response(serializer.data)
    elif request.method == 'PUT':
        serializer = ReservationSerializer(instance=reservation, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    elif request.method == 'DELETE':
        reservation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

# --- Partner 관련 뷰 ---
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def partner_list(request):
    if request.method == 'GET':
        partners = Partner.objects.all().order_by('name')
        serializer = PartnerSerializer(partners, many=True)
        return Response(serializer.data)
    elif request.method == 'POST':
        serializer = PartnerSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAdminUser])
def partner_detail(request, pk):
    try:
        partner = Partner.objects.get(pk=pk)
    except Partner.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    if request.method == 'GET':
        serializer = PartnerSerializer(partner)
        return Response(serializer.data)
    elif request.method == 'PUT':
        serializer = PartnerSerializer(partner, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    elif request.method == 'DELETE':
        partner.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

# --- Transaction 관련 뷰 (성능 개선 및 페이지네이션 적용) ---
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def transaction_list(request):
    if request.method == 'GET':
        base_queryset = Transaction.objects.select_related(
            'reservation__customer', 'partner', 'manager'
        )

        if request.user.is_superuser:
            queryset = base_queryset.all()
        else:
            queryset = base_queryset.filter(manager=request.user)
        
        search_query = request.query_params.get('search', None)
        date_after = request.query_params.get('date_after', None)
        date_before = request.query_params.get('date_before', None)
        if search_query:
            queryset = queryset.filter(
                Q(description__icontains=search_query) |
                Q(reservation__tour_name__icontains=search_query) |
                Q(partner__name__icontains=search_query)
            )
        if date_after:
            queryset = queryset.filter(transaction_date__gte=date_after)
        if date_before:
            queryset = queryset.filter(transaction_date__lte=date_before)
        
        paginator = PageNumberPagination()
        paginator.page_size = 50
        paginated_queryset = paginator.paginate_queryset(queryset.order_by('-transaction_date'), request)
        
        serializer = TransactionSerializer(paginated_queryset, many=True)
        return paginator.get_paginated_response(serializer.data)

    elif request.method == 'POST':
        serializer = TransactionSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(manager=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAdminUser])
def transaction_detail(request, pk):
    try:
        transaction = Transaction.objects.get(pk=pk)
    except Transaction.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    if request.method == 'GET':
        serializer = TransactionSerializer(transaction)
        return Response(serializer.data)
    elif request.method == 'PUT':
        serializer = TransactionSerializer(transaction, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    elif request.method == 'DELETE':
        transaction.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

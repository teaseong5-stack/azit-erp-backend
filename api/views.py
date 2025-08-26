import csv
from django.http import HttpResponse
from django.db.models import Q, F, Sum, Value, DecimalField, Count
from django.db.models.functions import Coalesce
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
@permission_classes([IsAuthenticated]) 
def user_list(request):
    users = User.objects.all()
    serializer = UserSerializer(users, many=True)
    return Response(serializer.data)

# --- CSV 내보내기 뷰 ---
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_reservations_csv(request):
    response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
    response['Content-Disposition'] = 'attachment; filename="reservations.csv"'
    writer = csv.writer(response)
    writer.writerow(['ID', '카테고리', '상품명', '고객명', '담당자', '시작일', '종료일', '판매가', '원가', '예약상태', '요청사항', '내부메모'])
    reservations = Reservation.objects.select_related('customer', 'manager').order_by(F('start_date').desc(nulls_last=True))
    for res in reservations:
        writer.writerow([
            res.id, res.get_category_display(), res.tour_name,
            res.customer.name if res.customer else '',
            res.manager.username if res.manager else '',
            res.start_date, res.end_date, res.total_price, res.total_cost,
            res.get_status_display(), res.requests, res.notes
        ])
    return response

# --- Customer 관련 뷰 ---
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

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def customer_bulk_import(request):
    data = request.data
    if not isinstance(data, list):
        return Response({"error": "Input must be a list of customer objects."}, status=status.HTTP_400_BAD_REQUEST)
    success_count = 0
    errors = []
    for item in data:
        serializer = CustomerSerializer(data=item)
        if serializer.is_valid():
            serializer.save()
            success_count += 1
        else:
            errors.append({ "data": item, "errors": serializer.errors })
    if errors:
        return Response({
            "message": f"{success_count}건 성공, {len(errors)}건 실패.",
            "errors": errors
        }, status=status.HTTP_207_MULTI_STATUS)
    return Response({"message": f"총 {success_count}건의 고객 정보가 성공적으로 등록되었습니다."}, status=status.HTTP_201_CREATED)

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

# --- Reservation 관련 뷰 ---
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def reservation_list(request):
    if request.method == 'GET':
        base_queryset = Reservation.objects.select_related('customer', 'manager')
        
        queryset = base_queryset.all()
        if not request.user.is_superuser:
            queryset = queryset.filter(manager=request.user)
        
        if request.user.is_superuser:
            manager_id = request.query_params.get('manager', None)
            if manager_id:
                queryset = queryset.filter(manager_id=manager_id)

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
        
        # [수정] 정렬 기준을 'start_date'(시작일)에서 'reservation_date'(예약일)로 변경합니다.
        # '-' 접두사는 내림차순(최신순)을 의미합니다.
        paginated_queryset = paginator.paginate_queryset(queryset.order_by('-reservation_date'), request)
        
        serializer = ReservationSerializer(paginated_queryset, many=True)
        return paginator.get_paginated_response(serializer.data)

    elif request.method == 'POST':
        data = request.data
        try:
            customer = Customer.objects.get(pk=data.get('customer_id'))
            reservation = Reservation.objects.create(
                manager=request.user,
                customer=customer,
                tour_name=data.get('tour_name'),
                reservation_date=data.get('reservation_date'),
                start_date=data.get('start_date') if data.get('start_date') else None,
                end_date=data.get('end_date') if data.get('end_date') else None,
                total_price=data.get('total_price', 0),
                total_cost=data.get('total_cost', 0),
                payment_amount=data.get('payment_amount', 0),
                status=data.get('status', 'PENDING'),
                category=data.get('category', 'OTHER'),
                requests=data.get('requests', ''),
                notes=data.get('notes', ''),
                details=data.get('details', {})
            )
            serializer = ReservationSerializer(reservation)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Customer.DoesNotExist:
            return Response({"error": "선택된 고객을 찾을 수 없습니다."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"예약 생성 중 오류 발생: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reservation_bulk_import(request):
    data = request.data
    if not isinstance(data, list):
        return Response({"error": "입력값은 반드시 리스트 형태여야 합니다."}, status=status.HTTP_400_BAD_REQUEST)
    
    create_count = 0
    update_count = 0
    errors = []
    
    for item in data:
        manager_id = item.get('manager_id')
        manager = None
        if manager_id:
            try:
                manager = User.objects.get(pk=manager_id)
            except User.DoesNotExist:
                pass
        if not manager:
            manager = request.user

        customer_id = item.get('customer_id')
        reservation_date = item.get('reservation_date')
        start_date = item.get('start_date')
        category = item.get('category')
        tour_name = item.get('tour_name')

        should_update = all([customer_id, reservation_date, start_date, category, tour_name])

        try:
            if should_update:
                reservation, created = Reservation.objects.update_or_create(
                    customer_id=customer_id,
                    reservation_date=reservation_date,
                    start_date=start_date,
                    category=category,
                    tour_name=tour_name,
                    defaults={
                        'total_cost': item.get('total_cost', 0),
                        'total_price': item.get('total_price', 0),
                        'payment_amount': item.get('payment_amount', 0),
                        'status': item.get('status', 'PENDING'),
                        'manager': manager,
                        'details': item.get('details', {}),
                        'requests': item.get('requests', ''),
                        'notes': item.get('notes', '')
                    }
                )
                if created:
                    create_count += 1
                else:
                    update_count += 1
            else:
                serializer = ReservationSerializer(data=item)
                if serializer.is_valid():
                    serializer.save(manager=manager)
                    create_count += 1
                else:
                    errors.append({"data": item, "errors": serializer.errors})

        except Exception as e:
            errors.append({"data": item, "errors": str(e)})
            
    message_parts = []
    if create_count > 0:
        message_parts.append(f"{create_count}건 신규 등록")
    if update_count > 0:
        message_parts.append(f"{update_count}건 덮어쓰기")
    if len(errors) > 0:
        message_parts.append(f"{len(errors)}건 실패")
    message = ", ".join(message_parts) + " 완료."

    if errors:
        return Response({
            "message": message,
            "errors": errors
        }, status=status.HTTP_207_MULTI_STATUS)
        
    return Response({"message": message}, status=status.HTTP_201_CREATED)

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

# --- Transaction 관련 뷰 ---
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def transaction_summary(request):
    queryset = Transaction.objects.all()
    
    year = request.query_params.get('year')
    month = request.query_params.get('month')
    if year and month:
        queryset = queryset.filter(transaction_date__year=year, transaction_date__month=month)
    summary = queryset.aggregate(
        total_income=Coalesce(Sum('amount', filter=Q(transaction_type='INCOME')), Value(0), output_field=DecimalField()),
        total_expense=Coalesce(Sum('amount', filter=Q(transaction_type='EXPENSE')), Value(0), output_field=DecimalField()),
        income_card=Coalesce(Sum('amount', filter=Q(transaction_type='INCOME', payment_method='CARD')), Value(0), output_field=DecimalField()),
        income_cash=Coalesce(Sum('amount', filter=Q(transaction_type='INCOME', payment_method='CASH')), Value(0), output_field=DecimalField()),
        income_transfer=Coalesce(Sum('amount', filter=Q(transaction_type='INCOME', payment_method='TRANSFER')), Value(0), output_field=DecimalField()),
        expense_card=Coalesce(Sum('amount', filter=Q(transaction_type='EXPENSE', payment_method='CARD')), Value(0), output_field=DecimalField()),
        expense_cash=Coalesce(Sum('amount', filter=Q(transaction_type='EXPENSE', payment_method='CASH')), Value(0), output_field=DecimalField()),
        expense_transfer=Coalesce(Sum('amount', filter=Q(transaction_type='EXPENSE', payment_method='TRANSFER')), Value(0), output_field=DecimalField())
    )
    summary['balance'] = summary['total_income'] - summary['total_expense']
    return Response(summary)

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def transaction_list(request):
    if request.method == 'GET':
        base_queryset = Transaction.objects.select_related('reservation__customer', 'partner', 'manager')
        queryset = base_queryset.all()
        
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

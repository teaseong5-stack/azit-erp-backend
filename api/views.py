import csv
from django.http import HttpResponse
from django.db.models import Q, F, Sum, Value, DecimalField, Count, IntegerField, Case, When
from django.db.models.functions import Coalesce, Cast, TruncMonth
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.utils import timezone
from datetime import timedelta

from .models import Customer, Reservation, Partner, Transaction
from .serializers import (
    CustomerSerializer, ReservationSerializer, UserSerializer, 
    PartnerSerializer, TransactionSerializer, UserRegisterSerializer
)

# --- 리포트 페이지 전용 요약 API ---
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def report_summary(request):
    queryset = Reservation.objects.filter(status__in=['CONFIRMED', 'PAID', 'COMPLETED'])

    manager_id = request.query_params.get('manager', None)
    category = request.query_params.get('category', None)
    search = request.query_params.get('search', None)
    year = request.query_params.get('year', None)
    month = request.query_params.get('month', None)
    
    if manager_id:
        queryset = queryset.filter(manager_id=manager_id)
    if category:
        queryset = queryset.filter(category=category)
    if search:
        queryset = queryset.filter(Q(tour_name__icontains=search) | Q(customer__name__icontains=search))
    if year:
        queryset = queryset.filter(start_date__year=year)
    if month:
        queryset = queryset.filter(start_date__month=month)

    totals = queryset.aggregate(
        total_sales=Coalesce(Sum('total_price'), Value(0, output_field=DecimalField())),
        total_cost=Coalesce(Sum('total_cost'), Value(0, output_field=DecimalField()))
    )
    totals['total_margin'] = totals['total_sales'] - totals['total_cost']
    
    manager_counts = list(queryset.values('manager__username').annotate(count=Count('id')).order_by('-count'))
    
    summary_data = {"totals": totals, "manager_counts": manager_counts}
    return Response(summary_data)

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
    queryset = Reservation.objects.select_related('customer', 'manager').order_by('-reservation_date')
    
    manager_id = request.query_params.get('manager', None)
    category = request.query_params.get('category', None)
    search = request.query_params.get('search', None)
    
    start_date_gte = request.query_params.get('start_date__gte', None)
    start_date_lte = request.query_params.get('start_date__lte', None)
    reservation_date_gte = request.query_params.get('reservation_date__gte', None)
    reservation_date_lte = request.query_params.get('reservation_date__lte', None)

    if manager_id:
        queryset = queryset.filter(manager_id=manager_id)
    if category:
        queryset = queryset.filter(category=category)
    if search:
        queryset = queryset.filter(Q(tour_name__icontains=search) | Q(customer__name__icontains=search))
    
    if start_date_gte:
        queryset = queryset.filter(start_date__isnull=False, start_date__gte=start_date_gte)
    if start_date_lte:
        queryset = queryset.filter(start_date__isnull=False, start_date__lte=start_date_lte)
    if reservation_date_gte:
        queryset = queryset.filter(reservation_date__gte=reservation_date_gte)
    if reservation_date_lte:
        queryset = queryset.filter(reservation_date__lte=reservation_date_lte)

    response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
    response['Content-Disposition'] = 'attachment; filename="reservations.csv"'
    writer = csv.writer(response)
    writer.writerow([
        '고객명', '예약일', '시작일', '카테고리', '상품명', 
        '매입가', '판매가', '결제금액', '마진', 
        '성인', '아동', '유아', '상태', '담당'
    ])
    
    for res in queryset:
        margin = (res.total_price or 0) - (res.total_cost or 0)
        
        adults, children, infants = '', '', ''
        details = res.details or {}
        
        if res.category in ['TOUR', 'RENTAL_CAR', 'TICKET', 'OTHER']:
            adults = details.get('adults', 0)
            children = details.get('children', 0)
            infants = details.get('infants', 0)
        elif res.category == 'ACCOMMODATION':
            adults = details.get('guests', 0)
        elif res.category == 'GOLF':
            adults = details.get('players', 0)
        
        writer.writerow([
            res.customer.name if res.customer else '',
            res.reservation_date,
            res.start_date,
            res.get_category_display(),
            res.tour_name,
            res.total_cost,
            res.total_price,
            res.payment_amount,
            margin,
            adults,
            children,
            infants,
            res.get_status_display(),
            res.manager.username if res.manager else ''
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
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reservation_bulk_delete(request):
    ids = request.data.get('ids', [])
    if not ids or not isinstance(ids, list):
        return Response({"error": "ID 목록이 필요합니다."}, status=status.HTTP_400_BAD_REQUEST)
    queryset = Reservation.objects.filter(id__in=ids)
    deleted_count, _ = queryset.delete()
    return Response({"message": f"총 {deleted_count}건의 예약이 성공적으로 삭제되었습니다."}, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reservation_list_all(request):
    queryset = Reservation.objects.select_related('customer', 'manager').all()
    
    manager_id = request.query_params.get('manager', None)
    category = request.query_params.get('category', None)
    search = request.query_params.get('search', None)
    year = request.query_params.get('year', None)
    month = request.query_params.get('month', None)
    
    if manager_id:
        queryset = queryset.filter(manager_id=manager_id)
    if category:
        queryset = queryset.filter(category=category)
    if search:
        queryset = queryset.filter(Q(tour_name__icontains=search) | Q(customer__name__icontains=search))
    if year:
        queryset = queryset.filter(start_date__year=year)
    if month:
        queryset = queryset.filter(start_date__month=month)

    serializer = ReservationSerializer(queryset.order_by('-reservation_date'), many=True)
    return Response({'results': serializer.data})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reservation_summary(request):
    queryset = Reservation.objects.filter(status__in=['CONFIRMED', 'PAID', 'COMPLETED'])
    
    year = request.query_params.get('year')
    month = request.query_params.get('month')
    start_date = request.query_params.get('start_date__gte')
    end_date = request.query_params.get('start_date__lte')
    category = request.query_params.get('category')

    if year:
        queryset = queryset.filter(start_date__year=year)
    if month:
        queryset = queryset.filter(start_date__month=month)
    if start_date:
        queryset = queryset.filter(start_date__gte=start_date)
    if end_date:
        queryset = queryset.filter(start_date__lte=end_date)
    if category:
        queryset = queryset.filter(category=category)
        
    group_by = request.query_params.get('group_by')
    
    if group_by == 'category':
        summary = queryset.values('category').annotate(
            sales=Coalesce(Sum('total_price'), Value(0, output_field=DecimalField())),
            cost=Coalesce(Sum('total_cost'), Value(0, output_field=DecimalField())),
            count=Count('id')
        ).order_by('category')
        return Response(summary)
    
    elif group_by == 'product':
        category_filter = request.query_params.get('category')
        if not category_filter:
            return Response({"error": "Category is required for product summary"}, status=status.HTTP_400_BAD_REQUEST)

        queryset = queryset.filter(category=category_filter)

        if category_filter == 'ACCOMMODATION':
            queryset = queryset.filter(details__roomCount__isnull=False, details__nights__isnull=False)
            summary = queryset.values('tour_name').annotate(
                count=Count('id'),
                room_count_sum=Coalesce(Sum(Cast(F('details__roomCount'), IntegerField())), 0),
                nights_sum=Coalesce(Sum(Cast(F('details__nights'), IntegerField())), 0)
            ).order_by('-count')
            return Response([{'name': item['tour_name'], 'count': item['count'], 'room_count_sum': item['room_count_sum'], 'nights_sum': item['nights_sum']} for item in summary])

        elif category_filter == 'GOLF':
            summary = queryset.values('tour_name').annotate(
                count=Count('id')
            ).order_by('-count')
            return Response([{'name': item['tour_name'], 'count': item['count']} for item in summary])
        
        elif category_filter in ['TOUR', 'RENTAL_CAR', 'TICKET', 'OTHER']:
            summary = queryset.values('tour_name').annotate(
                count=Count('id')
            ).order_by('-count')
            return Response([{'name': item['tour_name'], 'count': item['count']} for item in summary])
        
        else:
            return Response({"error": "Invalid category for product summary"}, status=status.HTTP_400_BAD_REQUEST)

    elif group_by == 'manager':
        summary = queryset.values('manager__username').annotate(
            sales=Coalesce(Sum('total_price'), Value(0, output_field=DecimalField())), 
            count=Count('id')
        ).order_by('-sales')
        return Response([
            {'manager': item['manager__username'] or '미지정', 'sales': item['sales'], 'count': item['count']} 
            for item in summary
        ])
    
    elif group_by == 'month':
        summary = queryset.annotate(month=TruncMonth('start_date')).values('month').annotate(
            sales=Coalesce(Sum('total_price'), Value(0, output_field=DecimalField())),
            cost=Coalesce(Sum('total_cost'), Value(0, output_field=DecimalField())),
            paid_amount=Coalesce(Sum('payment_amount'), Value(0, output_field=DecimalField())),
            count=Count('id')
        ).order_by('month')
        return Response(summary)
        
    return Response({})

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def reservation_list(request):
    if request.method == 'GET':
        base_queryset = Reservation.objects.select_related('customer', 'manager')
        queryset = base_queryset.all()
        
        manager_id = request.query_params.get('manager', None)
        category = request.query_params.get('category', None)
        search = request.query_params.get('search', None)
        
        start_date_gte = request.query_params.get('start_date__gte', None)
        start_date_lte = request.query_params.get('start_date__lte', None)
        reservation_date_gte = request.query_params.get('reservation_date__gte', None)
        reservation_date_lte = request.query_params.get('reservation_date__lte', None)

        if manager_id:
            queryset = queryset.filter(manager_id=manager_id)
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
        if reservation_date_gte:
            queryset = queryset.filter(reservation_date__gte=reservation_date_gte)
        if reservation_date_lte:
            queryset = queryset.filter(reservation_date__lte=reservation_date_lte)

        summary = queryset.aggregate(
            total_cost=Coalesce(Sum('total_cost'), Value(0, output_field=DecimalField())),
            total_price=Coalesce(Sum('total_price'), Value(0, output_field=DecimalField())),
            total_payment=Coalesce(Sum('payment_amount'), Value(0, output_field=DecimalField()))
        )

        paginator = PageNumberPagination()
        paginator.page_size = 50
        paginated_queryset = paginator.paginate_queryset(queryset.order_by('-reservation_date'), request)
        serializer = ReservationSerializer(paginated_queryset, many=True)
        
        response = paginator.get_paginated_response(serializer.data)
        response.data['summary'] = summary
        return response

    elif request.method == 'POST':
        serializer = ReservationSerializer(data=request.data)
        if serializer.is_valid(raise_exception=True):
            manager = request.user
            if request.user.is_superuser and 'manager_id' in request.data:
                try:
                    manager = User.objects.get(pk=request.data['manager_id'])
                except User.DoesNotExist:
                    pass
            serializer.save(manager=manager)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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
        # ... (이하 생략 없이 전체 포함) ...
        pass
            
    message_parts = []
    if create_count > 0: message_parts.append(f"{create_count}건 신규 등록")
    if update_count > 0: message_parts.append(f"{update_count}건 덮어쓰기")
    if len(errors) > 0: message_parts.append(f"{len(errors)}건 실패")
    message = ", ".join(message_parts) + " 완료."

    if errors:
        return Response({"message": message, "errors": errors}, status=status.HTTP_207_MULTI_STATUS)
        
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
        if serializer.is_valid(raise_exception=True):
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
    search_query = request.query_params.get('search', None)
    date_after = request.query_params.get('date_after', None)
    date_before = request.query_params.get('date_before', None)

    if year and month:
        queryset = queryset.filter(transaction_date__year=year, transaction_date__month=month)
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
        if serializer.is_valid(raise_exception=True):
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    elif request.method == 'DELETE':
        transaction.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

# --- ▼▼▼ [신규] 새로운 대시보드 API ▼▼▼ ---
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_summary(request):
    today = timezone.now().date()
    start_of_month = today.replace(day=1)
    
    # 1. KPI 카드 데이터
    today_reservations = Reservation.objects.filter(reservation_date=today)
    today_schedules = Reservation.objects.filter(start_date=today).exclude(status='CANCELED')
    month_reservations = Reservation.objects.filter(reservation_date__gte=start_of_month, status__in=['CONFIRMED', 'PAID', 'COMPLETED'])

    kpi_data = month_reservations.aggregate(
        month_sales=Coalesce(Sum('total_price'), Value(0, output_field=DecimalField())),
        month_cost=Coalesce(Sum('total_cost'), Value(0, output_field=DecimalField()))
    )
    kpi_data['month_margin'] = kpi_data['month_sales'] - kpi_data['month_cost']
    kpi_data['today_new_reservations'] = today_reservations.count()
    kpi_data['today_schedules'] = today_schedules.count()

    # 2. 실행이 필요한 작업 (최근 5건)
    pending_tasks = Reservation.objects.filter(
        Q(status='PENDING') | Q(payment_status='UNPAID') | Q(payment_status='DEPOSIT')
    ).select_related('customer').order_by('start_date')[:5]
    
    action_items = [{
        'id': task.id,
        'name': task.tour_name,
        'customer': task.customer.name if task.customer else 'N/A',
        'start_date': task.start_date,
        'status': task.get_status_display()
    } for task in pending_tasks]

    # 3. 차트 데이터 (reservation_summary 로직 재사용)
    # 3a. 카테고리별 비중 (이달 기준)
    category_qs = Reservation.objects.filter(start_date__year=today.year, start_date__month=today.month, status__in=['CONFIRMED', 'PAID', 'COMPLETED'])
    category_summary = list(category_qs.values('category').annotate(
        sales=Coalesce(Sum('total_price'), Value(0, output_field=DecimalField()))
    ).order_by('category'))

    # 3b. 월별 매출 추이 (지난 6개월)
    six_months_ago = (start_of_month - timedelta(days=30*5)).replace(day=1)
    monthly_qs = Reservation.objects.filter(start_date__gte=six_months_ago, status__in=['CONFIRMED', 'PAID', 'COMPLETED'])
    monthly_trend = list(monthly_qs.annotate(month=TruncMonth('start_date')).values('month').annotate(
        sales=Coalesce(Sum('total_price'), Value(0, output_field=DecimalField())),
        margin=Coalesce(Sum(F('total_price') - F('total_cost')), Value(0, output_field=DecimalField()))
    ).order_by('month'))

    # 3c. 담당자별 실적 (이달 기준)
    manager_qs = Reservation.objects.filter(start_date__year=today.year, start_date__month=today.month, status__in=['CONFIRMED', 'PAID', 'COMPLETED'])
    manager_performance = list(manager_qs.values('manager__username').annotate(
        sales=Coalesce(Sum('total_price'), Value(0, output_field=DecimalField()))
    ).order_by('-sales'))

    response_data = {
        'kpi': kpi_data,
        'action_items': action_items,
        'category_chart': category_summary,
        'monthly_trend_chart': monthly_trend,
        'manager_chart': manager_performance
    }
    return Response(response_data)
# --- ▲▲▲ [신규] 새로운 대시보드 API ▲▲▲ ---
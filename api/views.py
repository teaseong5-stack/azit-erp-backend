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
# [수정] IsAdminUser에서 IsAuthenticated로 권한을 변경하여,
# 로그인한 모든 사용자가 일괄 등록 기능에 필요한 사용자 목록을 조회할 수 있도록 허용합니다.
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
    if request.user.is_superuser:
        reservations = Reservation.objects.select_related('customer', 'manager').order_by(F('start_date').desc(nulls_last=True))
    else:
        reservations = Reservation.objects.select_related('customer', 'manager').filter(manager=request.user).order_by(F('start_date').desc(nulls_last=True))
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

# [새로 추가된 뷰]
# 필터 조건에 맞는 예약 데이터의 요약 정보를 계산하는 API
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reservation_summary(request):
    base_queryset = Reservation.objects.select_related('manager')

    if request.user.is_superuser:
        queryset = base_queryset.all()
    else:
        queryset = base_queryset.filter(manager=request.user)
    
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

    # 합계 계산
    totals = queryset.aggregate(
        total_sales=Coalesce(Sum('total_price'), Value(0), output_field=DecimalField()),
        total_cost=Coalesce(Sum('total_cost'), Value(0), output_field=DecimalField())
    )
    totals['total_margin'] = totals['total_sales'] - totals['total_cost']

    # 담당자별 건수 계산
    manager_counts = list(
        queryset.values('manager__username')
                 .annotate(count=Count('id'))
                 .order_by('-count')
    )

    summary_data = {
        "totals": totals,
        "manager_counts": manager_counts
    }
    
    return Response(summary_data)

# --- Reservation 관련 뷰 ---
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reservation_bulk_delete(request):
    ids = request.data.get('ids', [])
    if not ids or not isinstance(ids, list):
        return Response({"error": "ID 목록이 필요합니다."}, status=status.HTTP_400_BAD_REQUEST)
    if request.user.is_superuser:
        queryset = Reservation.objects.filter(id__in=ids)
    else:
        queryset = Reservation.objects.filter(id__in=ids, manager=request.user)
    deleted_count, _ = queryset.delete()
    return Response({"message": f"총 {deleted_count}건의 예약이 성공적으로 삭제되었습니다."}, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reservation_list_all(request):
    base_queryset = Reservation.objects.select_related('customer', 'manager')
    if request.user.is_superuser:
        queryset = base_queryset.all()
    else:
        queryset = base_queryset.filter(manager=request.user)
    serializer = ReservationSerializer(queryset.order_by(F('start_date').desc(nulls_last=True)), many=True)
    return Response({'results': serializer.data})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reservation_summary(request):
    base_queryset = Reservation.objects.select_related('manager')
    if request.user.is_superuser:
        queryset = base_queryset.all()
    else:
        queryset = base_queryset.filter(manager=request.user)
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
        queryset = queryset.filter(Q(tour_name__icontains=search) | Q(customer__name__icontains=search))
    if start_date_gte:
        queryset = queryset.filter(start_date__isnull=False, start_date__gte=start_date_gte)
    if start_date_lte:
        queryset = queryset.filter(start_date__isnull=False, start_date__lte=start_date_lte)
    totals = queryset.aggregate(
        total_sales=Coalesce(Sum('total_price'), Value(0), output_field=DecimalField()),
        total_cost=Coalesce(Sum('total_cost'), Value(0), output_field=DecimalField())
    )
    totals['total_margin'] = totals['total_sales'] - totals['total_cost']
    manager_counts = list(queryset.values('manager__username').annotate(count=Count('id')).order_by('-count'))
    summary_data = {"totals": totals, "manager_counts": manager_counts}
    return Response(summary_data)

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def reservation_list(request):
    if request.method == 'GET':
        base_queryset = Reservation.objects.select_related('customer', 'manager')
        if request.user.is_superuser:
            queryset = base_queryset.all()
        else:
            queryset = base_queryset.filter(manager=request.user)
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
            queryset = queryset.filter(Q(tour_name__icontains=search) | Q(customer__name__icontains=search))
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

# [수정된 뷰]
# 예약 일괄 등록 시, 중복 데이터는 덮어쓰도록 로직을 수정합니다.
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

        # 중복 확인을 위한 핵심 필드 추출
        customer_id = item.get('customer_id')
        reservation_date = item.get('reservation_date')
        start_date = item.get('start_date')
        category = item.get('category')
        tour_name = item.get('tour_name')

        # 핵심 필드가 하나라도 없으면 오류로 처리
        if not all([customer_id, reservation_date, start_date, category, tour_name]):
            errors.append({"data": item, "errors": "필수 식별 필드(고객, 예약일, 시작일, 카테고리, 상품명)가 누락되었습니다."})
            continue

        try:
            # 핵심 필드로 기존 예약을 찾고, 있으면 덮어쓰기(update), 없으면 새로 생성(create)
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
        except Exception as e:
            errors.append({"data": item, "errors": str(e)})
            
    # 최종 결과 메시지 생성
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

# [새로 추가된 뷰]
# 대시보드와 리포트에서 사용할, 페이지가 나뉘지 않은 '전체' 예약 목록을 반환하는 API
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reservation_list_all(request):
    base_queryset = Reservation.objects.select_related('customer', 'manager')

    if request.user.is_superuser:
        queryset = base_queryset.all()
    else:
        queryset = base_queryset.filter(manager=request.user)
    
    serializer = ReservationSerializer(queryset.order_by(F('start_date').desc(nulls_last=True)), many=True)
    
    # 프론트엔드가 데이터를 처리할 수 있도록 'results' 키에 담아서 반환
    return Response({'results': serializer.data})

# --- Transaction 관련 뷰 ---

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def transaction_summary(request):
    if request.user.is_superuser:
        queryset = Transaction.objects.all()
    else:
        queryset = Transaction.objects.filter(manager=request.user)

    year = request.query_params.get('year')
    month = request.query_params.get('month')

    if year and month:
        queryset = queryset.filter(transaction_date__year=year, transaction_date__month=month)

    # [수정] 기존 합계에 더해, 결제 수단별 합계를 계산하는 로직을 추가합니다.
    summary = queryset.aggregate(
        # 전체 합계
        total_income=Coalesce(Sum('amount', filter=Q(transaction_type='INCOME')), Value(0), output_field=DecimalField()),
        total_expense=Coalesce(Sum('amount', filter=Q(transaction_type='EXPENSE')), Value(0), output_field=DecimalField()),
        
        # 수입 상세
        income_card=Coalesce(Sum('amount', filter=Q(transaction_type='INCOME', payment_method='CARD')), Value(0), output_field=DecimalField()),
        income_cash=Coalesce(Sum('amount', filter=Q(transaction_type='INCOME', payment_method='CASH')), Value(0), output_field=DecimalField()),
        income_transfer=Coalesce(Sum('amount', filter=Q(transaction_type='INCOME', payment_method='TRANSFER')), Value(0), output_field=DecimalField()),

        # 지출 상세
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

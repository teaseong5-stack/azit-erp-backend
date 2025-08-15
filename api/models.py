from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone # timezone import 추가

class Customer(models.Model):
    name = models.CharField("고객명", max_length=100)
    phone_number = models.CharField("연락처", max_length=20)
    email = models.EmailField("이메일", blank=True)
    def __str__(self): return self.name

class Partner(models.Model):
    CATEGORY_CHOICES = [('HOTEL', '호텔'), ('AIRLINE', '항공사'), ('RENTAL', '렌터카'), ('RESTAURANT', '식당'), ('AGENCY', '현지 에이전시'), ('OTHER', '기타')]
    name = models.CharField("업체명", max_length=100)
    category = models.CharField("업체 종류", max_length=20, choices=CATEGORY_CHOICES)
    contact_person = models.CharField("담당자", max_length=50, blank=True)
    phone_number = models.CharField("연락처", max_length=50, blank=True)
    email = models.EmailField("이메일", blank=True)
    address = models.CharField("주소", max_length=255, blank=True)
    notes = models.TextField("메모", blank=True)
    def __str__(self): return self.name

class Reservation(models.Model):
    STATUS_CHOICES = [('PENDING', '상담중'), ('CONFIRMED', '예약확정'), ('PAID', '잔금완료'), ('COMPLETED', '여행완료'), ('CANCELED', '취소')]
    CATEGORY_CHOICES = [('TOUR', '투어'), ('RENTAL_CAR', '렌터카'), ('ACCOMMODATION', '숙박'), ('GOLF', '골프'), ('TICKET', '티켓'), ('OTHER', '기타')]
    PAYMENT_STATUS_CHOICES = [ # 결제 현황 선택지 추가
        ('UNPAID', '미결제'),
        ('DEPOSIT', '예약금 입금'),
        ('PAID', '결제완료'),
    ]

    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="고객")
    manager = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="담당자")
    tour_name = models.CharField("상품명", max_length=200)
    
    # reservation_date 필드 수정
    reservation_date = models.DateField("예약일", default=timezone.now)
    
    total_price = models.DecimalField("판매가", max_digits=10, decimal_places=0, default=0)
    total_cost = models.DecimalField("원가", max_digits=10, decimal_places=0, default=0)
    
    # payment_amount 필드 추가
    payment_amount = models.DecimalField("결제금액", max_digits=10, decimal_places=0, default=0)
    
    status = models.CharField("예약 상태", max_length=10, choices=STATUS_CHOICES, default='PENDING')
    
    # payment_status 필드 추가
    payment_status = models.CharField("결제 현황", max_length=20, choices=PAYMENT_STATUS_CHOICES, default='UNPAID')
    
    start_date = models.DateField("시작일", null=True, blank=True)
    end_date = models.DateField("종료일", null=True, blank=True)
    notes = models.TextField("내부 메모", blank=True)
    requests = models.TextField("요청사항", blank=True)
    
    # special_notes 필드 추가 (특이사항)
    special_notes = models.TextField("특이사항", blank=True)

    category = models.CharField("카테고리", max_length=20, choices=CATEGORY_CHOICES, default='TOUR')
    details = models.JSONField("상세 정보", default=dict, blank=True)
    def __str__(self): return f"[{self.get_category_display()}] {self.tour_name} - {self.customer.name if self.customer else '삭제된 고객'}"

class Transaction(models.Model):
    # ... (기존 Transaction 모델은 동일) ...
    TRANSACTION_TYPE_CHOICES = [('INCOME', '수입'), ('EXPENSE', '지출')]
    EXPENSE_ITEM_CHOICES = [('RENTAL_CAR', '렌터카'), ('ACCOMMODATION', '숙박'), ('GOLF', '골프'), ('CASH', '시제'), ('DEPOSIT', '예약금'), ('PURCHASE', '매입'), ('PARTNER', '제휴업체'), ('TICKET', '티켓'), ('GUIDE', '가이드'), ('MISC', '잡비'), ('OTHER', '기타')]
    PAYMENT_METHOD_CHOICES = [('CARD', '카드'), ('CASH', '현금'), ('TRANSFER', '계좌이체')]
    PROCESSING_STATUS_CHOICES = [('PENDING', '처리중'), ('COMPLETED', '완료'), ('HOLD', '보류')]

    transaction_date = models.DateField("거래일")
    transaction_type = models.CharField("거래 종류", max_length=10, choices=TRANSACTION_TYPE_CHOICES)
    amount = models.DecimalField("금액", max_digits=10, decimal_places=0)
    description = models.CharField("내용", max_length=255)
    expense_item = models.CharField("지출항목", max_length=20, choices=EXPENSE_ITEM_CHOICES, null=True, blank=True)
    payment_method = models.CharField("결제방법", max_length=10, choices=PAYMENT_METHOD_CHOICES, null=True, blank=True)
    processing_status = models.CharField("처리현황", max_length=10, choices=PROCESSING_STATUS_CHOICES, default='PENDING')
    reservation = models.ForeignKey(Reservation, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="관련 예약")
    partner = models.ForeignKey(Partner, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="관련 제휴업체")
    manager = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="담당자")
    notes = models.TextField("메모", blank=True)
    def __str__(self): return f"[{self.transaction_date}] {self.description} - {self.amount}"

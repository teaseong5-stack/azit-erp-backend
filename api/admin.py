from django.contrib import admin
from .models import Customer, Reservation, Partner, Transaction

# 관리자 페이지에 모델들을 등록합니다.
admin.site.register(Customer)
admin.site.register(Reservation)
admin.site.register(Partner)
# 누락되었던 Transaction 모델을 추가로 등록합니다.
admin.site.register(Transaction)

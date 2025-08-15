from django.contrib import admin
from .models import Customer, Reservation # models.py에서 Customer와 Reservation을 가져옴

# 관리자 페이지에 Customer와 Reservation 모델을 등록
admin.site.register(Customer)
admin.site.register(Reservation)
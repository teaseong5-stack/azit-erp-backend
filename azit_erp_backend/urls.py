from django.contrib import admin
from django.urls import path, include

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # /api/ 로 시작하는 모든 주소는 api 폴더의 urls.py 파일이 처리하도록 위임
    path('api/', include('api.urls')),

    # 토큰 발급 및 갱신을 위한 주소
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]

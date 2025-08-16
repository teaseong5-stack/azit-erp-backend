#!/usr/bin/env bash
set -o errexit

# 1. 의존성 패키지 설치
pip install -r requirements.txt

# 2. Django 관리 명령어 실행
python manage.py collectstatic --no-input
python manage.py migrate

# 3. 서버 시작 (이 줄이 추가되었습니다)
gunicorn azit_erp_backend.wsgi:application
#!/usr/bin/env bash
set -o errexit

# 1. 의존성 패키지 설치
pip install -r requirements.txt

# 2. Django 관리 명령어 실행
python manage.py collectstatic --no-input
python manage.py migrate

# 3. 서버 시작 (python -m 을 추가하여 수정)
python -m gunicorn azit_erp_backend.wsgi:application
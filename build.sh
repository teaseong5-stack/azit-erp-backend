#!/usr/bin/env bash
set -o errexit

# 1. 의존성 패키지 설치
pip install -r requirements.txt

# 2. Django 관리 명령어 실행
python manage.py collectstatic --no-input
python manage.py migrate

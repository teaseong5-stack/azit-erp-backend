from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings

def send_confirmation_email(reservation):
    """
    예약 확정 이메일을 고객에게 발송합니다.
    """
    if not reservation.customer or not reservation.customer.email:
        return

    customer = reservation.customer
    subject = f"[아지트 ERP] {customer.name}님의 '{reservation.tour_name}' 예약이 확정되었습니다."
    
    context = {
        'reservation': reservation,
        'customer_name': customer.name,
    }
    
    html_message = render_to_string('api/confirmation_email.html', context)
    plain_message = f"{customer.name}님의 예약({reservation.tour_name})이 확정되었습니다."

    try:
        send_mail(
            subject,
            plain_message,
            settings.DEFAULT_FROM_EMAIL,
            [customer.email],
            html_message=html_message,
            fail_silently=False,
        )
        print(f"Confirmation email sent to {customer.email} for reservation ID {reservation.id}")
    except Exception as e:
        print(f"Error sending confirmation email for reservation ID {reservation.id}: {e}")

document.addEventListener("DOMContentLoaded", function() {
    // 캘린더 요소가 없는 페이지에서는 스크립트를 실행하지 않습니다.
    if (!document.getElementById('calendar')) return;

    const calendarEl = document.getElementById('calendar');
    const detailModal = new bootstrap.Modal(document.getElementById('reservationDetailModal'));
    const modalBodyContent = document.getElementById('modal-body-content');
    
    let calendar = null;
    let allReservations = []; // 전체 예약 데이터만 저장합니다.

    const categoryLabels = { 'TOUR': '투어', 'RENTAL_CAR': '렌터카', 'ACCOMMODATION': '숙박', 'GOLF': '골프', 'TICKET': '티켓', 'OTHER': '기타' };
    const categoryColors = {
        'TOUR': 'rgba(54, 162, 235, 0.8)', 'RENTAL_CAR': 'rgba(75, 192, 192, 0.8)',
        'ACCOMMODATION': 'rgba(255, 99, 132, 0.8)', 'GOLF': 'rgba(153, 102, 255, 0.8)',
        'TICKET': 'rgba(255, 159, 64, 0.8)', 'OTHER': 'rgba(108, 117, 125, 0.8)'
    };

    /**
     * [복원] 간단한 이벤트 형식으로 데이터를 변환합니다.
     */
    function formatEvents(reservations) {
        return reservations.map(res => {
            let endDate = res.end_date;
            if (endDate) {
                const date = new Date(endDate);
                date.setDate(date.getDate() + 1);
                endDate = date.toISOString().split('T')[0];
            }
            const customerName = res.customer ? res.customer.name : '고객 미지정';
            const categoryLabel = categoryLabels[res.category] || res.category;
            return {
                id: res.id,
                title: `[${categoryLabel}] ${customerName} | ${res.tour_name}`,
                start: res.start_date,
                end: endDate,
                backgroundColor: categoryColors[res.category] || '#6c757d',
                borderColor: categoryColors[res.category] || '#6c757d'
            };
        });
    }

    /**
     * [복원] 기본 FullCalendar를 초기화하고 렌더링합니다.
     */
    function initializeCalendar(events) {
        if (calendar) {
            calendar.destroy();
        }

        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth', // 기본 월별 보기
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,listWeek' // 기본 보기 옵션
            },
            events: events,
            locale: 'ko',
            height: '80vh',
            eventClick: function(info) {
                const reservationId = info.event.id;
                const res = allReservations.find(r => r.id == reservationId);
                if (res) {
                    const customerName = res.customer ? res.customer.name : '고객 미지정';
                    const customerPhone = res.customer ? res.customer.phone_number : '정보 없음';
                    let detailsHtml = `
                        <h5>${res.tour_name}</h5>
                        <p><strong>고객:</strong> ${customerName} (${customerPhone})</p>
                        <p><strong>담당자:</strong> ${res.manager ? res.manager.username : '미지정'}</p>
                        <p><strong>기간:</strong> ${res.start_date || ''} ~ ${res.end_date || ''}</p>
                        <hr>
                        <p><strong>판매가:</strong> ${Number(res.total_price).toLocaleString()} VND</p>
                        <p><strong>원가:</strong> ${Number(res.total_cost).toLocaleString()} VND</p>
                        <hr>
                        <h6>요청사항</h6>
                        <p class="bg-light p-2 rounded">${res.requests || '없음'}</p>
                    `;
                    modalBodyContent.innerHTML = detailsHtml;
                    detailModal.show();
                }
            }
        });

        calendar.render();
    }

    // 페이지 초기화 함수
    async function initializePage() {
        const reservationResponse = await window.apiFetch('reservations/all/');

        if (reservationResponse && reservationResponse.results) {
            allReservations = reservationResponse.results;
            const events = formatEvents(allReservations);
            initializeCalendar(events);
        }
    }

    initializePage();
});

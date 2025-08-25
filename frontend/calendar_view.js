document.addEventListener("DOMContentLoaded", function() {
    if (!document.getElementById('calendar')) return;

    const calendarEl = document.getElementById('calendar');
    const detailModal = new bootstrap.Modal(document.getElementById('reservationDetailModal'));
    const modalBodyContent = document.getElementById('modal-body-content');
    let calendar = null;

    const categoryLabels = { 'TOUR': '투어', 'RENTAL_CAR': '렌터카', 'ACCOMMODATION': '숙박', 'GOLF': '골프', 'TICKET': '티켓', 'OTHER': '기타' };
    const categoryColors = {
        'TOUR': 'rgba(54, 162, 235, 0.8)', 'RENTAL_CAR': 'rgba(75, 192, 192, 0.8)',
        'ACCOMMODATION': 'rgba(255, 99, 132, 0.8)', 'GOLF': 'rgba(153, 102, 255, 0.8)',
        'TICKET': 'rgba(255, 159, 64, 0.8)', 'OTHER': 'rgba(108, 117, 125, 0.8)'
    };

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

    window.apiFetch('reservations/all/').then(response => {
        if(response && response.results) {
            const reservations = response.results;
            const events = formatEvents(reservations);
            
            if (calendar) calendar.destroy();
            calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,listWeek'
                },
                events: events,
                locale: 'ko',
                eventClick: function(info) {
                    // 기존 dashboard.js의 eventClick 로직과 동일하게 구현
                }
            });
            calendar.render();
        }
    });
});

document.addEventListener("DOMContentLoaded", function() {
    // 캘린더 요소가 없는 페이지에서는 스크립트를 실행하지 않습니다.
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
                    // [수정] 누락되었던 상세 정보 팝업 로직을 여기에 다시 추가합니다.
                    const reservationId = info.event.id;
                    const res = reservations.find(r => r.id == reservationId);
                    if (res) {
                        const customerName = res.customer ? res.customer.name : '고객 미지정';
                        const customerPhone = res.customer ? res.customer.phone_number : '정보 없음';
                        let detailsHtml = `
                            <div class="row">
                                <div class="col-md-6">
                                    <h5>${res.tour_name} <span class="badge" style="background-color: ${categoryColors[res.category] || '#6c757d'}">${categoryLabels[res.category]}</span></h5>
                                    <p class="text-muted">예약 ID: ${res.id} | 예약일: ${res.reservation_date}</p>
                                </div>
                                <div class="col-md-6 text-md-end">
                                    <p><strong>담당자:</strong> ${res.manager.username}</p>
                                    <p><strong>고객:</strong> ${customerName} (${customerPhone})</p>
                                </div>
                            </div>
                            <hr>
                        `;
                        let categoryDetails = '<div class="row">';
                        switch (res.category) {
                            case 'TOUR':
                                categoryDetails += `<div class="col-md-6"><p><strong>출발일:</strong> ${res.start_date} ${res.details.startTime || ''}</p></div><div class="col-md-6"><p><strong>인원:</strong> 성인 ${res.details.adults}, 아동 ${res.details.children}, 유아 ${res.details.infants}</p></div><div class="col-md-6"><p><strong>픽업:</strong> ${res.details.pickupLocation || 'N/A'}</p></div><div class="col-md-6"><p><strong>샌딩:</strong> ${res.details.dropoffLocation || 'N/A'}</p></div>`;
                                break;
                            case 'RENTAL_CAR':
                                categoryDetails += `<div class="col-md-6"><p><strong>차량:</strong> ${res.details.carType}</p></div><div class="col-md-6"><p><strong>이용시간:</strong> ${res.details.usageHours}</p></div><div class="col-md-6"><p><strong>픽업일시:</strong> ${res.details.pickupDateTime ? res.details.pickupDateTime.replace('T', ' ') : 'N/A'}</p></div><div class="col-md-6"><p><strong>장소:</strong> ${res.details.location || 'N/A'}</p></div><div class="col-md-12"><p><strong>옵션:</strong> 인원 ${res.details.passengers}, 캐리어 ${res.details.carriers}, 카시트 ${res.details.carSeats}, 유모차 ${res.details.strollers}</p></div>`;
                                break;
                            case 'ACCOMMODATION':
                                categoryDetails += `<div class="col-md-6"><p><strong>체크인:</strong> ${res.start_date}</p></div><div class="col-md-6"><p><strong>체크아웃:</strong> ${res.end_date}</p></div><div class="col-md-4"><p><strong>방 종류:</strong> ${res.details.roomType || 'N/A'}</p></div><div class="col-md-4"><p><strong>룸 수량:</strong> ${res.details.roomCount}</p></div><div class="col-md-4"><p><strong>인원수:</strong> ${res.details.guests}</p></div>`;
                                break;
                            case 'GOLF':
                                categoryDetails += `<div class="col-md-6"><p><strong>티오프:</strong> ${res.start_date} ${res.details.teeOffTime || ''}</p></div><div class="col-md-6"><p><strong>인원:</strong> ${res.details.players}명, ${res.details.rounds}홀</p></div>`;
                                break;
                            case 'TICKET':
                                 categoryDetails += `<div class="col-md-6"><p><strong>사용일:</strong> ${res.start_date} ${res.details.usageTime || ''}</p></div><div class="col-md-6"><p><strong>인원:</strong> 성인 ${res.details.adults}, 아동 ${res.details.children}, 유아 ${res.details.infants}</p></div>`;
                                break;
                            default:
                                categoryDetails += `<div class="col-12"><p>상세 정보가 없습니다.</p></div>`;
                        }
                        categoryDetails += '</div><hr>';
                        detailsHtml += categoryDetails;
                        detailsHtml += `
                            <div class="row">
                                <div class="col-md-4"><p><strong>판매가:</strong> ${Number(res.total_price).toLocaleString()} VND</p></div>
                                <div class="col-md-4"><p><strong>원가:</strong> ${Number(res.total_cost).toLocaleString()} VND</p></div>
                                <div class="col-md-4"><p><strong>결제 금액:</strong> ${Number(res.payment_amount).toLocaleString()} VND</p></div>
                            </div>
                            <hr>
                            <h6>요청사항</h6>
                            <p class="bg-light p-2 rounded">${res.requests || '없음'}</p>
                            <h6>내부 메모</h6>
                            <p class="bg-light p-2 rounded">${res.notes || '없음'}</p>
                        `;
                        modalBodyContent.innerHTML = detailsHtml;
                        detailModal.show();
                    }
                }
            });
            calendar.render();
        }
    });
});

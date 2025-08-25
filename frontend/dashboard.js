document.addEventListener("DOMContentLoaded", function() {
    // dashboard.html 페이지에 있을 때만 이 코드를 실행합니다.
    if (!document.getElementById('calendar')) return;

    const calendarEl = document.getElementById('calendar');
    const categorySalesCards = document.getElementById('category-sales-cards');
    const categoryPieChartCanvas = document.getElementById('categoryPieChart');
    const managerBarChartCanvas = document.getElementById('managerBarChart');
    const monthlySalesChartCanvas = document.getElementById('monthlySalesChart');
    const detailModal = new bootstrap.Modal(document.getElementById('reservationDetailModal'));
    const modalBodyContent = document.getElementById('modal-body-content');
    let categoryPieChart = null;
    let managerBarChart = null;
    let monthlySalesChart = null;
    let calendar = null;

    const categoryLabels = { 'TOUR': '투어', 'RENTAL_CAR': '렌터카', 'ACCOMMODATION': '숙박', 'GOLF': '골프', 'TICKET': '티켓', 'OTHER': '기타' };
    const categoryColors = {
        'TOUR': 'rgba(54, 162, 235, 0.8)', 'RENTAL_CAR': 'rgba(75, 192, 192, 0.8)',
        'ACCOMMODATION': 'rgba(255, 99, 132, 0.8)', 'GOLF': 'rgba(153, 102, 255, 0.8)',
        'TICKET': 'rgba(255, 159, 64, 0.8)', 'OTHER': 'rgba(108, 117, 125, 0.8)'
    };
    const categoryIcons = {
        'TOUR': 'bi-compass', 'RENTAL_CAR': 'bi-car-front-fill', 'ACCOMMODATION': 'bi-building',
        'GOLF': 'bi-flag-fill', 'TICKET': 'bi-ticket-perforated-fill', 'OTHER': 'bi-star-fill'
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
            return {
                id: res.id,
                title: `[${customerName}] ${res.tour_name}`,
                start: res.start_date,
                end: endDate,
                backgroundColor: categoryColors[res.category] || '#6c757d',
                borderColor: categoryColors[res.category] || '#6c757d',
                extendedProps: { category: res.category }
            };
        });
    }

    function initializeCalendar(events, allReservations) {
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
            eventTimeFormat: { hour: '2-digit', minute: '2-digit', meridiem: false },
            eventContent: function(info) {
                const category = info.event.extendedProps.category;
                const iconClass = categoryIcons[category] || 'bi-star-fill';
                const container = document.createElement('div');
                container.innerHTML = `<i class="bi ${iconClass} me-2"></i>${info.event.title}`;
                return { domNodes: [container] };
            },
            eventClick: function(info) {
                const reservationId = info.event.id;
                const res = allReservations.find(r => r.id == reservationId);
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

    function updateCategorySalesCards(reservations) {
        const categorySales = {};
        const activeReservations = reservations.filter(res => res.status !== 'CANCELED');
        activeReservations.forEach(res => {
            categorySales[res.category] = (categorySales[res.category] || 0) + Number(res.total_price);
        });
        categorySalesCards.innerHTML = '';
        if (Object.keys(categorySales).length === 0) {
            categorySalesCards.innerHTML = '<p class="text-muted">표시할 매출 데이터가 없습니다.</p>';
            return;
        }
        for (const category in categorySales) {
            const cardHtml = `<div class="col-md-4 col-lg-2 mb-3"><div class="card text-white" style="background-color: ${categoryColors[category] || '#6c757d'}"><div class="card-body"><h6 class="card-title">${categoryLabels[category] || category}</h6><p class="card-text fs-5">${categorySales[category].toLocaleString()} VND</p></div></div></div>`;
            categorySalesCards.innerHTML += cardHtml;
        }
    }

    function createCategoryPieChart(reservations) {
        const ctx = categoryPieChartCanvas.getContext('2d');
        const categorySales = {};
        const activeReservations = reservations.filter(res => res.status !== 'CANCELED');
        activeReservations.forEach(res => {
            categorySales[res.category] = (categorySales[res.category] || 0) + Number(res.total_price);
        });
        if (categoryPieChart) categoryPieChart.destroy();
        categoryPieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(categorySales).map(key => categoryLabels[key]),
                datasets: [{
                    data: Object.values(categorySales),
                    backgroundColor: Object.keys(categorySales).map(key => categoryColors[key])
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function createManagerBarChart(reservations) {
        const ctx = managerBarChartCanvas.getContext('2d');
        const managerCounts = {};
        const activeReservations = reservations.filter(res => res.status !== 'CANCELED');
        activeReservations.forEach(res => {
            const managerName = res.manager ? res.manager.username : '미지정';
            managerCounts[managerName] = (managerCounts[managerName] || 0) + 1;
        });
        if (managerBarChart) managerBarChart.destroy();
        managerBarChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(managerCounts),
                datasets: [{
                    label: '담당자별 예약 처리 건수',
                    data: Object.values(managerCounts),
                    backgroundColor: ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1', '#fd7e14']
                }]
            },
            options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, responsive: true, maintainAspectRatio: false }
        });
    }

    function createMonthlySalesChart(reservations) {
        const ctx = monthlySalesChartCanvas.getContext('2d');
        const monthlySales = {};
        const activeReservations = reservations.filter(res => res.status !== 'CANCELED' && res.start_date);
        activeReservations.forEach(res => {
            const month = res.start_date.substring(0, 7);
            monthlySales[month] = (monthlySales[month] || 0) + Number(res.total_price);
        });
        const sortedMonths = Object.keys(monthlySales).sort();
        if (monthlySalesChart) monthlySalesChart.destroy();
        monthlySalesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedMonths,
                datasets: [{
                    label: '월별 매출액',
                    data: sortedMonths.map(month => monthlySales[month]),
                    fill: false,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: { scales: { y: { beginAtZero: true } }, responsive: true, maintainAspectRatio: false }
        });
    }
    
    // [수정] 페이지네이션을 사용하지 않고 모든 데이터를 가져오도록 API를 호출합니다.
    window.apiFetch('reservations?page_size=10000').then(response => {
        if(response && response.results) {
            const reservations = response.results;
            
            const events = formatEvents(reservations);
            initializeCalendar(events, reservations);
            updateCategorySalesCards(reservations);
            createCategoryPieChart(reservations);
            createManagerBarChart(reservations);
            createMonthlySalesChart(reservations);
        }
    });
});

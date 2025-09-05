document.addEventListener("DOMContentLoaded", function() {
    // 캘린더 요소가 없는 페이지에서는 스크립트를 실행하지 않습니다.
    if (!document.getElementById('calendar')) return;

    const calendarEl = document.getElementById('calendar');
    const detailModal = new bootstrap.Modal(document.getElementById('reservationDetailModal'));
    const modalBodyContent = document.getElementById('modal-body-content');
    const resourceFilter = document.getElementById('resource-filter');
    
    let calendar = null;
    let allReservations = []; // 전체 예약 데이터를 저장할 배열
    let allUsers = []; // 전체 사용자(담당자) 데이터를 저장할 배열

    const categoryResources = [
        { id: 'TOUR', title: '투어' },
        { id: 'RENTAL_CAR', title: '렌터카' },
        { id: 'ACCOMMODATION', title: '숙박' },
        { id: 'GOLF', title: '골프' },
        { id: 'TICKET', title: '티켓' },
        { id: 'OTHER', title: '기타' }
    ];

    const categoryColors = {
        'TOUR': '#0d6efd', 'RENTAL_CAR': '#198754',
        'ACCOMMODATION': '#dc3545', 'GOLF': '#6f42c1',
        'TICKET': '#fd7e14', 'OTHER': '#6c757d'
    };

    /**
     * 예약 데이터를 FullCalendar 이벤트 형식으로 변환하는 함수
     * @param {string} groupBy - 리소스 그룹 기준 ('manager' 또는 'category')
     */
    function formatEvents(groupBy) {
        return allReservations.map(res => {
            let endDate = res.end_date;
            if (endDate) {
                const date = new Date(endDate);
                date.setDate(date.getDate() + 1);
                endDate = date.toISOString().split('T')[0];
            }
            const customerName = res.customer ? res.customer.name : '고객 미지정';
            
            let resourceId;
            if (groupBy === 'manager') {
                resourceId = res.manager ? res.manager.id : 'unassigned';
            } else { // category
                resourceId = res.category;
            }

            return {
                id: res.id,
                resourceId: resourceId,
                title: `${customerName} | ${res.tour_name}`,
                start: res.start_date,
                end: endDate,
                backgroundColor: categoryColors[res.category] || '#6c757d',
                borderColor: categoryColors[res.category] || '#6c757d'
            };
        });
    }

    /**
     * FullCalendar를 초기화하고 렌더링하는 함수
     * @param {string} groupBy - 리소스 그룹 기준 ('manager' 또는 'category')
     */
    function initializeCalendar(groupBy) {
        let resources = [];
        if (groupBy === 'manager') {
            resources = allUsers.map(u => ({ id: u.id, title: u.username }));
            resources.push({ id: 'unassigned', title: '미지정' }); // 담당자 없는 경우
        } else { // category
            resources = categoryResources;
        }

        const events = formatEvents(groupBy);

        if (calendar) {
            calendar.destroy();
        }

        calendar = new FullCalendar.Calendar(calendarEl, {
            // [수정] schedulerLicenseKey 옵션은 v6의 index.global.min.js에 포함되어 있으므로 제거합니다.
            initialView: 'resourceTimelineMonth', // 초기 뷰 설정
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'resourceTimelineMonth,resourceTimelineWeek,dayGridMonth,listWeek'
            },
            resources: resources,
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

    // 필터 변경 시 캘린더 다시 그리기
    resourceFilter.addEventListener('change', (e) => {
        initializeCalendar(e.target.value);
    });

    // 페이지 초기화 함수
    async function initializePage() {
        // 예약 데이터와 사용자(담당자) 데이터를 병렬로 불러옵니다.
        const [reservationResponse, userResponse] = await Promise.all([
            window.apiFetch('reservations/all/'),
            window.apiFetch('users')
        ]);

        if (reservationResponse && reservationResponse.results) {
            allReservations = reservationResponse.results;
        }
        if (userResponse) {
            allUsers = userResponse;
        }

        // '담당자별 보기'로 초기 캘린더를 렌더링합니다.
        initializeCalendar('manager');
    }

    initializePage();
});

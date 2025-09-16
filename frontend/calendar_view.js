document.addEventListener("DOMContentLoaded", function() {
    // 캘린더 요소가 없는 페이지에서는 스크립트를 실행하지 않습니다.
    if (!document.getElementById('calendar')) return;

    // --- 1. 요소 및 전역 변수 선언 ---
    const calendarEl = document.getElementById('calendar');
    const resourceFilter = document.getElementById('resource-filter');
    const detailModal = new bootstrap.Modal(document.getElementById('reservationDetailModal'));
    const modalBodyContent = document.getElementById('modal-body-content');
    
    let calendar = null;
    let allReservations = [];
    let allUsers = [];

    const categoryResources = [
        { id: 'TOUR', title: '투어' },
        { id: 'RENTAL_CAR', title: '렌터카' },
        { id: 'ACCOMMODATION', title: '숙박' },
        { id: 'GOLF', title: '골프' },
        { id: 'TICKET', title: '티켓' },
        { id: 'OTHER', title: '기타' }
    ];
    const categoryColors = {
        'TOUR': '#0d6efd', 'RENTAL_CAR': '#198754', 'ACCOMMODATION': '#dc3545',
        'GOLF': '#6f42c1', 'TICKET': '#fd7e14', 'OTHER': '#6c757d'
    };

    // --- 2. 데이터 변환 함수 ---

    /**
     * [신규] 리소스 타임라인 뷰에 맞는 이벤트 형식으로 데이터를 변환합니다.
     * @param {Array} reservations - 예약 데이터 배열
     * @param {String} groupKey - 그룹화 기준 ('manager' 또는 'category')
     */
    function formatEventsForTimeline(reservations, groupKey) {
        return reservations.map(res => {
            let resourceId;
            if (groupKey === 'manager') {
                resourceId = res.manager ? `manager_${res.manager.id}` : 'manager_null';
            } else {
                resourceId = res.category;
            }
            
            // FullCalendar는 end 날짜를 exclusive하게 취급하므로, 하루를 더해줍니다.
            let endDate = res.end_date;
            if (endDate) {
                const date = new Date(endDate);
                date.setDate(date.getDate() + 1);
                endDate = date.toISOString().split('T')[0];
            }

            return {
                id: res.id,
                resourceId: resourceId,
                title: `${res.customer ? res.customer.name : ''} | ${res.tour_name}`,
                start: res.start_date,
                end: endDate,
                backgroundColor: categoryColors[res.category] || '#6c757d',
                borderColor: categoryColors[res.category] || '#6c757d',
                extendedProps: {
                    reservation: res // 원본 데이터를 저장하여 툴팁/모달에서 사용
                }
            };
        });
    }

    /**
     * [신규] 사용자와 카테고리 데이터를 FullCalendar 리소스 형식으로 변환합니다.
     * @param {String} groupKey - 그룹화 기준 ('manager' 또는 'category')
     */
    function getResources(groupKey) {
        if (groupKey === 'manager') {
            const managerResources = allUsers.map(user => ({
                id: `manager_${user.id}`,
                title: user.username
            }));
            // 담당자 미지정 그룹 추가
            managerResources.push({ id: 'manager_null', title: '미지정' });
            return managerResources;
        } else {
            return categoryResources;
        }
    }

    // --- 3. 캘린더 렌더링 함수 ---

    /**
     * [수정] 리소스 타임라인 뷰를 포함하여 FullCalendar를 초기화하고 렌더링합니다.
     * @param {Array} resources - 리소스 데이터 (담당자 또는 카테고리)
     * @param {Array} events - 변환된 예약 이벤트 데이터
     */
    function initializeCalendar(resources, events) {
        if (calendar) {
            calendar.destroy();
        }

        calendar = new FullCalendar.Calendar(calendarEl, {
            // 프리미엄 플러그인 활성화
            schedulerLicenseKey: 'GPL-My-Project-Is-Open-Source',
            initialView: 'resourceTimelineMonth',
            aspectRatio: 1.5,
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'resourceTimelineDay,resourceTimelineWeek,resourceTimelineMonth'
            },
            locale: 'ko',
            editable: false, // 드래그 수정 방지
            resources: resources,
            events: events,

            // [신규] 마우스 오버 시 툴팁 표시
            eventMouseEnter: function(info) {
                const res = info.event.extendedProps.reservation;
                const tooltipContent = `
                    <strong>${res.tour_name}</strong><br>
                    고객: ${res.customer ? res.customer.name : '미지정'}<br>
                    담당: ${res.manager ? res.manager.username : '미지정'}<br>
                    기간: ${res.start_date || ''} ~ ${res.end_date || ''}
                `;
                // Tippy.js를 사용하여 툴팁 생성
                if (!info.el._tippy) {
                    tippy(info.el, {
                        content: tooltipContent,
                        allowHTML: true,
                        placement: 'top',
                        arrow: true,
                    });
                }
                info.el._tippy.show();
            },
            
            // [수정] 클릭 시에는 기존처럼 상세 모달 표시
            eventClick: function(info) {
                const res = info.event.extendedProps.reservation;
                const customerName = res.customer ? res.customer.name : '고객 미지정';
                const customerPhone = res.customer ? res.customer.phone_number : '정보 없음';
                modalBodyContent.innerHTML = `
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
                detailModal.show();
            }
        });

        calendar.render();
    }
    
    // --- 4. 페이지 제어 및 초기화 ---

    /**
     * [신규] 필터 값에 따라 캘린더를 다시 그리는 메인 함수
     */
    async function updateCalendarView() {
        const groupKey = resourceFilter.value;
        const resources = getResources(groupKey);
        const events = formatEventsForTimeline(allReservations, groupKey);
        initializeCalendar(resources, events);
    }
    
    async function initializePage() {
        try {
            // 예약과 사용자 정보를 병렬로 불러옵니다.
            const [reservationResponse, usersResponse] = await Promise.all([
                window.apiFetch('reservations/all/'),
                window.apiFetch('users/')
            ]);
            
            allReservations = reservationResponse.results || [];
            allUsers = usersResponse || [];

            // 필터에 이벤트 리스너 추가
            resourceFilter.addEventListener('change', updateCalendarView);
            
            // 초기 캘린더 렌더링
            updateCalendarView();

        } catch(error) {
            console.error("캘린더 초기화 실패:", error);
            calendarEl.innerHTML = '<p class="text-center text-danger">캘린더 데이터를 불러오는 데 실패했습니다.</p>';
        }
    }

    initializePage();
});

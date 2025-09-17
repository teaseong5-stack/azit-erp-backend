document.addEventListener("DOMContentLoaded", async function() {
    // 캘린더 요소가 없는 페이지에서는 스크립트를 실행하지 않습니다.
    if (!document.getElementById('calendar')) return;

    // --- 1. 요소 및 변수 선언 ---
    const calendarEl = document.getElementById('calendar');
    const groupFilter = document.getElementById('group-filter');
    const detailFilter = document.getElementById('detail-filter');
    const detailModal = new bootstrap.Modal(document.getElementById('reservationDetailModal'));
    const modalBodyContent = document.getElementById('modal-body-content');
    
    let calendar = null;
    let allReservations = []; // 전체 예약 데이터 저장
    let allUsers = []; // 전체 사용자 데이터 저장

    const categoryInfo = {
        'TOUR': { label: '투어', color: '#36a2eb' },
        'RENTAL_CAR': { label: '렌터카', color: '#4bc0c0' },
        'ACCOMMODATION': { label: '숙박', color: '#ff6384' },
        'GOLF': { label: '골프', color: '#9966ff' },
        'TICKET': { label: '티켓', color: '#ff9f40' },
        'OTHER': { label: '기타', color: '#808080' }
    };

    // --- 2. 데이터 처리 및 캘린더 렌더링 함수 ---

    /**
     * 예약 데이터를 FullCalendar의 '이벤트' 형식으로 변환합니다.
     */
    function formatEvents(reservations) {
        return reservations.map(res => {
            // end 날짜는 FullCalendar의 'exclusive' 특성 때문에 하루를 더해줘야 합니다.
            let endDate = res.end_date ? new Date(res.end_date) : new Date(res.start_date);
            endDate.setDate(endDate.getDate() + 1);

            return {
                id: res.id,
                title: `${res.customer ? res.customer.name : ''} | ${res.tour_name}`,
                start: res.start_date,
                end: endDate.toISOString().split('T')[0],
                backgroundColor: categoryInfo[res.category]?.color || categoryInfo['OTHER'].color,
                borderColor: categoryInfo[res.category]?.color || categoryInfo['OTHER'].color,
                extendedProps: { reservation: res } // 원본 데이터를 저장하여 툴팁/모달에서 사용
            };
        });
    }

    /**
     * 필터 조건에 따라 캘린더 이벤트를 업데이트합니다.
     */
    function filterAndRenderEvents() {
        const groupValue = groupFilter.value;
        const detailValue = detailFilter.value;

        let filteredReservations = allReservations;

        // 상세 필터 값이 있을 경우에만 필터링 수행
        if (groupValue === 'manager' && detailValue) {
            filteredReservations = allReservations.filter(res => 
                (res.manager ? String(res.manager.id) : 'unassigned') === detailValue
            );
        } else if (groupValue === 'category' && detailValue) {
            filteredReservations = allReservations.filter(res => res.category === detailValue);
        }

        calendar.removeAllEvents();
        calendar.addEventSource(formatEvents(filteredReservations));
    }
    
    /**
     * 상세 필터 드롭다운을 채우고 표시 상태를 조절합니다.
     */
    function updateDetailFilter() {
        const groupValue = groupFilter.value;
        
        if (groupValue === 'all') {
            detailFilter.style.display = 'none';
            detailFilter.value = '';
        } else {
            detailFilter.style.display = 'block';
            let optionsHtml = '<option value="">-- 전체 --</option>';
            if (groupValue === 'manager') {
                allUsers.forEach(user => {
                    optionsHtml += `<option value="${user.id}">${user.username}</option>`;
                });
                optionsHtml += `<option value="unassigned">담당자 미지정</option>`;
            } else { // category
                Object.entries(categoryInfo).forEach(([key, value]) => {
                    optionsHtml += `<option value="${key}">${value.label}</option>`;
                });
            }
            detailFilter.innerHTML = optionsHtml;
        }
        filterAndRenderEvents(); // 그룹 기준 변경 시에도 필터링 즉시 적용
    }

    // --- 3. 캘린더 초기화 ---

    function initializeCalendar() {
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,listWeek'
            },
            locale: 'ko',
            height: 'auto', // 부모 요소 높이에 맞춤
            editable: false,
            
            // 마우스 오버 시 툴팁 표시
            eventMouseEnter: function(info) {
                const res = info.event.extendedProps.reservation;
                const content = `
                    <strong>${res.tour_name}</strong><br>
                    고객: ${res.customer ? res.customer.name : 'N/A'}<br>
                    담당자: ${res.manager ? res.manager.username : '미지정'}<br>
                    상태: ${res.status_display}
                `;
                // Tippy.js 인스턴스를 요소에 저장하여 중복 생성을 방지
                if (!info.el._tippy) {
                    info.el._tippy = tippy(info.el, { 
                        content, 
                        allowHTML: true,
                        placement: 'top',
                        animation: 'scale-subtle',
                    });
                }
                info.el._tippy.show();
            },
            eventMouseLeave: function(info) {
                if (info.el._tippy) {
                    info.el._tippy.hide(); // 즉시 숨김
                }
            },
            // 이벤트 클릭 시 상세 모달 표시
            eventClick: function(info) {
                const res = info.event.extendedProps.reservation;
                if (res) {
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
            }
        });
        calendar.render();
    }

    // --- 4. 페이지 초기화 및 이벤트 리스너 ---

    async function initializePage() {
        initializeCalendar();
        try {
            // 예약 정보와 사용자 정보를 동시에 병렬로 불러옵니다.
            const [reservationResponse, usersResponse] = await Promise.all([
                window.apiFetch('reservations/all/'),
                window.apiFetch('users')
            ]);
            
            allReservations = reservationResponse?.results || [];
            allUsers = usersResponse || [];
            
            filterAndRenderEvents(); // 초기 데이터로 캘린더 채우기
            
        } catch (error) {
            console.error("캘린더 데이터 로딩 실패:", error);
            toast.error("예약 정보를 불러오는 데 실패했습니다.");
        }
    }

    // 필터 변경 시 캘린더 업데이트
    groupFilter.addEventListener('change', updateDetailFilter);
    detailFilter.addEventListener('change', filterAndRenderEvents);

    initializePage();
});
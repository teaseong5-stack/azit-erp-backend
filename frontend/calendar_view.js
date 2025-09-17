document.addEventListener("DOMContentLoaded", async function() {
    // 캘린더 요소가 없는 페이지에서는 스크립트를 실행하지 않습니다.
    if (!document.getElementById('calendar')) return;

    // --- 1. 요소 및 변수 선언 ---
    const calendarEl = document.getElementById('calendar');
    const groupFilter = document.getElementById('group-filter');
    const detailFilter = document.getElementById('detail-filter');
    const detailModal = new bootstrap.Modal(document.getElementById('reservationDetailModal'));
    const modalBodyContent = document.getElementById('modal-body-content');
    const modalTitle = document.querySelector('#reservationDetailModal .modal-title');
    
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
    
    // [추가] 예약 및 결제 상태에 대한 정보 객체
    const statusInfo = { 
        'PENDING': { label: '상담중', color: 'secondary' }, 
        'CONFIRMED': { label: '예약확정', color: 'primary' }, 
        'PAID': { label: '잔금완료', color: 'success' }, 
        'COMPLETED': { label: '여행완료', color: 'dark' }, 
        'CANCELED': { label: '취소', color: 'danger' } 
    };
    const paymentStatusInfo = {
        'UNPAID': { label: '미결제', color: 'danger' },
        'DEPOSIT': { label: '예약금 입금', color: 'info' },
        'PAID': { label: '결제완료', color: 'success' }
    };

    // --- 2. 데이터 처리 및 캘린더 렌더링 함수 ---

    function formatEvents(reservations) {
        return reservations.map(res => {
            let endDate = res.end_date ? new Date(res.end_date) : new Date(res.start_date);
            endDate.setDate(endDate.getDate() + 1);

            return {
                id: res.id,
                title: `${res.customer ? res.customer.name : ''} | ${res.tour_name}`,
                start: res.start_date,
                end: endDate.toISOString().split('T')[0],
                backgroundColor: categoryInfo[res.category]?.color || categoryInfo['OTHER'].color,
                borderColor: categoryInfo[res.category]?.color || categoryInfo['OTHER'].color,
                extendedProps: { reservation: res }
            };
        });
    }

    function filterAndRenderEvents() {
        const groupValue = groupFilter.value;
        const detailValue = detailFilter.value;
        let filteredReservations = allReservations;

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
        filterAndRenderEvents();
    }

    function formatReservationDetails(details) {
        if (!details || Object.keys(details).length === 0) {
            return '<p class="text-muted">추가 상세 정보 없음</p>';
        }
        const detailLabels = {
            adults: '성인', children: '아동', infants: '유아',
            startTime: '시작 시간', pickupLocation: '픽업 장소', dropoffLocation: '샌딩 장소',
            carType: '차량 종류', usageHours: '이용 시간',
            roomType: '방 종류', nights: '숙박일수', roomCount: '룸 수량', guests: '총 인원',
            teeOffTime: '티오프', players: '플레이어 수',
            usageTime: '이용 시간'
        };
        let html = '<ul class="list-group list-group-flush">';
        for (const [key, value] of Object.entries(details)) {
            if (value) {
                const label = detailLabels[key] || key;
                html += `<li class="list-group-item d-flex justify-content-between align-items-center ps-0">
                            ${label}
                            <span class="badge bg-secondary rounded-pill">${value}</span>
                         </li>`;
            }
        }
        html += '</ul>';
        return html;
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
            height: 'auto',
            editable: false,
            
            eventMouseEnter: function(info) {
                const res = info.event.extendedProps.reservation;
                const content = `
                    <strong>${res.tour_name}</strong><br>
                    고객: ${res.customer ? res.customer.name : 'N/A'}<br>
                    담당자: ${res.manager ? res.manager.username : '미지정'}<br>
                    상태: ${statusInfo[res.status]?.label || res.status}
                `;
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
                if (info.el._tippy) info.el._tippy.hide();
            },
            
            /**
             * [수정] payment_status와 special_notes를 포함하여 모달 내용을 최종 강화합니다.
             */
            eventClick: function(info) {
                const res = info.event.extendedProps.reservation;
                if (res) {
                    const customerName = res.customer ? res.customer.name : '고객 미지정';
                    const customerPhone = res.customer ? res.customer.phone_number : '정보 없음';
                    const currentStatus = statusInfo[res.status] || { label: res.status, color: 'secondary' };
                    const currentPaymentStatus = paymentStatusInfo[res.payment_status] || { label: res.payment_status, color: 'secondary' };

                    modalTitle.innerHTML = `[${res.id}] ${res.tour_name}`;

                    modalBodyContent.innerHTML = `
                        <div class="row">
                            <div class="col-md-6">
                                <h5>기본 정보</h5>
                                <ul class="list-unstyled">
                                    <li><strong>고객:</strong> ${customerName} (${customerPhone})</li>
                                    <li><strong>담당자:</strong> ${res.manager ? res.manager.username : '미지정'}</li>
                                    <li><strong>기간:</strong> ${res.start_date || ''} ~ ${res.end_date || ''}</li>
                                    <li><strong>예약일:</strong> ${res.reservation_date || 'N/A'}</li>
                                    <li><strong>예약 상태:</strong> <span class="badge bg-${currentStatus.color}">${currentStatus.label}</span></li>
                                    <li><strong>결제 상태:</strong> <span class="badge bg-${currentPaymentStatus.color}">${currentPaymentStatus.label}</span></li>
                                </ul>
                            </div>
                            <div class="col-md-6">
                                <h5>금액 정보</h5>
                                <ul class="list-unstyled">
                                    <li><strong>판매가:</strong> ${Number(res.total_price).toLocaleString()} VND</li>
                                    <li><strong>원가:</strong> ${Number(res.total_cost).toLocaleString()} VND</li>
                                    <li><strong>결제금액:</strong> ${Number(res.payment_amount).toLocaleString()} VND</li>
                                    <li><strong>마진:</strong> <span class="fw-bold ${res.total_price - res.total_cost >= 0 ? 'text-primary' : 'text-danger'}">${(res.total_price - res.total_cost).toLocaleString()} VND</span></li>
                                </ul>
                            </div>
                        </div>
                        <hr>
                        <h5>카테고리 상세</h5>
                        ${formatReservationDetails(res.details)}
                        <hr>
                        <h6>요청사항 (고객)</h6>
                        <p class="bg-light p-2 rounded small">${res.requests || '없음'}</p>
                        <h6>특이사항</h6>
                        <p class="bg-light p-2 rounded small">${res.special_notes || '없음'}</p>
                        <h6>내부 메모</h6>
                        <p class="bg-light p-2 rounded small">${res.notes || '없음'}</p>
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
            const [reservationResponse, usersResponse] = await Promise.all([
                window.apiFetch('reservations/all/'),
                window.apiFetch('users')
            ]);
            
            allReservations = reservationResponse?.results || [];
            allUsers = usersResponse || [];
            
            filterAndRenderEvents();
            
        } catch (error) {
            console.error("캘린더 데이터 로딩 실패:", error);
            toast.error("예약 정보를 불러오는 데 실패했습니다.");
        }
    }

    groupFilter.addEventListener('change', updateDetailFilter);
    detailFilter.addEventListener('change', filterAndRenderEvents);

    initializePage();
});
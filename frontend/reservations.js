document.addEventListener("DOMContentLoaded", async function() {
    // 해당 페이지가 아닐 경우 스크립트 실행 중단
    if (!document.getElementById('reservation-list-table')) return;

    // --- 1. 전역 변수 및 HTML 요소 선언 ---
    let user = null;
    try {
        user = await window.apiFetch('user-info');
    } catch (error) {
        console.error("사용자 정보 로딩 실패:", error);
        toast.error("사용자 정보를 불러오지 못했습니다. 일부 기능이 제한될 수 있습니다.");
        return;
    }

    const reservationListTable = document.getElementById('reservation-list-table');

    // 모달 요소
    const newReservationModalEl = new bootstrap.Modal(document.getElementById('newReservationModal'));
    const newReservationFormContainer = document.getElementById('new-reservation-form-container');
    const showNewReservationModalButton = document.getElementById('show-new-reservation-modal');
    const reservationModalEl = new bootstrap.Modal(document.getElementById('reservationModal'));
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSaveButton = document.getElementById('modal-save-button');

    // 현황판 필터 요소
    const summaryFilterYear = document.getElementById('summary-filter-year');
    const summaryFilterMonth = document.getElementById('summary-filter-month');
    const summaryFilterStartDate = document.getElementById('summary-filter-start-date');
    const summaryFilterEndDate = document.getElementById('summary-filter-end-date');
    const summaryFilterButton = document.getElementById('summary-filter-button');
    const summaryFilterReset = document.getElementById('summary-filter-reset');

    // 목록 필터 요소
    const filterCategory = document.getElementById('filter-category');
    const filterSearch = document.getElementById('filter-search');
    const filterStartDate = document.getElementById('filter-start-date');
    const filterEndDate = document.getElementById('filter-end-date');
    const filterButton = document.getElementById('filter-button');

    const exportCsvButton = document.getElementById('export-csv-button');
    const prevPageButton = document.getElementById('prev-page-button');
    const nextPageButton = document.getElementById('next-page-button');
    const pageInfo = document.getElementById('page-info');

    // 상태 관리 변수
    let currentPage = 1;
    let totalPages = 1;
    let currentFilters = {};
    let currentSummaryFilters = {};
    let allCustomers = [];
    let allUsers = [];

    // --- 2. 헬퍼(Helper) 및 렌더링 함수 ---

    function getLocalDateString(dateInput) {
        const d = dateInput ? new Date(dateInput) : new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function initializeSummaryFilters() {
        const currentYear = new Date().getFullYear();
        summaryFilterYear.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            const year = currentYear - i;
            summaryFilterYear.innerHTML += `<option value="${year}">${year}년</option>`;
        }
        summaryFilterMonth.innerHTML = '<option value="">-- 전체 월 --</option>';
        for (let i = 1; i <= 12; i++) {
            summaryFilterMonth.innerHTML += `<option value="${i}">${i}월</option>`;
        }
        summaryFilterYear.value = currentYear;
        summaryFilterMonth.value = new Date().getMonth() + 1;
    }

    function getSummaryFiltersFromInputs() {
        const filters = {};
        const startDate = summaryFilterStartDate.value;
        const endDate = summaryFilterEndDate.value;
        if (startDate && endDate) {
            filters.start_date__gte = startDate;
            filters.start_date__lte = endDate;
        } else {
            filters.year = summaryFilterYear.value;
            if (summaryFilterMonth.value) {
                filters.month = summaryFilterMonth.value;
            }
        }
        return filters;
    }

    async function updateCategorySummary(filters = {}) {
        currentSummaryFilters = filters;
        const params = new URLSearchParams({ group_by: 'category', ...filters });
        try {
            const summaryData = await window.apiFetch(`reservations/summary?${params.toString()}`);
            const categorySummaryCards = document.getElementById('category-summary-cards');
            categorySummaryCards.innerHTML = '';

            let totalSales = 0;
            let totalCost = 0;

            if (!summaryData || summaryData.length === 0) {
                categorySummaryCards.innerHTML = '<div class="col"><p class="text-muted text-center">요약 정보가 없습니다.</p></div>';
                return;
            }
            const categoryLabels = { 'TOUR': '투어', 'RENTAL_CAR': '렌터카', 'ACCOMMODATION': '숙박', 'GOLF': '골프', 'TICKET': '티켓', 'OTHER': '기타' };
            
            const salesMap = new Map();
            summaryData.forEach(item => {
                salesMap.set(item.category, { sales: item.sales, cost: item.cost });
                totalSales += Number(item.sales);
                totalCost += Number(item.cost);
            });

            Object.entries(categoryLabels).forEach(([key, label]) => {
                const data = salesMap.get(key) || { sales: 0 };
                categorySummaryCards.innerHTML += `<div class="col"><div class="card"><div class="card-body"><h5 class="card-title">${label}</h5><p class="card-text">${Number(data.sales).toLocaleString()} VND</p></div></div></div>`;
            });

            const totalMargin = totalSales - totalCost;

            categorySummaryCards.innerHTML += `<div class="col"><div class="card bg-dark text-white"><div class="card-body"><h5 class="card-title">총 합계</h5><p class="card-text">${totalSales.toLocaleString()} VND</p></div></div></div>`;
            categorySummaryCards.innerHTML += `<div class="col"><div class="card ${totalMargin >= 0 ? 'bg-primary' : 'bg-danger'} text-white"><div class="card-body"><h5 class="card-title">총 마진</h5><p class="card-text">${totalMargin.toLocaleString()} VND</p></div></div></div>`;

        } catch (error) {
            console.error("카테고리 요약 업데이트 실패:", error);
            toast.error("요약 정보를 불러오는데 실패했습니다.");
        }
    }
    
    /**
     * [수정] 카테고리별 상세 정보 필드 HTML을 요청된 레이아웃에 맞게 반환합니다.
     */
    function getCategoryFields(prefix, category, details = {}) {
        const commonFields = `
            <div class="form-group">
                <label for="${prefix}-adults" class="form-label">성인</label>
                <input type="number" class="form-control" id="${prefix}-adults" value="${details.adults || 0}">
            </div>
            <div class="form-group">
                <label for="${prefix}-children" class="form-label">아동</label>
                <input type="number" class="form-control" id="${prefix}-children" value="${details.children || 0}">
            </div>
            <div class="form-group">
                <label for="${prefix}-infants" class="form-label">유아</label>
                <input type="number" class="form-control" id="${prefix}-infants" value="${details.infants || 0}">
            </div>
        `;
        switch (category) {
            case 'TOUR':
                return `
                    <div class="form-grid form-grid--2-col">
                        <div class="form-group">
                            <label for="${prefix}-pickupLocation" class="form-label">픽업 장소</label>
                            <input type="text" class="form-control" id="${prefix}-pickupLocation" value="${details.pickupLocation || ''}">
                        </div>
                         <div class="form-group">
                            <label for="${prefix}-startTime" class="form-label">시작 시간</label>
                            <input type="time" class="form-control" id="${prefix}-startTime" value="${details.startTime || ''}">
                        </div>
                    </div>
                    <div class="form-grid form-grid--3-col mt-3">
                        ${commonFields}
                    </div>
                `;
            case 'RENTAL_CAR':
                return `
                    <div class="form-grid form-grid--3-col">
                        <div class="form-group">
                            <label for="${prefix}-carType" class="form-label">차량 종류</label>
                            <select id="${prefix}-carType" class="form-select">
                                <option value="4인승" ${details.carType === '4인승' ? 'selected' : ''}>4인승</option>
                                <option value="7인승" ${details.carType === '7인승' ? 'selected' : ''}>7인승</option>
                                <option value="9인승 리무진" ${details.carType === '9인승 리무진' ? 'selected' : ''}>9인승 리무진</option>
                                <option value="16인승" ${details.carType === '16인승' ? 'selected' : ''}>16인승</option>
                                <option value="29인승" ${details.carType === '29인승' ? 'selected' : ''}>29인승</option>
                                <option value="45인승" ${details.carType === '45인승' ? 'selected' : ''}>45인승</option>
                                <option value="렌터카+가이드" ${details.carType === '렌터카+가이드' ? 'selected' : ''}>렌터카+가이드</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="${prefix}-usageHours" class="form-label">이용 시간</label>
                            <select id="${prefix}-usageHours" class="form-select">
                                <option value="6시간" ${details.usageHours === '6시간' ? 'selected' : ''}>6시간</option>
                                <option value="12시간" ${details.usageHours === '12시간' ? 'selected' : ''}>12시간</option>
                                <option value="픽업" ${details.usageHours === '픽업' ? 'selected' : ''}>픽업</option>
                                <option value="샌딩" ${details.usageHours === '샌딩' ? 'selected' : ''}>샌딩</option>
                                <option value="공항픽업" ${details.usageHours === '공항픽업' ? 'selected' : ''}>공항픽업</option>
                                <option value="공항샌딩" ${details.usageHours === '공항샌딩' ? 'selected' : ''}>공항샌딩</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="${prefix}-startTime" class="form-label">시작 시간</label>
                            <input type="time" class="form-control" id="${prefix}-startTime" value="${details.startTime || ''}">
                        </div>
                        ${commonFields}
                    </div>
                `;
            case 'ACCOMMODATION':
                return `<div class="form-grid form-grid--4-col">
                    <div class="form-group">
                        <label for="${prefix}-roomType" class="form-label">방 종류</label>
                        <input type="text" class="form-control" id="${prefix}-roomType" value="${details.roomType || ''}">
                    </div>
                    <div class="form-group">
                        <label for="${prefix}-nights" class="form-label">숙박일수</label>
                        <input type="number" class="form-control" id="${prefix}-nights" value="${details.nights || 1}">
                    </div>
                    <div class="form-group">
                        <label for="${prefix}-roomCount" class="form-label">룸 수량</label>
                        <input type="number" class="form-control" id="${prefix}-roomCount" value="${details.roomCount || 1}">
                    </div>
                    <div class="form-group">
                        <label for="${prefix}-guests" class="form-label">인원수</label>
                        <input type="number" class="form-control" id="${prefix}-guests" value="${details.guests || 0}">
                    </div>
                </div>`;
            case 'GOLF':
                return `<div class="form-grid form-grid--2-col">
                    <div class="form-group">
                        <label for="${prefix}-teeOffTime" class="form-label">티오프</label>
                        <input type="time" class="form-control" id="${prefix}-teeOffTime" value="${details.teeOffTime || ''}">
                    </div>
                    <div class="form-group">
                        <label for="${prefix}-players" class="form-label">인원수</label>
                        <input type="number" class="form-control" id="${prefix}-players" value="${details.players || 0}">
                    </div>
                </div>`;
            case 'TICKET':
            case 'OTHER':
                return `<div class="form-grid form-grid--4-col">
                    <div class="form-group">
                        <label for="${prefix}-usageTime" class="form-label">이용 시간</label>
                        <input type="time" class="form-control" id="${prefix}-usageTime" value="${details.usageTime || ''}">
                    </div>
                    ${commonFields}
                </div>`;
            default:
                return '<p class="text-muted">이 카테고리에는 추가 상세 정보가 없습니다.</p>';
        }
    }

    /**
     * [수정] 요청사항에 맞게 팝업창의 전체 HTML 구조를 4열 그리드 기반으로 재구성합니다.
     */
    function renderFormFields(prefix, data = {}) {
        const details = data.details || {};
        const category = data.category || 'TOUR';
        const labels = {
            ACCOMMODATION: { tourName: '숙소명', startDate: '체크인', endDate: '체크아웃' },
            GOLF: { tourName: '골프장명', startDate: '라운딩일자', endDate: '종료일' },
            DEFAULT: { tourName: '상품명', startDate: '출발일', endDate: '종료일' }
        };
        const currentLabels = labels[category] || labels.DEFAULT;

        let managerOptions = allUsers.map(u => `<option value="${u.id}" ${data.manager && data.manager.id === u.id ? 'selected' : ''}>${u.username}</option>`).join('');
        let managerFieldHtml = user.is_superuser ? `
            <select class="form-select" id="${prefix}-manager">${managerOptions}</select>` : 
            `<input type="text" class="form-control" value="${data.manager ? data.manager.username : user.username}" disabled>`;

        return `
            <form id="${prefix}-form" class="reservation-form-layout">
                <!-- 기본 정보 섹션 -->
                <div class="form-section">
                    <h5 class="form-section-title">기본 정보</h5>
                    <div class="form-grid form-grid--3-col">
                        <div class="form-group">
                            <label for="${prefix}-customer-search" class="form-label fw-bold">고객명</label>
                            <div class="searchable-dropdown">
                                <input type="text" class="form-control" id="${prefix}-customer-search" placeholder="고객 검색..." autocomplete="off" value="${data.customer ? `${data.customer.name} (${data.customer.phone_number || '번호없음'})` : ''}" required>
                                <input type="hidden" id="${prefix}-customer_id" value="${data.customer ? data.customer.id : ''}">
                                <div class="dropdown-content" id="${prefix}-customer-results"></div>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="${prefix}-category" class="form-label fw-bold">카테고리</label>
                            <select class="form-select" id="${prefix}-category">
                                <option value="TOUR" ${category === 'TOUR' ? 'selected' : ''}>투어</option>
                                <option value="RENTAL_CAR" ${category === 'RENTAL_CAR' ? 'selected' : ''}>렌터카</option>
                                <option value="ACCOMMODATION" ${category === 'ACCOMMODATION' ? 'selected' : ''}>숙박</option>
                                <option value="GOLF" ${category === 'GOLF' ? 'selected' : ''}>골프</option>
                                <option value="TICKET" ${category === 'TICKET' ? 'selected' : ''}>티켓</option>
                                <option value="OTHER" ${category === 'OTHER' ? 'selected' : ''}>기타</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="${prefix}-tour_name" class="form-label fw-bold">${currentLabels.tourName}</label>
                            <input type="text" class="form-control" id="${prefix}-tour_name" value="${data.tour_name || ''}" required>
                        </div>
                    </div>
                    <div class="form-grid form-grid--4-col mt-3">
                        <div class="form-group">
                            <label for="${prefix}-reservation_date" class="form-label">예약일</label>
                            <input type="date" class="form-control" id="${prefix}-reservation_date" value="${data.reservation_date || getLocalDateString()}">
                        </div>
                        <div class="form-group">
                            <label for="${prefix}-start_date" class="form-label">${currentLabels.startDate}</label>
                            <input type="date" class="form-control" id="${prefix}-start_date" value="${data.start_date || ''}">
                        </div>
                        <div class="form-group">
                            <label for="${prefix}-end_date" class="form-label">${currentLabels.endDate}</label>
                            <input type="date" class="form-control" id="${prefix}-end_date" value="${data.end_date || ''}">
                        </div>
                        <div class="form-group">
                            <label for="${prefix}-manager" class="form-label fw-bold">담당자</label>
                            ${managerFieldHtml}
                        </div>
                    </div>
                </div>

                <!-- 상세 정보 섹션 -->
                <div class="form-section">
                    <h5 class="form-section-title">상세 정보</h5>
                    <div id="${prefix}-details-container">
                        ${getCategoryFields(prefix, category, details)}
                    </div>
                </div>

                <!-- 금액 및 상태 섹션 -->
                <div class="form-section">
                    <h5 class="form-section-title">금액 및 상태</h5>
                    <div class="form-grid form-grid--4-col">
                        <div class="form-group">
                            <label for="${prefix}-total_price" class="form-label">판매가</label>
                            <input type="number" class="form-control" id="${prefix}-total_price" value="${data.total_price || 0}">
                        </div>
                        <div class="form-group">
                            <label for="${prefix}-total_cost" class="form-label">원가</label>
                            <input type="number" class="form-control" id="${prefix}-total_cost" value="${data.total_cost || 0}">
                        </div>
                         <div class="form-group">
                            <label for="${prefix}-payment_amount" class="form-label">결제금액</label>
                            <input type="number" class="form-control" id="${prefix}-payment_amount" value="${data.payment_amount || 0}">
                        </div>
                        <div class="form-group">
                            <label for="${prefix}-status" class="form-label fw-bold">예약 상태</label>
                            <select class="form-select" id="${prefix}-status">
                                <option value="PENDING" ${data.status === 'PENDING' ? 'selected' : ''}>상담중</option>
                                <option value="CONFIRMED" ${data.status === 'CONFIRMED' ? 'selected' : ''}>예약확정</option>
                                <option value="PAID" ${data.status === 'PAID' ? 'selected' : ''}>잔금완료</option>
                                <option value="COMPLETED" ${data.status === 'COMPLETED' ? 'selected' : ''}>여행완료</option>
                                <option value="CANCELED" ${data.status === 'CANCELED' ? 'selected' : ''}>취소</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <!-- 기타 정보 섹션 -->
                <div class="form-section">
                    <h5 class="form-section-title">기타 정보</h5>
                    <div class="form-grid form-grid--2-col">
                        <div class="form-group">
                            <label for="${prefix}-requests" class="form-label">요청사항 (외부/고객)</label>
                            <textarea class="form-control" id="${prefix}-requests" rows="3">${data.requests || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label for="${prefix}-notes" class="form-label">메모 (내부 참고 사항)</label>
                            <textarea class="form-control" id="${prefix}-notes" rows="3">${data.notes || ''}</textarea>
                        </div>
                    </div>
                </div>
                
                ${prefix === 'new-reservation' ? '<div class="mt-4"><button type="submit" class="btn btn-primary w-100">예약 등록</button></div>' : ''}
            </form>
        `;
    }
    
    // --- 3. 핵심 로직 함수 (생략 없이 전체 포함) ---
    async function fetchAllInitialData() {
        try {
            const [customersRes, usersRes] = await Promise.all([
                window.apiFetch('customers?page_size=10000'),
                window.apiFetch('users'),
            ]);
            allCustomers = customersRes.results || [];
            allUsers = usersRes || [];
        } catch (error) {
            console.error("초기 데이터 로딩 실패:", error);
            toast.error("고객 또는 사용자 목록 로딩에 실패했습니다.");
        }
    }

    async function populateReservations(page = 1, filters = {}) {
        currentFilters = filters;
        const params = new URLSearchParams({ page, ...filters });
        try {
            const response = await window.apiFetch(`reservations?${params.toString()}`);
            reservationListTable.innerHTML = '';
            if (!response || !response.results || response.results.length === 0) {
                reservationListTable.innerHTML = '<tr><td colspan="12" class="text-center py-5">표시할 예약 데이터가 없습니다.</td></tr>';
                pageInfo.textContent = '데이터가 없습니다.';
                prevPageButton.disabled = true;
                nextPageButton.disabled = true;
                return;
            }
            const reservations = response.results;
            reservations.forEach(res => {
                const row = document.createElement('tr');
                const margin = (res.total_price || 0) - (res.total_cost || 0);
                const statusColors = { 'PENDING': 'secondary', 'CONFIRMED': 'primary', 'PAID': 'success', 'COMPLETED': 'dark', 'CANCELED': 'danger' };
                const statusColor = statusColors[res.status] || 'light';
                row.innerHTML = `
                    <td><input type="checkbox" class="form-check-input reservation-checkbox" value="${res.id}"></td>
                    <td>${res.customer ? res.customer.name : 'N/A'}</td>
                    <td>${res.reservation_date || 'N/A'}</td>
                    <td>${res.start_date || '미정'}</td>
                    <td>${res.category_display || res.category}</td>
                    <td>${res.tour_name}</td>
                    <td>${Number(res.total_cost).toLocaleString()} VND</td>
                    <td>${Number(res.total_price).toLocaleString()} VND</td>
                    <td class="${margin >= 0 ? 'text-primary' : 'text-danger'} fw-bold">${margin.toLocaleString()} VND</td>
                    <td><span class="badge bg-${statusColor}">${res.status_display || res.status}</span></td>
                    <td>${res.manager ? res.manager.username : 'N/A'}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary edit-btn" data-id="${res.id}">수정</button>
                            <button class="btn btn-outline-danger delete-btn" data-id="${res.id}" data-name="${res.tour_name}">삭제</button>
                        </div>
                    </td>
                `;
                reservationListTable.appendChild(row);
            });
            const totalCount = response.count;
            totalPages = Math.ceil(totalCount / 50);
            currentPage = page;
            pageInfo.textContent = `페이지 ${currentPage} / ${totalPages} (총 ${totalCount}건)`;
            prevPageButton.disabled = !response.previous;
            nextPageButton.disabled = !response.next;
        } catch (error) {
            console.error("예약 목록 로딩 실패:", error);
            toast.error("예약 목록을 불러오는 데 실패했습니다.");
        }
    }

    // --- 4. 이벤트 처리 (생략 없이 전체 포함) ---
    function getFiltersFromInputs() {
        const filters = {
            category: filterCategory.value,
            search: filterSearch.value.trim(),
            start_date__gte: filterStartDate.value,
            start_date__lte: filterEndDate.value,
        };
        for (const key in filters) {
            if (!filters[key]) delete filters[key];
        }
        return filters;
    }

    summaryFilterButton.addEventListener('click', () => updateCategorySummary(getSummaryFiltersFromInputs()));
    summaryFilterReset.addEventListener('click', () => {
        initializeSummaryFilters();
        summaryFilterStartDate.value = '';
        summaryFilterEndDate.value = '';
        updateCategorySummary(getSummaryFiltersFromInputs());
    });
    filterButton.addEventListener('click', () => populateReservations(1, getFiltersFromInputs()));
    showNewReservationModalButton.addEventListener('click', () => {
        newReservationFormContainer.innerHTML = renderFormFields('new-reservation', {});
        newReservationModalEl.show();
        setupFormEventListeners('new-reservation');
    });
    reservationListTable.addEventListener('click', async (event) => {
        const target = event.target;
        const reservationId = target.dataset.id;
        if (target.classList.contains('edit-btn')) {
            openReservationModal(reservationId);
        }
        if (target.classList.contains('delete-btn')) {
            const reservationName = target.dataset.name;
            if (confirm(`[${reservationName}] 예약을 정말 삭제하시겠습니까?`)) {
                try {
                    await window.apiFetch(`reservations/${reservationId}`, { method: 'DELETE' });
                    toast.show("예약이 삭제되었습니다.");
                    populateReservations(currentPage, currentFilters);
                    updateCategorySummary(currentSummaryFilters);
                } catch (error) {
                    toast.error(`삭제 실패: ${error.message}`);
                }
            }
        }
    });
    exportCsvButton.addEventListener('click', async () => {
        const params = new URLSearchParams(getFiltersFromInputs());
        try {
            toast.show("CSV 파일을 생성 중입니다...");
            const blob = await window.apiFetch(`export-reservations-csv?${params.toString()}`, {}, true);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `reservations_${getLocalDateString()}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (error) {
            console.error("CSV 내보내기 실패:", error);
            toast.error("CSV 파일을 다운로드하는 데 실패했습니다.");
        }
    });
    prevPageButton.addEventListener('click', () => populateReservations(currentPage - 1, currentFilters));
    nextPageButton.addEventListener('click', () => populateReservations(currentPage + 1, currentFilters));
    
    function getDetailsFromForm(prefix, category) {
        const details = {};
        const form = document.getElementById(`${prefix}-form`);
        if (!form) return details;
        const getFieldValue = (id) => form.querySelector(`#${prefix}-${id}`)?.value;
        switch (category) {
            case 'TOUR':
            case 'RENTAL_CAR':
            case 'TICKET':
            case 'OTHER':
                details.startTime = getFieldValue('startTime');
                details.pickupLocation = getFieldValue('pickupLocation');
                details.dropoffLocation = getFieldValue('dropoffLocation');
                details.adults = getFieldValue('adults');
                details.children = getFieldValue('children');
                details.infants = getFieldValue('infants');
                if (category === 'RENTAL_CAR') {
                    details.carType = getFieldValue('carType');
                    details.usageHours = getFieldValue('usageHours');
                }
                if (category === 'TICKET' || category === 'OTHER') {
                    details.usageTime = getFieldValue('usageTime');
                }
                break;
            case 'ACCOMMODATION':
                details.roomType = getFieldValue('roomType');
                details.nights = getFieldValue('nights');
                details.roomCount = getFieldValue('roomCount');
                details.guests = getFieldValue('guests');
                break;
            case 'GOLF':
                details.teeOffTime = getFieldValue('teeOffTime');
                details.players = getFieldValue('players');
                break;
        }
        return details;
    }

    function handleCategoryChange(prefix) {
        const categorySelect = document.getElementById(`${prefix}-category`);
        const detailsContainer = document.getElementById(`${prefix}-details-container`);
        const tourNameLabel = document.querySelector(`label[for='${prefix}-tour_name']`);
        const startDateLabel = document.querySelector(`label[for='${prefix}-start_date']`);
        const endDateLabel = document.querySelector(`label[for='${prefix}-end_date']`);
        if (!categorySelect || !detailsContainer) return;
        const category = categorySelect.value;
        detailsContainer.innerHTML = getCategoryFields(prefix, category, {});
        const labels = {
            ACCOMMODATION: { tourName: '숙소명', startDate: '체크인', endDate: '체크아웃' },
            GOLF: { tourName: '골프장명', startDate: '라운딩일자', endDate: '종료일' },
            DEFAULT: { tourName: '상품명', startDate: '출발일', endDate: '종료일' }
        };
        const currentLabels = labels[category] || labels.DEFAULT;
        if (tourNameLabel) tourNameLabel.textContent = currentLabels.tourName;
        if (startDateLabel) startDateLabel.textContent = currentLabels.startDate;
        if (endDateLabel) endDateLabel.textContent = currentLabels.endDate;
    }
    
    function setupFormEventListeners(prefix) {
        const categorySelect = document.getElementById(`${prefix}-category`);
        if (categorySelect) {
            categorySelect.addEventListener('change', () => handleCategoryChange(prefix));
        }
        initializeSearchableCustomerDropdown(prefix);
        if (prefix === 'new-reservation') {
            const form = document.getElementById(`${prefix}-form`);
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const category = form.querySelector(`#${prefix}-category`).value;
                const customerId = form.querySelector(`#${prefix}-customer_id`).value;
                if (!customerId) {
                    toast.error("고객을 선택해주세요.");
                    return;
                }
                const formData = {
                    customer_id: customerId,
                    tour_name: form.querySelector(`#${prefix}-tour_name`).value,
                    reservation_date: form.querySelector(`#${prefix}-reservation_date`).value,
                    start_date: form.querySelector(`#${prefix}-start_date`).value || null,
                    end_date: form.querySelector(`#${prefix}-end_date`).value || null,
                    total_price: form.querySelector(`#${prefix}-total_price`).value,
                    total_cost: form.querySelector(`#${prefix}-total_cost`).value,
                    payment_amount: form.querySelector(`#${prefix}-payment_amount`).value,
                    status: form.querySelector(`#${prefix}-status`).value,
                    category: category,
                    requests: form.querySelector(`#${prefix}-requests`).value,
                    notes: form.querySelector(`#${prefix}-notes`).value,
                    details: getDetailsFromForm(prefix, category),
                };
                const managerSelect = form.querySelector(`#${prefix}-manager`);
                if (managerSelect) formData.manager_id = managerSelect.value;
                try {
                    await window.apiFetch('reservations', { method: 'POST', body: JSON.stringify(formData) });
                    newReservationModalEl.hide();
                    toast.show("새로운 예약이 등록되었습니다.");
                    populateReservations(1, {});
                    updateCategorySummary(currentSummaryFilters);
                } catch (error) {
                    toast.error(`등록 실패: ${error.message}`);
                }
            });
        }
    }

    async function openReservationModal(reservationId) {
        try {
            const reservationData = await window.apiFetch(`reservations/${reservationId}`);
            modalTitle.textContent = `예약 정보 수정 (ID: ${reservationId})`;
            modalBody.innerHTML = renderFormFields('edit-reservation', reservationData);
            reservationModalEl.show();
            setupFormEventListeners('edit-reservation');
            modalSaveButton.onclick = async () => {
                const form = document.getElementById('edit-reservation-form');
                const category = form.querySelector('#edit-reservation-category').value;
                const customerId = form.querySelector('#edit-reservation-customer_id').value;
                if (!customerId || isNaN(parseInt(customerId))) {
                    toast.error("유효한 고객을 선택해주세요.");
                    return;
                }
                const updatedData = {
                    customer_id: customerId,
                    tour_name: form.querySelector('#edit-reservation-tour_name').value,
                    reservation_date: form.querySelector('#edit-reservation-reservation_date').value,
                    start_date: form.querySelector('#edit-reservation-start_date').value || null,
                    end_date: form.querySelector('#edit-reservation-end_date').value || null,
                    total_price: form.querySelector('#edit-reservation-total_price').value,
                    total_cost: form.querySelector('#edit-reservation-total_cost').value,
                    payment_amount: form.querySelector('#edit-reservation-payment_amount').value,
                    status: form.querySelector('#edit-reservation-status').value,
                    category: category,
                    requests: form.querySelector('#edit-reservation-requests').value,
                    notes: form.querySelector('#edit-reservation-notes').value,
                    details: getDetailsFromForm('edit-reservation', category),
                };
                const managerSelect = form.querySelector('#edit-reservation-manager');
                if (managerSelect) updatedData.manager_id = managerSelect.value;
                try {
                    await window.apiFetch(`reservations/${reservationId}`, { method: 'PUT', body: JSON.stringify(updatedData) });
                    reservationModalEl.hide();
                    toast.show("예약 정보가 수정되었습니다.");
                    populateReservations(currentPage, currentFilters);
                    updateCategorySummary(currentSummaryFilters);
                } catch (error) {
                    toast.error(`수정 실패: ${error.message}`);
                }
            };
        } catch (error) {
            toast.error("예약 정보를 불러오는 데 실패했습니다.");
        }
    }
    
    function initializeSearchableCustomerDropdown(prefix) {
        const searchInput = document.getElementById(`${prefix}-customer-search`);
        const resultsContainer = document.getElementById(`${prefix}-customer-results`);
        const hiddenIdInput = document.getElementById(`${prefix}-customer_id`);
        if (!searchInput || !resultsContainer || !hiddenIdInput) return;
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            resultsContainer.innerHTML = '';
            hiddenIdInput.value = ''; 
            if (query.length < 1) {
                resultsContainer.style.display = 'none';
                return;
            }
            const filteredCustomers = allCustomers.filter(c =>
                c.name.toLowerCase().includes(query) || (c.phone_number && c.phone_number.includes(query))
            );
            if (filteredCustomers.length > 0) {
                resultsContainer.style.display = 'block';
                filteredCustomers.slice(0, 10).forEach(c => {
                    const item = document.createElement('a');
                    item.className = 'dropdown-item';
                    item.href = '#';
                    item.textContent = `${c.name} (${c.phone_number || '번호없음'})`;
                    item.onclick = (e) => {
                        e.preventDefault();
                        searchInput.value = item.textContent;
                        hiddenIdInput.value = c.id;
                        resultsContainer.style.display = 'none';
                    };
                    resultsContainer.appendChild(item);
                });
            } else {
                resultsContainer.style.display = 'none';
            }
        });
        document.addEventListener('click', (e) => {
            if (e.target !== searchInput) {
                resultsContainer.style.display = 'none';
            }
        });
    }

    // --- 5. 페이지 초기화 실행 ---
    async function initializePage() {
        initializeSummaryFilters();
        await fetchAllInitialData();
        await updateCategorySummary(getSummaryFiltersFromInputs());
        await populateReservations(1, {});
        
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        const reservationId = urlParams.get('id');

        if (action === 'edit' && reservationId) {
            openReservationModal(reservationId);
        }
    }
    
    initializePage();
});
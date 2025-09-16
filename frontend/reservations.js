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

    // 현황판 요소
    const categorySummaryCards = document.getElementById('category-summary-cards');

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
    
    // 페이지네이션 요소
    const prevPageButton = document.getElementById('prev-page-button');
    const nextPageButton = document.getElementById('next-page-button');
    const pageInfo = document.getElementById('page-info');
    const paginationContainer = document.getElementById('pagination-container');

    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const bulkDeleteButton = document.getElementById('bulk-delete-button');

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

    /**
     * [수정] 현황 요약 필터 값을 기반으로 필터 객체를 생성 (일자별 검색 우선)
     */
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
            categorySummaryCards.innerHTML = '';
            
            if (!summaryData || summaryData.length === 0) {
                categorySummaryCards.innerHTML = '<div class="col"><p class="text-muted text-center">요약 정보가 없습니다.</p></div>';
                return;
            }

            const categoryLabels = { 'TOUR': '투어', 'RENTAL_CAR': '렌터카', 'ACCOMMODATION': '숙박', 'GOLF': '골프', 'TICKET': '티켓', 'OTHER': '기타' };
            const salesMap = new Map(summaryData.map(item => [item.category, item.sales]));
            let totalSales = 0;

            Object.entries(categoryLabels).forEach(([key, label]) => {
                const sales = salesMap.get(key) || 0;
                totalSales += sales;
                const cardHtml = `<div class="col"><div class="card"><div class="card-body"><h5 class="card-title">${label}</h5><p class="card-text">${sales.toLocaleString()} VND</p></div></div></div>`;
                categorySummaryCards.innerHTML += cardHtml;
            });

            const totalCardHtml = `<div class="col"><div class="card bg-dark text-white"><div class="card-body"><h5 class="card-title">총 합계</h5><p class="card-text">${totalSales.toLocaleString()} VND</p></div></div></div>`;
            categorySummaryCards.innerHTML += totalCardHtml;
        } catch (error) {
            console.error("카테고리 요약 업데이트 실패:", error);
            toast.error("요약 정보를 불러오는데 실패했습니다.");
        }
    }

    function renderFormFields(prefix, data = {}) {
        const details = data.details || {};
        const category = data.category || 'TOUR';
        
        const labels = {
            ACCOMMODATION: { tourName: '숙소명', startDate: '체크인', endDate: '체크아웃' },
            GOLF: { tourName: '골프장명', startDate: '라운딩일자', endDate: '종료일' },
            DEFAULT: { tourName: '상품명', startDate: '출발일', endDate: '종료일' }
        };
        const currentLabels = labels[category] || labels.DEFAULT;

        let managerFieldHtml = '';
        const managerValue = data.manager ? data.manager.id : (prefix === 'new-reservation' ? user.id : '');

        if (user.is_superuser) {
            const userOptions = allUsers.map(u => `<option value="${u.id}" ${managerValue == u.id ? 'selected' : ''}>${u.username}</option>`).join('');
            managerFieldHtml = `<div class="form-group"><label for="${prefix}-manager" class="form-label fw-bold">담당자</label><select class="form-select" id="${prefix}-manager">${userOptions}</select></div>`;
        } else {
            managerFieldHtml = `<div class="form-group"><label class="form-label fw-bold">담당자</label><input type="text" class="form-control" value="${user.username}" disabled></div>`;
        }
        
        const categoryOptions = [
            { value: 'TOUR', text: '투어' }, { value: 'RENTAL_CAR', text: '렌터카' },
            { value: 'ACCOMMODATION', text: '숙박' }, { value: 'GOLF', text: '골프' },
            { value: 'TICKET', text: '티켓' }, { value: 'OTHER', text: '기타' }
        ].map(opt => `<option value="${opt.value}" ${category === opt.value ? 'selected' : ''}>${opt.text}</option>`).join('');
        
        const statusOptions = [
            { value: 'PENDING', text: '상담중' }, { value: 'CONFIRMED', text: '예약확정' },
            { value: 'PAID', text: '잔금완료' }, { value: 'COMPLETED', text: '여행완료' }, { value: 'CANCELED', text: '취소' }
        ].map(opt => `<option value="${opt.value}" ${data.status === opt.value ? 'selected' : ''}>${opt.text}</option>`).join('');

        return `
            <form id="${prefix}-form" class="form-section-wrapper">
                <div class="form-section">
                    <h5 class="form-section-title">기본 정보</h5>
                    <div class="form-group grid-col-span-2">
                        <label for="${prefix}-customer-search" class="form-label fw-bold">고객명</label>
                        <div class="searchable-dropdown">
                            <input type="text" class="form-control" id="${prefix}-customer-search" placeholder="고객 검색..." autocomplete="off" value="${data.customer ? `${data.customer.name} (${data.customer.phone_number || '번호없음'})` : ''}" required>
                            <input type="hidden" id="${prefix}-customer_id" value="${data.customer ? data.customer.id : ''}">
                            <div class="dropdown-content" id="${prefix}-customer-results"></div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="${prefix}-category" class="form-label fw-bold">카테고리</label>
                        <select class="form-select" id="${prefix}-category">${categoryOptions}</select>
                    </div>
                    ${managerFieldHtml}
                    <div class="form-group grid-col-span-2">
                        <label for="${prefix}-tour_name" class="form-label fw-bold">${currentLabels.tourName}</label>
                        <input type="text" class="form-control" id="${prefix}-tour_name" value="${data.tour_name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="${prefix}-reservation_date" class="form-label">${currentLabels.reservationDate || '예약일'}</label>
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
                </div>
                <div class="form-section" id="${prefix}-details-container">
                    <h5 class="form-section-title">상세 정보</h5>
                    ${getCategoryFields(prefix, category, details)}
                </div>
                <div class="form-section">
                    <h5 class="form-section-title">금액 및 상태</h5>
                    <div class="form-group"><label for="${prefix}-total_price" class="form-label">판매가</label><input type="number" class="form-control" id="${prefix}-total_price" value="${data.total_price || 0}"></div>
                    <div class="form-group"><label for="${prefix}-total_cost" class="form-label">원가</label><input type="number" class="form-control" id="${prefix}-total_cost" value="${data.total_cost || 0}"></div>
                    <div class="form-group"><label for="${prefix}-payment_amount" class="form-label">결제금액</label><input type="number" class="form-control" id="${prefix}-payment_amount" value="${data.payment_amount || 0}"></div>
                    <div class="form-group"><label for="${prefix}-status" class="form-label fw-bold">예약 상태</label><select class="form-select" id="${prefix}-status">${statusOptions}</select></div>
                </div>
                <div class="form-section">
                    <h5 class="form-section-title">기타 정보</h5>
                    <div class="form-group grid-full-width"><label for="${prefix}-requests" class="form-label">요청사항 (외부/고객)</label><textarea class="form-control" id="${prefix}-requests" rows="3">${data.requests || ''}</textarea></div>
                    <div class="form-group grid-full-width"><label for="${prefix}-notes" class="form-label">메모 (내부 참고 사항)</label><textarea class="form-control" id="${prefix}-notes" rows="3">${data.notes || ''}</textarea></div>
                </div>
                ${prefix === 'new-reservation' ? '<div class="mt-3"><button type="submit" class="btn btn-primary w-100">예약 등록</button></div>' : ''}
            </form>
        `;
    }

    function getCategoryFields(prefix, category, details = {}) {
        const commonFields = `
            <div class="form-group"><label for="${prefix}-adults" class="form-label">성인</label><input type="number" class="form-control" id="${prefix}-adults" value="${details.adults || 0}"></div>
            <div class="form-group"><label for="${prefix}-children" class="form-label">아동</label><input type="number" class="form-control" id="${prefix}-children" value="${details.children || 0}"></div>
            <div class="form-group"><label for="${prefix}-infants" class="form-label">유아</label><input type="number" class="form-control" id="${prefix}-infants" value="${details.infants || 0}"></div>
        `;
        switch (category) {
            case 'TOUR':
                return `
                    <div class="form-group"><label for="${prefix}-startTime" class="form-label">시작 시간</label><input type="time" class="form-control" id="${prefix}-startTime" value="${details.startTime || ''}"></div>
                    <div class="form-group grid-col-span-2"><label for="${prefix}-pickupLocation" class="form-label">픽업 장소</label><input type="text" class="form-control" id="${prefix}-pickupLocation" value="${details.pickupLocation || ''}"></div>
                    <div class="form-group grid-col-span-2"><label for="${prefix}-dropoffLocation" class="form-label">샌딩 장소</label><input type="text" class="form-control" id="${prefix}-dropoffLocation" value="${details.dropoffLocation || ''}"></div>
                    ${commonFields}
                `;
            case 'RENTAL_CAR':
                return `
                    <div class="form-group"><label for="${prefix}-carType" class="form-label">차량 종류</label><select id="${prefix}-carType" class="form-select"><option>4인승</option><option>7인승</option></select></div>
                    <div class="form-group"><label for="${prefix}-usageHours" class="form-label">이용 시간</label><select id="${prefix}-usageHours" class="form-select"><option>6시간</option><option>12시간</option></select></div>
                    <div class="form-group"><label for="${prefix}-startTime" class="form-label">시작 시간</label><input type="time" class="form-control" id="${prefix}-startTime" value="${details.startTime || ''}"></div>
                    <div class="form-group grid-col-span-2"><label for="${prefix}-pickupLocation" class="form-label">픽업 장소</label><input type="text" class="form-control" id="${prefix}-pickupLocation" value="${details.pickupLocation || ''}"></div>
                    <div class="form-group grid-col-span-2"><label for="${prefix}-dropoffLocation" class="form-label">샌딩 장소</label><input type="text" class="form-control" id="${prefix}-dropoffLocation" value="${details.dropoffLocation || ''}"></div>
                    ${commonFields}
                `;
            case 'ACCOMMODATION':
                return `
                    <div class="form-group"><label for="${prefix}-roomType" class="form-label">방 종류</label><input type="text" class="form-control" id="${prefix}-roomType" value="${details.roomType || ''}"></div>
                    <div class="form-group"><label for="${prefix}-nights" class="form-label">숙박일수</label><input type="number" class="form-control" id="${prefix}-nights" value="${details.nights || 1}"></div>
                    <div class="form-group"><label for="${prefix}-roomCount" class="form-label">룸 수량</label><input type="number" class="form-control" id="${prefix}-roomCount" value="${details.roomCount || 1}"></div>
                    <div class="form-group"><label for="${prefix}-guests" class="form-label">인원수</label><input type="number" class="form-control" id="${prefix}-guests" value="${details.guests || 0}"></div>
                `;
            case 'GOLF':
                 return `
                    <div class="form-group"><label for="${prefix}-teeOffTime" class="form-label">티오프</label><input type="time" class="form-control" id="${prefix}-teeOffTime" value="${details.teeOffTime || ''}"></div>
                    <div class="form-group"><label for="${prefix}-players" class="form-label">인원수</label><input type="number" class="form-control" id="${prefix}-players" value="${details.players || 0}"></div>
                `;
            case 'TICKET':
            case 'OTHER':
                return `
                    <div class="form-group grid-full-width"><label for="${prefix}-usageTime" class="form-label">이용 시간</label><input type="time" class="form-control" id="${prefix}-usageTime" value="${details.usageTime || ''}"></div>
                    ${commonFields}
                `;
            default:
                return '<div class="form-group grid-full-width"><p class="text-muted">이 카테고리에는 추가 상세 정보가 없습니다.</p></div>';
        }
    }
    
    // --- 3. 핵심 로직 함수 ---

    async function fetchAllInitialData() {
        try {
            const [customers, users] = await Promise.all([
                window.apiFetch('customers?page_size=10000'),
                window.apiFetch('users'),
            ]);
            allCustomers = customers.results || [];
            allUsers = users || [];
        } catch (error) {
            console.error("초기 데이터 로딩 실패:", error);
            toast.error("고객 또는 사용자 목록 로딩에 실패했습니다.");
        }
    }
    
    /**
     * [수정] 예약 목록 표시 및 수정/삭제 버튼 이벤트 리스너 연결 로직 복원
     */
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
            
            // 페이지네이션 정보 업데이트
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
    
    // --- 4. 이벤트 처리 ---

    /**
     * [수정] 예약 목록 필터 값을 기반으로 필터 객체를 생성
     */
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

    // 현황판 '조회' 버튼
    summaryFilterButton.addEventListener('click', () => {
        const filters = getSummaryFiltersFromInputs();
        updateCategorySummary(filters);
    });

    // 현황판 '초기화' 버튼
    summaryFilterReset.addEventListener('click', () => {
        initializeSummaryFilters();
        summaryFilterStartDate.value = '';
        summaryFilterEndDate.value = '';
        const filters = getSummaryFiltersFromInputs();
        updateCategorySummary(filters);
    });

    // 예약 목록 '조회' 버튼
    filterButton.addEventListener('click', () => {
        const filters = getFiltersFromInputs();
        populateReservations(1, filters);
    });

    /**
     * [수정] 동적으로 생성된 수정/삭제 버튼에 대한 이벤트 위임 처리
     */
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
    
    /**
     * [수정] CSV 내보내기 기능 구현
     */
    exportCsvButton.addEventListener('click', async () => {
        const filters = getFiltersFromInputs();
        const params = new URLSearchParams(filters);
        const endpoint = `export-reservations-csv?${params.toString()}`;
        
        try {
            toast.show("CSV 파일을 생성 중입니다...");
            const blob = await window.apiFetch(endpoint, {}, true);
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

    // 페이지네이션 버튼
    prevPageButton.addEventListener('click', () => populateReservations(currentPage - 1, currentFilters));
    nextPageButton.addEventListener('click', () => populateReservations(currentPage + 1, currentFilters));

    // --- 5. 페이지 초기화 실행 ---
    async function initializePage() {
        initializeSummaryFilters();
        await fetchAllInitialData();
        const initialSummaryFilters = getSummaryFiltersFromInputs();
        await updateCategorySummary(initialSummaryFilters);
        await populateReservations(1, {});
    }
    
    initializePage();
});
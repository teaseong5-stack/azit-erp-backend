document.addEventListener("DOMContentLoaded", async function() {
    // reservations.html 페이지가 아닐 경우, 스크립트 실행을 중단합니다.
    if (!document.getElementById('reservation-list-table')) return;

    // 필수 함수(apiFetch) 존재 여부를 확인합니다.
    if (typeof window.apiFetch !== 'function') {
        console.error("Error: window.apiFetch is not defined. Ensure common.js is loaded correctly.");
        toast.error("페이지 초기화에 실패했습니다. (필수 모듈 로드 실패)");
        return;
    }

    // --- 1. 전역 변수 및 HTML 요소 선언 ---

    let user = null;
    try {
        user = await window.apiFetch('user-info');
    } catch (error) {
        console.error("초기화 실패 (user-info 로드 실패):", error);
        return; // 사용자 정보 없이는 진행 불가
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
    
    // 기타 버튼
    const exportCsvButton = document.getElementById('export-csv-button');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const bulkDeleteButton = document.getElementById('bulk-delete-button');

    // 페이지네이션 요소
    const prevPageButtons = document.querySelectorAll('#prev-page-button');
    const nextPageButtons = document.querySelectorAll('#next-page-button');
    const pageInfos = document.querySelectorAll('#page-info');
    const paginationContainers = document.querySelectorAll('#pagination-container');

    // 상태 관리 변수
    let currentPage = 1;
    let totalPages = 1;
    let currentFilters = {};
    let currentSummaryFilters = {};
    let allCustomers = [];
    let allUsers = [];

    // --- 2. 헬퍼(Helper) 및 렌더링 함수 ---

    /**
     * 날짜 객체 또는 문자열을 'YYYY-MM-DD' 형식의 문자열로 변환합니다.
     */
    function getLocalDateString(dateInput) {
        if (!dateInput) return new Date().toISOString().slice(0, 10);
        return new Date(dateInput).toISOString().slice(0, 10);
    }

    /**
     * 현황 요약 필터(년/월)를 초기화하고 현재 날짜로 설정합니다.
     */
    function initializeSummaryFilters() {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

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
        summaryFilterMonth.value = currentMonth;
    }

    /**
     * 카테고리별 매출 요약 현황판을 업데이트합니다.
     */
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
                const cardHtml = `
                    <div class="col">
                        <div class="card">
                            <div class="card-body">
                                <h5 class="card-title">${label}</h5>
                                <p class="card-text">${sales.toLocaleString()} VND</p>
                            </div>
                        </div>
                    </div>`;
                categorySummaryCards.innerHTML += cardHtml;
            });

            const totalCardHtml = `
                <div class="col">
                     <div class="card bg-dark text-white">
                        <div class="card-body">
                            <h5 class="card-title">총 합계</h5>
                            <p class="card-text">${totalSales.toLocaleString()} VND</p>
                        </div>
                    </div>
                </div>`;
            categorySummaryCards.innerHTML += totalCardHtml;
        } catch (error) {
            console.error("Failed to update category summary:", error);
            categorySummaryCards.innerHTML = '<div class="col-12"><p class="text-danger text-center py-3">요약 정보를 불러오는데 실패했습니다.</p></div>';
        }
    }

    /**
     * [수정됨] 새 예약/수정 폼의 전체 HTML 구조를 생성하여 반환합니다.
     * 섹션별 그리드 레이아웃을 적용하여 한 줄에 여러 항목을 배치합니다.
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
                <!-- 기본 정보 섹션 -->
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

                <!-- 상세 정보 섹션 -->
                <div class="form-section" id="${prefix}-details-container">
                    <h5 class="form-section-title">상세 정보</h5>
                    ${getCategoryFields(prefix, category, details)}
                </div>

                <!-- 금액 및 상태 섹션 -->
                <div class="form-section">
                    <h5 class="form-section-title">금액 및 상태</h5>
                    <div class="form-group"><label for="${prefix}-total_price" class="form-label">판매가</label><input type="number" class="form-control" id="${prefix}-total_price" value="${data.total_price || 0}"></div>
                    <div class="form-group"><label for="${prefix}-total_cost" class="form-label">원가</label><input type="number" class="form-control" id="${prefix}-total_cost" value="${data.total_cost || 0}"></div>
                    <div class="form-group"><label for="${prefix}-payment_amount" class="form-label">결제금액</label><input type="number" class="form-control" id="${prefix}-payment_amount" value="${data.payment_amount || 0}"></div>
                    <div class="form-group"><label for="${prefix}-status" class="form-label fw-bold">예약 상태</label><select class="form-select" id="${prefix}-status">${statusOptions}</select></div>
                </div>
                
                <!-- 기타 정보 섹션 -->
                <div class="form-section">
                    <h5 class="form-section-title">기타 정보</h5>
                    <div class="form-group grid-full-width"><label for="${prefix}-requests" class="form-label">요청사항 (외부/고객)</label><textarea class="form-control" id="${prefix}-requests" rows="3">${data.requests || ''}</textarea></div>
                    <div class="form-group grid-full-width"><label for="${prefix}-notes" class="form-label">메모 (내부 참고 사항)</label><textarea class="form-control" id="${prefix}-notes" rows="3">${data.notes || ''}</textarea></div>
                </div>
                
                ${prefix === 'new-reservation' ? '<div class="mt-3"><button type="submit" class="btn btn-primary w-100">예약 등록</button></div>' : ''}
            </form>
        `;
    }

    /**
     * [수정됨] 선택된 카테고리에 맞는 상세 정보 필드 HTML을 반환합니다.
     * 각 필드를 .form-group으로 감싸 그리드 아이템으로 만듭니다.
     */
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
    
    // ... (기존의 다른 헬퍼 함수들은 생략 - 필요 시 추가) ...

    // --- 3. 핵심 로직 함수 ---

    /**
     * 모든 고객 목록을 불러와 전역 변수에 저장합니다.
     */
    async function fetchAllCustomers() {
        try {
            const response = await window.apiFetch('customers?page_size=10000');
            allCustomers = response.results || [];
        } catch (error) {
            console.error("Failed to fetch customers:", error);
            toast.error("고객 목록 로드에 실패했습니다.");
        }
    }

    /**
     * 모든 사용자 목록을 불러와 전역 변수에 저장합니다. (관리자만)
     */
    async function fetchAllUsers() {
        if (user && user.is_superuser) {
            try {
                allUsers = await window.apiFetch('users') || [];
            } catch (error) {
                console.error("Failed to fetch users:", error);
                toast.error("사용자 목록 로드에 실패했습니다.");
            }
        }
    }

    /**
     * 예약 목록을 API에서 불러와 테이블에 렌더링합니다.
     */
    async function populateReservations(page = 1, filters = {}) {
        currentFilters = filters;
        const params = new URLSearchParams({ page, ...filters });
        
        try {
            const response = await window.apiFetch(`reservations?${params.toString()}`);
            reservationListTable.innerHTML = '';

            if (!response || !response.results || response.results.length === 0) {
                pageInfos.forEach(info => info.textContent = '데이터가 없습니다.');
                // ... (기타 UI 처리)
                reservationListTable.innerHTML = '<tr><td colspan="12" class="text-center py-5">표시할 예약 데이터가 없습니다.</td></tr>';
                return;
            }

            const reservations = response.results;
            totalPages = Math.ceil(response.count / 50);

            reservations.forEach(res => {
                const row = document.createElement('tr');
                // ... (테이블 row 생성 로직은 기존과 동일) ...
                reservationListTable.appendChild(row);
            });

            // 페이지네이션 정보 업데이트
            pageInfos.forEach(info => info.textContent = `페이지 ${page} / ${totalPages}`);
            // ... (기타 페이지네이션 UI 업데이트)

        } catch (error) {
            console.error("Failed to populate reservations:", error);
            reservationListTable.innerHTML = '<tr><td colspan="12" class="text-center py-5 text-danger">예약 데이터를 불러오는데 실패했습니다.</td></tr>';
        }
    }
    
    // --- 4. 이벤트 리스너 설정 ---

    /**
     * '새 예약 등록' 모달을 열고 폼을 렌더링합니다.
     */
    showNewReservationModalButton.addEventListener('click', () => {
        newReservationFormContainer.innerHTML = renderFormFields('new-reservation', {});
        // 폼 렌더링 후 이벤트 리스너(고객 검색, 카테고리 변경 등)를 설정해야 합니다.
        // setupFormEventListeners('new-reservation');
        newReservationModalEl.show();
    });

    // ... (기타 모든 이벤트 리스너들은 여기에 위치해야 합니다) ...
    // 예: 필터 버튼, 페이지네이션 버튼, 폼 제출 등
    
    // --- 5. 페이지 초기화 실행 ---
    async function initializePage() {
        initializeSummaryFilters();
        
        // 필수 데이터들을 병렬로 먼저 로드합니다.
        await Promise.all([
            fetchAllCustomers(),
            fetchAllUsers()
        ]);
        
        const initialFilters = { 
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1
        };
        
        // 데이터 로딩이 끝난 후 화면을 렌더링합니다.
        updateCategorySummary(initialFilters);
        populateReservations(1, {}); // 처음에는 필터 없이 전체 목록
    }

    initializePage();
});

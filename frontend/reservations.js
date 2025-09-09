/**
 * reservations.js
 * 아지트 ERP의 '예약 관리' 페이지에 대한 모든 동적 기능 및 API 연동을 처리합니다.
 *
 * 주요 기능:
 * - 예약 목록 조회, 필터링, 검색 및 상단 요약 현황판
 * - 숫자 기반 페이지네이션 및 이전/다음 버튼
 * - 모달을 통한 예약 생성 및 수정 (관리자 권한에 따른 담당자 변경 기능 포함)
 * - 선택된 카테고리에 따라 동적으로 변경되는 상세 정보 폼
 * - 고객 검색 기능이 포함된 드롭다운
 * - 선택 예약 일괄 삭제 및 전체 데이터 CSV 내보내기
 */
document.addEventListener("DOMContentLoaded", async function() {
    // 해당 페이지가 아닐 경우 스크립트 실행 중단
    if (!document.getElementById('reservation-list-table')) return;

    // --- 1. 전역 변수 및 HTML 요소 선언 ---
    const user = await window.apiFetch('user-info');
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
    
    // 통합 필터 요소
    const filterCategory = document.getElementById('filter-category');
    const filterSearch = document.getElementById('filter-search');
    const filterStartDate = document.getElementById('filter-start-date');
    const filterEndDate = document.getElementById('filter-end-date');
    const filterButton = document.getElementById('filter-button');
    
    const exportCsvButton = document.getElementById('export-csv-button');
    
    // 페이지네이션 요소
    const prevPageButtons = document.querySelectorAll('#prev-page-button');
    const nextPageButtons = document.querySelectorAll('#next-page-button');
    const pageInfos = document.querySelectorAll('#page-info');
    const paginationContainers = document.querySelectorAll('#pagination-container');

    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const bulkDeleteButton = document.getElementById('bulk-delete-button');

    // 상태 관리 변수
    let currentPage = 1;
    let totalPages = 1;
    let currentFilters = {};
    let allCustomers = [];
    let allUsers = []; 

    // --- 2. 헬퍼(Helper) 및 렌더링 함수 ---

    /**
     * 카테고리별 매출 요약 현황판을 업데이트하는 함수
     * @param {object} filters - 적용할 필터 조건
     */
    async function updateCategorySummary(filters = {}) {
        const params = new URLSearchParams({ group_by: 'category', ...filters });
        if (filters.start_date__gte) {
            params.delete('year');
            params.delete('month');
        }
        const summaryData = await window.apiFetch(`reservations/summary?${params.toString()}`);
        
        categorySummaryCards.innerHTML = '';
        
        if (!summaryData) {
            categorySummaryCards.innerHTML = '<div class="col"><p class="text-muted text-center">요약 정보를 불러오는데 실패했습니다.</p></div>';
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
                    <div class="card card-body text-center h-100">
                        <h6 class="card-subtitle mb-2 text-muted">${label}</h6>
                        <p class="card-text fs-5 fw-bold">${sales.toLocaleString()} VND</p>
                    </div>
                </div>
            `;
            categorySummaryCards.innerHTML += cardHtml;
        });

        const totalCardHtml = `
            <div class="col">
                <div class="card card-body text-center h-100 bg-dark text-white">
                    <h6 class="card-subtitle mb-2 text-white-50">총 합계</h6>
                    <p class="card-text fs-5 fw-bold">${totalSales.toLocaleString()} VND</p>
                </div>
            </div>
        `;
        categorySummaryCards.innerHTML += totalCardHtml;
    }

    /**
     * 페이지네이션 UI를 동적으로 생성하고 렌더링합니다.
     */
    function renderPagination(currentPage, totalPages) {
        paginationContainers.forEach(container => {
            container.innerHTML = ''; 

            const pageWindow = 2;
            let startPage = Math.max(1, currentPage - pageWindow);
            let endPage = Math.min(totalPages, currentPage + pageWindow);

            if (currentPage - startPage < pageWindow) {
                endPage = Math.min(totalPages, endPage + (pageWindow - (currentPage - startPage)));
            }
            if (endPage - currentPage < pageWindow) {
                startPage = Math.max(1, startPage - (pageWindow - (endPage - currentPage)));
            }

            if (startPage > 1) {
                container.innerHTML += `<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`;
                if (startPage > 2) {
                    container.innerHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
                }
            }

            for (let i = startPage; i <= endPage; i++) {
                const activeClass = (i === currentPage) ? 'active' : '';
                container.innerHTML += `<li class="page-item ${activeClass}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
            }
            
            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    container.innerHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
                }
                container.innerHTML += `<li class="page-item"><a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a></li>`;
            }
        });
    }
    
    /**
     * 검색 가능한 고객 드롭다운 메뉴를 초기화합니다.
     */
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

    /**
     * 선택된 카테고리에 맞는 상세 정보 필드 HTML을 반환합니다.
     */
    function getCategoryFields(prefix, category, details = {}) {
        const commonFields = `
            <div class="col-md-4"><label for="${prefix}-adults" class="form-label">성인</label><input type="number" class="form-control" id="${prefix}-adults" value="${details.adults || 0}"></div>
            <div class="col-md-4"><label for="${prefix}-children" class="form-label">아동</label><input type="number" class="form-control" id="${prefix}-children" value="${details.children || 0}"></div>
            <div class="col-md-4"><label for="${prefix}-infants" class="form-label">유아</label><input type="number" class="form-control" id="${prefix}-infants" value="${details.infants || 0}"></div>
        `;
        switch (category) {
            case 'TOUR':
                return `
                    <div class="col-md-4"><label for="${prefix}-startTime" class="form-label">시작 시간</label><input type="time" class="form-control" id="${prefix}-startTime" value="${details.startTime || ''}"></div>
                    <div class="col-md-4"><label for="${prefix}-pickupLocation" class="form-label">픽업 장소</label><input type="text" class="form-control" id="${prefix}-pickupLocation" value="${details.pickupLocation || ''}"></div>
                    <div class="col-md-4"><label for="${prefix}-dropoffLocation" class="form-label">샌딩 장소</label><input type="text" class="form-control" id="${prefix}-dropoffLocation" value="${details.dropoffLocation || ''}"></div>
                    ${commonFields}
                `;
            case 'RENTAL_CAR':
                return `
                    <div class="col-md-6"><label for="${prefix}-carType" class="form-label">차량 종류</label>
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
                    <div class="col-md-6"><label for="${prefix}-usageHours" class="form-label">이용 시간</label>
                        <select id="${prefix}-usageHours" class="form-select">
                            <option value="6시간" ${details.usageHours === '6시간' ? 'selected' : ''}>6시간</option>
                            <option value="12시간" ${details.usageHours === '12시간' ? 'selected' : ''}>12시간</option>
                            <option value="픽업" ${details.usageHours === '픽업' ? 'selected' : ''}>픽업</option>
                            <option value="샌딩" ${details.usageHours === '샌딩' ? 'selected' : ''}>샌딩</option>
                            <option value="공항픽업" ${details.usageHours === '공항픽업' ? 'selected' : ''}>공항픽업</option>
                            <option value="공항샌딩" ${details.usageHours === '공항샌딩' ? 'selected' : ''}>공항샌딩</option>
                        </select>
                    </div>
                    <div class="col-md-4"><label for="${prefix}-startTime" class="form-label">시작 시간</label><input type="time" class="form-control" id="${prefix}-startTime" value="${details.startTime || ''}"></div>
                    <div class="col-md-4"><label for="${prefix}-pickupLocation" class="form-label">픽업 장소</label><input type="text" class="form-control" id="${prefix}-pickupLocation" value="${details.pickupLocation || ''}"></div>
                    <div class="col-md-4"><label for="${prefix}-dropoffLocation" class="form-label">샌딩 장소</label><input type="text" class="form-control" id="${prefix}-dropoffLocation" value="${details.dropoffLocation || ''}"></div>
                    ${commonFields}
                `;
            case 'ACCOMMODATION':
                 return `
                    <div class="col-md-4"><label for="${prefix}-roomType" class="form-label">방 종류</label><input type="text" class="form-control" id="${prefix}-roomType" value="${details.roomType || ''}"></div>
                    <div class="col-md-2"><label for="${prefix}-nights" class="form-label">숙박일수</label><input type="number" class="form-control" id="${prefix}-nights" value="${details.nights || 1}"></div>
                    <div class="col-md-2"><label for="${prefix}-roomCount" class="form-label">룸 수량</label><input type="number" class="form-control" id="${prefix}-roomCount" value="${details.roomCount || 1}"></div>
                    <div class="col-md-4"><label for="${prefix}-guests" class="form-label">인원수</label><input type="number" class="form-control" id="${prefix}-guests" value="${details.guests || 0}"></div>
                `;
            case 'GOLF':
                return `
                    <div class="col-md-6"><label for="${prefix}-teeOffTime" class="form-label">티오프</label><input type="time" class="form-control" id="${prefix}-teeOffTime" value="${details.teeOffTime || ''}"></div>
                    <div class="col-md-6"><label for="${prefix}-players" class="form-label">인원수</label><input type="number" class="form-control" id="${prefix}-players" value="${details.players || 0}"></div>
                `;
            case 'TICKET':
            case 'OTHER':
                 return `
                    <div class="col-md-12"><label for="${prefix}-usageTime" class="form-label">이용 시간</label><input type="time" class="form-control" id="${prefix}-usageTime" value="${details.usageTime || ''}"></div>
                    ${commonFields}
                `;
            default:
                return '<div class="col-12"><p class="text-muted">이 카테고리에는 추가 상세 정보가 없습니다.</p></div>';
        }
    }
    
    /**
     * 폼에서 카테고리별 상세 정보를 객체 형태로 추출합니다.
     */
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

    /**
     * 카테고리 변경 시 호출되어 상세 정보 UI를 업데이트하고 라벨을 변경합니다.
     */
    function handleCategoryChange(prefix) {
        const categorySelect = document.getElementById(`${prefix}-category`);
        const detailsContainer = document.getElementById(`${prefix}-details-container`);
        const tourNameLabel = document.querySelector(`label[for='${prefix}-tour_name']`);
        const startDateLabel = document.querySelector(`label[for='${prefix}-start_date']`);
        const endDateLabel = document.querySelector(`label[for='${prefix}-end_date']`);
        
        if (categorySelect && detailsContainer) {
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
    }

    /**
     * 신규/수정 폼의 전체 HTML 구조를 생성하여 반환합니다.
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
        if (prefix === 'edit-reservation') {
             managerFieldHtml = user.is_superuser ? `
                <div class="col-md-6"><label for="${prefix}-manager" class="form-label fw-bold">담당자</label><select class="form-select" id="${prefix}-manager"></select></div>
                ` : `
                <div class="col-md-6"><label class="form-label fw-bold">담당자</label><input type="text" class="form-control" value="${data.manager ? data.manager.username : '미지정'}" disabled></div>
                `;
        } else { // 'new-reservation'
            managerFieldHtml = user.is_superuser ? `
                <div class="col-md-6"><label for="${prefix}-manager" class="form-label fw-bold">담당자</label><select class="form-select" id="${prefix}-manager"></select></div>
                ` : `
                <div class="col-md-6"><label class="form-label fw-bold">담당자</label><input type="text" class="form-control" value="${user.username}" disabled></div>
                `;
        }

        return `
            <form id="${prefix}-form">
                <div class="row g-3">
                    <div class="col-md-4"><label for="${prefix}-customer-search" class="form-label fw-bold">고객명</label>
                        <div class="searchable-dropdown">
                            <input type="text" class="form-control" id="${prefix}-customer-search" placeholder="고객 검색..." autocomplete="off" value="${data.customer ? `${data.customer.name} (${data.customer.phone_number || '번호없음'})` : ''}" required>
                            <input type="hidden" id="${prefix}-customer_id" value="${data.customer ? data.customer.id : ''}">
                            <div class="dropdown-content" id="${prefix}-customer-results"></div>
                        </div>
                    </div>
                    <div class="col-md-4"><label for="${prefix}-category" class="form-label fw-bold">카테고리</label><select class="form-select" id="${prefix}-category"></select></div>
                    <div class="col-md-4"><label for="${prefix}-tour_name" class="form-label fw-bold">${currentLabels.tourName}</label><input type="text" class="form-control" id="${prefix}-tour_name" value="${data.tour_name || ''}" required></div>
                    <div class="col-md-4"><label for="${prefix}-reservation_date" class="form-label">예약일</label><input type="date" class="form-control" id="${prefix}-reservation_date" value="${data.reservation_date || new Date().toISOString().split('T')[0]}"></div>
                    <div class="col-md-4"><label for="${prefix}-start_date" class="form-label">${currentLabels.startDate}</label><input type="date" class="form-control" id="${prefix}-start_date" value="${data.start_date || ''}"></div>
                    <div class="col-md-4"><label for="${prefix}-end_date" class="form-label">${currentLabels.endDate}</label><input type="date" class="form-control" id="${prefix}-end_date" value="${data.end_date || ''}"></div>
                    <hr class="my-4">
                    <h5>상세 정보</h5>
                    <div class="row g-3" id="${prefix}-details-container">
                        ${getCategoryFields(prefix, category, details)}
                    </div>
                    <hr class="my-4">
                    <div class="row g-3">
                        <div class="col-md-4"><label for="${prefix}-total_price" class="form-label">판매가</label><input type="number" class="form-control" id="${prefix}-total_price" value="${data.total_price || 0}"></div>
                        <div class="col-md-4"><label for="${prefix}-total_cost" class="form-label">원가</label><input type="number" class="form-control" id="${prefix}-total_cost" value="${data.total_cost || 0}"></div>
                        <div class="col-md-4"><label for="${prefix}-payment_amount" class="form-label">결제금액</label><input type="number" class="form-control" id="${prefix}-payment_amount" value="${data.payment_amount || 0}"></div>
                    </div>
                    <div class="row g-3 mt-1">
                        <div class="col-md-6"><label for="${prefix}-status" class="form-label fw-bold">예약 상태</label><select class="form-select" id="${prefix}-status"></select></div>
                        ${managerFieldHtml}
                    </div>
                    <div class="col-12 mt-3"><label for="${prefix}-requests" class="form-label">요청사항 (외부/고객)</label><textarea class="form-control" id="${prefix}-requests" rows="3">${data.requests || ''}</textarea></div>
                    <div class="col-12"><label for="${prefix}-notes" class="form-label">메모 (내부 참고 사항)</label><textarea class="form-control" id="${prefix}-notes" rows="3">${data.notes || ''}</textarea></div>
                </div>
                ${prefix === 'new-reservation' ? '<button type="submit" class="btn btn-primary mt-4 w-100">예약 등록</button>' : ''}
            </form>
        `;
    }
    
    // --- 3. 핵심 로직 함수 ---

    async function fetchAllCustomers() {
        const response = await window.apiFetch('customers?page_size=10000');
        if (response && response.results) {
            allCustomers = response.results;
        }
    }

    async function fetchAllUsers() {
        if (user && user.is_superuser) {
            const response = await window.apiFetch('users');
            if (response) {
                allUsers = response;
            }
        }
    }

    async function populateReservations(page = 1, filters = {}) {
        currentFilters = filters;
        const params = new URLSearchParams({ page, ...filters });
        const endpoint = `reservations?${params.toString()}`;
        
        const response = await window.apiFetch(endpoint);
        reservationListTable.innerHTML = '';

        if (!response || !response.results || response.results.length === 0) {
            pageInfos.forEach(info => info.textContent = '데이터가 없습니다.');
            paginationContainers.forEach(container => container.innerHTML = '');
            prevPageButtons.forEach(btn => btn.disabled = true);
            nextPageButtons.forEach(btn => btn.disabled = true);
            reservationListTable.innerHTML = '<tr><td colspan="12" class="text-center py-5">표시할 예약 데이터가 없습니다.</td></tr>';
            return;
        }

        const reservations = response.results;
        const totalCount = response.count;
        totalPages = Math.ceil(totalCount / 50);

        reservations.forEach(res => {
            const row = document.createElement('tr');
            const margin = (res.total_price || 0) - (res.total_cost || 0);

            const statusColors = {
                'PENDING': 'secondary', 'CONFIRMED': 'primary', 'PAID': 'success',
                'COMPLETED': 'dark', 'CANCELED': 'danger'
            };
            const statusColor = statusColors[res.status] || 'light';

            row.innerHTML = `
                <td><input type="checkbox" class="form-check-input reservation-checkbox" value="${res.id}"></td>
                <td>${res.customer ? res.customer.name : 'N/A'}</td>
                <td>${res.reservation_date || 'N/A'}</td>
                <td>${res.start_date || '미정'}</td>
                <td>${res.category_display || res.category}</td>
                <td style="min-width: 200px;">${res.tour_name}</td>
                <td>${Number(res.total_cost).toLocaleString()} VND</td>
                <td>${Number(res.total_price).toLocaleString()} VND</td>
                <td class="${margin >= 0 ? 'text-primary' : 'text-danger'} fw-bold">${margin.toLocaleString()} VND</td>
                <td><span class="badge bg-${statusColor}">${res.status_display || res.status}</span></td>
                <td>${res.manager ? res.manager.username : 'N/A'}</td>
                <td></td>
            `;
            const actionCell = row.cells[11];
            actionCell.innerHTML = `
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary edit-btn">수정</button>
                    <button class="btn btn-sm btn-outline-danger delete-btn">삭제</button>
                </div>
            `;
            actionCell.querySelector('.edit-btn').addEventListener('click', () => openReservationModal(res.id));
            actionCell.querySelector('.delete-btn').addEventListener('click', async () => {
                if (confirm(`[${res.tour_name}] 예약을 정말 삭제하시겠습니까?`)) {
                    await window.apiFetch(`reservations/${res.id}`, { method: 'DELETE' });
                    populateReservations(currentPage, currentFilters);
                }
            });
            reservationListTable.appendChild(row);
        });

        currentPage = page;
        const pageText = `총 ${totalCount}건`;
        pageInfos.forEach(info => info.textContent = pageText);
        renderPagination(currentPage, totalPages);
        prevPageButtons.forEach(btn => btn.disabled = !response.previous);
        nextPageButtons.forEach(btn => btn.disabled = !response.next);
        if(selectAllCheckbox) selectAllCheckbox.checked = false;
    }

    async function openReservationModal(reservationId) {
        const data = await window.apiFetch(`reservations/${reservationId}`);
        if (!data) return;

        modalTitle.textContent = `예약 정보 수정 (ID: ${reservationId})`;
        modalBody.innerHTML = renderFormFields('edit-reservation', data);
        
        initializeSearchableCustomerDropdown('edit-reservation');
        
        const categorySelect = document.getElementById('edit-reservation-category');
        const statusSelect = document.getElementById('edit-reservation-status');
        
        const categories = {TOUR:"투어", RENTAL_CAR:"렌터카", ACCOMMODATION:"숙박", GOLF:"골프", TICKET:"티켓", OTHER:"기타"};
        Object.entries(categories).forEach(([key, value]) => {
            categorySelect.innerHTML += `<option value="${key}" ${data.category === key ? 'selected' : ''}>${value}</option>`;
        });

        const statuses = {PENDING:"예약대기", CONFIRMED:"예약확정", PAID:"결제완료", COMPLETED:"여행완료", CANCELED:"예약취소"};
        Object.entries(statuses).forEach(([key, value]) => {
            statusSelect.innerHTML += `<option value="${key}" ${data.status === key ? 'selected' : ''}>${value}</option>`;
        });
        
        if (user.is_superuser) {
            const managerSelect = document.getElementById('edit-reservation-manager');
            managerSelect.innerHTML = '<option value="">-- 담당자 변경안함 --</option>'; 
            allUsers.forEach(u => {
                const isSelected = data.manager && data.manager.id === u.id;
                managerSelect.innerHTML += `<option value="${u.id}" ${isSelected ? 'selected' : ''}>${u.username}</option>`;
            });
        }
        
        categorySelect.addEventListener('change', () => handleCategoryChange('edit-reservation'));
        
        modalSaveButton.onclick = async () => {
            const form = document.getElementById('edit-reservation-form');
            const category = form.querySelector('#edit-reservation-category').value;
            const startDateValue = form.querySelector('#edit-reservation-start_date').value;
            const endDateValue = form.querySelector('#edit-reservation-end_date').value;
            const formData = {
                tour_name: form.querySelector('#edit-reservation-tour_name').value,
                customer_id: form.querySelector('#edit-reservation-customer_id').value,
                reservation_date: form.querySelector('#edit-reservation-reservation_date').value,
                start_date: startDateValue ? startDateValue : null,
                end_date: endDateValue ? endDateValue : null,
                total_price: form.querySelector('#edit-reservation-total_price').value,
                total_cost: form.querySelector('#edit-reservation-total_cost').value,
                payment_amount: form.querySelector('#edit-reservation-payment_amount').value,
                status: form.querySelector('#edit-reservation-status').value,
                category: category,
                requests: form.querySelector('#edit-reservation-requests').value,
                notes: form.querySelector('#edit-reservation-notes').value,
                details: getDetailsFromForm('edit-reservation', category)
            };

            if (user.is_superuser) {
                const managerSelect = form.querySelector('#edit-reservation-manager');
                if (managerSelect && managerSelect.value) {
                    formData.manager_id = managerSelect.value;
                }
            }

            const response = await window.apiFetch(`reservations/${reservationId}`, { method: 'PUT', body: JSON.stringify(formData) });
            if (response) {
                reservationModalEl.hide();
                populateReservations(currentPage, currentFilters);
            }
        };

        reservationModalEl.show();
    }


    // --- 4. 이벤트 리스너 설정 ---

    filterButton.addEventListener('click', () => {
        const filters = {
            category: filterCategory.value,
            search: filterSearch.value,
            start_date__gte: filterStartDate.value,
            start_date__lte: filterEndDate.value,
        };
        for (const key in filters) {
            if (!filters[key]) delete filters[key];
        }
        populateReservations(1, filters);
        updateCategorySummary(filters);
    });

    paginationContainers.forEach(container => {
        container.addEventListener('click', (e) => {
            e.preventDefault();
            if (e.target.tagName === 'A' && e.target.dataset.page) {
                const pageNum = parseInt(e.target.dataset.page, 10);
                if (pageNum !== currentPage) {
                    populateReservations(pageNum, currentFilters);
                }
            }
        });
    });

    exportCsvButton.addEventListener('click', () => {
        window.open(window.API_BASE_URL + '/export-reservations-csv/', '_blank');
    });

    prevPageButtons.forEach(btn => btn.addEventListener('click', () => {
        if (currentPage > 1) populateReservations(currentPage - 1, currentFilters);
    }));

    nextPageButtons.forEach(btn => btn.addEventListener('click', () => {
        if (currentPage < totalPages) populateReservations(currentPage + 1, currentFilters);
    }));

    selectAllCheckbox.addEventListener('click', () => {
        document.querySelectorAll('.reservation-checkbox').forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
        });
    });

    bulkDeleteButton.addEventListener('click', async () => {
        const selectedIds = Array.from(document.querySelectorAll('.reservation-checkbox:checked')).map(cb => cb.value);
        if (selectedIds.length === 0) {
            alert('삭제할 항목을 선택해주세요.');
            return;
        }
        if (confirm(`선택된 ${selectedIds.length}개의 예약을 정말 삭제하시겠습니까?`)) {
            const response = await window.apiFetch('reservations/bulk-delete/', { method: 'POST', body: JSON.stringify({ ids: selectedIds }) });
            if (response) {
                alert(response.message);
                populateReservations(currentPage, currentFilters);
            }
        }
    });

    showNewReservationModalButton.addEventListener('click', () => {
        newReservationModalEl.show();
    });

    // --- 5. 페이지 초기화 실행 ---

    async function initializePage() {
        await Promise.all([fetchAllCustomers(), fetchAllUsers(), updateCategorySummary()]);
        
        newReservationFormContainer.innerHTML = renderFormFields('new-reservation');
        initializeSearchableCustomerDropdown('new-reservation');
        
        const newCategorySelect = document.getElementById('new-reservation-category');
        const newStatusSelect = document.getElementById('new-reservation-status');

        const categories = {TOUR:"투어", RENTAL_CAR:"렌터카", ACCOMMODATION:"숙박", GOLF:"골프", TICKET:"티켓", OTHER:"기타"};
        Object.entries(categories).forEach(([key, value]) => {
            newCategorySelect.innerHTML += `<option value="${key}">${value}</option>`;
        });

        const statuses = {PENDING:"예약대기", CONFIRMED:"예약확정", PAID:"결제완료", COMPLETED:"여행완료", CANCELED:"예약취소"};
        Object.entries(statuses).forEach(([key, value]) => {
            newStatusSelect.innerHTML += `<option value="${key}">${value}</option>`;
        });
        
        if (user.is_superuser) {
            const newManagerSelect = document.getElementById('new-reservation-manager');
            allUsers.forEach(u => {
                const isSelected = user.id === u.id;
                newManagerSelect.innerHTML += `<option value="${u.id}" ${isSelected ? 'selected' : ''}>${u.username}</option>`;
            });
        }
        
        newCategorySelect.addEventListener('change', () => handleCategoryChange('new-reservation'));
        handleCategoryChange('new-reservation');

        const newReservationForm = document.getElementById('new-reservation-form');
        if(newReservationForm){
            newReservationForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const category = newReservationForm.querySelector('#new-reservation-category').value;
                const startDateValue = newReservationForm.querySelector('#new-reservation-start_date').value;
                const endDateValue = newReservationForm.querySelector('#new-reservation-end_date').value;
                const formData = {
                    tour_name: newReservationForm.querySelector('#new-reservation-tour_name').value,
                    customer_id: newReservationForm.querySelector('#new-reservation-customer_id').value,
                    reservation_date: newReservationForm.querySelector('#new-reservation-reservation_date').value,
                    start_date: startDateValue ? startDateValue : null,
                    end_date: endDateValue ? endDateValue : null,
                    total_price: newReservationForm.querySelector('#new-reservation-total_price').value,
                    total_cost: newReservationForm.querySelector('#new-reservation-total_cost').value,
                    payment_amount: newReservationForm.querySelector('#new-reservation-payment_amount').value,
                    status: newReservationForm.querySelector('#new-reservation-status').value,
                    category: category,
                    requests: newReservationForm.querySelector('#new-reservation-requests').value,
                    notes: newReservationForm.querySelector('#new-reservation-notes').value,
                    details: getDetailsFromForm('new-reservation', category)
                };
                
                if (user.is_superuser) {
                    formData.manager_id = newReservationForm.querySelector('#new-reservation-manager').value;
                }
                
                const response = await window.apiFetch('reservations', { method: 'POST', body: JSON.stringify(formData) });
                if (response) {
                    newReservationModalEl.hide();
                    newReservationForm.reset();
                    document.getElementById('new-reservation-customer_id').value = '';
                    newCategorySelect.value = 'TOUR';
                    handleCategoryChange('new-reservation');
                    populateReservations(1, {});
                    updateCategorySummary({}); // 현황판도 새로고침
                }
            });
        }
        
        await populateReservations(1, {});

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('action') === 'new') {
            newReservationModalEl.show();
        }
    }

    initializePage();
});

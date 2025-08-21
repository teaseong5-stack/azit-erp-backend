document.addEventListener("DOMContentLoaded", async function() {
    // reservations.html 페이지가 아닐 경우, 스크립트 실행을 중단합니다.
    if (!document.getElementById('reservation-list-table')) return;

    // --- 1. 전역 변수 및 HTML 요소 선언 ---
    const user = await window.apiFetch('user-info');
    const reservationListTable = document.getElementById('reservation-list-table');
    const reservationFormContainer = document.getElementById('reservation-form');
    const modal = new bootstrap.Modal(document.getElementById('reservationModal'));
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSaveButton = document.getElementById('modal-save-button');
    
    // 필터 요소
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
    
    // 상태 변수
    let currentPage = 1;
    let totalPages = 1;
    let currentFilters = {};
    let allCustomers = []; // 모든 고객 정보를 저장할 배열

    // --- 2. 데이터 로딩 및 화면 렌더링 함수 ---

    /**
     * 서버에서 모든 고객 정보를 한 번만 불러와 전역 변수에 저장하는 함수
     */
    async function fetchAllCustomers() {
        const response = await window.apiFetch('customers?page_size=10000');
        if (response && response.results) {
            allCustomers = response.results;
        }
    }

    /**
     * 서버에서 예약 목록을 가져와 테이블에 표시하는 함수
     * @param {number} page - 조회할 페이지 번호
     * @param {object} filters - 적용할 필터 객체
     */
    async function populateReservations(page = 1, filters = {}) {
        currentFilters = filters;
        const params = new URLSearchParams({ page, ...filters });
        const endpoint = `reservations?${params.toString()}`;
        
        const response = await window.apiFetch(endpoint);
        reservationListTable.innerHTML = '';

        if (!response || !response.results) {
            pageInfo.textContent = '데이터가 없습니다.';
            prevPageButton.disabled = true;
            nextPageButton.disabled = true;
            return;
        }

        const reservations = response.results;
        const totalCount = response.count;
        totalPages = Math.ceil(totalCount / 50);

        reservations.forEach(res => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${res.id}</td>
                <td>${res.tour_name}</td>
                <td>${res.customer ? res.customer.name : 'N/A'}</td>
                <td>${res.manager ? res.manager.username : 'N/A'}</td>
                <td>${res.start_date || '미정'}</td>
                <td>${Number(res.total_price).toLocaleString()}원</td>
                <td><span class="badge bg-primary">${res.status}</span></td>
                <td></td>
            `;
            const actionCell = row.cells[7];
            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'btn-group';

            const editButton = document.createElement('button');
            editButton.textContent = '수정/상세';
            editButton.className = 'btn btn-sm btn-primary';
            editButton.onclick = () => openReservationModal(res.id);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = '삭제';
            deleteButton.className = 'btn btn-sm btn-danger';
            deleteButton.onclick = async () => {
                if (confirm(`[${res.tour_name}] 예약을 정말 삭제하시겠습니까?`)) {
                    await window.apiFetch(`reservations/${res.id}`, { method: 'DELETE' });
                    populateReservations(currentPage, currentFilters);
                }
            };
            
            buttonGroup.appendChild(editButton);
            buttonGroup.appendChild(deleteButton);
            actionCell.appendChild(buttonGroup);
            reservationListTable.appendChild(row);
        });

        currentPage = page;
        pageInfo.textContent = `페이지 ${currentPage} / ${totalPages} (총 ${totalCount}건)`;
        prevPageButton.disabled = !response.previous;
        nextPageButton.disabled = !response.next;
    }

    /**
     * 검색 가능 드롭다운을 초기화하고 이벤트를 연결하는 함수
     * @param {string} prefix - 폼 요소 ID의 접두사
     */
    function initializeSearchableCustomerDropdown(prefix) {
        const searchInput = document.getElementById(`${prefix}-customer-search`);
        const resultsContainer = document.getElementById(`${prefix}-customer-results`);
        const hiddenIdInput = document.getElementById(`${prefix}-customer_id`);

        if (!searchInput) return;

        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            resultsContainer.innerHTML = '';
            hiddenIdInput.value = ''; // 검색어 변경 시 id 초기화

            if (query.length < 1) {
                resultsContainer.style.display = 'none';
                return;
            }

            const filteredCustomers = allCustomers.filter(c => 
                c.name.toLowerCase().includes(query) || c.phone_number.includes(query)
            );

            if (filteredCustomers.length > 0) {
                resultsContainer.style.display = 'block';
                filteredCustomers.forEach(c => {
                    const item = document.createElement('a');
                    item.textContent = `${c.name} (${c.phone_number})`;
                    item.onclick = () => {
                        searchInput.value = `${c.name} (${c.phone_number})`;
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
            if (!searchInput.contains(e.target)) {
                resultsContainer.style.display = 'none';
            }
        });
    }

    /**
     * 예약 폼의 카테고리별 상세 필드를 생성하는 함수
     * @param {string} prefix - 폼 요소 ID의 접두사
     * @param {string} category - 선택된 카테고리
     * @param {object} details - 기존 상세 정보 데이터
     * @returns {string} - 생성된 HTML 문자열
     */
    function getCategoryFields(prefix, category, details = {}) {
        switch (category) {
            case 'TOUR':
                return `
                    <div class="col-md-4"><label for="${prefix}-startTime" class="form-label">시작 시간</label><input type="time" class="form-control" id="${prefix}-startTime" value="${details.startTime || ''}"></div>
                    <div class="col-md-4"><label for="${prefix}-pickupLocation" class="form-label">픽업 장소</label><input type="text" class="form-control" id="${prefix}-pickupLocation" value="${details.pickupLocation || ''}"></div>
                    <div class="col-md-4"><label for="${prefix}-dropoffLocation" class="form-label">샌딩 장소</label><input type="text" class="form-control" id="${prefix}-dropoffLocation" value="${details.dropoffLocation || ''}"></div>
                    <div class="col-md-4"><label for="${prefix}-adults" class="form-label">성인</label><input type="number" class="form-control" id="${prefix}-adults" value="${details.adults || 0}"></div>
                    <div class="col-md-4"><label for="${prefix}-children" class="form-label">아동</label><input type="number" class="form-control" id="${prefix}-children" value="${details.children || 0}"></div>
                    <div class="col-md-4"><label for="${prefix}-infants" class="form-label">유아</label><input type="number" class="form-control" id="${prefix}-infants" value="${details.infants || 0}"></div>
                `;
            default:
                return '<div class="col-12"><p class="text-muted">이 카테고리에는 추가 상세 정보가 없습니다.</p></div>';
        }
    }

    /**
     * 새 예약 또는 수정 폼의 전체 HTML을 생성하는 함수
     * @param {string} prefix - 폼 요소 ID의 접두사
     * @param {object} data - 기존 예약 데이터 (수정 시 사용)
     * @returns {string} - 생성된 HTML 폼 문자열
     */
    function renderFormFields(prefix, data = {}) {
        const details = data.details || {};
        const category = data.category || 'TOUR';
        
        return `
            <form id="${prefix}-form">
                <div class="row g-3">
                    <div class="col-md-6"><label for="${prefix}-tour_name" class="form-label">상품명</label><input type="text" class="form-control" id="${prefix}-tour_name" value="${data.tour_name || ''}" required></div>
                    <div class="col-md-6">
                        <label for="${prefix}-customer-search" class="form-label">고객</label>
                        <div class="searchable-dropdown">
                            <input type="text" class="form-control" id="${prefix}-customer-search" placeholder="고객 이름 또는 연락처로 검색..." autocomplete="off" value="${data.customer ? `${data.customer.name} (${data.customer.phone_number})` : ''}" required>
                            <input type="hidden" id="${prefix}-customer_id" value="${data.customer ? data.customer.id : ''}">
                            <div class="dropdown-content" id="${prefix}-customer-results"></div>
                        </div>
                    </div>
                    <div class="col-md-6"><label for="${prefix}-start_date" class="form-label">시작일</label><input type="date" class="form-control" id="${prefix}-start_date" value="${data.start_date || ''}"></div>
                    <div class="col-md-6"><label for="${prefix}-end_date" class="form-label">종료일</label><input type="date" class="form-control" id="${prefix}-end_date" value="${data.end_date || ''}"></div>
                    <div class="col-md-6"><label for="${prefix}-total_price" class="form-label">판매가</label><input type="number" class="form-control" id="${prefix}-total_price" value="${data.total_price || 0}"></div>
                    <div class="col-md-6"><label for="${prefix}-total_cost" class="form-label">원가</label><input type="number" class="form-control" id="${prefix}-total_cost" value="${data.total_cost || 0}"></div>
                    <div class="col-md-6"><label for="${prefix}-status" class="form-label">예약 상태</label><select class="form-select" id="${prefix}-status"></select></div>
                    <div class="col-md-6"><label for="${prefix}-category" class="form-label">카테고리</label><select class="form-select" id="${prefix}-category"></select></div>
                    <hr>
                    <h5>상세 정보</h5>
                    <div class="row g-3" id="${prefix}-details-container">
                        ${getCategoryFields(prefix, category, details)}
                    </div>
                    <hr>
                    <div class="col-12"><label for="${prefix}-requests" class="form-label">요청사항</label><textarea class="form-control" id="${prefix}-requests" rows="3">${data.requests || ''}</textarea></div>
                    <div class="col-12"><label for="${prefix}-notes" class="form-label">내부 메모</label><textarea class="form-control" id="${prefix}-notes" rows="3">${data.notes || ''}</textarea></div>
                </div>
            </form>
        `;
    }

    /**
     * 예약 수정/상세보기 모달을 열고 데이터를 채우는 함수
     * @param {number} reservationId - 조회할 예약의 ID
     */
    async function openReservationModal(reservationId) {
        const data = await window.apiFetch(`reservations/${reservationId}`);
        if (!data) return;

        modalTitle.textContent = `예약 정보 수정 (ID: ${reservationId})`;
        modalBody.innerHTML = renderFormFields('edit-reservation', data);
        
        initializeSearchableCustomerDropdown('edit-reservation');
        
        const categorySelect = document.getElementById('edit-reservation-category');
        const statusSelect = document.getElementById('edit-reservation-status');
        ['TOUR', 'RENTAL_CAR', 'ACCOMMODATION', 'GOLF', 'TICKET', 'OTHER'].forEach(cat => {
            categorySelect.innerHTML += `<option value="${cat}" ${data.category === cat ? 'selected' : ''}>${cat}</option>`;
        });
        ['PENDING', 'CONFIRMED', 'PAID', 'COMPLETED', 'CANCELED'].forEach(stat => {
            statusSelect.innerHTML += `<option value="${stat}" ${data.status === stat ? 'selected' : ''}>${stat}</option>`;
        });

        modal.show();

        modalSaveButton.onclick = async () => {
            const form = document.getElementById('edit-reservation-form');
            const formData = {
                tour_name: form.querySelector('#edit-reservation-tour_name').value,
                customer_id: form.querySelector('#edit-reservation-customer_id').value,
                start_date: form.querySelector('#edit-reservation-start_date').value,
                end_date: form.querySelector('#edit-reservation-end_date').value,
                total_price: form.querySelector('#edit-reservation-total_price').value,
                total_cost: form.querySelector('#edit-reservation-total_cost').value,
                status: form.querySelector('#edit-reservation-status').value,
                category: form.querySelector('#edit-reservation-category').value,
                requests: form.querySelector('#edit-reservation-requests').value,
                notes: form.querySelector('#edit-reservation-notes').value,
                details: {}
            };

            await window.apiFetch(`reservations/${reservationId}`, {
                method: 'PUT',
                body: JSON.stringify(formData)
            });
            modal.hide();
            populateReservations(currentPage, currentFilters);
        };
    }

    // --- 3. 이벤트 리스너 설정 ---

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
    });
    
    exportCsvButton.addEventListener('click', () => {
        window.open(window.API_BASE_URL + '/export-csv/', '_blank');
    });

    prevPageButton.addEventListener('click', () => {
        if (currentPage > 1) {
            populateReservations(currentPage - 1, currentFilters);
        }
    });

    nextPageButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            populateReservations(currentPage + 1, currentFilters);
        }
    });

    // --- 4. 페이지 초기화 ---
    async function initializePage() {
        await fetchAllCustomers();
        await populateReservations(1, {});
        
        const formHtml = renderFormFields('new-reservation');
        reservationFormContainer.innerHTML = formHtml;
        
        initializeSearchableCustomerDropdown('new-reservation');
        
        const newCategorySelect = document.getElementById('new-reservation-category');
        const newStatusSelect = document.getElementById('new-reservation-status');
        ['TOUR', 'RENTAL_CAR', 'ACCOMMODATION', 'GOLF', 'TICKET', 'OTHER'].forEach(cat => {
            newCategorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
        ['PENDING', 'CONFIRMED', 'PAID', 'COMPLETED', 'CANCELED'].forEach(stat => {
            newStatusSelect.innerHTML += `<option value="${stat}">${stat}</option>`;
        });

        const newReservationForm = document.getElementById('new-reservation-form');
        if(newReservationForm){
            newReservationForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = {
                    tour_name: newReservationForm.querySelector('#new-reservation-tour_name').value,
                    customer_id: newReservationForm.querySelector('#new-reservation-customer_id').value,
                    start_date: newReservationForm.querySelector('#new-reservation-start_date').value,
                    end_date: newReservationForm.querySelector('#new-reservation-end_date').value,
                    total_price: newReservationForm.querySelector('#new-reservation-total_price').value,
                    total_cost: newReservationForm.querySelector('#new-reservation-total_cost').value,
                    status: newReservationForm.querySelector('#new-reservation-status').value,
                    category: newReservationForm.querySelector('#new-reservation-category').value,
                    requests: newReservationForm.querySelector('#new-reservation-requests').value,
                    notes: newReservationForm.querySelector('#new-reservation-notes').value,
                    details: {}
                };
                await window.apiFetch('reservations', {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
                newReservationForm.reset();
                populateReservations(1, {});
            });
        }
    }

    initializePage();
});

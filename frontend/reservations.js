document.addEventListener("DOMContentLoaded", async function() {
    if (!document.getElementById('reservation-list-table')) return;

    // --- 1. 전역 변수 및 HTML 요소 선언 ---
    const user = await window.apiFetch('user-info');
    const reservationListTable = document.getElementById('reservation-list-table');
    const newReservationModal = new bootstrap.Modal(document.getElementById('newReservationModal'));
    const newReservationFormContainer = document.getElementById('new-reservation-form-container');
    const showNewReservationModalButton = document.getElementById('show-new-reservation-modal');
    const modal = new bootstrap.Modal(document.getElementById('reservationModal'));
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSaveButton = document.getElementById('modal-save-button');
    const filterCategory = document.getElementById('filter-category');
    const filterSearch = document.getElementById('filter-search');
    const filterStartDate = document.getElementById('filter-start-date');
    const filterEndDate = document.getElementById('filter-end-date');
    const filterButton = document.getElementById('filter-button');
    const exportCsvButton = document.getElementById('export-csv-button');
    const prevPageButton = document.getElementById('prev-page-button');
    const nextPageButton = document.getElementById('next-page-button');
    const pageInfo = document.getElementById('page-info');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const bulkDeleteButton = document.getElementById('bulk-delete-button');
    let currentPage = 1;
    let totalPages = 1;
    let currentFilters = {};
    let allCustomers = [];

    // --- 2. 데이터 로딩 및 화면 렌더링 함수 ---

    async function fetchAllCustomers() {
        const response = await window.apiFetch('customers?page_size=10000');
        if (response && response.results) {
            allCustomers = response.results;
        }
    }
    
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
            const margin = (res.total_price || 0) - (res.total_cost || 0);

            row.innerHTML = `
                <td><input type="checkbox" class="form-check-input reservation-checkbox" value="${res.id}"></td>
                <td>${res.customer ? res.customer.name : 'N/A'}</td>
                <td>${res.reservation_date || 'N/A'}</td>
                <td>${res.start_date || '미정'}</td>
                <td>${res.category || 'N/A'}</td>
                <td>${res.tour_name}</td>
                <td>${Number(res.total_cost).toLocaleString()} VND</td>
                <td>${Number(res.total_price).toLocaleString()} VND</td>
                <td class="${margin >= 0 ? 'text-primary' : 'text-danger'} fw-bold">${Number(margin).toLocaleString()} VND</td>
                <td><span class="badge bg-primary">${res.status}</span></td>
                <td>${res.manager ? res.manager.username : 'N/A'}</td>
                <td></td>
            `;
            const actionCell = row.cells[11];
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
        if(selectAllCheckbox) selectAllCheckbox.checked = false;
    }

    function initializeSearchableCustomerDropdown(prefix) {
        const searchInput = document.getElementById(`${prefix}-customer-search`);
        const resultsContainer = document.getElementById(`${prefix}-customer-results`);
        const hiddenIdInput = document.getElementById(`${prefix}-customer_id`);
        if (!searchInput) return;
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            resultsContainer.innerHTML = '';
            hiddenIdInput.value = '';
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
            if (e.target !== searchInput) {
                resultsContainer.style.display = 'none';
            }
        });
    }

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
                return `
                    <div class="col-md-12"><label for="${prefix}-usageTime" class="form-label">이용 시간</label><input type="time" class="form-control" id="${prefix}-usageTime" value="${details.usageTime || ''}"></div>
                    ${commonFields}
                `;
            case 'OTHER':
                return `
                    <div class="col-md-12"><label for="${prefix}-usageTime" class="form-label">이용 시간</label><input type="time" class="form-control" id="${prefix}-usageTime" value="${details.usageTime || ''}"></div>
                    ${commonFields}
                `;
            default:
                return '<div class="col-12"><p class="text-muted">이 카테고리에는 추가 상세 정보가 없습니다.</p></div>';
        }
    }
    
    function getDetailsFromForm(prefix, category) {
        const details = {};
        const form = document.getElementById(`${prefix}-form`);
        if (!form) return details;
        const getFieldValue = (id) => form.querySelector(`#${prefix}-${id}`)?.value;
        switch (category) {
            case 'TOUR':
                details.startTime = getFieldValue('startTime');
                details.pickupLocation = getFieldValue('pickupLocation');
                details.dropoffLocation = getFieldValue('dropoffLocation');
                details.adults = getFieldValue('adults');
                details.children = getFieldValue('children');
                details.infants = getFieldValue('infants');
                break;
            case 'RENTAL_CAR':
                details.carType = getFieldValue('carType');
                details.usageHours = getFieldValue('usageHours');
                details.startTime = getFieldValue('startTime');
                details.pickupLocation = getFieldValue('pickupLocation');
                details.dropoffLocation = getFieldValue('dropoffLocation');
                details.adults = getFieldValue('adults');
                details.children = getFieldValue('children');
                details.infants = getFieldValue('infants');
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
            case 'TICKET':
                details.usageTime = getFieldValue('usageTime');
                details.adults = getFieldValue('adults');
                details.children = getFieldValue('children');
                details.infants = getFieldValue('infants');
                break;
            case 'OTHER':
                details.usageTime = getFieldValue('usageTime');
                details.adults = getFieldValue('adults');
                details.children = getFieldValue('children');
                details.infants = getFieldValue('infants');
                break;
        }
        return details;
    }

    function handleCategoryChange(prefix) {
        const categorySelect = document.getElementById(`${prefix}-category`);
        const detailsContainer = document.getElementById(`${prefix}-details-container`);
        const tourNameLabel = document.querySelector(`label[for='${prefix}-tour_name']`);
        const startDateLabel = document.querySelector(`label[for='${prefix}-start_date']`);
        if (categorySelect && detailsContainer) {
            const category = categorySelect.value;
            detailsContainer.innerHTML = getCategoryFields(prefix, category, {});
            if (tourNameLabel) {
                tourNameLabel.textContent = (category === 'ACCOMMODATION') ? '숙소명' : (category === 'GOLF') ? '골프장명' : '상품명';
            }
            if (startDateLabel) {
                startDateLabel.textContent = (category === 'GOLF') ? '라운딩일자' : (category === 'ACCOMMODATION' ? '체크인' : '출발일');
            }
        }
    }

    function renderFormFields(prefix, data = {}) {
        const details = data.details || {};
        const category = data.category || 'TOUR';
        const productNameLabel = (category === 'ACCOMMODATION') ? '숙소명' : (category === 'GOLF') ? '골프장명' : '상품명';
        return `
            <form id="${prefix}-form">
                <div class="row g-3">
                    <div class="col-md-4"><label for="${prefix}-customer-search" class="form-label">고객명</label>
                        <div class="searchable-dropdown">
                            <input type="text" class="form-control" id="${prefix}-customer-search" placeholder="고객 검색..." autocomplete="off" value="${data.customer ? `${data.customer.name} (${data.customer.phone_number})` : ''}" required>
                            <input type="hidden" id="${prefix}-customer_id" value="${data.customer ? data.customer.id : ''}">
                            <div class="dropdown-content" id="${prefix}-customer-results"></div>
                        </div>
                    </div>
                    <div class="col-md-4"><label for="${prefix}-category" class="form-label">카테고리</label><select class="form-select" id="${prefix}-category"></select></div>
                    <div class="col-md-4"><label for="${prefix}-tour_name" class="form-label">${productNameLabel}</label><input type="text" class="form-control" id="${prefix}-tour_name" value="${data.tour_name || ''}" required></div>
                    <div class="col-md-4"><label for="${prefix}-reservation_date" class="form-label">예약일</label><input type="date" class="form-control" id="${prefix}-reservation_date" value="${data.reservation_date || new Date().toISOString().split('T')[0]}"></div>
                    <div class="col-md-4"><label for="${prefix}-start_date" class="form-label">${category === 'GOLF' ? '라운딩일자' : '출발일/체크인'}</label><input type="date" class="form-control" id="${prefix}-start_date" value="${data.start_date || ''}"></div>
                    <div class="col-md-4"><label for="${prefix}-end_date" class="form-label">종료일/체크아웃</label><input type="date" class="form-control" id="${prefix}-end_date" value="${data.end_date || ''}"></div>
                    <hr>
                    <h5>상세 정보</h5>
                    <div class="row g-3" id="${prefix}-details-container">
                        ${getCategoryFields(prefix, category, details)}
                    </div>
                    <hr>
                    <div class="col-md-3"><label for="${prefix}-total_price" class="form-label">판매가</label><input type="number" class="form-control" id="${prefix}-total_price" value="${data.total_price || 0}"></div>
                    <div class="col-md-3"><label for="${prefix}-total_cost" class="form-label">원가</label><input type="number" class="form-control" id="${prefix}-total_cost" value="${data.total_cost || 0}"></div>
                    <div class="col-md-3"><label for="${prefix}-payment_amount" class="form-label">결제금액</label><input type="number" class="form-control" id="${prefix}-payment_amount" value="${data.payment_amount || 0}"></div>
                    <div class="col-md-3"><label for="${prefix}-status" class="form-label">예약 상태</label><select class="form-select" id="${prefix}-status"></select></div>
                    <div class="col-12"><label for="${prefix}-requests" class="form-label">요청사항 (외부/고객)</label><textarea class="form-control" id="${prefix}-requests" rows="3">${data.requests || ''}</textarea></div>
                    <div class="col-12"><label for="${prefix}-notes" class="form-label">메모 (내부 참고 사항)</label><textarea class="form-control" id="${prefix}-notes" rows="3">${data.notes || ''}</textarea></div>
                </div>
                ${prefix === 'new-reservation' ? '<button type="submit" class="btn btn-primary mt-3">예약 등록</button>' : ''}
            </form>
        `;
    }

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
        categorySelect.addEventListener('change', () => handleCategoryChange('edit-reservation'));
        modal.show();
        modalSaveButton.onclick = async () => {
            const form = document.getElementById('edit-reservation-form');
            const category = form.querySelector('#edit-reservation-category').value;
            // [수정] 비어있는 날짜 값을 null로 변환하는 로직 추가
            const startDateValue = form.querySelector('#edit-reservation-start_date').value;
            const endDateValue = form.querySelector('#edit-reservation-end_date').value;
            const formData = {
                tour_name: form.querySelector('#edit-reservation-tour_name').value,
                customer_id: form.querySelector('#edit-reservation-customer_id').value,
                reservation_date: form.querySelector('#edit-reservation-reservation_date').value,
                start_date: startDateValue ? startDateValue : null,
                end_date: endDateValue ? endDateValue : null,
                total_price: form.querySelector('#edit-reservation-total_price').value.replace(/,/g, ''),
                total_cost: form.querySelector('#edit-reservation-total_cost').value.replace(/,/g, ''),
                payment_amount: form.querySelector('#edit-reservation-payment_amount').value.replace(/,/g, ''),
                status: form.querySelector('#edit-reservation-status').value,
                category: category,
                requests: form.querySelector('#edit-reservation-requests').value,
                notes: form.querySelector('#edit-reservation-notes').value,
                details: getDetailsFromForm('edit-reservation', category)
            };
            const response = await window.apiFetch(`reservations/${reservationId}`, { method: 'PUT', body: JSON.stringify(formData) });
            if (response) {
                modal.hide();
                populateReservations(currentPage, currentFilters);
            }
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
        if (currentPage > 1) populateReservations(currentPage - 1, currentFilters);
    });
    nextPageButton.addEventListener('click', () => {
        if (currentPage < totalPages) populateReservations(currentPage + 1, currentFilters);
    });
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
        newReservationModal.show();
    });

    // --- 4. 페이지 초기화 ---
    async function initializePage() {
        await fetchAllCustomers();
        await populateReservations(1, {});
        
        const formHtml = renderFormFields('new-reservation');
        newReservationFormContainer.innerHTML = formHtml;
        
        initializeSearchableCustomerDropdown('new-reservation');
        
        const newCategorySelect = document.getElementById('new-reservation-category');
        const newStatusSelect = document.getElementById('new-reservation-status');
        ['TOUR', 'RENTAL_CAR', 'ACCOMMODATION', 'GOLF', 'TICKET', 'OTHER'].forEach(cat => {
            newCategorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
        ['PENDING', 'CONFIRMED', 'PAID', 'COMPLETED', 'CANCELED'].forEach(stat => {
            newStatusSelect.innerHTML += `<option value="${stat}">${stat}</option>`;
        });
        newCategorySelect.addEventListener('change', () => handleCategoryChange('new-reservation'));

        const newReservationForm = document.getElementById('new-reservation-form');
        if(newReservationForm){
            newReservationForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const category = newReservationForm.querySelector('#new-reservation-category').value;
                // [수정] 비어있는 날짜 값을 null로 변환하는 로직 추가
                const startDateValue = newReservationForm.querySelector('#new-reservation-start_date').value;
                const endDateValue = newReservationForm.querySelector('#new-reservation-end_date').value;
                const formData = {
                    tour_name: newReservationForm.querySelector('#new-reservation-tour_name').value,
                    customer_id: newReservationForm.querySelector('#new-reservation-customer_id').value,
                    reservation_date: newReservationForm.querySelector('#new-reservation-reservation_date').value,
                    start_date: startDateValue ? startDateValue : null,
                    end_date: endDateValue ? endDateValue : null,
                    total_price: newReservationForm.querySelector('#new-reservation-total_price').value.replace(/,/g, ''),
                    total_cost: newReservationForm.querySelector('#new-reservation-total_cost').value.replace(/,/g, ''),
                    payment_amount: newReservationForm.querySelector('#new-reservation-payment_amount').value.replace(/,/g, ''),
                    status: newReservationForm.querySelector('#new-reservation-status').value,
                    category: category,
                    requests: newReservationForm.querySelector('#new-reservation-requests').value,
                    notes: newReservationForm.querySelector('#new-reservation-notes').value,
                    details: getDetailsFromForm('new-reservation', category)
                };
                const response = await window.apiFetch('reservations', { method: 'POST', body: JSON.stringify(formData) });
                if (response) {
                    newReservationModal.hide();
                    newReservationForm.reset();
                    newCategorySelect.value = 'TOUR';
                    handleCategoryChange('new-reservation');
                    populateReservations(1, {});
                }
            });
        }

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('action') === 'new') {
            newReservationModal.show();
        }
    }

    initializePage();
});

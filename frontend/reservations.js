document.addEventListener("DOMContentLoaded", async function() {
    // reservations.html 페이지에 있을 때만 이 코드를 실행합니다.
    if (!document.getElementById('reservation-list-table')) return;

    const user = await window.apiFetch('user-info');
    const reservationListTable = document.getElementById('reservation-list-table');
    const reservationForm = document.getElementById('reservation-form');
    const customerInput = document.getElementById('res-customer');
    const customerOptions = document.getElementById('customerOptions');
    const categorySelect = document.getElementById('res-category');
    const managerSelect = document.getElementById('res-manager');
    const dynamicFieldsContainer = document.getElementById('dynamic-form-fields');
    const returningCustomerAlert = document.getElementById('returning-customer-alert');
    const filterCategory = document.getElementById('filter-category');
    const filterSearchInput = document.getElementById('filter-search');
    const filterStartDate = document.getElementById('filter-start-date');
    const filterEndDate = document.getElementById('filter-end-date');
    const filterButton = document.getElementById('filter-button');
    const filterResetButton = document.getElementById('filter-reset-button');
    
    const statusEditModal = new bootstrap.Modal(document.getElementById('statusEditModal'));
    const statusModalTourName = document.getElementById('status-modal-tour-name');
    const statusModalSelect = document.getElementById('status-modal-select');
    const statusModalSaveButton = document.getElementById('status-modal-save-button');
    
    const detailEditModal = new bootstrap.Modal(document.getElementById('detailEditModal'));
    const detailModalSaveButton = document.getElementById('detail-modal-save-button');
    const editCustomerInput = document.getElementById('edit-customer');
    const editCustomerOptions = document.getElementById('editCustomerOptions');
    const editDynamicFieldsContainer = document.getElementById('edit-dynamic-form-fields');
    const editCategorySelect = document.getElementById('edit-category-select');

    let customerMap = new Map();
    let allReservations = [];

    if (user && user.is_superuser) {
        const users = await window.apiFetch('users');
        managerSelect.innerHTML = '';
        if (users) {
            users.forEach(u => {
                const option = document.createElement('option');
                option.value = u.id;
                option.textContent = u.username;
                managerSelect.appendChild(option);
            });
        }
    } else if (user) {
        managerSelect.innerHTML = `<option value="${user.id}">${user.username}</option>`;
        managerSelect.disabled = true;
    }

    const formTemplates = {
        TOUR: `
            <h4 class="mt-4">투어 정보</h4>
            <div class="row g-3">
                <div class="col-md-12"><label class="form-label">상품명</label><input type="text" class="form-control" id="details-productName" required></div>
                <div class="col-md-6"><label class="form-label">출발일</label><input type="date" class="form-control" id="details-startDate"></div>
                <div class="col-md-6"><label class="form-label">출발시간</label><input type="time" class="form-control" id="details-startTime"></div>
                <div class="col-md-6"><label class="form-label">픽업장소</label><input type="text" class="form-control" id="details-pickupLocation"></div>
                <div class="col-md-6"><label class="form-label">샌딩장소</label><input type="text" class="form-control" id="details-dropoffLocation"></div>
                <div class="col-md-4"><label class="form-label">성인</label><input type="number" class="form-control" id="details-adults" value="0"></div>
                <div class="col-md-4"><label class="form-label">아동</label><input type="number" class="form-control" id="details-children" value="0"></div>
                <div class="col-md-4"><label class="form-label">유아</label><input type="number" class="form-control" id="details-infants" value="0"></div>
            </div>`,
        RENTAL_CAR: `
            <h4 class="mt-4">렌터카 정보</h4>
            <div class="row g-3">
                <div class="col-md-6">
                    <label class="form-label">차량 선택</label>
                    <input class="form-control" list="carTypeOptions" id="details-carType" placeholder="차량 종류 선택 또는 직접 입력..." required>
                    <datalist id="carTypeOptions">
                        <option value="4인승"></option>
                        <option value="7인승"></option>
                        <option value="9인승(리무진)"></option>
                        <option value="16인승"></option>
                        <option value="29인승"></option>
                        <option value="45인승"></option>
                    </datalist>
                </div>
                <div class="col-md-6">
                    <label class="form-label">이용시간</label>
                    <input class="form-control" list="usageHoursOptions" id="details-usageHours" placeholder="이용 시간 선택 또는 직접 입력...">
                    <datalist id="usageHoursOptions">
                        <option value="6시간"></option>
                        <option value="12시간"></option>
                        <option value="픽업"></option>
                        <option value="샌딩"></option>
                        <option value="픽업+샌딩"></option>
                        <option value="공항픽업"></option>
                        <option value="공항샌딩"></option>
                    </datalist>
                </div>
                <div class="col-md-6"><label class="form-label">픽업일시</label><input type="datetime-local" class="form-control" id="details-pickupDateTime"></div>
                <div class="col-md-6"><label class="form-label">픽업/샌딩장소</label><input type="text" class="form-control" id="details-location"></div>
                <div class="col-md-3"><label class="form-label">인원수</label><input type="number" class="form-control" id="details-passengers" value="0"></div>
                <div class="col-md-3"><label class="form-label">캐리어</label><input type="number" class="form-control" id="details-carriers" value="0"></div>
                <div class="col-md-3"><label class="form-label">카시트</label><input type="number" class="form-control" id="details-carSeats" value="0"></div>
                <div class="col-md-3"><label class="form-label">유모차</label><input type="number" class="form-control" id="details-strollers" value="0"></div>
            </div>`,
        ACCOMMODATION: `
            <h4 class="mt-4">숙박 정보</h4>
            <div class="row g-3">
                <div class="col-12"><label class="form-label">숙소명</label><input type="text" class="form-control" id="details-hotelName" required></div>
                <div class="col-md-6"><label class="form-label">체크인</label><input type="date" class="form-control" id="details-checkIn"></div>
                <div class="col-md-6"><label class="form-label">체크아웃</label><input type="date" class="form-control" id="details-checkOut"></div>
                <div class="col-md-4"><label class="form-label">방 종류</label><input type="text" class="form-control" id="details-roomType"></div>
                <div class="col-md-4"><label class="form-label">룸 수량</label><input type="number" class="form-control" id="details-roomCount" value="1"></div>
                <div class="col-md-4"><label class="form-label">인원수</label><input type="number" class="form-control" id="details-guests" value="0"></div>
            </div>`,
        GOLF: `
            <h4 class="mt-4">골프 정보</h4>
            <div class="row g-3">
                <div class="col-12"><label class="form-label">골프장</label><input type="text" class="form-control" id="details-golfCourse" required></div>
                <div class="col-md-6"><label class="form-label">티오프 날짜</label><input type="date" class="form-control" id="details-teeOffDate"></div>
                <div class="col-md-6"><label class="form-label">티오프 시간</label><input type="time" class="form-control" id="details-teeOffTime"></div>
                <div class="col-md-6"><label class="form-label">인원수</label><input type="number" class="form-control" id="details-players" value="0"></div>
                <div class="col-md-6"><label class="form-label">라운딩 수량</label><input type="number" class="form-control" id="details-rounds" value="18"></div>
            </div>`,
        TICKET: `
            <h4 class="mt-4">티켓 정보</h4>
            <div class="row g-3">
                <div class="col-12"><label class="form-label">상품명</label><input type="text" class="form-control" id="details-ticketName" required></div>
                <div class="col-md-6"><label class="form-label">사용일</label><input type="date" class="form-control" id="details-usageDate"></div>
                <div class="col-md-6"><label class="form-label">사용시간</label><input type="time" class="form-control" id="details-usageTime"></div>
                <div class="col-md-4"><label class="form-label">성인</label><input type="number" class="form-control" id="details-adults" value="0"></div>
                <div class="col-md-4"><label class="form-label">아동</label><input type="number" class="form-control" id="details-children" value="0"></div>
                <div class="col-md-4"><label class="form-label">유아</label><input type="number" class="form-control" id="details-infants" value="0"></div>
            </div>`,
        OTHER: `
            <h4 class="mt-4">기타 정보</h4>
            <div class="row g-3">
                <div class="col-12"><label class="form-label">상품명</label><input type="text" class="form-control" id="details-productName" required></div>
                <div class="col-md-6"><label class="form-label">시작일</label><input type="date" class="form-control" id="details-startDate"></div>
                <div class="col-md-6"><label class="form-label">시작시간</label><input type="time" class="form-control" id="details-startTime"></div>
            </div>`
    };
    
    const editFormTemplates = {
        TOUR: `
            <div class="row g-3">
                <div class="col-12"><label class="form-label">상품명</label><input type="text" class="form-control" id="edit-details-productName" required></div>
                <div class="col-md-6"><label class="form-label">출발일</label><input type="date" class="form-control" id="edit-details-startDate"></div>
                <div class="col-md-6"><label class="form-label">출발시간</label><input type="time" class="form-control" id="edit-details-startTime"></div>
                <div class="col-md-6"><label class="form-label">픽업장소</label><input type="text" class="form-control" id="edit-details-pickupLocation"></div>
                <div class="col-md-6"><label class="form-label">샌딩장소</label><input type="text" class="form-control" id="edit-details-dropoffLocation"></div>
                <div class="col-md-4"><label class="form-label">성인</label><input type="number" class="form-control" id="edit-details-adults"></div>
                <div class="col-md-4"><label class="form-label">아동</label><input type="number" class="form-control" id="edit-details-children"></div>
                <div class="col-md-4"><label class="form-label">유아</label><input type="number" class="form-control" id="edit-details-infants"></div>
            </div>`,
        RENTAL_CAR: `
            <div class="row g-3">
                <div class="col-md-6">
                    <label class="form-label">차량 선택</label>
                    <input class="form-control" list="editCarTypeOptions" id="edit-details-carType" required>
                    <datalist id="editCarTypeOptions">
                        <option value="4인승"></option>
                        <option value="7인승"></option>
                        <option value="9인승(리무진)"></option>
                        <option value="16인승"></option>
                        <option value="29인승"></option>
                        <option value="45인승"></option>
                    </datalist>
                </div>
                <div class="col-md-6">
                    <label class="form-label">이용시간</label>
                    <input class="form-control" list="editUsageHoursOptions" id="edit-details-usageHours">
                    <datalist id="editUsageHoursOptions">
                        <option value="6시간"></option>
                        <option value="12시간"></option>
                        <option value="픽업"></option>
                        <option value="샌딩"></option>
                        <option value="픽업+샌딩"></option>
                        <option value="공항픽업"></option>
                        <option value="공항샌딩"></option>
                    </datalist>
                </div>
                <div class="col-md-6"><label class="form-label">픽업일시</label><input type="datetime-local" class="form-control" id="edit-details-pickupDateTime"></div>
                <div class="col-md-6"><label class="form-label">픽업/샌딩장소</label><input type="text" class="form-control" id="edit-details-location"></div>
                <div class="col-md-3"><label class="form-label">인원수</label><input type="number" class="form-control" id="edit-details-passengers"></div>
                <div class="col-md-3"><label class="form-label">캐리어</label><input type="number" class="form-control" id="edit-details-carriers"></div>
                <div class="col-md-3"><label class="form-label">카시트</label><input type="number" class="form-control" id="edit-details-carSeats"></div>
                <div class="col-md-3"><label class="form-label">유모차</label><input type="number" class="form-control" id="edit-details-strollers"></div>
            </div>`,
        ACCOMMODATION: `
            <div class="row g-3">
                <div class="col-12"><label class="form-label">숙소명</label><input type="text" class="form-control" id="edit-details-hotelName" required></div>
                <div class="col-md-6"><label class="form-label">체크인</label><input type="date" class="form-control" id="edit-details-checkIn"></div>
                <div class="col-md-6"><label class="form-label">체크아웃</label><input type="date" class="form-control" id="edit-details-checkOut"></div>
                <div class="col-md-4"><label class="form-label">방 종류</label><input type="text" class="form-control" id="edit-details-roomType"></div>
                <div class="col-md-4"><label class="form-label">룸 수량</label><input type="number" class="form-control" id="edit-details-roomCount"></div>
                <div class="col-md-4"><label class="form-label">인원수</label><input type="number" class="form-control" id="edit-details-guests"></div>
            </div>`,
        GOLF: `
            <div class="row g-3">
                <div class="col-12"><label class="form-label">골프장</label><input type="text" class="form-control" id="edit-details-golfCourse" required></div>
                <div class="col-md-6"><label class="form-label">티오프 날짜</label><input type="date" class="form-control" id="edit-details-teeOffDate"></div>
                <div class="col-md-6"><label class="form-label">티오프 시간</label><input type="time" class="form-control" id="edit-details-teeOffTime"></div>
                <div class="col-md-6"><label class="form-label">인원수</label><input type="number" class="form-control" id="edit-details-players"></div>
                <div class="col-md-6"><label class="form-label">라운딩 수량</label><input type="number" class="form-control" id="edit-details-rounds"></div>
            </div>`,
        TICKET: `
            <div class="row g-3">
                <div class="col-12"><label class="form-label">상품명</label><input type="text" class="form-control" id="edit-details-ticketName" required></div>
                <div class="col-md-6"><label class="form-label">사용일</label><input type="date" class="form-control" id="edit-details-usageDate"></div>
                <div class="col-md-6"><label class="form-label">사용시간</label><input type="time" class="form-control" id="edit-details-usageTime"></div>
                <div class="col-md-4"><label class="form-label">성인</label><input type="number" class="form-control" id="edit-details-adults"></div>
                <div class="col-md-4"><label class="form-label">아동</label><input type="number" class="form-control" id="edit-details-children"></div>
                <div class="col-md-4"><label class="form-label">유아</label><input type="number" class="form-control" id="edit-details-infants"></div>
            </div>`,
        OTHER: `
            <div class="row g-3">
                <div class="col-12"><label class="form-label">상품명</label><input type="text" class="form-control" id="edit-details-productName" required></div>
                <div class="col-md-6"><label class="form-label">시작일</label><input type="date" class="form-control" id="edit-details-startDate"></div>
                <div class="col-md-6"><label class="form-label">시작시간</label><input type="time" class="form-control" id="edit-details-startTime"></div>
            </div>`
    };

    function updateFormFields() {
        const category = categorySelect.value;
        dynamicFieldsContainer.innerHTML = formTemplates[category] || '';
    }

    categorySelect.addEventListener('change', updateFormFields);

    async function populateReservations(filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        const reservations = await window.apiFetch(`reservations?${queryString}`);
        allReservations = reservations || [];
        reservationListTable.innerHTML = '';
        if(!reservations) return;
        
        reservations.forEach(res => {
            const row = document.createElement('tr');
            const customerName = res.customer ? res.customer.name : '삭제된 고객';
            
            row.innerHTML = `
                <td>${res.id}</td>
                <td>${res.reservation_date}</td>
                <td><span class="badge bg-secondary">${res.status}</span></td>
                <td><span class="badge bg-success">${res.payment_status}</span></td>
                <td>${res.category}</td>
                <td>${res.tour_name}</td>
                <td>${customerName}</td>
                <td>${res.start_date || ''}</td>
                <td>${Number(res.payment_amount).toLocaleString()}원</td>
                <td></td>
            `;
            
            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'btn-group';

            const detailEditButton = document.createElement('button');
            detailEditButton.textContent = '상세';
            detailEditButton.className = 'btn btn-primary btn-sm';
            detailEditButton.onclick = () => {
                editDynamicFieldsContainer.innerHTML = editFormTemplates[res.category] || '';
                editCategorySelect.value = res.category;
                
                const customerIdentifier = res.customer ? `${res.customer.name} (${res.customer.phone_number.slice(-4)})` : '';
                editCustomerInput.value = customerIdentifier;
                
                document.getElementById('edit-price').value = res.total_price;
                document.getElementById('edit-cost').value = res.total_cost;
                document.getElementById('edit-payment-amount').value = res.payment_amount;
                document.getElementById('edit-payment-status').value = res.payment_status;
                document.getElementById('edit-notes').value = res.notes;
                document.getElementById('edit-requests').value = res.requests;

                if (res.category === 'TOUR') {
                    document.getElementById('edit-details-productName').value = res.details.productName || '';
                    document.getElementById('edit-details-startDate').value = res.start_date || '';
                    document.getElementById('edit-details-startTime').value = res.details.startTime || '';
                    document.getElementById('edit-details-pickupLocation').value = res.details.pickupLocation || '';
                    document.getElementById('edit-details-dropoffLocation').value = res.details.dropoffLocation || '';
                    document.getElementById('edit-details-adults').value = res.details.adults || 0;
                    document.getElementById('edit-details-children').value = res.details.children || 0;
                    document.getElementById('edit-details-infants').value = res.details.infants || 0;
                } else if (res.category === 'TICKET') {
                    document.getElementById('edit-details-ticketName').value = res.details.ticketName || '';
                    document.getElementById('edit-details-usageDate').value = res.start_date || '';
                    document.getElementById('edit-details-usageTime').value = res.details.usageTime || '';
                    document.getElementById('edit-details-adults').value = res.details.adults || 0;
                    document.getElementById('edit-details-children').value = res.details.children || 0;
                    document.getElementById('edit-details-infants').value = res.details.infants || 0;
                } // ... 다른 카테고리 else if 추가 ...
                
                detailModalSaveButton.onclick = async () => {
                    const editCustomerIdentifier = editCustomerInput.value;
                    const editCustomerId = customerMap.get(editCustomerIdentifier);

                    if (!editCustomerId) {
                        alert(`'${editCustomerIdentifier}' 고객을 찾을 수 없습니다.`);
                        return;
                    }

                    const newCategory = editCategorySelect.value;
                    let tour_name = '', details = {}, start_date = null, end_date = null;
                    
                    if (newCategory === 'TOUR') {
                        tour_name = document.getElementById('edit-details-productName').value;
                        start_date = document.getElementById('edit-details-startDate').value || null;
                        details = {
                            productName: tour_name, startTime: document.getElementById('edit-details-startTime').value,
                            pickupLocation: document.getElementById('edit-details-pickupLocation').value,
                            dropoffLocation: document.getElementById('edit-details-dropoffLocation').value,
                            adults: document.getElementById('edit-details-adults').value,
                            children: document.getElementById('edit-details-children').value,
                            infants: document.getElementById('edit-details-infants').value,
                        };
                    } else if (newCategory === 'TICKET') {
                        tour_name = document.getElementById('edit-details-ticketName').value;
                        start_date = document.getElementById('edit-details-usageDate').value || null;
                        details = {
                            ticketName: tour_name, usageTime: document.getElementById('edit-details-usageTime').value,
                            adults: document.getElementById('edit-details-adults').value,
                            children: document.getElementById('edit-details-children').value,
                            infants: document.getElementById('edit-details-infants').value,
                        };
                    } // ... 다른 카테고리 데이터 수집 로직 추가 ...

                    const updatedData = {
                        customer_id: editCustomerId,
                        tour_name, details, start_date, end_date,
                        total_price: document.getElementById('edit-price').value,
                        total_cost: document.getElementById('edit-cost').value,
                        payment_amount: document.getElementById('edit-payment-amount').value,
                        payment_status: document.getElementById('edit-payment-status').value,
                        notes: document.getElementById('edit-notes').value,
                        requests: document.getElementById('edit-requests').value,
                        status: res.status,
                        category: newCategory
                    };
                    await window.apiFetch(`reservations/${res.id}`, { method: 'PUT', body: JSON.stringify(updatedData) });
                    detailEditModal.hide();
                    populateReservations();
                };
                detailEditModal.show();
            };

            const statusEditButton = document.createElement('button');
            statusEditButton.textContent = '상태';
            statusEditButton.className = 'btn btn-info btn-sm';
            statusEditButton.onclick = () => {
                statusModalTourName.textContent = res.tour_name;
                statusModalSelect.value = res.status;
                statusModalSaveButton.onclick = async () => {
                    const updatedData = { ...res, customer_id: res.customer.id, status: statusModalSelect.value };
                    await window.apiFetch(`reservations/${res.id}`, { method: 'PUT', body: JSON.stringify(updatedData) });
                    statusEditModal.hide();
                    populateReservations();
                };
                statusEditModal.show();
            };
            
            const deleteButton = document.createElement('button');
            deleteButton.textContent = '삭제';
            deleteButton.className = 'btn btn-danger btn-sm';
            deleteButton.onclick = async () => {
                if (confirm(`'${res.tour_name}' 예약을 정말 삭제하시겠습니까?`)) {
                    await window.apiFetch(`reservations/${res.id}`, { method: 'DELETE' });
                    populateReservations();
                }
            };

            buttonGroup.appendChild(detailEditButton);
            buttonGroup.appendChild(statusEditButton);
            buttonGroup.appendChild(deleteButton);
            
            row.cells[9].appendChild(buttonGroup);
            reservationListTable.appendChild(row);
        });
    }
    
    async function populateCustomersForSelect() {
        const customers = await window.apiFetch('customers');
        customerOptions.innerHTML = '';
        editCustomerOptions.innerHTML = '';
        customerMap.clear();
        if(!customers) return;
        customers.forEach(customer => {
            const phoneSuffix = customer.phone_number.slice(-4);
            const customerIdentifier = `${customer.name} (${phoneSuffix})`;

            const option = document.createElement('option');
            option.value = customerIdentifier;
            customerOptions.appendChild(option);
            editCustomerOptions.appendChild(option.cloneNode(true));
            customerMap.set(customerIdentifier, customer.id);
        });
    }

    customerInput.addEventListener('input', () => {
        const customerIdentifier = customerInput.value;
        const customerId = customerMap.get(customerIdentifier);
        
        returningCustomerAlert.textContent = '';

        if (customerId) {
            const pastReservations = allReservations.filter(res => res.customer && res.customer.id === customerId);
            if (pastReservations.length > 0) {
                returningCustomerAlert.textContent = `⭐ 재방문 고객입니다! (총 ${pastReservations.length}회 예약)`;
            }
        }
    });

    reservationForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        const customerIdentifier = customerInput.value;
        const customerId = customerMap.get(customerIdentifier);

        if (!customerId) {
            alert(`'${customerIdentifier}' 고객을 찾을 수 없습니다. 고객 관리 메뉴에서 먼저 등록하거나, 목록에서 정확한 이름을 선택해주세요.`);
            return;
        }

        const category = categorySelect.value;
        let tour_name = '', details = {}, start_date = null, end_date = null;
        
        if (category === 'TOUR') {
            tour_name = document.getElementById('details-productName').value;
            start_date = document.getElementById('details-startDate').value || null;
            details = {
                productName: tour_name, startTime: document.getElementById('details-startTime').value,
                pickupLocation: document.getElementById('details-pickupLocation').value,
                dropoffLocation: document.getElementById('details-dropoffLocation').value,
                adults: document.getElementById('details-adults').value,
                children: document.getElementById('details-children').value,
                infants: document.getElementById('details-infants').value,
            };
        } else if (category === 'RENTAL_CAR') {
            tour_name = document.getElementById('details-carType').value;
            start_date = document.getElementById('details-pickupDateTime').value ? document.getElementById('details-pickupDateTime').value.substring(0, 10) : null;
            details = {
                carType: tour_name, 
                usageHours: document.getElementById('details-usageHours').value,
                pickupDateTime: document.getElementById('details-pickupDateTime').value || null,
                location: document.getElementById('details-location').value,
                passengers: document.getElementById('details-passengers').value,
                carriers: document.getElementById('details-carriers').value,
                carSeats: document.getElementById('details-carSeats').value,
                strollers: document.getElementById('details-strollers').value,
            };
        } else if (category === 'ACCOMMODATION') {
            tour_name = document.getElementById('details-hotelName').value;
            start_date = document.getElementById('details-checkIn').value || null;
            end_date = document.getElementById('details-checkOut').value || null;
            details = {
                hotelName: tour_name, roomType: document.getElementById('details-roomType').value,
                roomCount: document.getElementById('details-roomCount').value,
                guests: document.getElementById('details-guests').value,
            };
        } else if (category === 'GOLF') {
            tour_name = document.getElementById('details-golfCourse').value;
            start_date = document.getElementById('details-teeOffDate').value || null;
            details = {
                golfCourse: tour_name, teeOffTime: document.getElementById('details-teeOffTime').value,
                players: document.getElementById('details-players').value,
                rounds: document.getElementById('details-rounds').value,
            };
        } else if (category === 'TICKET') {
            tour_name = document.getElementById('details-ticketName').value;
            start_date = document.getElementById('details-usageDate').value || null;
            details = {
                ticketName: tour_name, usageTime: document.getElementById('details-usageTime').value,
                adults: document.getElementById('details-adults').value,
                children: document.getElementById('details-children').value,
                infants: document.getElementById('details-infants').value,
            };
        } else if (category === 'OTHER') {
            tour_name = document.getElementById('details-productName').value;
            start_date = document.getElementById('details-startDate').value || null;
            details = {
                productName: tour_name,
                startTime: document.getElementById('details-startTime').value,
            };
        }

        const formData = {
            customer_id: customerId,
            manager_id: managerSelect.value,
            reservation_date: document.getElementById('res-reservation-date').value || new Date().toISOString().split('T')[0],
            payment_amount: document.getElementById('res-payment-amount').value,
            payment_status: document.getElementById('res-payment-status').value,
            special_notes: document.getElementById('res-special-notes').value,
            category, status: document.getElementById('res-status').value,
            tour_name, total_price: document.getElementById('res-price').value,
            total_cost: document.getElementById('res-cost').value,
            notes: document.getElementById('res-notes').value,
            requests: document.getElementById('res-requests').value,
            details, start_date, end_date,
        };
        
        await window.apiFetch('reservations', { method: 'POST', body: JSON.stringify(formData) });
        reservationForm.reset();
        updateFormFields();
        populateReservations();
    });

    function applyFilters() {
        const filters = {};
        if (filterCategory.value) filters.category = filterCategory.value;
        if (filterSearchInput.value) filters.search = filterSearchInput.value.trim();
        if (filterStartDate.value) filters.start_date__gte = filterStartDate.value;
        if (filterEndDate.value) filters.start_date__lte = filterEndDate.value;
        populateReservations(filters);
    }

    filterButton.addEventListener('click', applyFilters);
    filterSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') applyFilters(); });

    filterResetButton.addEventListener('click', () => {
        filterCategory.value = '';
        filterSearchInput.value = '';
        filterStartDate.value = '';
        filterEndDate.value = '';
        populateReservations();
    });

    updateFormFields();
    populateCustomersForSelect();
    populateReservations();
});

document.addEventListener("DOMContentLoaded", async function() {
    // accounting.html 페이지가 아닐 경우, 스크립트 실행을 중단합니다.
    if (!document.getElementById('transaction-list-table')) return;

    // --- 1. HTML 요소 및 전역 변수 선언 ---
    const user = await window.apiFetch('user-info');
    const transactionListTable = document.getElementById('transaction-list-table');
    
    // 새 거래 등록 모달 관련
    const newTransactionModal = new bootstrap.Modal(document.getElementById('newTransactionModal'));
    const showNewTransactionModalButton = document.getElementById('show-new-transaction-modal');
    const transactionForm = document.getElementById('transaction-form');
    
    // 폼 내부 요소
    const reservationSelect = document.getElementById('trans-reservation');
    const partnerSelect = document.getElementById('trans-partner');
    const managerSelect = document.getElementById('trans-manager');
    const transTypeSelect = document.getElementById('trans-type');
    const expenseItemWrapper = document.getElementById('expense-item-wrapper');

    // 목록 필터 요소
    const filterSearchInput = document.getElementById('filter-search');
    const filterStartDate = document.getElementById('filter-start-date');
    const filterEndDate = document.getElementById('filter-end-date');
    const filterButton = document.getElementById('filter-button');
    const filterResetButton = document.getElementById('filter-reset-button');

    // 수정 모달 요소
    const editModal = new bootstrap.Modal(document.getElementById('editTransactionModal'));
    const editModalSaveButton = document.getElementById('edit-transaction-save-button');
    const editReservationSelect = document.getElementById('edit-trans-reservation');
    const editPartnerSelect = document.getElementById('edit-trans-partner');

    // 페이지네이션 관련 요소 및 상태 변수
    const prevPageButton = document.getElementById('prev-page-button');
    const nextPageButton = document.getElementById('next-page-button');
    const pageInfo = document.getElementById('page-info');
    let currentPage = 1;
    let totalPages = 1;
    let currentFilters = {};

    // --- 2. 데이터 로딩 및 화면 구성 함수 ---

    async function populateSelectOptions() {
        const [reservationsResponse, partners] = await Promise.all([
            window.apiFetch('reservations?page_size=10000'),
            window.apiFetch('partners'),
        ]);
        const resOptions = ['<option value="">-- 예약 선택 --</option>'];
        if (reservationsResponse && reservationsResponse.results) {
            reservationsResponse.results.forEach(res => {
                const customerName = res.customer ? res.customer.name : '알 수 없음';
                resOptions.push(`<option value="${res.id}">[${res.id}] ${res.tour_name} - ${customerName}</option>`);
            });
        }
        reservationSelect.innerHTML = resOptions.join('');
        editReservationSelect.innerHTML = resOptions.join('');
        const partnerOptions = ['<option value="">-- 제휴업체 선택 --</option>'];
        if (partners) {
            partners.forEach(p => partnerOptions.push(`<option value="${p.id}">${p.name}</option>`));
        }
        partnerSelect.innerHTML = partnerOptions.join('');
        editPartnerSelect.innerHTML = partnerOptions.join('');
        if (user && user.is_superuser) {
            const users = await window.apiFetch('users');
            if (users) {
                users.forEach(u => {
                    const option = `<option value="${u.id}">${u.username}</option>`;
                    managerSelect.innerHTML += option;
                });
            }
        } else if (user) {
            managerSelect.innerHTML = `<option value="${user.id}">${user.username}</option>`;
            managerSelect.disabled = true;
        }
    }

    async function populateTransactions(page = 1, filters = {}) {
        currentFilters = filters;
        let params = new URLSearchParams({ page, ...filters });
        const queryString = params.toString();
        const response = await window.apiFetch(`transactions?${queryString}`);
        transactionListTable.innerHTML = '';
        if (!response || !response.results) {
            pageInfo.textContent = '데이터가 없습니다.';
            prevPageButton.disabled = true;
            nextPageButton.disabled = true;
            return;
        }
        const transactions = response.results;
        const totalCount = response.count;
        totalPages = Math.ceil(totalCount / 50);
        transactions.forEach(trans => {
            const row = document.createElement('tr');
            const amountClass = trans.transaction_type === 'INCOME' ? 'text-primary' : 'text-danger';
            const relatedItem = trans.reservation ? `예약: ${trans.reservation.tour_name}` : (trans.partner ? `업체: ${trans.partner.name}` : '');
            row.innerHTML = `
                <td>${trans.transaction_date}</td>
                <td><span class="badge bg-${amountClass.includes('primary') ? 'primary' : 'danger'}">${trans.transaction_type}</span></td>
                <td>${trans.description}</td>
                <td class="${amountClass} fw-bold">${Number(trans.amount).toLocaleString()} VND</td>
                <td>${relatedItem}</td>
                <td>${trans.manager ? trans.manager.username : ''}</td>
                <td></td>
            `;
            if (user && user.is_superuser) {
                const buttonGroup = document.createElement('div');
                buttonGroup.className = 'btn-group';
                const editButton = document.createElement('button');
                editButton.textContent = '수정';
                editButton.className = 'btn btn-primary btn-sm';
                editButton.onclick = () => {
                    document.getElementById('edit-trans-date').value = trans.transaction_date;
                    document.getElementById('edit-trans-type').value = trans.transaction_type;
                    document.getElementById('edit-trans-amount').value = trans.amount;
                    document.getElementById('edit-trans-description').value = trans.description;
                    editReservationSelect.value = trans.reservation ? trans.reservation.id : '';
                    editPartnerSelect.value = trans.partner ? trans.partner.id : '';
                    document.getElementById('edit-trans-notes').value = trans.notes || '';
                    editModalSaveButton.onclick = async () => {
                        const updatedData = {
                            transaction_date: document.getElementById('edit-trans-date').value,
                            transaction_type: document.getElementById('edit-trans-type').value,
                            amount: document.getElementById('edit-trans-amount').value,
                            description: document.getElementById('edit-trans-description').value,
                            reservation_id: editReservationSelect.value || null,
                            partner_id: editPartnerSelect.value || null,
                            notes: document.getElementById('edit-trans-notes').value,
                        };
                        await window.apiFetch(`transactions/${trans.id}`, { method: 'PUT', body: JSON.stringify(updatedData) });
                        editModal.hide();
                        populateTransactions(currentPage, currentFilters);
                    };
                    editModal.show();
                };
                const deleteButton = document.createElement('button');
                deleteButton.textContent = '삭제';
                deleteButton.className = 'btn btn-danger btn-sm';
                deleteButton.onclick = async () => {
                    if (confirm(`'${trans.description}' 거래 내역을 정말 삭제하시겠습니까?`)) {
                        await window.apiFetch(`transactions/${trans.id}`, { method: 'DELETE' });
                        populateTransactions(currentPage, currentFilters);
                    }
                };
                buttonGroup.appendChild(editButton);
                buttonGroup.appendChild(deleteButton);
                row.cells[6].appendChild(buttonGroup);
            }
            transactionListTable.appendChild(row);
        });
        currentPage = page;
        pageInfo.textContent = `페이지 ${currentPage} / ${totalPages} (총 ${totalCount}건)`;
        prevPageButton.disabled = !response.previous;
        nextPageButton.disabled = !response.next;
    }

    function applyFilters() {
        const filters = {};
        if (filterSearchInput.value) filters.search = filterSearchInput.value.trim();
        if (filterStartDate.value) filters.date_after = filterStartDate.value;
        if (filterEndDate.value) filters.date_before = filterEndDate.value;
        populateTransactions(1, filters);
    }

    // --- 3. 이벤트 리스너 설정 ---

    showNewTransactionModalButton.addEventListener('click', () => {
        newTransactionModal.show();
    });

    transactionForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = {
            transaction_date: document.getElementById('trans-date').value,
            transaction_type: document.getElementById('trans-type').value,
            amount: document.getElementById('trans-amount').value,
            description: document.getElementById('trans-description').value,
            expense_item: document.getElementById('trans-expense-item').value || null,
            payment_method: document.getElementById('trans-payment-method').value || null,
            processing_status: document.getElementById('trans-processing-status').value,
            manager_id: managerSelect.value,
            reservation_id: reservationSelect.value || null,
            partner_id: partnerSelect.value || null,
        };
        const response = await window.apiFetch('transactions', { method: 'POST', body: JSON.stringify(formData) });
        if (response) {
            newTransactionModal.hide();
            transactionForm.reset();
            expenseItemWrapper.style.display = 'none';
            populateTransactions(1, {});
        }
    });
    
    transTypeSelect.addEventListener('change', () => {
        expenseItemWrapper.style.display = transTypeSelect.value === 'EXPENSE' ? 'block' : 'none';
    });

    filterButton.addEventListener('click', applyFilters);
    filterSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') applyFilters(); });
    filterResetButton.addEventListener('click', () => {
        filterSearchInput.value = '';
        filterStartDate.value = '';
        filterEndDate.value = '';
        populateTransactions(1, {});
    });

    prevPageButton.addEventListener('click', () => {
        if (currentPage > 1) populateTransactions(currentPage - 1, currentFilters);
    });
    nextPageButton.addEventListener('click', () => {
        if (currentPage < totalPages) populateTransactions(currentPage + 1, currentFilters);
    });

    // --- 4. 페이지 초기화 실행 ---
    async function initializePage() {
        await populateSelectOptions();
        await populateTransactions(1, {});

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('action') === 'new') {
            newTransactionModal.show();
        }
    }
    initializePage();
});

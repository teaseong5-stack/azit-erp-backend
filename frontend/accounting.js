document.addEventListener("DOMContentLoaded", async function() {
    // accounting.html 페이지에 있을 때만 이 코드를 실행합니다.
    if (!document.getElementById('transaction-list-table')) return;

    const user = await window.apiFetch('user-info');
    const transactionListTable = document.getElementById('transaction-list-table');
    const transactionForm = document.getElementById('transaction-form');
    const reservationSelect = document.getElementById('trans-reservation');
    const partnerSelect = document.getElementById('trans-partner');
    const managerSelect = document.getElementById('trans-manager');
    const transTypeSelect = document.getElementById('trans-type');
    const expenseItemWrapper = document.getElementById('expense-item-wrapper');
    
    // 현황판 요소
    const totalIncomeEl = document.getElementById('total-income');
    const totalExpenseEl = document.getElementById('total-expense');
    const balanceEl = document.getElementById('balance');

    // 필터 요소
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

    // 거래 종류(수입/지출) 변경 시 지출항목 필드 표시/숨김 처리
    transTypeSelect.addEventListener('change', () => {
        expenseItemWrapper.style.display = transTypeSelect.value === 'EXPENSE' ? 'block' : 'none';
    });

    // 드롭다운 메뉴 채우기
    async function populateSelectOptions() {
        const [reservations, partners, users] = await Promise.all([
            window.apiFetch('reservations'),
            window.apiFetch('partners'),
            (user && user.is_superuser) ? window.apiFetch('users') : Promise.resolve(null)
        ]);

        const resOptions = ['<option value="">-- 예약 선택 --</option>'];
        if (reservations) {
            reservations.forEach(res => {
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
        
        managerSelect.innerHTML = '';
        if (user && user.is_superuser && users) {
            users.forEach(u => {
                const option = `<option value="${u.id}">${u.username}</option>`;
                managerSelect.innerHTML += option;
            });
        } else if (user) {
            managerSelect.innerHTML = `<option value="${user.id}">${user.username}</option>`;
            managerSelect.disabled = true;
        }
    }

    // 거래 내역 목록 및 현황판 업데이트
    async function populateTransactions(filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        const transactions = await window.apiFetch(`transactions?${queryString}`);
        transactionListTable.innerHTML = '';
        if (!transactions) return;

        let totalIncome = 0;
        let totalExpense = 0;

        transactions.forEach(trans => {
            if (trans.transaction_type === 'INCOME') {
                totalIncome += Number(trans.amount);
            } else {
                totalExpense += Number(trans.amount);
            }
            
            const row = document.createElement('tr');
            const amountClass = trans.transaction_type === 'INCOME' ? 'text-primary' : 'text-danger';
            const relatedItem = trans.reservation ? `예약: ${trans.reservation.tour_name}` : (trans.partner ? `업체: ${trans.partner.name}` : '');

            row.innerHTML = `
                <td>${trans.transaction_date}</td>
                <td><span class="badge bg-${amountClass.includes('primary') ? 'primary' : 'danger'}">${trans.transaction_type}</span></td>
                <td>${trans.description}</td>
                <td class="${amountClass} fw-bold">${Number(trans.amount).toLocaleString()}원</td>
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
                        populateTransactions();
                    };
                    editModal.show();
                };
                const deleteButton = document.createElement('button');
                deleteButton.textContent = '삭제';
                deleteButton.className = 'btn btn-danger btn-sm';
                deleteButton.onclick = async () => {
                    if (confirm(`'${trans.description}' 거래 내역을 정말 삭제하시겠습니까?`)) {
                        await window.apiFetch(`transactions/${trans.id}`, { method: 'DELETE' });
                        populateTransactions();
                    }
                };
                buttonGroup.appendChild(editButton);
                buttonGroup.appendChild(deleteButton);
                row.cells[6].appendChild(buttonGroup);
            }
            
            transactionListTable.appendChild(row);
        });

        totalIncomeEl.textContent = `${totalIncome.toLocaleString()}원`;
        totalExpenseEl.textContent = `${totalExpense.toLocaleString()}원`;
        balanceEl.textContent = `${(totalIncome - totalExpense).toLocaleString()}원`;
    }

    // 새 거래 등록 폼 제출
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
        await window.apiFetch('transactions', { method: 'POST', body: JSON.stringify(formData) });
        transactionForm.reset();
        expenseItemWrapper.style.display = 'none';
        populateTransactions();
    });

    function applyFilters() {
        const filters = {};
        if (filterSearchInput.value) filters.search = filterSearchInput.value.trim();
        if (filterStartDate.value) filters.date_after = filterStartDate.value;
        if (filterEndDate.value) filters.date_before = filterEndDate.value;
        populateTransactions(filters);
    }

    filterButton.addEventListener('click', applyFilters);
    filterSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') applyFilters(); });

    filterResetButton.addEventListener('click', () => {
        filterSearchInput.value = '';
        filterStartDate.value = '';
        filterEndDate.value = '';
        populateTransactions();
    });

    // 페이지 초기화
    populateSelectOptions();
    populateTransactions();
});

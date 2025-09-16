document.addEventListener("DOMContentLoaded", async function() {
    // accounting.html 페이지가 아닐 경우, 스크립트 실행을 중단합니다.
    if (!document.getElementById('transaction-list-table')) return;

    // --- 1. HTML 요소 및 전역 변수 선언 ---
    let user = null;
    try {
        user = await window.apiFetch('user-info');
    } catch (error) {
        console.error("사용자 정보 로딩 실패:", error);
        // 사용자 정보 로딩 실패 시 페이지 기능이 제한될 수 있음을 알림
        toast.error("사용자 정보를 불러오지 못했습니다. 일부 기능이 제한될 수 있습니다.");
        return; // 필수 데이터 로딩 실패 시 실행 중단
    }

    const transactionListTable = document.getElementById('transaction-list-table');
    
    // 현황판 요소
    const totalIncomeEl = document.getElementById('total-income');
    const totalExpenseEl = document.getElementById('total-expense');
    const balanceEl = document.getElementById('balance');
    const incomeCardEl = document.getElementById('income-card');
    const incomeCashEl = document.getElementById('income-cash');
    const incomeTransferEl = document.getElementById('income-transfer');
    const expenseCardEl = document.getElementById('expense-card');
    const expenseCashEl = document.getElementById('expense-cash');
    const expenseTransferEl = document.getElementById('expense-transfer');
    const summaryYearSelect = document.getElementById('summary-year-select');
    const summaryMonthSelect = document.getElementById('summary-month-select');
    const summaryFilterButton = document.getElementById('summary-filter-button');
    const summaryResetButton = document.getElementById('summary-reset-button');
    
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

    async function updateSummaryCards(year = null, month = null) {
        try {
            let endpoint = 'transactions/summary';
            const params = new URLSearchParams();
            if (year) params.append('year', year);
            if (month) params.append('month', month);
            const queryString = params.toString();
            if (queryString) endpoint += `?${queryString}`;
            
            const summary = await window.apiFetch(endpoint);
            
            totalIncomeEl.textContent = `${Number(summary.total_income).toLocaleString()} VND`;
            totalExpenseEl.textContent = `${Number(summary.total_expense).toLocaleString()} VND`;
            balanceEl.textContent = `${Number(summary.balance).toLocaleString()} VND`;
            incomeCardEl.textContent = `${Number(summary.income_card).toLocaleString()}`;
            incomeCashEl.textContent = `${Number(summary.income_cash).toLocaleString()}`;
            incomeTransferEl.textContent = `${Number(summary.income_transfer).toLocaleString()}`;
            expenseCardEl.textContent = `${Number(summary.expense_card).toLocaleString()}`;
            expenseCashEl.textContent = `${Number(summary.expense_cash).toLocaleString()}`;
            expenseTransferEl.textContent = `${Number(summary.expense_transfer).toLocaleString()}`;
        } catch (error) {
            console.error("현황판 업데이트 실패:", error);
            toast.error("현황판 정보를 불러오는 데 실패했습니다.");
        }
    }

    function populateYearMonthDropdowns() {
        const currentYear = new Date().getFullYear();
        summaryYearSelect.innerHTML = '<option value="">전체</option>';
        for (let i = 0; i < 5; i++) {
            const year = currentYear - i;
            summaryYearSelect.innerHTML += `<option value="${year}">${year}년</option>`;
        }
        summaryMonthSelect.innerHTML = '<option value="">전체</option>';
        for (let i = 1; i <= 12; i++) {
            summaryMonthSelect.innerHTML += `<option value="${i}">${i}월</option>`;
        }
    }

    /**
     * [수정됨] Promise.allSettled를 사용하여 일부 API 호출이 실패해도 나머지는 정상적으로 로드되도록 변경
     */
    async function populateSelectOptions() {
        const results = await Promise.allSettled([
            window.apiFetch('reservations?page_size=10000'),
            window.apiFetch('partners'),
            window.apiFetch('users')
        ]);

        const reservationsResponse = results[0].status === 'fulfilled' ? results[0].value : { results: [] };
        const partners = results[1].status === 'fulfilled' ? results[1].value : [];
        const users = results[2].status === 'fulfilled' ? results[2].value : [];

        // 예약 드롭다운 채우기
        const resOptions = ['<option value="">-- 예약 선택 --</option>'];
        reservationsResponse.results.forEach(res => {
            const customerName = res.customer ? res.customer.name : '알 수 없음';
            resOptions.push(`<option value="${res.id}">[${res.id}] ${res.tour_name} - ${customerName}</option>`);
        });
        reservationSelect.innerHTML = resOptions.join('');
        editReservationSelect.innerHTML = resOptions.join('');

        // 제휴업체 드롭다운 채우기
        const partnerOptions = ['<option value="">-- 제휴업체 선택 --</option>'];
        partners.forEach(p => partnerOptions.push(`<option value="${p.id}">${p.name}</option>`));
        partnerSelect.innerHTML = partnerOptions.join('');
        editPartnerSelect.innerHTML = partnerOptions.join('');
        
        // 담당자 드롭다운 채우기
        managerSelect.innerHTML = '';
        if (user && user.is_superuser) {
            users.forEach(u => {
                const option = `<option value="${u.id}">${u.username}</option>`;
                managerSelect.innerHTML += option;
            });
        } else if (user) {
            managerSelect.innerHTML = `<option value="${user.id}">${user.username}</option>`;
            managerSelect.disabled = true;
        }
    }

    async function populateTransactions(page = 1, filters = {}) {
        try {
            currentFilters = filters;
            let params = new URLSearchParams({ page, ...filters });
            const queryString = params.toString();
            const response = await window.apiFetch(`transactions?${queryString}`);
            
            transactionListTable.innerHTML = '';
            if (!response || !response.results || response.results.length === 0) {
                pageInfo.textContent = '데이터가 없습니다.';
                prevPageButton.disabled = true;
                nextPageButton.disabled = true;
                transactionListTable.innerHTML = '<tr><td colspan="7" class="text-center py-5">표시할 거래 데이터가 없습니다.</td></tr>';
                return;
            }
            const transactions = response.results;
            const totalCount = response.count;
            totalPages = Math.ceil(totalCount / 50); // 페이지당 50개로 가정
            transactions.forEach(trans => {
                const row = document.createElement('tr');
                const amountClass = trans.transaction_type === 'INCOME' ? 'text-primary' : 'text-danger';
                const relatedItem = trans.reservation ? `예약: ${trans.reservation.tour_name}` : (trans.partner ? `업체: ${trans.partner.name}` : '');
                row.innerHTML = `
                    <td>${trans.transaction_date}</td>
                    <td><span class="badge bg-${amountClass.includes('primary') ? 'primary' : 'danger'}">${trans.transaction_type === 'INCOME' ? '수입' : '지출'}</span></td>
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
                    editButton.onclick = () => { /* 수정 모달 로직 */ };
                    const deleteButton = document.createElement('button');
                    deleteButton.textContent = '삭제';
                    deleteButton.className = 'btn btn-danger btn-sm';
                    deleteButton.onclick = async () => { /* 삭제 로직 */ };
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
        } catch (error) {
            console.error("거래 내역 로딩 실패:", error);
            toast.error("거래 내역을 불러오는 데 실패했습니다.");
            transactionListTable.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-danger">데이터 로딩 중 오류가 발생했습니다.</td></tr>';
        }
    }
    
    function applyFilters() {
        const filters = {
            search: filterSearchInput.value.trim(),
            date_after: filterStartDate.value,
            date_before: filterEndDate.value
        };
        for (const key in filters) {
            if (!filters[key]) delete filters[key];
        }
        populateTransactions(1, filters);
    }

    // --- 3. 이벤트 리스너 설정 ---
    
    summaryFilterButton.addEventListener('click', () => {
        updateSummaryCards(summaryYearSelect.value, summaryMonthSelect.value);
    });

    summaryResetButton.addEventListener('click', () => {
        summaryYearSelect.value = '';
        summaryMonthSelect.value = '';
        updateSummaryCards();
    });

    showNewTransactionModalButton.addEventListener('click', () => {
        newTransactionModal.show();
    });

    /**
     * [수정됨] try...catch를 추가하여 폼 제출 시 발생하는 서버 오류를 처리하고 사용자에게 피드백을 제공
     */
    transactionForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        try {
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
            
            newTransactionModal.hide();
            transactionForm.reset();
            expenseItemWrapper.style.display = 'none';
            toast.show("새로운 거래 내역이 성공적으로 등록되었습니다.");
            
            await populateTransactions(1, {});
            await updateSummaryCards();

        } catch (error) {
            toast.error(`등록 실패: ${error.message}`);
            console.error("Transaction submission failed:", error);
        }
    });
    
    transTypeSelect.addEventListener('change', () => {
        expenseItemWrapper.style.display = transTypeSelect.value === 'EXPENSE' ? 'block' : 'none';
    });

    filterButton.addEventListener('click', applyFilters);
    filterSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') applyFilters(); });

    prevPageButton.addEventListener('click', () => {
        if (currentPage > 1) populateTransactions(currentPage - 1, currentFilters);
    });
    nextPageButton.addEventListener('click', () => {
        if (currentPage < totalPages) populateTransactions(currentPage + 1, currentFilters);
    });
    
    // --- 4. 페이지 초기화 실행 ---
    async function initializePage() {
        populateYearMonthDropdowns();
        // 초기 데이터 로딩 함수들을 병렬로 실행
        await Promise.all([
            populateSelectOptions(),
            updateSummaryCards(),
            populateTransactions(1, {})
        ]);

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('action') === 'new') {
            newTransactionModal.show();
        }
    }
    
    initializePage();
});
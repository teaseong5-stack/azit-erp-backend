document.addEventListener("DOMContentLoaded", async function() {
    // monthly_status.html 페이지가 아닐 경우, 스크립트 실행을 중단합니다.
    if (!document.getElementById('summary-year-select')) return;

    // --- 1. HTML 요소 선언 ---
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

    // --- 2. 데이터 로딩 및 화면 구성 함수 ---

    async function updateSummaryCards(year = null, month = null) {
        let endpoint = 'transactions/summary';
        if (year && month) {
            const params = new URLSearchParams({ year, month });
            endpoint += `?${params.toString()}`;
        }
        
        const summary = await window.apiFetch(endpoint);
        if (summary) {
            totalIncomeEl.textContent = `${Number(summary.total_income).toLocaleString()} VND`;
            totalExpenseEl.textContent = `${Number(summary.total_expense).toLocaleString()} VND`;
            balanceEl.textContent = `${Number(summary.balance).toLocaleString()} VND`;
            incomeCardEl.textContent = `${Number(summary.income_card).toLocaleString()}`;
            incomeCashEl.textContent = `${Number(summary.income_cash).toLocaleString()}`;
            incomeTransferEl.textContent = `${Number(summary.income_transfer).toLocaleString()}`;
            expenseCardEl.textContent = `${Number(summary.expense_card).toLocaleString()}`;
            expenseCashEl.textContent = `${Number(summary.expense_cash).toLocaleString()}`;
            expenseTransferEl.textContent = `${Number(summary.expense_transfer).toLocaleString()}`;
        }
    }

    function populateYearMonthDropdowns() {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        for (let i = 0; i < 5; i++) {
            const year = currentYear - i;
            const option = document.createElement('option');
            option.value = year;
            option.textContent = `${year}년`;
            summaryYearSelect.appendChild(option);
        }
        for (let i = 1; i <= 12; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i}월`;
            summaryMonthSelect.appendChild(option);
        }
        summaryYearSelect.value = currentYear;
        summaryMonthSelect.value = currentMonth;
    }

    // --- 3. 이벤트 리스너 설정 ---

    summaryFilterButton.addEventListener('click', () => {
        const selectedYear = summaryYearSelect.value;
        const selectedMonth = summaryMonthSelect.value;
        updateSummaryCards(selectedYear, selectedMonth);
    });

    summaryResetButton.addEventListener('click', () => {
        updateSummaryCards();
    });

    // --- 4. 페이지 초기화 실행 ---
    async function initializePage() {
        populateYearMonthDropdowns();
        await updateSummaryCards();
    }
    initializePage();
});

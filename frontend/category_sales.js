document.addEventListener("DOMContentLoaded", function() {
    if (!document.getElementById('category-sales-table')) return;

    // --- 1. HTML 요소 선언 ---
    const categorySalesTable = document.getElementById('category-sales-table');
    const yearSelect = document.getElementById('filter-year');
    const monthSelect = document.getElementById('filter-month');
    const filterButton = document.getElementById('filter-button');

    const categoryLabels = { 'TOUR': '투어', 'RENTAL_CAR': '렌터카', 'ACCOMMODATION': '숙박', 'GOLF': '골프', 'TICKET': '티켓', 'OTHER': '기타' };

    function populateFilters() {
        const currentYear = new Date().getFullYear();
        yearSelect.innerHTML = '<option value="">전체 년도</option>';
        for (let i = 0; i < 5; i++) {
            const year = currentYear - i;
            yearSelect.innerHTML += `<option value="${year}">${year}년</option>`;
        }
        monthSelect.innerHTML = '<option value="">전체 월</option>';
        for (let i = 1; i <= 12; i++) {
            monthSelect.innerHTML += `<option value="${i}">${i}월</option>`;
        }
    }

    async function updateDashboard(year, month) {
        const params = new URLSearchParams({ group_by: 'category' });
        if (year) params.append('year', year);
        if (month) params.append('month', month);

        try {
            const summaryData = await window.apiFetch(`reservations/summary?${params.toString()}`);
            
            if (!summaryData || summaryData.length === 0) {
                categorySalesTable.innerHTML = '<tr><td colspan="7" class="text-center py-5">해당 기간의 데이터가 없습니다.</td></tr>';
                return;
            }

            // 전체 매출 합계 계산
            const totalSales = summaryData.reduce((sum, item) => sum + Number(item.sales), 0);

            categorySalesTable.innerHTML = '';
            summaryData.forEach(item => {
                const sales = Number(item.sales);
                const cost = Number(item.cost);
                const count = Number(item.count) || 0;
                
                const margin = sales - cost;
                const marginRate = sales > 0 ? (margin / sales * 100).toFixed(1) : 0;
                const salesShare = totalSales > 0 ? (sales / totalSales * 100).toFixed(1) : 0;

                const row = categorySalesTable.insertRow();
                row.innerHTML = `
                    <td>${categoryLabels[item.category] || item.category}</td>
                    <td>${count.toLocaleString()}</td>
                    <td>${cost.toLocaleString()} VND</td>
                    <td>${sales.toLocaleString()} VND</td>
                    <td class="fw-bold ${margin >= 0 ? 'text-primary' : 'text-danger'}">${margin.toLocaleString()} VND</td>
                    <td>${marginRate}%</td>
                    <td>${salesShare}%</td>
                `;
            });
        } catch (error) {
            console.error("데이터 업데이트 실패:", error);
            toast.error("데이터를 불러오는 중 오류가 발생했습니다.");
            categorySalesTable.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-danger">데이터 로딩 중 오류가 발생했습니다.</td></tr>';
        }
    }
    
    filterButton.addEventListener('click', () => {
        updateDashboard(yearSelect.value, monthSelect.value);
    });

    async function initializePage() {
        populateFilters();
        await updateDashboard();
    }

    initializePage();
});
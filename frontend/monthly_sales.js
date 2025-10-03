document.addEventListener("DOMContentLoaded", function() {
    if (!document.getElementById('monthly-sales-table')) return;

    const monthlySalesTable = document.getElementById('monthly-sales-table');
    const totalRow = document.getElementById('monthly-sales-total');
    const yearSelect = document.getElementById('filter-year');
    const filterButton = document.getElementById('filter-button');
    const reportTitle = document.getElementById('monthly-report-title');

    function populateFilters() {
        const currentYear = new Date().getFullYear();
        for (let i = 0; i < 5; i++) {
            const year = currentYear - i;
            yearSelect.innerHTML += `<option value="${year}" ${i === 0 ? 'selected' : ''}>${year}년</option>`;
        }
    }

    async function updateDashboard(year) {
        reportTitle.textContent = `${year}년 월별 실적 요약`;
        const params = new URLSearchParams({ group_by: 'month', year: year });

        try {
            const summaryData = await window.apiFetch(`reservations/summary?${params.toString()}`);
            
            monthlySalesTable.innerHTML = '';
            
            if (!summaryData || summaryData.length === 0) {
                monthlySalesTable.innerHTML = '<tr><td colspan="6" class="text-center py-5">해당 년도의 데이터가 없습니다.</td></tr>';
                totalRow.innerHTML = '';
                return;
            }

            const monthlyData = Array.from({ length: 12 }, () => null);
            summaryData.forEach(item => {
                const monthIndex = new Date(item.month).getMonth();
                monthlyData[monthIndex] = item;
            });

            let totalCost = 0, totalSales = 0, totalPaid = 0, totalCount = 0;

            monthlyData.forEach((item, index) => {
                const month = index + 1;
                const cost = Number(item?.cost || 0);
                const sales = Number(item?.sales || 0);
                const paid = Number(item?.paid_amount || 0);
                const count = Number(item?.count || 0);
                const margin = sales - cost;

                totalCost += cost;
                totalSales += sales;
                totalPaid += paid;
                totalCount += count;

                const row = monthlySalesTable.insertRow();
                row.innerHTML = `
                    <td>${month}월</td>
                    <td>${cost.toLocaleString()} VND</td>
                    <td>${sales.toLocaleString()} VND</td>
                    <td class="fw-bold ${margin >= 0 ? 'text-primary' : 'text-danger'}">${margin.toLocaleString()} VND</td>
                    <td>${paid.toLocaleString()} VND</td>
                    <td>${count}</td>
                `;
            });

            const totalMargin = totalSales - totalCost;
            totalRow.innerHTML = `
                <td>총 합계</td>
                <td>${totalCost.toLocaleString()} VND</td>
                <td>${totalSales.toLocaleString()} VND</td>
                <td class="fw-bold ${totalMargin >= 0 ? 'text-primary' : 'text-danger'}">${totalMargin.toLocaleString()} VND</td>
                <td>${totalPaid.toLocaleString()} VND</td>
                <td>${totalCount}</td>
            `;

        } catch (error) {
            console.error("데이터 업데이트 실패:", error);
            toast.error("데이터를 불러오는 중 오류가 발생했습니다.");
            monthlySalesTable.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-danger">데이터 로딩 중 오류가 발생했습니다.</td></tr>';
            totalRow.innerHTML = '';
        }
    }
    
    filterButton.addEventListener('click', () => {
        updateDashboard(yearSelect.value);
    });

    async function initializePage() {
        populateFilters();
        await updateDashboard(new Date().getFullYear());
    }

    initializePage();
});
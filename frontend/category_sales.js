document.addEventListener("DOMContentLoaded", function() {
    if (!document.getElementById('category-sales-table')) return;

    // --- 1. HTML 요소 선언 ---
    const categorySalesTable = document.getElementById('category-sales-table');
    const yearSelect = document.getElementById('filter-year');
    const monthSelect = document.getElementById('filter-month');
    const filterButton = document.getElementById('filter-button');
    const detailModalEl = new bootstrap.Modal(document.getElementById('detailModal'));
    const detailModalTitle = document.getElementById('detailModalTitle');
    const detailModalBody = document.getElementById('detailModalBody');

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
                categorySalesTable.innerHTML = '<tr><td colspan="8" class="text-center py-5">해당 기간의 데이터가 없습니다.</td></tr>';
                return;
            }

            const totalSales = summaryData.reduce((sum, item) => sum + Number(item.sales), 0);

            categorySalesTable.innerHTML = '';
            summaryData.forEach(item => {
                const sales = Number(item.sales);
                const cost = Number(item.cost);
                const totalCustomers = Number(item.total_customers) || 0;
                const count = Number(item.count) || 0;
                
                const margin = sales - cost;
                const marginRate = sales > 0 ? (margin / sales * 100).toFixed(1) : 0;
                const salesShare = totalSales > 0 ? (sales / totalSales * 100).toFixed(1) : 0;
                const avgPricePerCustomer = totalCustomers > 0 ? (sales / totalCustomers).toFixed(0) : 0;

                const row = categorySalesTable.insertRow();
                row.innerHTML = `
                    <td><a href="#" class="category-detail-link" data-category="${item.category}">${categoryLabels[item.category] || item.category}</a></td>
                    <td>${totalCustomers.toLocaleString()}</td>
                    <td>${cost.toLocaleString()} VND</td>
                    <td>${sales.toLocaleString()} VND</td>
                    <td class="fw-bold ${margin >= 0 ? 'text-primary' : 'text-danger'}">${margin.toLocaleString()} VND</td>
                    <td>${marginRate}%</td>
                    <td>${salesShare}%</td>
                    <td>${Number(avgPricePerCustomer).toLocaleString()} VND</td>
                `;
            });
        } catch (error) {
            console.error("데이터 업데이트 실패:", error);
            toast.error("데이터를 불러오는 중 오류가 발생했습니다.");
            categorySalesTable.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-danger">데이터 로딩 중 오류가 발생했습니다.</td></tr>';
        }
    }
    
    async function showCategoryDetailsPopup(category, year, month) {
        const categoryName = categoryLabels[category] || category;
        detailModalTitle.textContent = `${categoryName} 상세 실적`;
        detailModalBody.innerHTML = '<div class="text-center py-5"><div class="spinner-border" role="status"></div></div>';
        detailModalEl.show();
    
        const params = new URLSearchParams({ group_by: 'product', category });
        if (year) params.append('year', year);
        if (month) params.append('month', month);
    
        try {
            const detailData = await window.apiFetch(`reservations/summary?${params.toString()}`);
            
            let headers = [];
            switch (category) {
                case 'ACCOMMODATION': headers = ['숙소명', '예약건수', '룸수량']; break;
                case 'GOLF': headers = ['골프장명', '예약건수', '라운딩수량']; break;
                default: headers = ['상품명', '예약건수', '이용인원']; break;
            }
    
            let rowsHtml = '';
            if (detailData && detailData.length > 0) {
                detailData.forEach(item => {
                    rowsHtml += `<tr>
                        <td>${item.name}</td>
                        <td>${item.count}</td>
                        <td>${item.quantity.toLocaleString()}</td>
                    </tr>`;
                });
            } else {
                rowsHtml = '<tr><td colspan="3" class="text-center">데이터가 없습니다.</td></tr>';
            }
    
            const tableHtml = `
                <div class="table-responsive">
                    <table class="table table-striped table-bordered">
                        <thead>
                            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>
            `;
            detailModalBody.innerHTML = tableHtml;
    
        } catch (error) {
            console.error("상세 데이터 로딩 실패:", error);
            detailModalBody.innerHTML = '<p class="text-center text-danger">데이터를 불러오는 중 오류가 발생했습니다.</p>';
        }
    }

    filterButton.addEventListener('click', () => {
        updateDashboard(yearSelect.value, monthSelect.value);
    });

    categorySalesTable.addEventListener('click', function(event) {
        if (event.target.classList.contains('category-detail-link')) {
            event.preventDefault();
            const category = event.target.dataset.category;
            showCategoryDetailsPopup(category, yearSelect.value, monthSelect.value);
        }
    });

    async function initializePage() {
        populateFilters();
        await updateDashboard();
    }

    initializePage();
});
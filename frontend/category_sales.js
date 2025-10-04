document.addEventListener("DOMContentLoaded", function() {
    if (!document.getElementById('category-sales-table')) return;

    // --- 1. HTML 요소 선언 ---
    const categorySalesTable = document.getElementById('category-sales-table');
    const totalRow = document.getElementById('category-sales-total'); // 합계 행
    const yearSelect = document.getElementById('filter-year');
    const monthSelect = document.getElementById('filter-month');
    const filterButton = document.getElementById('filter-button');
    const detailModalEl = new bootstrap.Modal(document.getElementById('detailModal'));
    const detailModalTitle = document.getElementById('detailModalTitle');
    const detailModalBody = document.getElementById('detailModalBody');

    const categoryLabels = { 'TOUR': '투어', 'RENTAL_CAR': '렌터카', 'ACCOMMODATION': '숙박', 'GOLF': '골프', 'TICKET': '티켓', 'OTHER': '기타' };

    // --- 2. 데이터 로딩 및 렌더링 함수 ---

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
            
            categorySalesTable.innerHTML = '';
            totalRow.innerHTML = '';

            if (!summaryData || summaryData.length === 0) {
                categorySalesTable.innerHTML = '<tr><td colspan="7" class="text-center py-5">해당 기간의 데이터가 없습니다.</td></tr>';
                return;
            }

            let totalCount = 0, totalCost = 0, totalSales = 0;

            summaryData.forEach(item => {
                totalCount += Number(item.count || 0);
                totalCost += Number(item.cost);
                totalSales += Number(item.sales);
            });

            summaryData.forEach(item => {
                const sales = Number(item.sales);
                const cost = Number(item.cost);
                const count = Number(item.count) || 0;
                
                const margin = sales - cost;
                const marginRate = sales > 0 ? (margin / sales * 100).toFixed(1) : 0;
                const salesShare = totalSales > 0 ? (sales / totalSales * 100).toFixed(1) : 0;

                const row = categorySalesTable.insertRow();
                row.innerHTML = `
                    <td><a href="#" class="category-detail-link" data-category="${item.category}">${categoryLabels[item.category] || item.category}</a></td>
                    <td>${count.toLocaleString()}</td>
                    <td>${cost.toLocaleString()} VND</td>
                    <td>${sales.toLocaleString()} VND</td>
                    <td class="fw-bold ${margin >= 0 ? 'text-primary' : 'text-danger'}">${margin.toLocaleString()} VND</td>
                    <td>${marginRate}%</td>
                    <td>${salesShare}%</td>
                `;
            });

            // 합계 행 렌더링
            const totalMargin = totalSales - totalCost;
            const totalMarginRate = totalSales > 0 ? (totalMargin / totalSales * 100).toFixed(1) : 0;
            totalRow.innerHTML = `
                <td>총 합계</td>
                <td>${totalCount.toLocaleString()}</td>
                <td>${totalCost.toLocaleString()} VND</td>
                <td>${totalSales.toLocaleString()} VND</td>
                <td class="fw-bold ${totalMargin >= 0 ? 'text-primary' : 'text-danger'}">${totalMargin.toLocaleString()} VND</td>
                <td>${totalMarginRate}%</td>
                <td>100.0%</td>
            `;

        } catch (error) {
            console.error("데이터 업데이트 실패:", error);
            toast.error("데이터를 불러오는 중 오류가 발생했습니다.");
            categorySalesTable.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-danger">데이터 로딩 중 오류가 발생했습니다.</td></tr>';
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
            let rowsHtml = '';
            let colspan = 2;

            if (category === 'ACCOMMODATION') {
                headers = ['숙소명', '예약건수', '룸수량'];
                colspan = 3;
                if (detailData && detailData.length > 0) {
                    detailData.forEach(item => {
                        rowsHtml += `<tr>
                            <td>${item.name}</td>
                            <td>${item.count}</td>
                            <td>${item.quantity.toLocaleString()}</td>
                        </tr>`;
                    });
                }
            } else if (category === 'GOLF') {
                headers = ['골프장명', '예약건수', '라운딩 수량'];
                colspan = 3;
                if (detailData && detailData.length > 0) {
                    detailData.forEach(item => {
                        rowsHtml += `<tr>
                            <td>${item.name}</td>
                            <td>${item.count}</td>
                            <td>${item.quantity.toLocaleString()}</td>
                        </tr>`;
                    });
                }
            } else {
                const nameHeader = (category === 'RENTAL_CAR') ? '상품명(차량별)' : '상품명';
                headers = [nameHeader, '예약건수'];
                colspan = 2;
                if (detailData && detailData.length > 0) {
                    detailData.forEach(item => {
                        rowsHtml += `<tr>
                            <td>${item.name}</td>
                            <td>${item.count}</td>
                        </tr>`;
                    });
                }
            }
            
            if (!rowsHtml) {
                rowsHtml = `<tr><td colspan="${colspan}" class="text-center">데이터가 없습니다.</td></tr>`;
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
    
    // --- 3. 이벤트 리스너 설정 ---
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

    // --- 4. 페이지 초기화 ---
    async function initializePage() {
        populateFilters();
        await updateDashboard();
    }

    initializePage();
});
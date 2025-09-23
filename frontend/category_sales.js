document.addEventListener("DOMContentLoaded", function() {
    // category_sales.html 페이지가 아닐 경우, 스크립트 실행을 중단합니다.
    if (!document.getElementById('categoryPieChart')) return;

    // --- 1. HTML 요소 선언 ---
    const categoryPieChartCanvas = document.getElementById('categoryPieChart');
    const categorySalesTable = document.getElementById('category-sales-table');
    const yearSelect = document.getElementById('filter-year');
    const monthSelect = document.getElementById('filter-month');
    const filterButton = document.getElementById('filter-button');
    const detailModal = new bootstrap.Modal(document.getElementById('detailModal'));
    const detailModalTitle = document.getElementById('detailModalTitle');
    const detailModalBody = document.getElementById('detailModalBody');

    let categoryPieChart = null;

    const categoryLabels = { 'TOUR': '투어', 'RENTAL_CAR': '렌터카', 'ACCOMMODATION': '숙박', 'GOLF': '골프', 'TICKET': '티켓', 'OTHER': '기타' };
    const categoryColors = {
        'TOUR': 'rgba(54, 162, 235, 0.8)', 'RENTAL_CAR': 'rgba(75, 192, 192, 0.8)',
        'ACCOMMODATION': 'rgba(255, 99, 132, 0.8)', 'GOLF': 'rgba(153, 102, 255, 0.8)',
        'TICKET': 'rgba(255, 159, 64, 0.8)', 'OTHER': 'rgba(108, 117, 125, 0.8)'
    };

    /**
     * 년/월 필터 드롭다운을 초기화하는 함수
     */
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

    /**
     * 서버에서 카테고리별 요약 데이터를 가져와 차트와 테이블(매출 비중 포함)을 업데이트하는 함수
     */
    async function updateDashboard(year, month) {
        const params = new URLSearchParams({ group_by: 'category' });
        if (year) params.append('year', year);
        if (month) params.append('month', month);

        try {
            const summaryData = await window.apiFetch(`reservations/summary?${params.toString()}`);
            
            if (!summaryData || summaryData.length === 0) {
                categorySalesTable.innerHTML = '<tr><td colspan="3" class="text-center py-5">해당 기간의 데이터가 없습니다.</td></tr>';
                if (categoryPieChart) {
                    categoryPieChart.destroy();
                    categoryPieChart = null;
                }
                categoryPieChartCanvas.getContext('2d').clearRect(0, 0, categoryPieChartCanvas.width, categoryPieChartCanvas.height);
                return;
            }
            
            // 매출 비중을 계산하기 위해 총 매출액을 먼저 구합니다.
            const totalSales = summaryData.reduce((sum, item) => sum + Number(item.sales), 0);

            const labels = summaryData.map(item => categoryLabels[item.category] || item.category);
            const data = summaryData.map(item => item.sales);
            const backgroundColors = summaryData.map(item => categoryColors[item.category] || '#6c757d');

            if (categoryPieChart) categoryPieChart.destroy();
            categoryPieChart = new Chart(categoryPieChartCanvas.getContext('2d'), {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{ data: data, backgroundColor: backgroundColors }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });

            categorySalesTable.innerHTML = '';
            summaryData.forEach(item => {
                const row = categorySalesTable.insertRow();
                // 각 카테고리의 매출 비중을 계산합니다.
                const percentage = totalSales > 0 ? ((Number(item.sales) / totalSales) * 100).toFixed(1) : 0;
                row.innerHTML = `
                    <td><a href="#" class="category-detail-link" data-category="${item.category}">${categoryLabels[item.category] || item.category}</a></td>
                    <td>${Number(item.sales).toLocaleString()} VND</td>
                    <td>${percentage}%</td>
                `;
            });
        } catch (error) {
            console.error("대시보드 업데이트 실패:", error);
            toast.error("데이터를 불러오는 중 오류가 발생했습니다.");
        }
    }

    /**
     * 특정 카테고리의 상품별 매출 상세 내역을 팝업으로 보여주는 함수
     */
    async function showProductDetails(category, year, month) {
        detailModalTitle.textContent = `${categoryLabels[category] || category} 상품별 매출 현황`;
        detailModalBody.innerHTML = '<div class="text-center py-5"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>';
        detailModal.show();

        const params = new URLSearchParams({ category: category, group_by: 'product' });
        if (year) params.append('year', year);
        if (month) params.append('month', month);

        try {
            const productData = await window.apiFetch(`reservations/summary?${params.toString()}`);
            
            let tableHtml = '<div class="table-responsive"><table class="table table-striped"><thead><tr><th>상품명</th><th>매출액 (VND)</th><th>건수</th></tr></thead><tbody>';
            
            if (productData && productData.length > 0) {
                productData.forEach(item => {
                    tableHtml += `<tr><td>${item.product}</td><td>${Number(item.sales).toLocaleString()}</td><td>${item.count}</td></tr>`;
                });
            } else {
                tableHtml += '<tr><td colspan="3" class="text-center">데이터가 없습니다.</td></tr>';
            }
            tableHtml += '</tbody></table></div>';
            detailModalBody.innerHTML = tableHtml;
        } catch (error) {
            console.error("상품 상세 정보 로딩 실패:", error);
            detailModalBody.innerHTML = '<p class="text-center text-danger">상세 정보를 불러오는 중 오류가 발생했습니다.</p>';
        }
    }
    
    // '조회' 버튼 이벤트 리스너
    filterButton.addEventListener('click', () => {
        updateDashboard(yearSelect.value, monthSelect.value);
    });

    // 테이블의 카테고리명 클릭 이벤트 리스너 (이벤트 위임)
    categorySalesTable.addEventListener('click', function(event) {
        if (event.target.classList.contains('category-detail-link')) {
            event.preventDefault();
            const category = event.target.dataset.category;
            showProductDetails(category, yearSelect.value, monthSelect.value);
        }
    });

    /**
     * 페이지 초기화 함수
     */
    async function initializePage() {
        populateFilters();
        await updateDashboard(); // 초기에는 전체 기간 데이터로 대시보드 표시
    }

    initializePage();
});
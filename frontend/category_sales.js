document.addEventListener("DOMContentLoaded", function() {
    if (!document.getElementById('categoryPieChart')) return;

    const categoryPieChartCanvas = document.getElementById('categoryPieChart');
    const categorySalesTable = document.getElementById('category-sales-table');
    const yearSelect = document.getElementById('filter-year');
    const monthSelect = document.getElementById('filter-month');
    const filterButton = document.getElementById('filter-button');
    const detailModal = new bootstrap.Modal(document.getElementById('detailModal'));
    const detailModalTitle = document.getElementById('detailModalTitle');
    const detailModalBody = document.getElementById('detailModalBody');

    let categoryPieChart = null;
    let allReservations = []; // 전체 예약을 저장할 변수

    const categoryLabels = { 'TOUR': '투어', 'RENTAL_CAR': '렌터카', 'ACCOMMODATION': '숙박', 'GOLF': '골프', 'TICKET': '티켓', 'OTHER': '기타' };
    const categoryColors = {
        'TOUR': 'rgba(54, 162, 235, 0.8)', 'RENTAL_CAR': 'rgba(75, 192, 192, 0.8)',
        'ACCOMMODATION': 'rgba(255, 99, 132, 0.8)', 'GOLF': 'rgba(153, 102, 255, 0.8)',
        'TICKET': 'rgba(255, 159, 64, 0.8)', 'OTHER': 'rgba(108, 117, 125, 0.8)'
    };

    /**
     * 년/월 필터 옵션을 채우는 함수
     */
    function populateFilters() {
        const currentYear = new Date().getFullYear();
        yearSelect.innerHTML = '<option value="">전체</option>';
        for (let i = 0; i < 5; i++) {
            const year = currentYear - i;
            yearSelect.innerHTML += `<option value="${year}">${year}년</option>`;
        }
        monthSelect.innerHTML = '<option value="">전체</option>';
        for (let i = 1; i <= 12; i++) {
            monthSelect.innerHTML += `<option value="${i}">${i}월</option>`;
        }
    }

    /**
     * 필터링된 예약 데이터로 차트와 테이블을 업데이트하는 함수
     */
    function updateDashboard(reservations) {
        const categorySales = {};
        const activeReservations = reservations.filter(res => res.status !== 'CANCELED');
        
        activeReservations.forEach(res => {
            categorySales[res.category] = (categorySales[res.category] || 0) + Number(res.total_price);
        });

        // 차트 렌더링
        if (categoryPieChart) categoryPieChart.destroy();
        categoryPieChart = new Chart(categoryPieChartCanvas.getContext('2d'), {
            type: 'pie',
            data: {
                labels: Object.keys(categorySales).map(key => categoryLabels[key] || key),
                datasets: [{
                    data: Object.values(categorySales),
                    backgroundColor: Object.keys(categorySales).map(key => categoryColors[key] || '#6c757d')
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        // 테이블 렌더링
        categorySalesTable.innerHTML = '';
        const sortedCategories = Object.entries(categorySales).sort((a, b) => b[1] - a[1]);

        for (const [category, sales] of sortedCategories) {
            const row = categorySalesTable.insertRow();
            row.innerHTML = `
                <td><a href="#" class="category-detail-link" data-category="${category}">${categoryLabels[category] || category}</a></td>
                <td>${sales.toLocaleString()} VND</td>
            `;
        }
    }

    /**
     * 카테고리 클릭 시 상품별 상세 팝업을 표시하는 함수
     */
    function showProductDetails(category, year, month) {
        detailModalTitle.textContent = `${categoryLabels[category] || category} 상품별 매출 현황`;
        
        let filteredReservations = allReservations;
        if (year) {
            filteredReservations = filteredReservations.filter(r => r.start_date && r.start_date.startsWith(year));
        }
        if (month) {
            const monthStr = month.toString().padStart(2, '0');
            filteredReservations = filteredReservations.filter(r => r.start_date && r.start_date.substring(5, 7) === monthStr);
        }

        const productSales = {};
        filteredReservations
            .filter(r => r.status !== 'CANCELED' && r.category === category)
            .forEach(r => {
                productSales[r.tour_name] = (productSales[r.tour_name] || 0) + Number(r.total_price);
            });

        let tableHtml = '<table class="table"><thead><tr><th>상품명</th><th>매출액 (VND)</th></tr></thead><tbody>';
        const sortedProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]);
        
        for (const [product, sales] of sortedProducts) {
            tableHtml += `<tr><td>${product}</td><td>${sales.toLocaleString()}</td></tr>`;
        }
        tableHtml += '</tbody></table>';
        detailModalBody.innerHTML = tableHtml;
        detailModal.show();
    }
    
    // 이벤트 리스너 설정
    filterButton.addEventListener('click', () => {
        const year = yearSelect.value;
        const month = monthSelect.value;
        let filtered = allReservations;
        if (year) {
            filtered = filtered.filter(r => r.start_date && r.start_date.startsWith(year));
        }
        if (month) {
            const monthStr = month.toString().padStart(2, '0');
            filtered = filtered.filter(r => r.start_date && r.start_date.substring(5, 7) === monthStr);
        }
        updateDashboard(filtered);
    });

    categorySalesTable.addEventListener('click', function(event) {
        if (event.target.classList.contains('category-detail-link')) {
            event.preventDefault();
            const category = event.target.dataset.category;
            showProductDetails(category, yearSelect.value, monthSelect.value);
        }
    });

    // 페이지 초기화
    async function initializePage() {
        populateFilters();
        const response = await window.apiFetch('reservations/all/');
        if (response && response.results) {
            allReservations = response.results;
            updateDashboard(allReservations);
        }
    }

    initializePage();
});

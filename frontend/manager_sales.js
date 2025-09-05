document.addEventListener("DOMContentLoaded", function() {
    if (!document.getElementById('managerBarChart')) return;

    const managerBarChartCanvas = document.getElementById('managerBarChart');
    const managerSalesTable = document.getElementById('manager-sales-table');
    const yearSelect = document.getElementById('filter-year');
    const monthSelect = document.getElementById('filter-month');
    const filterButton = document.getElementById('filter-button');
    const detailModal = new bootstrap.Modal(document.getElementById('detailModal'));
    const detailModalTitle = document.getElementById('detailModalTitle');
    const detailModalBody = document.getElementById('detailModalBody');

    let managerBarChart = null;
    let allReservations = [];

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
        const managerStats = {};
        const activeReservations = reservations.filter(res => res.status !== 'CANCELED');

        activeReservations.forEach(res => {
            const managerName = res.manager ? res.manager.username : '미지정';
            if (!managerStats[managerName]) {
                managerStats[managerName] = { sales: 0, count: 0 };
            }
            managerStats[managerName].sales += Number(res.total_price);
            managerStats[managerName].count += 1;
        });

        const sortedManagers = Object.entries(managerStats).sort((a, b) => b[1].sales - a[1].sales);
        const labels = sortedManagers.map(entry => entry[0]);
        const salesData = sortedManagers.map(entry => entry[1].sales);

        // 차트 렌더링
        if (managerBarChart) managerBarChart.destroy();
        managerBarChart = new Chart(managerBarChartCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '담당자별 매출액 (VND)',
                    data: salesData,
                    backgroundColor: 'rgba(153, 102, 255, 0.6)'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });

        // 테이블 렌더링
        managerSalesTable.innerHTML = '';
        sortedManagers.forEach(([manager, stats]) => {
            const row = managerSalesTable.insertRow();
            row.innerHTML = `
                <td><a href="#" class="manager-detail-link" data-manager="${manager}">${manager}</a></td>
                <td>${stats.sales.toLocaleString()} VND</td>
                <td>${stats.count} 건</td>
            `;
        });
    }

    /**
     * 담당자 클릭 시 카테고리별 상세 실적 팝업을 표시하는 함수
     */
    function showManagerDetails(managerName, year, month) {
        detailModalTitle.textContent = `${managerName} 상세 실적`;

        let filteredReservations = allReservations;
        if (year) {
            filteredReservations = filteredReservations.filter(r => r.start_date && r.start_date.startsWith(year));
        }
        if (month) {
            const monthStr = month.toString().padStart(2, '0');
            filteredReservations = filteredReservations.filter(r => r.start_date && r.start_date.substring(5, 7) === monthStr);
        }

        const categoryStats = {};
        filteredReservations
            .filter(r => r.status !== 'CANCELED' && (r.manager ? r.manager.username : '미지정') === managerName)
            .forEach(r => {
                const category = r.category_display || r.category;
                if (!categoryStats[category]) {
                    categoryStats[category] = { sales: 0, count: 0 };
                }
                categoryStats[category].sales += Number(r.total_price);
                categoryStats[category].count += 1;
            });

        let tableHtml = '<table class="table"><thead><tr><th>카테고리</th><th>매출액 (VND)</th><th>건수</th></tr></thead><tbody>';
        const sortedCategories = Object.entries(categoryStats).sort((a, b) => b[1].sales - a[1].sales);

        for (const [category, stats] of sortedCategories) {
            tableHtml += `<tr><td>${category}</td><td>${stats.sales.toLocaleString()}</td><td>${stats.count}</td></tr>`;
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

    managerSalesTable.addEventListener('click', function(event) {
        if (event.target.classList.contains('manager-detail-link')) {
            event.preventDefault();
            const managerName = event.target.dataset.manager;
            showManagerDetails(managerName, yearSelect.value, monthSelect.value);
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

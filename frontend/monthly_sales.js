document.addEventListener("DOMContentLoaded", function() {
    if (!document.getElementById('monthlySalesChart')) return;

    const monthlySalesChartCanvas = document.getElementById('monthlySalesChart');
    const monthlySalesTable = document.getElementById('monthly-sales-table');
    const yearSelect = document.getElementById('filter-year');
    const filterButton = document.getElementById('filter-button');
    
    let monthlySalesChart = null;
    let allReservations = [];

    /**
     * 년도 필터 옵션을 채우는 함수
     */
    function populateFilters() {
        const currentYear = new Date().getFullYear();
        for (let i = 0; i < 5; i++) {
            const year = currentYear - i;
            const option = document.createElement('option');
            option.value = year;
            option.textContent = `${year}년`;
            if (i === 0) option.selected = true; // 기본으로 현재 년도 선택
            yearSelect.appendChild(option);
        }
    }

    /**
     * 필터링된 예약 데이터로 차트와 테이블을 업데이트하는 함수
     */
    function updateDashboard(reservations) {
        const monthlySales = {};
        const activeReservations = reservations.filter(res => res.status !== 'CANCELED' && res.start_date);
        
        activeReservations.forEach(res => {
            const month = res.start_date.substring(0, 7); // YYYY-MM
            monthlySales[month] = (monthlySales[month] || 0) + Number(res.total_price);
        });
        
        const sortedMonths = Object.keys(monthlySales).sort();
        
        // 차트 렌더링
        if (monthlySalesChart) monthlySalesChart.destroy();
        monthlySalesChart = new Chart(monthlySalesChartCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: sortedMonths,
                datasets: [{
                    label: '월별 매출액 (VND)',
                    data: sortedMonths.map(month => monthlySales[month]),
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });

        // 테이블 렌더링
        monthlySalesTable.innerHTML = '';
        sortedMonths.forEach(month => {
            const row = monthlySalesTable.insertRow();
            row.innerHTML = `
                <td>${month}</td>
                <td>${monthlySales[month].toLocaleString()} VND</td>
            `;
        });
    }

    // 이벤트 리스너 설정
    filterButton.addEventListener('click', () => {
        const year = yearSelect.value;
        let filtered = allReservations;
        if (year) {
            filtered = filtered.filter(r => r.start_date && r.start_date.startsWith(year));
        }
        updateDashboard(filtered);
    });

    // 페이지 초기화
    async function initializePage() {
        populateFilters();
        const response = await window.apiFetch('reservations/all/');
        if (response && response.results) {
            allReservations = response.results;
            // 초기에 현재 년도 데이터로 필터링
            const currentYear = new Date().getFullYear().toString();
            const initialData = allReservations.filter(r => r.start_date && r.start_date.startsWith(currentYear));
            updateDashboard(initialData);
        }
    }

    initializePage();
});

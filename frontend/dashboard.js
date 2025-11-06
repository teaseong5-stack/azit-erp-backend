document.addEventListener("DOMContentLoaded", async function() {
    // 이 스크립트가 dashboard.html에서만 실행되도록 확인합니다.
    if (!document.getElementById('kpi-month-sales')) return;

    // --- 1. 차트 인스턴스 변수 선언 ---
    let categoryChart = null;
    let trendChart = null;
    let managerChart = null;
    
    const categoryLabels = { 'TOUR': '투어', 'RENTAL_CAR': '렌터카', 'ACCOMMODATION': '숙박', 'GOLF': '골프', 'TICKET': '티켓', 'OTHER': '기타' };
    const categoryColors = {
        'TOUR': 'rgba(54, 162, 235, 0.8)', 'RENTAL_CAR': 'rgba(75, 192, 192, 0.8)',
        'ACCOMMODATION': 'rgba(255, 99, 132, 0.8)', 'GOLF': 'rgba(153, 102, 255, 0.8)',
        'TICKET': 'rgba(255, 159, 64, 0.8)', 'OTHER': 'rgba(108, 117, 125, 0.8)'
    };

    // --- 2. 데이터 렌더링 함수 ---

    function renderKpiCards(kpi) {
        document.getElementById('kpi-month-sales').textContent = `${Number(kpi.month_sales).toLocaleString()} VND`;
        document.getElementById('kpi-month-margin').textContent = `${Number(kpi.month_margin).toLocaleString()} VND`;
        document.getElementById('kpi-today-new').textContent = `${kpi.today_new_reservations} 건`;
        document.getElementById('kpi-today-schedules').textContent = `${kpi.today_schedules} 건`;
    }

    function renderActionItems(items) {
        const tableBody = document.getElementById('action-items-table');
        if (items.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">확인이 필요한 항목이 없습니다.</td></tr>';
            return;
        }
        tableBody.innerHTML = items.map(item => `
            <tr>
                <td>${item.start_date || '미정'}</td>
                <td>${item.name}</td>
                <td>${item.customer}</td>
                <td><span class="badge bg-warning text-dark">${item.status}</span></td>
                <td><a href="reservations.html?action=edit&id=${item.id}" class="btn btn-sm btn-outline-primary">확인</a></td>
            </tr>
        `).join('');
    }

    function renderCategoryChart(data) {
        const ctx = document.getElementById('categoryDoughnutChart').getContext('2d');
        const labels = data.map(item => categoryLabels[item.category] || item.category);
        const salesData = data.map(item => item.sales);
        const backgroundColors = data.map(item => categoryColors[item.category] || '#6c757d');
        
        if (categoryChart) categoryChart.destroy();
        categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: salesData,
                    backgroundColor: backgroundColors,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' }
                }
            }
        });
    }

    function renderMonthlyTrendChart(data) {
        const ctx = document.getElementById('monthlyTrendChart').getContext('2d');
        const labels = data.map(item => new Date(item.month).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' }));
        const salesData = data.map(item => item.sales);
        const marginData = data.map(item => item.margin);

        if (trendChart) trendChart.destroy();
        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '총 매출',
                        data: salesData,
                        borderColor: 'rgba(54, 162, 235, 1)',
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        fill: true,
                        tension: 0.1
                    },
                    {
                        label: '총 마진',
                        data: marginData,
                        borderColor: 'rgba(75, 192, 192, 1)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        fill: true,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        ticks: { callback: value => `${(value / 1000000).toLocaleString()}M` }
                    }
                }
            }
        });
    }

    function renderManagerChart(data) {
        const ctx = document.getElementById('managerBarChart').getContext('2d');
        const labels = data.map(item => item.manager__username || '미지정');
        const salesData = data.map(item => item.sales);

        if (managerChart) managerChart.destroy();
        managerChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '담당자별 매출',
                    data: salesData,
                    backgroundColor: 'rgba(255, 159, 64, 0.6)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y', // 가로 막대 그래프
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { callback: value => `${(value / 1000000).toLocaleString()}M` }
                    }
                }
            }
        });
    }

    // --- 3. 페이지 초기화 ---
    async function initializeDashboard() {
        try {
            const data = await window.apiFetch('dashboard-summary');
            
            renderKpiCards(data.kpi);
            renderActionItems(data.action_items);
            renderCategoryChart(data.category_chart);
            renderMonthlyTrendChart(data.monthly_trend_chart);
            renderManagerChart(data.manager_chart);
            
        } catch (error) {
            console.error("대시보드 데이터 로딩 실패:", error);
            toast.error("대시보드 데이터를 불러오는 데 실패했습니다.");
        }
    }

    initializeDashboard();
});
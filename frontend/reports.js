document.addEventListener("DOMContentLoaded", async function() {
    // reports.html 페이지가 아닐 경우, 스크립트 실행을 중단합니다.
    if (!document.getElementById('report-type')) return;

    const reportTypeSelect = document.getElementById('report-type');
    const generateReportButton = document.getElementById('generate-report-button');
    const reportResultDiv = document.getElementById('report-result');
    const chartContainer = document.getElementById('chart-container');
    let reportChart = null;

    const response = await window.apiFetch('reservations?page_size=10000');
    if (!response || !response.results) {
        reportResultDiv.innerHTML = '<p class="text-danger">리포트를 생성할 예약 데이터가 없습니다.</p>';
        return;
    }
    const allReservations = response.results;

    /**
     * 선택된 리포트 종류에 따라 데이터를 분석하고 결과를 표시하는 함수
     */
    function generateReport() {
        const reportType = reportTypeSelect.value;
        reportResultDiv.innerHTML = '';
        chartContainer.innerHTML = '<canvas id="reportChart"></canvas>';
        const ctx = document.getElementById('reportChart').getContext('2d');

        const activeReservations = allReservations.filter(res => res.status !== 'CANCELED');

        if (reportChart) {
            reportChart.destroy();
        }

        switch (reportType) {
            case 'monthly-sales':
                const monthlySales = {};
                activeReservations.forEach(res => {
                    if (res.start_date) {
                        const month = res.start_date.substring(0, 7);
                        monthlySales[month] = (monthlySales[month] || 0) + Number(res.total_price);
                    }
                });

                const sortedMonths = Object.keys(monthlySales).sort();
                reportChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: sortedMonths,
                        datasets: [{
                            label: '월별 총 매출액',
                            data: sortedMonths.map(month => monthlySales[month]),
                            backgroundColor: 'rgba(54, 162, 235, 0.6)'
                        }]
                    },
                    options: { scales: { y: { beginAtZero: true } } }
                });
                break;

            case 'category-sales':
                const categorySales = {};
                activeReservations.forEach(res => {
                    categorySales[res.category] = (categorySales[res.category] || 0) + Number(res.total_price);
                });

                reportChart = new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels: Object.keys(categorySales),
                        datasets: [{
                            data: Object.values(categorySales),
                            backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40']
                        }]
                    }
                });
                break;

            case 'manager-performance':
                const managerPerformance = {};
                activeReservations.forEach(res => {
                    const managerName = res.manager ? res.manager.username : '미지정';
                    if (!managerPerformance[managerName]) {
                        managerPerformance[managerName] = { count: 0, sales: 0 };
                    }
                    managerPerformance[managerName].count += 1;
                    managerPerformance[managerName].sales += Number(res.total_price);
                });

                reportChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: Object.keys(managerPerformance),
                        datasets: [{
                            label: '담당자별 예약 건수',
                            data: Object.values(managerPerformance).map(p => p.count),
                            backgroundColor: 'rgba(75, 192, 192, 0.6)',
                            yAxisID: 'y-axis-count'
                        }, {
                            label: '담당자별 매출액',
                            data: Object.values(managerPerformance).map(p => p.sales),
                            backgroundColor: 'rgba(153, 102, 255, 0.6)',
                            type: 'line',
                            yAxisID: 'y-axis-sales'
                        }]
                    },
                    options: {
                        scales: {
                            'y-axis-count': {
                                type: 'linear',
                                position: 'left',
                                beginAtZero: true,
                                title: { display: true, text: '예약 건수' }
                            },
                            'y-axis-sales': {
                                type: 'linear',
                                position: 'right',
                                beginAtZero: true,
                                title: { display: true, text: '매출액 (원)' },
                                grid: { drawOnChartArea: false }
                            }
                        }
                    }
                });
                break;
        }
    }

    generateReportButton.addEventListener('click', generateReport);
    generateReport();
});

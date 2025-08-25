document.addEventListener("DOMContentLoaded", function() {
    if (!document.getElementById('managerBarChart')) return;

    const managerBarChartCanvas = document.getElementById('managerBarChart');
    const managerSalesTable = document.getElementById('manager-sales-table');
    let managerBarChart = null;

    window.apiFetch('reservations/all/').then(response => {
        if(response && response.results) {
            const reservations = response.results;
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

            // Render Chart
            if (managerBarChart) managerBarChart.destroy();
            managerBarChart = new Chart(managerBarChartCanvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: Object.keys(managerStats),
                    datasets: [{
                        label: '담당자별 매출액 (VND)',
                        data: Object.values(managerStats).map(s => s.sales),
                        backgroundColor: 'rgba(153, 102, 255, 0.6)'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
            });

            // Render Table
            managerSalesTable.innerHTML = '';
            for (const manager in managerStats) {
                const row = managerSalesTable.insertRow();
                row.innerHTML = `
                    <td>${manager}</td>
                    <td>${managerStats[manager].sales.toLocaleString()} VND</td>
                    <td>${managerStats[manager].count} 건</td>
                `;
            }
        }
    });
});

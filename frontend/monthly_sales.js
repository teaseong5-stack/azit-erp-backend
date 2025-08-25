document.addEventListener("DOMContentLoaded", function() {
    if (!document.getElementById('monthlySalesChart')) return;

    const monthlySalesChartCanvas = document.getElementById('monthlySalesChart');
    const monthlySalesTable = document.getElementById('monthly-sales-table');
    let monthlySalesChart = null;

    window.apiFetch('reservations/all/').then(response => {
        if(response && response.results) {
            const reservations = response.results;
            const monthlySales = {};
            const activeReservations = reservations.filter(res => res.status !== 'CANCELED' && res.start_date);
            
            activeReservations.forEach(res => {
                const month = res.start_date.substring(0, 7);
                monthlySales[month] = (monthlySales[month] || 0) + Number(res.total_price);
            });
            
            const sortedMonths = Object.keys(monthlySales).sort();
            
            // Render Chart
            if (monthlySalesChart) monthlySalesChart.destroy();
            monthlySalesChart = new Chart(monthlySalesChartCanvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: sortedMonths,
                    datasets: [{
                        label: '월별 매출액',
                        data: sortedMonths.map(month => monthlySales[month]),
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
            });

            // Render Table
            monthlySalesTable.innerHTML = '';
            sortedMonths.forEach(month => {
                const row = monthlySalesTable.insertRow();
                row.innerHTML = `
                    <td>${month}</td>
                    <td>${monthlySales[month].toLocaleString()} VND</td>
                `;
            });
        }
    });
});

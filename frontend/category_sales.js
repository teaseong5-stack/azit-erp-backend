document.addEventListener("DOMContentLoaded", function() {
    if (!document.getElementById('categoryPieChart')) return;

    const categoryPieChartCanvas = document.getElementById('categoryPieChart');
    const categorySalesTable = document.getElementById('category-sales-table');
    let categoryPieChart = null;

    const categoryLabels = { 'TOUR': '투어', 'RENTAL_CAR': '렌터카', 'ACCOMMODATION': '숙박', 'GOLF': '골프', 'TICKET': '티켓', 'OTHER': '기타' };
    const categoryColors = {
        'TOUR': 'rgba(54, 162, 235, 0.8)', 'RENTAL_CAR': 'rgba(75, 192, 192, 0.8)',
        'ACCOMMODATION': 'rgba(255, 99, 132, 0.8)', 'GOLF': 'rgba(153, 102, 255, 0.8)',
        'TICKET': 'rgba(255, 159, 64, 0.8)', 'OTHER': 'rgba(108, 117, 125, 0.8)'
    };

    window.apiFetch('reservations/all/').then(response => {
        if(response && response.results) {
            const reservations = response.results;
            const categorySales = {};
            const activeReservations = reservations.filter(res => res.status !== 'CANCELED');
            
            activeReservations.forEach(res => {
                categorySales[res.category] = (categorySales[res.category] || 0) + Number(res.total_price);
            });

            // Render Chart
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

            // Render Table
            categorySalesTable.innerHTML = '';
            for (const category in categorySales) {
                const row = categorySalesTable.insertRow();
                row.innerHTML = `
                    <td>${categoryLabels[category] || category}</td>
                    <td>${categorySales[category].toLocaleString()} VND</td>
                `;
            }
        }
    });
});

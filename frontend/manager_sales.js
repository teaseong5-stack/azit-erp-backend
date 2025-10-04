document.addEventListener("DOMContentLoaded", function() {
    if (!document.getElementById('manager-sales-table')) return;

    const managerSalesTable = document.getElementById('manager-sales-table');
    const totalRow = document.getElementById('manager-sales-total');
    const yearSelect = document.getElementById('filter-year');
    const monthSelect = document.getElementById('filter-month');
    const filterButton = document.getElementById('filter-button');
    const chartCanvas = document.getElementById('managerSalesChart');

    let managerBarChart = null; // 차트 인스턴스를 저장할 변수

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
        const params = new URLSearchParams({ group_by: 'manager' });
        if (year) params.append('year', year);
        if (month) params.append('month', month);

        try {
            const summaryData = await window.apiFetch(`reservations/summary?${params.toString()}`);
            
            managerSalesTable.innerHTML = '';
            totalRow.innerHTML = '';
            if (managerBarChart) managerBarChart.destroy(); // 기존 차트 파괴

            if (!summaryData || summaryData.length === 0) {
                managerSalesTable.innerHTML = '<tr><td colspan="4" class="text-center py-5">해당 기간의 데이터가 없습니다.</td></tr>';
                return;
            }

            const totalSales = summaryData.reduce((sum, item) => sum + Number(item.sales), 0);
            const totalCount = summaryData.reduce((sum, item) => sum + Number(item.count), 0);

            // 매출액 기준으로 데이터 정렬
            summaryData.sort((a, b) => b.sales - a.sales);

            summaryData.forEach(item => {
                const sales = Number(item.sales);
                const salesShare = totalSales > 0 ? (sales / totalSales * 100).toFixed(1) : 0;

                const row = managerSalesTable.insertRow();
                row.innerHTML = `
                    <td>${item.manager || '미지정'}</td>
                    <td>${sales.toLocaleString()} VND</td>
                    <td>${item.count}</td>
                    <td>${salesShare}%</td>
                `;
            });

            // 합계 행 렌더링
            totalRow.innerHTML = `
                <td>총 합계</td>
                <td>${totalSales.toLocaleString()} VND</td>
                <td>${totalCount}</td>
                <td>100.0%</td>
            `;

            // 가로 막대 그래프 생성
            const labels = summaryData.map(item => item.manager || '미지정');
            const data = summaryData.map(item => item.sales);
            managerBarChart = new Chart(chartCanvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: '매출액 (VND)',
                        data: data,
                        backgroundColor: 'rgba(54, 162, 235, 0.6)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    indexAxis: 'y', // 이 옵션이 가로 막대 그래프를 만듭니다.
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return value.toLocaleString();
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });

        } catch (error) {
            console.error("데이터 업데이트 실패:", error);
            toast.error("데이터를 불러오는 중 오류가 발생했습니다.");
            managerSalesTable.innerHTML = '<tr><td colspan="4" class="text-center py-5 text-danger">데이터 로딩 중 오류가 발생했습니다.</td></tr>';
        }
    }
    
    filterButton.addEventListener('click', () => {
        updateDashboard(yearSelect.value, monthSelect.value);
    });

    async function initializePage() {
        populateFilters();
        await updateDashboard();
    }

    initializePage();
});
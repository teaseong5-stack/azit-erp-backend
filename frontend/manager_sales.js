document.addEventListener("DOMContentLoaded", function() {
    // 이 스크립트가 manager_sales.html에서만 실행되도록 확인합니다.
    if (!document.getElementById('manager-sales-table')) return;

    // --- 1. HTML 요소 선언 ---
    const managerSalesTable = document.getElementById('manager-sales-table');
    const totalRow = document.getElementById('manager-sales-total');
    const startDateInput = document.getElementById('filter-start-date');
    const endDateInput = document.getElementById('filter-end-date');
    const filterButton = document.getElementById('filter-button');
    const resetButton = document.getElementById('reset-button');
    const chartCanvas = document.getElementById('managerSalesChart');

    let managerBarChart = null; // 차트 인스턴스를 저장할 변수

    /**
     * 서버에서 데이터를 가져와 테이블과 차트를 업데이트하는 함수
     * @param {string} startDate - 조회 시작일
     * @param {string} endDate - 조회 종료일
     */
    async function updateDashboard(startDate, endDate) {
        const params = new URLSearchParams({ group_by: 'manager' });
        if (startDate) params.append('start_date__gte', startDate);
        if (endDate) params.append('start_date__lte', endDate);

        try {
            const summaryData = await window.apiFetch(`reservations/summary?${params.toString()}`);
            
            // 기존 내용을 초기화합니다.
            managerSalesTable.innerHTML = '';
            totalRow.innerHTML = '';
            if (managerBarChart) {
                managerBarChart.destroy(); // 기존 차트가 있으면 파괴합니다.
            }

            if (!summaryData || summaryData.length === 0) {
                managerSalesTable.innerHTML = '<tr><td colspan="4" class="text-center py-5">해당 기간의 데이터가 없습니다.</td></tr>';
                return;
            }

            // 전체 합계 계산
            const totalSales = summaryData.reduce((sum, item) => sum + Number(item.sales), 0);
            const totalCount = summaryData.reduce((sum, item) => sum + Number(item.count), 0);

            // 매출액 기준으로 데이터를 내림차순 정렬합니다.
            summaryData.sort((a, b) => b.sales - a.sales);

            // 테이블 본문(tbody) 렌더링
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

            // 합계 행(tfoot) 렌더링
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
                                // 숫자에 콤마를 추가하는 포맷터
                                callback: function(value) {
                                    return value.toLocaleString();
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false // 범례는 숨깁니다.
                        },
                        tooltip: {
                            callbacks: {
                                // 툴팁에 표시될 텍스트 포맷 지정
                                label: function(context) {
                                    return ` 매출: ${context.raw.toLocaleString()} VND`;
                                }
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.error("데이터 업데이트 실패:", error);
            toast.error("데이터를 불러오는 중 오류가 발생했습니다.");
            managerSalesTable.innerHTML = '<tr><td colspan="4" class="text-center py-5 text-danger">데이터 로딩 중 오류가 발생했습니다.</td></tr>';
        }
    }
    
    // --- 3. 이벤트 리스너 설정 ---

    // '조회' 버튼 클릭 시
    filterButton.addEventListener('click', () => {
        updateDashboard(startDateInput.value, endDateInput.value);
    });

    // '초기화' 버튼 클릭 시
    resetButton.addEventListener('click', () => {
        startDateInput.value = '';
        endDateInput.value = '';
        updateDashboard(); // 필터를 비우고 전체 데이터 조회
    });

    // --- 4. 페이지 초기화 ---
    updateDashboard(); // 페이지가 처음 열릴 때 전체 데이터로 조회
});
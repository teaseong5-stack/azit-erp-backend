document.addEventListener("DOMContentLoaded", function() {
    // reports.html 페이지에 있을 때만 이 코드를 실행합니다.
    if (!document.getElementById('report-table-body')) return;

    const reportTableBody = document.getElementById('report-table-body');
    const categorySummaryTable = document.getElementById('category-summary-table');
    const categorySummaryFooter = document.getElementById('category-summary-footer');
    const downloadCsvButton = document.getElementById('download-csv-button');

    const categoryLabels = { 'TOUR': '투어', 'RENTAL_CAR': '렌터카', 'ACCOMMODATION': '숙박', 'GOLF': '골프', 'TICKET': '티켓', 'OTHER': '기타' };

    // 주어진 예약 데이터로 리포트 페이지 전체를 생성하는 함수
    function generateReport(reservations) {
        // 1. 카테고리별 손익 계산
        const summary = {};
        let grandTotalSales = 0;
        let grandTotalCost = 0;

        const activeReservations = reservations.filter(res => res.status !== 'CANCELED');

        activeReservations.forEach(res => {
            if (!summary[res.category]) {
                summary[res.category] = { sales: 0, cost: 0 };
            }
            summary[res.category].sales += Number(res.total_price);
            summary[res.category].cost += Number(res.total_cost);
        });

        // 2. 요약 표 채우기
        categorySummaryTable.innerHTML = '';
        for (const category in summary) {
            const profit = summary[category].sales - summary[category].cost;
            const row = `
                <tr>
                    <td>${categoryLabels[category] || category}</td>
                    <td>${summary[category].sales.toLocaleString()}원</td>
                    <td>${summary[category].cost.toLocaleString()}원</td>
                    <td class="fw-bold ${profit >= 0 ? 'text-primary' : 'text-danger'}">${profit.toLocaleString()}원</td>
                </tr>
            `;
            categorySummaryTable.innerHTML += row;
            grandTotalSales += summary[category].sales;
            grandTotalCost += summary[category].cost;
        }

        // 3. 요약 표 합계 채우기
        const grandTotalProfit = grandTotalSales - grandTotalCost;
        categorySummaryFooter.innerHTML = `
            <tr>
                <td>합계</td>
                <td>${grandTotalSales.toLocaleString()}원</td>
                <td>${grandTotalCost.toLocaleString()}원</td>
                <td class="${grandTotalProfit >= 0 ? 'text-primary' : 'text-danger'}">${grandTotalProfit.toLocaleString()}원</td>
            </tr>
        `;

        // 4. 전체 예약 내역 표 채우기
        reportTableBody.innerHTML = '';
        reservations.forEach(res => {
            const row = `
                <tr>
                    <td>${res.id}</td>
                    <td>${res.category}</td>
                    <td>${res.tour_name}</td>
                    <td>${res.customer ? res.customer.name : ''}</td>
                    <td>${res.manager ? res.manager.username : ''}</td>
                    <td>${res.start_date || ''}</td>
                    <td>${Number(res.total_price).toLocaleString()}</td>
                    <td>${Number(res.total_cost).toLocaleString()}</td>
                    <td>${res.status}</td>
                </tr>
            `;
            reportTableBody.innerHTML += row;
        });
    }

    // CSV 다운로드 버튼 이벤트
    downloadCsvButton.addEventListener('click', async () => {
        const blob = await window.apiFetch('export-csv', {}, true);
        if (blob) {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'reservations.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        }
    });

    // 페이지 초기 로드
    window.apiFetch('reservations').then(reservations => {
        if (reservations) {
            generateReport(reservations);
        }
    });
});

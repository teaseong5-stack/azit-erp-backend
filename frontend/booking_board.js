document.addEventListener("DOMContentLoaded", async function() {
    if (!document.getElementById('bookingBoardTab')) return;

    // --- 1. HTML 요소 선언 ---
    const todayDateEl = document.getElementById('today-date');
    const todaySchedulesTable = document.getElementById('today-schedules-table');
    const weeklySalesEl = document.getElementById('weekly-sales');
    const weeklyCountEl = document.getElementById('weekly-count');
    const monthlySalesEl = document.getElementById('monthly-sales');
    const monthlyCountEl = document.getElementById('monthly-count');

    // --- 2. 데이터 렌더링 함수 ---

    function renderTodaySchedules(schedules) {
        todayDateEl.textContent = new Date().toLocaleDateString('ko-KR');
        if (!schedules || schedules.length === 0) {
            todaySchedulesTable.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-5">오늘의 확정 일정이 없습니다.</td></tr>';
            return;
        }

        // --- ▼▼▼ [수정] 이 부분이 수정되었습니다 ▼▼▼ ---
        // 1. JavaScript에서 안전하게 시간순으로 정렬합니다.
        schedules.sort((a, b) => {
            const timeA = (a.details && a.details.startTime) || '99:99';
            const timeB = (b.details && b.details.startTime) || '99:99';
            return timeA.localeCompare(timeB);
        });

        todaySchedulesTable.innerHTML = '';
        schedules.forEach(res => {
            // 2. details가 null일 경우를 대비하여 안전하게 접근합니다.
            const startTime = (res.details && res.details.startTime) || '시간 미정';
            // --- ▲▲▲ [수정] 이 부분이 수정되었습니다 ▲▲▲ ---
            
            const statusColors = { 'PENDING': 'secondary', 'CONFIRMED': 'primary', 'PAID': 'success', 'COMPLETED': 'dark', 'CANCELED': 'danger' };
            const statusColor = statusColors[res.status] || 'light';

            const row = todaySchedulesTable.insertRow();
            row.innerHTML = `
                <td><span class="badge bg-primary-subtle text-primary-emphasis">${startTime}</span></td>
                <td>${res.tour_name}</td>
                <td>${res.customer ? res.customer.name : 'N/A'}</td>
                <td>${res.category_display}</td>
                <td>${res.manager ? res.manager.username : 'N/A'}</td>
                <td><span class="badge bg-${statusColor}">${res.status_display}</span></td>
                <td>
                    <a href="reservations.html?action=edit&id=${res.id}" class="btn btn-sm btn-outline-primary">
                        <i class="bi bi-pencil-fill"></i>
                    </a>
                </td>
            `;
        });
    }

    function renderSummaries(weekly, monthly) {
        weeklySalesEl.textContent = `${Number(weekly.total_sales).toLocaleString()} VND`;
        weeklyCountEl.textContent = `${weekly.total_count} 건`;
        monthlySalesEl.textContent = `${Number(monthly.total_sales).toLocaleString()} VND`;
        monthlyCountEl.textContent = `${monthly.total_count} 건`;
    }

    // --- 3. 페이지 초기화 ---
    async function initializeBoard() {
        try {
            const data = await window.apiFetch('booking-board-summary/');
            renderTodaySchedules(data.today_schedules);
            renderSummaries(data.weekly_summary, data.monthly_summary);
        } catch (error) {
            console.error("예약 현황판 데이터 로딩 실패:", error);
            toast.error("현황판 데이터를 불러오는 중 오류가 발생했습니다.");
        }
    }

    initializeBoard();
});
document.addEventListener("DOMContentLoaded", async function() {
    if (!document.getElementById('bookingBoardTab')) return;

    // --- 1. HTML 요소 선언 ---
    const todayDateEl = document.getElementById('today-date');
    const todaySchedulesTable = document.getElementById('today-schedules-table');
    
    const weeklySalesEl = document.getElementById('weekly-sales');
    const weeklyCountEl = document.getElementById('weekly-count');
    const weekRangeEl = document.getElementById('week-range');
    const weeklySchedulesTable = document.getElementById('weekly-schedules-table');

    const monthlySalesEl = document.getElementById('monthly-sales');
    const monthlyCountEl = document.getElementById('monthly-count');
    const calendarMonthYearEl = document.getElementById('calendar-month-year');
    const calendarGridEl = document.getElementById('monthly-calendar-grid');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');

    const eventModal = new bootstrap.Modal(document.getElementById('eventDetailModal'));
    const eventModalTitle = document.getElementById('event-modal-title');
    const eventModalBody = document.getElementById('event-modal-body');
    const eventModalEditLink = document.getElementById('event-modal-edit-link');

    let allMonthlySchedules = [];
    let currentDate = new Date();

    // --- 2. 데이터 렌더링 함수 ---

    function renderTodaySchedules(schedules) {
        todayDateEl.textContent = new Date().toLocaleDateString('ko-KR');
        if (!schedules || schedules.length === 0) {
            todaySchedulesTable.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-5">오늘의 확정 일정이 없습니다.</td></tr>';
            return;
        }

        // JavaScript에서 안전하게 시간순으로 정렬합니다.
        schedules.sort((a, b) => {
            const timeA = (a.details && a.details.startTime) || '99:99';
            const timeB = (b.details && b.details.startTime) || '99:99';
            return timeA.localeCompare(timeB);
        });

        todaySchedulesTable.innerHTML = '';
        schedules.forEach(res => {
            const startTime = (res.details && res.details.startTime) || '시간 미정';
            const statusColors = { 'CONFIRMED': 'primary', 'PAID': 'success', 'COMPLETED': 'dark' };
            const statusColor = statusColors[res.status] || 'secondary';

            const row = todaySchedulesTable.insertRow();
            row.innerHTML = `
                <td><span class="badge bg-primary-subtle text-primary-emphasis">${startTime}</span></td>
                <td>${res.tour_name}</td>
                <td>${res.customer ? res.customer.name : 'N/A'}</td>
                <td>${res.category_display}</td>
                <td>${res.manager ? res.manager.username : 'N/A'}</td>
                <td><span class="badge bg-${statusColor}">${res.status_display}</span></td>
                <td><a href="reservations.html?action=edit&id=${res.id}" class="btn btn-sm btn-outline-primary"><i class="bi bi-pencil-fill"></i></a></td>
            `;
        });
    }

    function renderWeeklySchedules(schedules) {
        const today = new Date();
        const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
        const endOfWeek = new Date(today.setDate(today.getDate() + 6));
        weekRangeEl.textContent = `${startOfWeek.toLocaleDateString('ko-KR')} ~ ${endOfWeek.toLocaleDateString('ko-KR')}`;

        if (!schedules || schedules.length === 0) {
            weeklySchedulesTable.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-5">이번 주 확정 일정이 없습니다.</td></tr>';
            return;
        }

        weeklySchedulesTable.innerHTML = '';
        schedules.forEach(res => {
            const statusColors = { 'CONFIRMED': 'primary', 'PAID': 'success', 'COMPLETED': 'dark' };
            const statusColor = statusColors[res.status] || 'secondary';
            const row = weeklySchedulesTable.insertRow();
            row.innerHTML = `
                <td>${res.start_date}</td>
                <td>${res.tour_name}</td>
                <td>${res.customer ? res.customer.name : 'N/A'}</td>
                <td>${res.category_display}</td>
                <td>${res.manager ? res.manager.username : 'N/A'}</td>
                <td><span class="badge bg-${statusColor}">${res.status_display}</span></td>
                <td><a href="reservations.html?action=edit&id=${res.id}" class="btn btn-sm btn-outline-primary"><i class="bi bi-pencil-fill"></i></a></td>
            `;
        });
    }

    function renderMonthlyCalendar(year, month, schedules) {
        calendarMonthYearEl.textContent = `${year}년 ${month + 1}월`;
        calendarGridEl.innerHTML = '';

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();

        for (let i = 0; i < firstDay; i++) {
            calendarGridEl.innerHTML += `<div class="day-cell other-month"></div>`;
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateString = date.toISOString().split('T')[0];
            const isToday = date.toDateString() === today.toDateString();

            const daySchedules = schedules.filter(s => s.start_date === dateString);
            
            let eventsHtml = '<div class="event-list">';
            daySchedules.forEach(schedule => {
                eventsHtml += `<div class="event-item" data-schedule-id="${schedule.id}">${schedule.tour_name}</div>`;
            });
            eventsHtml += '</div>';

            calendarGridEl.innerHTML += `
                <div class="day-cell ${isToday ? 'today' : ''}">
                    <div class="day-number">${day}</div>
                    ${eventsHtml}
                </div>
            `;
        }

        // 캘린더 셀 클릭 이벤트
        calendarGridEl.querySelectorAll('.event-item').forEach(item => {
            item.addEventListener('click', () => {
                const scheduleId = item.dataset.scheduleId;
                const schedule = allMonthlySchedules.find(s => s.id == scheduleId);
                showEventModal(schedule);
            });
        });
    }

    function showEventModal(schedule) {
        eventModalTitle.textContent = `[${schedule.category_display}] ${schedule.tour_name}`;
        eventModalBody.innerHTML = `
            <p><strong>고객명:</strong> ${schedule.customer ? schedule.customer.name : 'N/A'}</p>
            <p><strong>담당자:</strong> ${schedule.manager ? schedule.manager.username : 'N/A'}</p>
            <p><strong>시작일:</strong> ${schedule.start_date}</p>
            <p><strong>상태:</strong> ${schedule.status_display}</p>
        `;
        eventModalEditLink.href = `reservations.html?action=edit&id=${schedule.id}`;
        eventModal.show();
    }

    function renderSummaries(weekly, monthly) {
        weeklySalesEl.textContent = `${Number(weekly.total_sales).toLocaleString()} VND`;
        weeklyCountEl.textContent = `${weekly.total_count} 건`;
        monthlySalesEl.textContent = `${Number(monthly.total_sales).toLocaleString()} VND`;
        monthlyCountEl.textContent = `${monthly.total_count} 건`;
    }

    // --- 3. 이벤트 리스너 ---
    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderMonthlyCalendar(currentDate.getFullYear(), currentDate.getMonth(), allMonthlySchedules);
    });

    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderMonthlyCalendar(currentDate.getFullYear(), currentDate.getMonth(), allMonthlySchedules);
    });

    // --- 4. 페이지 초기화 ---
    async function initializeBoard() {
        try {
            const data = await window.apiFetch('booking-board-summary/');
            allMonthlySchedules = data.monthly_schedules; // 월간 스케줄 전역 저장

            renderTodaySchedules(data.today_schedules);
            renderWeeklySchedules(data.weekly_schedules);
            renderSummaries(data.weekly_summary, data.monthly_summary);
            renderMonthlyCalendar(currentDate.getFullYear(), currentDate.getMonth(), allMonthlySchedules);
            
        } catch (error) {
            console.error("예약 현황판 데이터 로딩 실패:", error);
            toast.error("현황판 데이터를 불러오는 중 오류가 발생했습니다.");
        }
    }

    initializeBoard();
});
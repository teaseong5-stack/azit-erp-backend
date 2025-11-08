<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>아지트 ERP - 예약 현황판</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <!-- 사이드바 -->
    <nav class="sidebar">
        <div class="sidebar-header"><h3><i class="bi bi-house-heart-fill me-2"></i>아지트 ERP</h3></div>
        <ul class="nav flex-column">
            <li class="nav-item"><a class="nav-link" href="dashboard.html"><i class="bi bi-grid-fill me-2"></i>대시보드</a></li>
            <li class="nav-item"><a class="nav-link" href="customers.html"><i class="bi bi-people-fill me-2"></i>고객 관리</a></li>
            <li class="nav-item has-submenu"><a class="nav-link active" href="reservations.html"><i class="bi bi-calendar-check-fill me-2"></i>예약 관리</a><ul class="submenu" style="display: block;"><li><a class="nav-link" href="reservations.html?action=new">새 예약 등록</a></li><li><a class="nav-link" href="reservations.html">예약 목록</a></li><li><a class="nav-link active" href="booking_board.html">예약 현황판</a></li><li><a class="nav-link" href="bulk_upload.html">일괄 등록</a></li></ul></li>
            <li class="nav-item has-submenu"><a class="nav-link" href="reports.html"><i class="bi bi-file-earmark-bar-graph-fill me-2"></i>리포트</a><ul class="submenu"><li><a class="nav-link" href="monthly_sales.html">월별 매출 현황</a></li><li><a class="nav-link" href="category_sales.html">카테고리별 현황</a></li><li><a class="nav-link" href="manager_sales.html">담당자별 현황</a></li></ul></li>
            <li class="nav-item"><a class="nav-link" href="partners.html"><i class="bi bi-building me-2"></i>제휴업체 관리</a></li>
            <li class="nav-item has-submenu"><a class="nav-link" href="accounting.html"><i class="bi bi-calculator-fill me-2"></i>회계 관리</a><ul class="submenu"><li><a class="nav-link" href="accounting.html?action=new">새 거래 등록</a></li><li><a class="nav-link" href="accounting.html">거래 내역</a></li></ul></li>
        </ul>
        <ul id="admin-menu" class="nav flex-column mt-auto"><li class="nav-item"><a class="nav-link" href="https://azit-erp-backend-1.onrender.com/admin/" target="_blank"><i class="bi bi-gear-fill me-2"></i>설정</a></li></ul>
    </nav>

    <!-- 메인 콘텐츠 -->
    <main class="content">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1>예약 현황판</h1>
            <button id="logout-button" class="btn btn-outline-danger">로그아웃</button>
        </div>

        <ul class="nav nav-tabs nav-fill mb-4" id="bookingBoardTab" role="tablist">
            <li class="nav-item" role="presentation"><button class="nav-link active" id="today-tab" data-bs-toggle="tab" data-bs-target="#today-panel" type="button" role="tab"><i class="bi bi-calendar-check-fill me-2"></i>일일 현황</button></li>
            <li class="nav-item" role="presentation"><button class="nav-link" id="weekly-tab" data-bs-toggle="tab" data-bs-target="#weekly-panel" type="button" role="tab"><i class="bi bi-calendar-week-fill me-2"></i>주간 현황</button></li>
            <li class="nav-item" role="presentation"><button class="nav-link" id="monthly-tab" data-bs-toggle="tab" data-bs-target="#monthly-panel" type="button" role="tab"><i class="bi bi-calendar-month-fill me-2"></i>월간 현황</button></li>
        </ul>

        <div class="tab-content" id="bookingBoardTabContent">
            
            <!-- 일일 현황판 패널 -->
            <div class="tab-pane fade show active" id="today-panel" role="tabpanel">
                <div class="card">
                    <div class="card-header fs-5 fw-bold">오늘의 확정 일정 (<span id="today-date"></span>)</div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-hover table-sm">
                                <thead><tr><th>시작시간</th><th>상품명</th><th>고객명</th><th>카테고리</th><th>담당자</th><th>상태</th><th>관리</th></tr></thead>
                                <tbody id="today-schedules-table"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 주간 현황판 패널 -->
            <div class="tab-pane fade" id="weekly-panel" role="tabpanel">
                <div class="row mb-4">
                    <div class="col-md-6"><div class="card kpi-card text-white bg-primary"><div class="card-body text-center"><h5 class="card-title">이번 주 총 매출</h5><p class="card-text fs-3 fw-bold" id="weekly-sales">0 VND</p></div></div></div>
                    <div class="col-md-6"><div class="card kpi-card text-white bg-info"><div class="card-body text-center"><h5 class="card-title">이번 주 예약 건수</h5><p class="card-text fs-3 fw-bold" id="weekly-count">0 건</p></div></div></div>
                </div>
                <div class="card">
                    <div class="card-header fs-5 fw-bold">이번 주 확정 일정 (<span id="week-range"></span>)</div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-hover table-sm">
                                <thead><tr><th>시작일</th><th>상품명</th><th>고객명</th><th>카테고리</th><th>담당자</th><th>상태</th><th>관리</th></tr></thead>
                                <tbody id="weekly-schedules-table"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 월간 현황판 패널 -->
            <div class="tab-pane fade" id="monthly-panel" role="tabpanel">
                <div class="row mb-4">
                    <div class="col-md-6"><div class="card kpi-card text-white bg-success"><div class="card-body text-center"><h5 class="card-title">이번 달 총 매출</h5><p class="card-text fs-3 fw-bold" id="monthly-sales">0 VND</p></div></div></div>
                    <div class="col-md-6"><div class="card kpi-card text-white bg-warning text-dark"><div class="card-body text-center"><h5 class="card-title">이번 달 예약 건수</h5><p class="card-text fs-3 fw-bold" id="monthly-count">0 건</p></div></div></div>
                </div>
                <div class="card">
                    <div class="card-header fs-5 fw-bold d-flex justify-content-between align-items-center">
                        <button class="btn btn-outline-secondary" id="prev-month-btn"><i class="bi bi-chevron-left"></i></button>
                        <span id="calendar-month-year"></span>
                        <button class="btn btn-outline-secondary" id="next-month-btn"><i class="bi bi-chevron-right"></i></button>
                    </div>
                    <div class="card-body">
                        <div class="calendar-header-grid">
                            <div class="calendar-header-cell">일</div>
                            <div class="calendar-header-cell">월</div>
                            <div class="calendar-header-cell">화</div>
                            <div class="calendar-header-cell">수</div>
                            <div class="calendar-header-cell">목</div>
                            <div class="calendar-header-cell">금</div>
                            <div class="calendar-header-cell">토</div>
                        </div>
                        <div class="calendar-grid" id="monthly-calendar-grid">
                            <!-- 캘린더 날짜 셀이 여기에 동적으로 삽입됩니다. -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <!-- 캘린더 이벤트 상세 모달 -->
    <div class="modal fade" id="eventDetailModal" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="event-modal-title">일정 상세</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body" id="event-modal-body">
                    <!-- 이벤트 상세 내용이 여기에 삽입됩니다. -->
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">닫기</button>
                    <a href="#" id="event-modal-edit-link" class="btn btn-primary">수정하기</a>
                </div>
            </div>
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
    <script src="common.js" defer></script>
    <script src="booking_board.js" defer></script>
</body>
</html>
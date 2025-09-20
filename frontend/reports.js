document.addEventListener("DOMContentLoaded", async function() {
    if (!document.getElementById('report-table-body')) return;

    // --- 1. 요소 및 변수 선언 ---
    const user = await window.apiFetch('user-info');
    const tableBody = document.getElementById('report-table-body');
    const yearSelect = document.getElementById('filter-year');
    const monthSelect = document.getElementById('filter-month');
    const categorySelect = document.getElementById('filter-category');
    const productInput = document.getElementById('filter-product');
    const managerSelect = document.getElementById('filter-manager');
    const filterButton = document.getElementById('filter-button');
    const resetButton = document.getElementById('reset-button');
    const pageInfo = document.getElementById('page-info');
    const prevPageButton = document.getElementById('prev-page-button');
    const nextPageButton = document.getElementById('next-page-button');
    const summaryTotalSales = document.getElementById('summary-total-sales');
    const summaryTotalCost = document.getElementById('summary-total-cost');
    const summaryTotalMargin = document.getElementById('summary-total-margin');
    const summaryManagerCounts = document.getElementById('summary-manager-counts');

    // 상세 정보 팝업(모달) 요소
    const detailModalEl = new bootstrap.Modal(document.getElementById('reportDetailModal'));
    const detailModalTitle = document.getElementById('report-detail-title');
    const detailModalBody = document.getElementById('report-detail-body');

    let currentPage = 1;
    let totalPages = 1;
    let currentFilters = {};
    let allReservations = []; // 필터링된 전체 예약을 저장할 변수

    // --- 2. 데이터 로딩 및 렌더링 함수 ---
    async function initializeFilters() {
        const currentYear = new Date().getFullYear();
        yearSelect.innerHTML = '<option value="">전체</option>';
        for (let i = 0; i < 5; i++) {
            const year = currentYear - i;
            yearSelect.innerHTML += `<option value="${year}">${year}년</option>`;
        }
        monthSelect.innerHTML = '<option value="">전체</option>';
        for (let i = 1; i <= 12; i++) {
            monthSelect.innerHTML += `<option value="${i}">${i}월</option>`;
        }
        managerSelect.innerHTML = '<option value="">전체</option>';
        try {
            const users = await window.apiFetch('users');
            if (users) {
                users.forEach(u => {
                    managerSelect.innerHTML += `<option value="${u.id}">${u.username}</option>`;
                });
            }
        } catch (error) {
            console.error("담당자 목록 로딩 실패:", error);
        }
    }

    async function fetchSummaryData(filters = {}) {
        const params = new URLSearchParams(filters);
        const endpoint = `reports/summary?${params.toString()}`;
        try {
            const summaryData = await window.apiFetch(endpoint);
            summaryTotalSales.textContent = `${Number(summaryData.totals.total_sales).toLocaleString()} VND`;
            summaryTotalCost.textContent = `${Number(summaryData.totals.total_cost).toLocaleString()} VND`;
            summaryTotalMargin.textContent = `${Number(summaryData.totals.total_margin).toLocaleString()} VND`;

            summaryManagerCounts.innerHTML = '';
            if (summaryData.manager_counts.length > 0) {
                const list = document.createElement('ul');
                list.className = 'list-unstyled mb-0';
                summaryData.manager_counts.forEach(item => {
                    const listItem = document.createElement('li');
                    listItem.className = 'd-flex justify-content-between';
                    listItem.innerHTML = `
                        <a href="#" class="manager-detail-link" data-manager-name="${item.manager__username || '미지정'}">
                            ${item.manager__username || '미지정'}
                        </a> 
                        <strong>${item.count}건</strong>`;
                    list.appendChild(listItem);
                });
                summaryManagerCounts.appendChild(list);
            } else {
                summaryManagerCounts.textContent = '데이터 없음';
            }
        } catch (error) {
            console.error("요약 데이터 로딩 실패:", error);
            toast.error("요약 정보를 불러오는데 실패했습니다.");
        }
    }

    async function fetchReportData(page = 1, filters = {}) {
        currentFilters = filters;
        const params = new URLSearchParams({ page, ...filters });
        const paginatedEndpoint = `reservations?${params.toString()}`;
        params.delete('page');
        const allEndpoint = `reservations/all?${params.toString()}`;

        try {
            const [paginatedResponse, allResponse] = await Promise.all([
                window.apiFetch(paginatedEndpoint),
                window.apiFetch(allEndpoint)
            ]);

            allReservations = allResponse.results || [];
            tableBody.innerHTML = '';

            if (!paginatedResponse || !paginatedResponse.results || paginatedResponse.results.length === 0) {
                pageInfo.textContent = '데이터가 없습니다.';
                prevPageButton.disabled = true;
                nextPageButton.disabled = true;
                tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-5">조회된 데이터가 없습니다.</td></tr>';
                return;
            }

            const reservations = paginatedResponse.results;
            const totalCount = paginatedResponse.count;
            totalPages = Math.ceil(totalCount / 50);

            reservations.forEach(res => {
                const row = tableBody.insertRow();
                const margin = (res.total_price || 0) - (res.total_cost || 0);
                row.innerHTML = `
                    <td><a href="#" class="category-detail-link" data-category="${res.category}" data-category-name="${res.category_display}">${res.category_display || 'N/A'}</a></td>
                    <td>${res.tour_name}</td>
                    <td>${res.customer ? res.customer.name : 'N/A'}</td>
                    <td>${Number(res.total_price).toLocaleString()} VND</td>
                    <td>${Number(res.total_cost).toLocaleString()} VND</td>
                    <td class="fw-bold ${margin >= 0 ? 'text-primary' : 'text-danger'}">${Number(margin).toLocaleString()} VND</td>
                    <td><a href="#" class="manager-detail-link" data-manager-name="${res.manager ? res.manager.username : '미지정'}">${res.manager ? res.manager.username : '미지정'}</a></td>
                `;
            });

            currentPage = page;
            pageInfo.textContent = `페이지 ${currentPage} / ${totalPages} (총 ${totalCount}건)`;
            prevPageButton.disabled = !paginatedResponse.previous;
            nextPageButton.disabled = !paginatedResponse.next;
        } catch (error) {
            console.error("리포트 데이터 로딩 실패:", error);
            toast.error("데이터를 불러오는 데 실패했습니다.");
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-danger">데이터 로딩 중 오류가 발생했습니다.</td></tr>';
        }
    }

    function showDetailPopup(type, value, displayName) {
        let title = '';
        let headers = [];
        let rows = [];
        const dataMap = new Map();

        if (type === 'manager') {
            title = `${value} 담당 상세 실적`;
            headers = ['카테고리', '매출액 (VND)', '건수'];
            const filtered = allReservations.filter(r => (r.manager ? r.manager.username : '미지정') === value);

            filtered.forEach(r => {
                const key = r.category_display || '기타';
                const current = dataMap.get(key) || { sales: 0, count: 0 };
                current.sales += Number(r.total_price);
                current.count += 1;
                dataMap.set(key, current);
            });

            rows = Array.from(dataMap, ([key, val]) => `<tr><td>${key}</td><td>${val.sales.toLocaleString()}</td><td>${val.count}</td></tr>`);

        } else { // category
            title = `${displayName} 카테고리 상세 실적`;
            headers = ['담당자', '매출액 (VND)', '건수'];
            const filtered = allReservations.filter(r => r.category === value);

            filtered.forEach(r => {
                const key = r.manager ? r.manager.username : '미지정';
                const current = dataMap.get(key) || { sales: 0, count: 0 };
                current.sales += Number(r.total_price);
                current.count += 1;
                dataMap.set(key, current);
            });

            rows = Array.from(dataMap, ([key, val]) => `<tr><td>${key}</td><td>${val.sales.toLocaleString()}</td><td>${val.count}</td></tr>`);
        }

        detailModalTitle.textContent = title;
        detailModalBody.innerHTML = `
            <div class="table-responsive">
                <table class="table table-striped table-bordered">
                    <thead>
                        <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                    </thead>
                    <tbody>
                        ${rows.join('')}
                    </tbody>
                </table>
            </div>
        `;
        detailModalEl.show();
    }

    // --- 3. 이벤트 처리 함수 ---
    function applyFilters() {
        const filters = {
            year: yearSelect.value,
            month: monthSelect.value,
            category: categorySelect.value,
            search: productInput.value.trim(),
            manager: managerSelect.value,
        };
        for (const key in filters) {
            if (!filters[key]) delete filters[key];
        }
        fetchReportData(1, filters);
        fetchSummaryData(filters);
    }

    function resetFilters() {
        yearSelect.value = '';
        monthSelect.value = '';
        categorySelect.value = '';
        productInput.value = '';
        managerSelect.value = '';
        applyFilters();
    }

    // --- 4. 이벤트 리스너 설정 ---
    filterButton.addEventListener('click', applyFilters);
    resetButton.addEventListener('click', resetFilters);

    prevPageButton.addEventListener('click', () => {
        if (currentPage > 1) fetchReportData(currentPage - 1, currentFilters);
    });

    nextPageButton.addEventListener('click', () => {
        if (currentPage < totalPages) fetchReportData(currentPage + 1, currentFilters);
    });

    document.querySelector('.content').addEventListener('click', function(event) {
        const target = event.target;
        if (target.classList.contains('manager-detail-link')) {
            event.preventDefault();
            const managerName = target.dataset.managerName;
            showDetailPopup('manager', managerName, managerName);
        }
        if (target.classList.contains('category-detail-link')) {
            event.preventDefault();
            const category = target.dataset.category;
            const categoryName = target.dataset.categoryName;
            showDetailPopup('category', category, categoryName);
        }
    });

    // --- 5. 페이지 초기화 ---
    async function initializePage() {
        await initializeFilters();
        applyFilters();
    }

    initializePage();
});
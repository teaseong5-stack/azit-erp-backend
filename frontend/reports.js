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
    const resetButton = document.getElementById('reset-button'); // [추가] 초기화 버튼
    const pageInfo = document.getElementById('page-info');
    const prevPageButton = document.getElementById('prev-page-button');
    const nextPageButton = document.getElementById('next-page-button');
    const summaryTotalSales = document.getElementById('summary-total-sales');
    const summaryTotalCost = document.getElementById('summary-total-cost');
    const summaryTotalMargin = document.getElementById('summary-total-margin');
    const summaryManagerCounts = document.getElementById('summary-manager-counts');
    let currentPage = 1;
    let totalPages = 1;
    let currentFilters = {};

    // --- 2. 데이터 로딩 및 렌더링 함수 ---
    async function initializeFilters() {
        // 년/월 드롭다운 채우기
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
        
        // 담당자 드롭다운 채우기
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
                    listItem.innerHTML = `<span>${item.manager__username || '미지정'}</span> <strong>${item.count}건</strong>`;
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
        const endpoint = `reservations?${params.toString()}`;

        try {
            const response = await window.apiFetch(endpoint);
            tableBody.innerHTML = '';

            if (!response || !response.results || response.results.length === 0) {
                pageInfo.textContent = '데이터가 없습니다.';
                prevPageButton.disabled = true;
                nextPageButton.disabled = true;
                tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-5">조회된 데이터가 없습니다.</td></tr>';
                return;
            }

            const reservations = response.results;
            const totalCount = response.count;
            totalPages = Math.ceil(totalCount / 50);

            reservations.forEach(res => {
                const row = tableBody.insertRow();
                const margin = (res.total_price || 0) - (res.total_cost || 0);
                row.innerHTML = `
                    <td>${res.category_display || 'N/A'}</td>
                    <td>${res.tour_name}</td>
                    <td>${res.customer ? res.customer.name : 'N/A'}</td>
                    <td>${Number(res.total_price).toLocaleString()} VND</td>
                    <td>${Number(res.total_cost).toLocaleString()} VND</td>
                    <td class="fw-bold ${margin >= 0 ? 'text-primary' : 'text-danger'}">${Number(margin).toLocaleString()} VND</td>
                    <td>${res.manager ? res.manager.username : 'N/A'}</td>
                `;
            });
            
            currentPage = page;
            pageInfo.textContent = `페이지 ${currentPage} / ${totalPages} (총 ${totalCount}건)`;
            prevPageButton.disabled = !response.previous;
            nextPageButton.disabled = !response.next;
        } catch (error) {
            console.error("리포트 데이터 로딩 실패:", error);
            toast.error("데이터를 불러오는 데 실패했습니다.");
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-danger">데이터 로딩 중 오류가 발생했습니다.</td></tr>';
        }
    }
    
    // --- 3. 이벤트 처리 함수 ---
    function applyFilters() {
        // [수정] 복잡한 날짜 계산 로직을 제거하고, 년/월 값을 그대로 사용합니다.
        const filters = {
            year: yearSelect.value,
            month: monthSelect.value,
            category: categorySelect.value,
            search: productInput.value.trim(),
            manager: managerSelect.value,
        };
        // 빈 필터 값은 파라미터에서 제외
        for (const key in filters) {
            if (!filters[key]) {
                delete filters[key];
            }
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
        applyFilters(); // 필터를 초기화한 후 다시 조회
    }

    // --- 4. 이벤트 리스너 설정 ---
    filterButton.addEventListener('click', applyFilters);
    resetButton.addEventListener('click', resetFilters); // [추가] 초기화 버튼 이벤트
    
    prevPageButton.addEventListener('click', () => {
        if (currentPage > 1) {
            fetchReportData(currentPage - 1, currentFilters);
        }
    });

    nextPageButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            fetchReportData(currentPage + 1, currentFilters);
        }
    });

    // --- 5. 페이지 초기화 ---
    async function initializePage() {
        await initializeFilters();
        applyFilters(); // 초기 로드 시 전체 데이터 조회
    }

    initializePage();
});

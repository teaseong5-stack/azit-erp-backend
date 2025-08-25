document.addEventListener("DOMContentLoaded", async function() {
    if (!document.getElementById('report-table-body')) return;

    const user = await window.apiFetch('user-info');
    const tableBody = document.getElementById('report-table-body');
    const yearSelect = document.getElementById('filter-year');
    const monthSelect = document.getElementById('filter-month');
    const categorySelect = document.getElementById('filter-category');
    const productInput = document.getElementById('filter-product');
    const managerSelect = document.getElementById('filter-manager');
    const filterButton = document.getElementById('filter-button');
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
        if (user && user.is_superuser) {
            const users = await window.apiFetch('users');
            if (users) {
                users.forEach(u => {
                    managerSelect.innerHTML += `<option value="${u.id}">${u.username}</option>`;
                });
            }
        } else if (user) {
            managerSelect.innerHTML += `<option value="${user.id}">${user.username}</option>`;
            managerSelect.value = user.id;
        }
    }

    async function fetchSummaryData(filters = {}) {
        const params = new URLSearchParams(filters);
        const endpoint = `reservations/summary?${params.toString()}`;
        const summaryData = await window.apiFetch(endpoint);

        if (summaryData) {
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
        }
    }

    async function fetchReportData(page = 1, filters = {}) {
        currentFilters = filters;
        const params = new URLSearchParams({ page, ...filters });
        const endpoint = `reservations?${params.toString()}`;

        const response = await window.apiFetch(endpoint);
        tableBody.innerHTML = '';

        if (!response || !response.results) {
            pageInfo.textContent = '데이터가 없습니다.';
            prevPageButton.disabled = true;
            nextPageButton.disabled = true;
            const row = tableBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 7;
            cell.textContent = '조회된 데이터가 없습니다.';
            cell.className = 'text-center text-muted';
            return;
        }

        const reservations = response.results;
        const totalCount = response.count;
        totalPages = Math.ceil(totalCount / 50);

        reservations.forEach(res => {
            const row = tableBody.insertRow();
            const margin = (res.total_price || 0) - (res.total_cost || 0);

            row.innerHTML = `
                <td>${res.category || 'N/A'}</td>
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
    }

    function applyFilters() {
        const filters = {};
        const year = yearSelect.value;
        const month = monthSelect.value;
        
        if (year && month) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            filters.start_date__gte = startDate.toISOString().split('T')[0];
            filters.start_date__lte = endDate.toISOString().split('T')[0];
        } else if (year) {
            filters.start_date__gte = `${year}-01-01`;
            filters.start_date__lte = `${year}-12-31`;
        }

        if (categorySelect.value) filters.category = categorySelect.value;
        if (productInput.value) filters.search = productInput.value.trim();
        if (managerSelect.value) filters.manager = managerSelect.value;

        fetchReportData(1, filters);
        fetchSummaryData(filters);
    }

    filterButton.addEventListener('click', applyFilters);
    
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

    async function initializePage() {
        await initializeFilters();
        await fetchReportData(1, {});
        await fetchSummaryData({});
    }

    initializePage();
});

document.addEventListener("DOMContentLoaded", function() {
    // customers.html 페이지가 아닐 경우, 스크립트 실행을 중단합니다.
    if (!document.getElementById('customer-list-table')) return;

    // --- 1. HTML 요소 및 전역 변수 선언 ---
    const customerListTable = document.getElementById('customer-list-table');
    const customerForm = document.getElementById('customer-form');
    
    // 새 고객 등록 모달 관련 요소
    const newCustomerModal = new bootstrap.Modal(document.getElementById('newCustomerModal'));
    const showNewCustomerModalButton = document.getElementById('show-new-customer-modal');

    // 수정 모달 관련 요소
    const editModal = new bootstrap.Modal(document.getElementById('editCustomerModal'));
    const editModalSaveButton = document.getElementById('edit-customer-save-button');

    // 검색 및 필터 요소
    const searchInput = document.getElementById('customer-search-input');
    const searchButton = document.getElementById('customer-search-button');
    const searchResetButton = document.getElementById('customer-search-reset-button');

    // 페이지네이션 요소
    const prevPageButton = document.getElementById('prev-page-button');
    const nextPageButton = document.getElementById('next-page-button');
    const pageInfo = document.getElementById('page-info');

    // 일괄 등록 요소
    const bulkDataInput = document.getElementById('bulk-customer-data');
    const bulkUploadButton = document.getElementById('bulk-upload-button');
    const bulkResultLog = document.getElementById('bulk-result-log');
    
    // 상태 변수
    let currentPage = 1;
    let totalPages = 1;

    // --- 2. 데이터 로딩 및 화면 구성 함수 ---

    /**
     * 서버에서 고객 목록을 가져와 테이블에 표시하는 함수
     * @param {number} page - 조회할 페이지 번호
     * @param {string} searchTerm - 검색어
     */
    async function populateCustomers(page = 1, searchTerm = '') {
        let endpoint = `customers?page=${page}`;
        if (searchTerm) {
            endpoint += `&search=${searchTerm}`;
        }
        
        const response = await window.apiFetch(endpoint);
        
        customerListTable.innerHTML = '';
        if(!response || !response.results) {
            prevPageButton.disabled = true;
            nextPageButton.disabled = true;
            pageInfo.textContent = '데이터가 없습니다.';
            return;
        }

        const customers = response.results;
        const totalCount = response.count;
        totalPages = Math.ceil(totalCount / 50);

        customers.forEach(customer => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${customer.id}</td>
                <td>${customer.name}</td>
                <td>${customer.phone_number}</td>
                <td>${customer.email || ''}</td>
                <td></td>
            `;

            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'btn-group';

            const editButton = document.createElement('button');
            editButton.textContent = '수정';
            editButton.className = 'btn btn-primary btn-sm';
            editButton.onclick = () => {
                document.getElementById('edit-name').value = customer.name;
                document.getElementById('edit-phone').value = customer.phone_number;
                document.getElementById('edit-email').value = customer.email || '';
                
                editModalSaveButton.onclick = async () => {
                    const updatedData = {
                        name: document.getElementById('edit-name').value,
                        phone_number: document.getElementById('edit-phone').value,
                        email: document.getElementById('edit-email').value
                    };
                    await window.apiFetch(`customers/${customer.id}`, { method: 'PUT', body: JSON.stringify(updatedData) });
                    editModal.hide();
                    populateCustomers(currentPage, searchInput.value.trim());
                };
                editModal.show();
            };

            const deleteButton = document.createElement('button');
            deleteButton.textContent = '삭제';
            deleteButton.className = 'btn btn-danger btn-sm';
            deleteButton.onclick = async () => {
                if (confirm(`'${customer.name}' 고객을 정말 삭제하시겠습니까?`)) {
                    await window.apiFetch(`customers/${customer.id}`, { method: 'DELETE' });
                    populateCustomers(currentPage, searchInput.value.trim());
                }
            };

            buttonGroup.appendChild(editButton);
            buttonGroup.appendChild(deleteButton);
            row.cells[4].appendChild(buttonGroup);
            customerListTable.appendChild(row);
        });

        currentPage = page;
        pageInfo.textContent = `페이지 ${currentPage} / ${totalPages} (총 ${totalCount}건)`;
        prevPageButton.disabled = !response.previous;
        nextPageButton.disabled = !response.next;
    }

    /**
     * 검색을 수행하는 함수
     */
    function performSearch() {
        const searchTerm = searchInput.value.trim();
        populateCustomers(1, searchTerm);
    }

    // --- 3. 이벤트 리스너 설정 ---

    // '새 고객 등록' 버튼 클릭 시 팝업 열기
    showNewCustomerModalButton.addEventListener('click', () => {
        newCustomerModal.show();
    });

    // 개별 고객 등록 폼 제출
    customerForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = {
            name: document.getElementById('name').value,
            phone_number: document.getElementById('phone').value,
            email: document.getElementById('email').value,
        };
        const response = await window.apiFetch('customers', { method: 'POST', body: JSON.stringify(formData) });
        if (response) {
            newCustomerModal.hide();
            customerForm.reset();
            populateCustomers(1); // 첫 페이지로 목록 새로고침
        }
    });

    // 검색 버튼 및 Enter 키 이벤트
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') performSearch();
    });

    // 초기화 버튼 이벤트
    searchResetButton.addEventListener('click', () => {
        searchInput.value = '';
        populateCustomers(1);
    });
    
    // 페이지네이션 버튼 이벤트
    prevPageButton.addEventListener('click', () => {
        if (currentPage > 1) populateCustomers(currentPage - 1, searchInput.value.trim());
    });
    nextPageButton.addEventListener('click', () => {
        if (currentPage < totalPages) populateCustomers(currentPage + 1, searchInput.value.trim());
    });

    // 일괄 등록 버튼 이벤트
    bulkUploadButton.addEventListener('click', async () => {
        const rawData = bulkDataInput.value.trim();
        if (!rawData) {
            bulkResultLog.textContent = '오류: 입력된 데이터가 없습니다.';
            return;
        }
        const rows = rawData.split('\n').slice(1);
        const customers = [];
        bulkResultLog.textContent = '데이터 변환 중...';
        for (const row of rows) {
            const columns = row.split('\t');
            if (columns.length < 2) continue;
            const customer = {
                name: columns[0] || '',
                phone_number: columns[1] || '',
                email: columns[2] || ''
            };
            customers.push(customer);
        }
        if (customers.length === 0) {
            bulkResultLog.textContent = '오류: 변환할 수 있는 데이터가 없습니다. 형식을 확인해주세요.';
            return;
        }
        bulkResultLog.textContent = `${customers.length}개의 데이터를 서버로 전송합니다...`;
        try {
            const response = await window.apiFetch('customers/bulk/', { method: 'POST', body: JSON.stringify(customers) });
            if (response) {
                bulkResultLog.textContent = `업로드 완료!\n\n${JSON.stringify(response, null, 2)}`;
                bulkDataInput.value = '';
                newCustomerModal.hide();
                populateCustomers(1);
            } else {
                bulkResultLog.textContent = '서버에서 오류가 발생했습니다. 응답을 받지 못했습니다.';
            }
        } catch (error) {
            bulkResultLog.textContent = `업로드 중 오류 발생:\n${error}`;
        }
    });

    // --- 4. 페이지 초기화 ---
    async function initializePage() {
        await populateCustomers(1);
        
        // URL 파라미터를 확인하여 팝업을 자동으로 엽니다.
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('action') === 'new') {
            newCustomerModal.show();
        }
    }
    
    initializePage();
});

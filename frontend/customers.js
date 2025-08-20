document.addEventListener("DOMContentLoaded", function() {
    // customers.html 페이지가 아닐 경우, 스크립트 실행을 중단합니다.
    if (!document.getElementById('customer-list-table')) return;

    // HTML 요소들을 변수에 할당합니다.
    const customerListTable = document.getElementById('customer-list-table');
    const customerForm = document.getElementById('customer-form');
    const editModal = new bootstrap.Modal(document.getElementById('editCustomerModal'));
    const editModalSaveButton = document.getElementById('edit-customer-save-button');
    const searchInput = document.getElementById('customer-search-input');
    const searchButton = document.getElementById('customer-search-button');
    const searchResetButton = document.getElementById('customer-search-reset-button');

    // 페이지네이션 관련 요소 및 상태 변수를 선언합니다.
    const prevPageButton = document.getElementById('prev-page-button');
    const nextPageButton = document.getElementById('next-page-button');
    const pageInfo = document.getElementById('page-info');
    let currentPage = 1;
    let totalPages = 1;

    // 서버에서 고객 목록을 가져와 화면에 표시하는 함수입니다.
    async function populateCustomers(page = 1, searchTerm = '') {
        // 페이지 번호와 검색어를 포함하여 API 엔드포인트를 구성합니다.
        let endpoint = `customers?page=${page}`;
        if (searchTerm) {
            endpoint += `&search=${searchTerm}`;
        }
        
        // 백엔드에서 페이지네이션 형식으로 응답을 받습니다.
        const response = await window.apiFetch(endpoint);
        
        customerListTable.innerHTML = ''; // 기존 목록을 초기화합니다.

        // 응답이 없거나 결과가 없으면, 버튼을 비활성화하고 메시지를 표시합니다.
        if(!response || !response.results) {
            prevPageButton.disabled = true;
            nextPageButton.disabled = true;
            pageInfo.textContent = '데이터가 없습니다.';
            return;
        }

        const customers = response.results;
        const totalCount = response.count;
        totalPages = Math.ceil(totalCount / 50); // 페이지당 50개 기준으로 총 페이지 수를 계산합니다.

        // 각 고객 데이터를 테이블의 행(row)으로 만들어 추가합니다.
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

            // 수정 버튼 생성 및 이벤트 처리
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
                    await window.apiFetch(`customers/${customer.id}`, {
                        method: 'PUT',
                        body: JSON.stringify(updatedData)
                    });
                    editModal.hide();
                    populateCustomers(currentPage, searchInput.value.trim()); // 현재 페이지 새로고침
                };
                editModal.show();
            };

            // 삭제 버튼 생성 및 이벤트 처리
            const deleteButton = document.createElement('button');
            deleteButton.textContent = '삭제';
            deleteButton.className = 'btn btn-danger btn-sm';
            deleteButton.onclick = async () => {
                if (confirm(`'${customer.name}' 고객을 정말 삭제하시겠습니까?`)) {
                    await window.apiFetch(`customers/${customer.id}`, { method: 'DELETE' });
                    populateCustomers(currentPage, searchInput.value.trim()); // 현재 페이지 새로고침
                }
            };

            buttonGroup.appendChild(editButton);
            buttonGroup.appendChild(deleteButton);
            row.cells[4].appendChild(buttonGroup);
            customerListTable.appendChild(row);
        });

        // 페이지 정보 및 버튼 상태를 업데이트합니다.
        currentPage = page;
        pageInfo.textContent = `페이지 ${currentPage} / ${totalPages} (총 ${totalCount}건)`;
        prevPageButton.disabled = !response.previous; // 이전 페이지가 없으면 비활성화
        nextPageButton.disabled = !response.next;     // 다음 페이지가 없으면 비활성화
    }
    
    // 새 고객 등록 폼 제출 이벤트 처리
    customerForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = {
            name: document.getElementById('name').value,
            phone_number: document.getElementById('phone').value,
            email: document.getElementById('email').value,
        };
        await window.apiFetch('customers', { method: 'POST', body: JSON.stringify(formData) });
        customerForm.reset();
        populateCustomers(); // 목록 새로고침
    });

    // 검색 기능 관련 이벤트 처리
    function performSearch() {
        const searchTerm = searchInput.value.trim();
        populateCustomers(1, searchTerm); // 검색 시 항상 첫 페이지부터 조회
    }

    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') performSearch();
    });

    searchResetButton.addEventListener('click', () => {
        searchInput.value = '';
        populateCustomers(1); // 초기화 시 첫 페이지 조회
    });
    
    // 이전/다음 페이지 버튼 이벤트 처리
    prevPageButton.addEventListener('click', () => {
        if (currentPage > 1) {
            populateCustomers(currentPage - 1, searchInput.value.trim());
        }
    });

    nextPageButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            populateCustomers(currentPage + 1, searchInput.value.trim());
        }
    });

    // 페이지가 처음 로드될 때 고객 목록을 불러옵니다.
    populateCustomers();
});

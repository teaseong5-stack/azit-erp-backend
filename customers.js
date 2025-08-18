document.addEventListener("DOMContentLoaded", function() {
    if (!document.getElementById('customer-list-table')) return;

    const customerListTable = document.getElementById('customer-list-table');
    const customerForm = document.getElementById('customer-form');
    const editModal = new bootstrap.Modal(document.getElementById('editCustomerModal'));
    const editModalSaveButton = document.getElementById('edit-customer-save-button');
    const searchInput = document.getElementById('customer-search-input');
    const searchButton = document.getElementById('customer-search-button');
    const searchResetButton = document.getElementById('customer-search-reset-button');

    async function populateCustomers(searchTerm = '') {
        let endpoint = 'customers';
        if (searchTerm) {
            const params = new URLSearchParams({ search: searchTerm });
            endpoint += `?${params.toString()}`;
        }
        const customers = await window.apiFetch(endpoint);
        
        customerListTable.innerHTML = '';
        if(!customers) return;
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
                    await window.apiFetch(`customers/${customer.id}`, {
                        method: 'PUT',
                        body: JSON.stringify(updatedData)
                    });
                    editModal.hide();
                    populateCustomers(searchInput.value.trim());
                };
                editModal.show();
            };

            const deleteButton = document.createElement('button');
            deleteButton.textContent = '삭제';
            deleteButton.className = 'btn btn-danger btn-sm';
            deleteButton.onclick = async () => {
                if (confirm(`'${customer.name}' 고객을 정말 삭제하시겠습니까?`)) {
                    await window.apiFetch(`customers/${customer.id}`, { method: 'DELETE' });
                    populateCustomers(searchInput.value.trim());
                }
            };

            buttonGroup.appendChild(editButton);
            buttonGroup.appendChild(deleteButton);
            row.cells[4].appendChild(buttonGroup);
            customerListTable.appendChild(row);
        });
    }

    customerForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = {
            name: document.getElementById('name').value,
            phone_number: document.getElementById('phone').value,
            email: document.getElementById('email').value,
        };
        await window.apiFetch('customers', { method: 'POST', body: JSON.stringify(formData) });
        customerForm.reset();
        populateCustomers();
    });

    searchButton.addEventListener('click', () => {
        const searchTerm = searchInput.value.trim();
        populateCustomers(searchTerm);
    });

    searchResetButton.addEventListener('click', () => {
        searchInput.value = '';
        populateCustomers();
    });
    
    searchInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            searchButton.click();
        }
    });

    populateCustomers();
});

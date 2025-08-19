document.addEventListener("DOMContentLoaded", async function() {
    // partners.html 페이지에 있을 때만 이 코드를 실행합니다.
    if (!document.getElementById('partner-list-table')) return;

    const user = await window.apiFetch('user-info');
    const partnerListTable = document.getElementById('partner-list-table');
    const partnerForm = document.getElementById('partner-form');
    const bulkPasteArea = document.getElementById('bulk-paste-area');
    const bulkImportButton = document.getElementById('bulk-import-button');
    const importStatus = document.getElementById('import-status');
    
    const editModal = new bootstrap.Modal(document.getElementById('editPartnerModal'));
    const editModalSaveButton = document.getElementById('edit-partner-save-button');

    async function populatePartners() {
        const partners = await window.apiFetch('partners');
        partnerListTable.innerHTML = '';
        if (!partners) return;
        partners.forEach(partner => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${partner.id}</td>
                <td>${partner.name}</td>
                <td>${partner.category}</td>
                <td>${partner.contact_person || ''}</td>
                <td>${partner.phone_number || ''}</td>
                <td></td>
            `;

            // 관리자일 경우에만 수정/삭제 버튼을 추가합니다.
            if (user && user.is_superuser) {
                const buttonGroup = document.createElement('div');
                buttonGroup.className = 'btn-group';

                const editButton = document.createElement('button');
                editButton.textContent = '수정';
                editButton.className = 'btn btn-primary btn-sm';
                editButton.onclick = () => {
                    document.getElementById('edit-partner-name').value = partner.name;
                    document.getElementById('edit-partner-category').value = partner.category;
                    document.getElementById('edit-partner-contact-person').value = partner.contact_person || '';
                    document.getElementById('edit-partner-phone').value = partner.phone_number || '';
                    document.getElementById('edit-partner-email').value = partner.email || '';
                    document.getElementById('edit-partner-notes').value = partner.notes || '';

                    editModalSaveButton.onclick = async () => {
                        const updatedData = {
                            name: document.getElementById('edit-partner-name').value,
                            category: document.getElementById('edit-partner-category').value,
                            contact_person: document.getElementById('edit-partner-contact-person').value,
                            phone_number: document.getElementById('edit-partner-phone').value,
                            email: document.getElementById('edit-partner-email').value,
                            notes: document.getElementById('edit-partner-notes').value,
                        };
                        await window.apiFetch(`partners/${partner.id}`, {
                            method: 'PUT',
                            body: JSON.stringify(updatedData)
                        });
                        editModal.hide();
                        populatePartners();
                    };
                    editModal.show();
                };

                const deleteButton = document.createElement('button');
                deleteButton.textContent = '삭제';
                deleteButton.className = 'btn btn-danger btn-sm';
                deleteButton.onclick = async () => {
                    if (confirm(`'${partner.name}' 업체를 정말 삭제하시겠습니까?`)) {
                        await window.apiFetch(`partners/${partner.id}`, { method: 'DELETE' });
                        populatePartners();
                    }
                };
                
                buttonGroup.appendChild(editButton);
                buttonGroup.appendChild(deleteButton);
                row.cells[5].appendChild(buttonGroup);
            }
            
            partnerListTable.appendChild(row);
        });
    }

    partnerForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = {
            name: document.getElementById('partner-name').value,
            category: document.getElementById('partner-category').value,
            contact_person: document.getElementById('partner-contact-person').value,
            phone_number: document.getElementById('partner-phone').value,
            email: document.getElementById('partner-email').value,
            notes: document.getElementById('partner-notes').value,
        };
        await window.apiFetch('partners', { method: 'POST', body: JSON.stringify(formData) });
        partnerForm.reset();
        populatePartners();
    });

    bulkImportButton.addEventListener('click', async () => {
        const pasteData = bulkPasteArea.value.trim();
        if (!pasteData) {
            alert('붙여넣을 데이터가 없습니다.');
            return;
        }

        const rows = pasteData.split('\n');
        const promises = [];
        let successCount = 0;
        let failCount = 0;

        importStatus.textContent = '등록을 시작합니다...';

        rows.forEach(row => {
            const columns = row.split('\t'); // 탭으로 열 구분
            if (columns.length < 2 || !columns[0]) return;

            const partnerData = {
                name: columns[0] || '',
                category: columns[1] || 'OTHER',
                contact_person: columns[2] || '',
                phone_number: columns[3] || '',
                email: columns[4] || '',
                address: columns[5] || '',
                notes: columns[6] || ''
            };

            const promise = window.apiFetch('partners', {
                method: 'POST',
                body: JSON.stringify(partnerData)
            }).then(result => {
                if (result) successCount++;
                else failCount++;
            });
            promises.push(promise);
        });

        await Promise.all(promises);

        importStatus.textContent = `등록 완료! (성공: ${successCount}건, 실패: ${failCount}건)`;
        bulkPasteArea.value = '';
        populatePartners();
    });

    populatePartners();
});

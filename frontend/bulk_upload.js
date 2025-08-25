document.addEventListener("DOMContentLoaded", async function() {
    const uploadButton = document.getElementById('upload-button');
    const dataInput = document.getElementById('bulk-data-input');
    const resultLog = document.getElementById('result-log');

    let allCustomers = [];
    let allUsers = [];

    async function fetchDataForMapping() {
        resultLog.textContent = '고객 및 담당자 정보를 불러오는 중...';
        try {
            const [customerResponse, userResponse] = await Promise.all([
                window.apiFetch('customers?page_size=10000'),
                window.apiFetch('users')
            ]);
            if (customerResponse && customerResponse.results) {
                allCustomers = customerResponse.results;
            }
            if (userResponse) {
                allUsers = userResponse;
            }
            resultLog.textContent = '준비 완료. 데이터를 붙여넣고 업로드를 시작하세요.';
        } catch (error) {
            resultLog.textContent = '고객 또는 담당자 정보 로딩 실패. 페이지를 새로고침 해주세요.';
        }
    }

    uploadButton.addEventListener('click', async () => {
        const rawData = dataInput.value.trim();
        if (!rawData) {
            resultLog.textContent = '오류: 입력된 데이터가 없습니다.';
            return;
        }

        const rows = rawData.split('\n').slice(1);
        const reservations = [];
        resultLog.textContent = '데이터 변환 및 고객 정보 확인 중...';

        for (const row of rows) {
            const columns = row.split('\t');
            if (columns.length < 11) continue;

            const customerName = columns[1].trim();
            const managerName = columns[10].trim();
            
            // [수정] 고객 자동 생성 로직 추가
            let customer = allCustomers.find(c => c.name === customerName);

            // 만약 고객이 존재하지 않으면, 새로 생성합니다.
            if (!customer && customerName) {
                resultLog.textContent += `\n'${customerName}' 고객 정보가 없어 새로 등록합니다...`;
                const newCustomerData = { 
                    name: customerName, 
                    phone_number: '정보 없음' // 기본값 설정
                };
                
                const newCustomer = await window.apiFetch('customers', {
                    method: 'POST',
                    body: JSON.stringify(newCustomerData)
                });

                if (newCustomer) {
                    allCustomers.push(newCustomer); // 다음 검색을 위해 로컬 목록에 추가
                    customer = newCustomer;
                    resultLog.textContent += `\n'${customerName}' 고객 등록 완료 (ID: ${customer.id}).`;
                } else {
                    resultLog.textContent += `\n[오류] '${customerName}' 고객 생성 실패. 이 예약은 건너뜁니다.`;
                    continue; // 고객 생성 실패 시 해당 예약 건너뛰기
                }
            }
            
            const manager = allUsers.find(u => u.username === managerName);

            const totalPrice = parseFloat((columns[7] || '0').replace(/,/g, '')) || 0;
            const balance = parseFloat((columns[8] || '0').replace(/,/g, '')) || 0;
            const totalCost = parseFloat((columns[6] || '0').replace(/,/g, '')) || 0;
            const paymentAmount = totalPrice - balance;

            const reservation = {
                customer_id: customer ? customer.id : null,
                reservation_date: columns[2] || new Date().toISOString().split('T')[0],
                start_date: columns[3] || null,
                category: columns[4] || 'TOUR',
                tour_name: columns[5] || '제목 없음',
                total_cost: totalCost,
                total_price: totalPrice,
                payment_amount: paymentAmount,
                status: columns[9] || 'CONFIRMED',
                manager_id: manager ? manager.id : null,
                details: {},
                requests: '',
                notes: `일괄 등록된 데이터 (원본 고객명: ${customerName}, 원본 담당자명: ${managerName})`
            };
            
            if (!manager) reservation.notes += ` [경고: 담당자 '${managerName}'를 찾을 수 없음]`;
            
            reservations.push(reservation);
        }

        if (reservations.length === 0) {
            resultLog.textContent = '오류: 변환할 수 있는 데이터가 없습니다. 형식을 확인해주세요.';
            return;
        }

        resultLog.textContent += `\n\n${reservations.length}개의 데이터를 서버로 전송합니다...`;

        try {
            const response = await window.apiFetch('reservations/bulk/', {
                method: 'POST',
                body: JSON.stringify(reservations)
            });

            if (response) {
                resultLog.textContent = `업로드 완료!\n\n${JSON.stringify(response, null, 2)}`;
                dataInput.value = '';
            } else {
                resultLog.textContent = '서버에서 오류가 발생했습니다. 응답을 받지 못했습니다.';
            }
        } catch (error) {
            resultLog.textContent = `업로드 중 오류 발생:\n${error}`;
        }
    });

    fetchDataForMapping();
});

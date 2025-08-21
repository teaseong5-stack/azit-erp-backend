document.addEventListener("DOMContentLoaded", async function() {
    // bulk_upload.html 페이지가 아닐 경우, 스크립트 실행을 중단합니다.
    if (!document.getElementById('upload-button')) return;

    const uploadButton = document.getElementById('upload-button');
    const dataInput = document.getElementById('bulk-data-input');
    const resultLog = document.getElementById('result-log');

    // 고객 및 담당자 이름-ID 매칭을 위한 데이터를 저장할 전역 변수
    let allCustomers = [];
    let allUsers = [];

    /**
     * 페이지 로드 시 고객 및 사용자 목록을 미리 불러와서 매핑 준비를 하는 함수
     */
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

    /**
     * '업로드 시작' 버튼 클릭 시 실행되는 이벤트 리스너
     */
    uploadButton.addEventListener('click', async () => {
        const rawData = dataInput.value.trim();
        if (!rawData) {
            resultLog.textContent = '오류: 입력된 데이터가 없습니다.';
            return;
        }

        // 데이터를 줄 단위로 나누고, 첫 번째 줄(헤더)은 제외합니다.
        const rows = rawData.split('\n').slice(1);
        const reservations = [];
        resultLog.textContent = '데이터 변환 중...';

        for (const row of rows) {
            // 탭으로 구분된 데이터를 배열로 변환합니다.
            const columns = row.split('\t');
            if (columns.length < 11) continue; // 필수 컬럼 수 확인

            // 새로운 컬럼 순서에 맞춰 데이터를 파싱합니다.
            const customerName = columns[1].trim();
            const managerName = columns[10].trim();
            
            // 이름으로 ID를 찾습니다.
            const customer = allCustomers.find(c => c.name === customerName);
            const manager = allUsers.find(u => u.username === managerName);

            const totalPrice = parseFloat(columns[7]) || 0;
            const balance = parseFloat(columns[8]) || 0;
            const paymentAmount = totalPrice - balance; // 잔액을 통해 결제 금액을 계산

            const reservation = {
                customer_id: customer ? customer.id : null,
                reservation_date: columns[2] || new Date().toISOString().split('T')[0],
                start_date: columns[3] || null,
                category: columns[4] || 'TOUR',
                tour_name: columns[5] || '제목 없음',
                total_cost: parseFloat(columns[6]) || 0,
                total_price: totalPrice,
                payment_amount: paymentAmount,
                status: columns[9] || 'CONFIRMED',
                manager_id: manager ? manager.id : null,
                details: {},
                requests: '',
                notes: `일괄 등록된 데이터 (원본 고객명: ${customerName}, 원본 담당자명: ${managerName})`
            };
            
            // 고객이나 담당자를 찾지 못한 경우, 내부 메모에 경고를 남깁니다.
            if (!customer) reservation.notes += ` [경고: 고객 '${customerName}'을 찾을 수 없음]`;
            if (!manager) reservation.notes += ` [경고: 담당자 '${managerName}'를 찾을 수 없음]`;
            
            reservations.push(reservation);
        }

        if (reservations.length === 0) {
            resultLog.textContent = '오류: 변환할 수 있는 데이터가 없습니다. 형식을 확인해주세요.';
            return;
        }

        resultLog.textContent = `${reservations.length}개의 데이터를 서버로 전송합니다...`;

        try {
            // 백엔드의 일괄 등록 API를 호출합니다.
            const response = await window.apiFetch('reservations/bulk/', {
                method: 'POST',
                body: JSON.stringify(reservations)
            });

            if (response) {
                resultLog.textContent = `업로드 완료!\n\n${JSON.stringify(response, null, 2)}`;
                dataInput.value = ''; // 성공 시 입력창 비우기
            } else {
                resultLog.textContent = '서버에서 오류가 발생했습니다. 응답을 받지 못했습니다.';
            }
        } catch (error) {
            resultLog.textContent = `업로드 중 오류 발생:\n${error}`;
        }
    });

    // 페이지 로드 시 이름-ID 매칭을 위한 데이터를 미리 불러옵니다.
    fetchDataForMapping();
});

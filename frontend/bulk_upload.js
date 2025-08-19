document.addEventListener("DOMContentLoaded", function() {
    const uploadButton = document.getElementById('upload-button');
    const dataInput = document.getElementById('bulk-data-input');
    const resultLog = document.getElementById('result-log');

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
            
            // 데이터 순서: 상품명, 고객ID, 시작일, 종료일, 판매가, 원가, 카테고리, 성인, 아동, 유아, 요청사항, 내부메모
            if (columns.length < 7) continue; // 필수 컬럼 수 확인

            const reservation = {
                tour_name: columns[0] || '제목 없음',
                customer_id: parseInt(columns[1], 10) || null,
                start_date: columns[2] || null,
                end_date: columns[3] || null,
                total_price: parseFloat(columns[4]) || 0,
                total_cost: parseFloat(columns[5]) || 0,
                category: columns[6] || 'TOUR',
                // 상세 정보(details)는 JSON 객체로 구성합니다.
                details: {
                    adults: parseInt(columns[7]) || 0,
                    children: parseInt(columns[8]) || 0,
                    infants: parseInt(columns[9]) || 0,
                },
                requests: columns[10] || '',
                notes: columns[11] || '',
                status: 'CONFIRMED' // 기본 상태는 '예약확정'으로 설정
            };
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
                resultLog.textContent = `업로드 성공!\n\n${JSON.stringify(response, null, 2)}`;
                dataInput.value = ''; // 성공 시 입력창 비우기
            } else {
                resultLog.textContent = '서버에서 오류가 발생했습니다. 응답을 받지 못했습니다.';
            }
        } catch (error) {
            resultLog.textContent = `업로드 중 오류 발생:\n${error}`;
        }
    });
});

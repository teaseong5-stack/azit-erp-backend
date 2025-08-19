document.addEventListener("DOMContentLoaded", function() {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');

    // common.js에 정의된 전역 변수 API_BASE_URL을 가져옵니다.
    // 이 스크립트가 실행되기 전에 common.js가 먼저 로드되어야 합니다.
    const API_BASE_URL = window.API_BASE_URL;

    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        // API_BASE_URL이 정의되지 않았을 경우를 대비한 방어 코드
        if (!API_BASE_URL) {
            errorMessage.textContent = 'API 주소를 불러올 수 없습니다. common.js 파일을 확인해주세요.';
            errorMessage.style.display = 'block';
            return;
        }

        try {
            // 하드코딩된 로컬 주소 대신, common.js의 API_BASE_URL을 사용하도록 수정합니다.
            const response = await fetch(`${API_BASE_URL}/token/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: document.getElementById('username').value,
                    password: document.getElementById('password').value
                }),
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('accessToken', data.access);
                localStorage.setItem('refreshToken', data.refresh);
                window.location.assign('dashboard.html');
            } else {
                const errorData = await response.json();
                errorMessage.textContent = errorData.detail || '아이디 또는 비밀번호가 올바르지 않습니다.';
                errorMessage.style.display = 'block';
            }
        } catch (error) {
            console.error('로그인 중 심각한 오류 발생:', error);
            errorMessage.textContent = '서버에 연결할 수 없습니다. 네트워크 연결을 확인하거나 잠시 후 다시 시도해주세요.';
            errorMessage.style.display = 'block';
        }
    });
});

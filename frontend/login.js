document.addEventListener("DOMContentLoaded", function() {
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    
    // 1. 올바른 API 주소를 가져옵니다.
    const API_LOGIN_ENDPOINT = 'token/'; 

    // 로그인 폼 제출 이벤트 처리
    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        const loginData = {
            username: usernameInput.value,
            password: passwordInput.value
        };

        try {
            // 2. 자체 fetch 대신 common.js의 apiFetch를 사용합니다. (단, 여기서는 토큰이 없으므로 직접 호출)
            const response = await fetch(`${window.ERP_CONFIG.API_BASE_URL}/${API_LOGIN_ENDPOINT}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData),
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('accessToken', data.access);
                localStorage.setItem('refreshToken', data.refresh);
                window.location.assign('dashboard.html');
            } else {
                const errorData = await response.json();
                const errorMessage = errorData.detail || '아이디 또는 비밀번호가 올바르지 않습니다.';
                // 3. alert 대신 toast 알림을 사용합니다.
                toast.error(errorMessage);
            }
        } catch (error) {
            console.error('로그인 중 오류 발생:', error);
            toast.error('서버에 연결할 수 없습니다. 네트워크를 확인해주세요.');
        }
    });
});
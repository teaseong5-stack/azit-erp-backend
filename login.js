document.addEventListener("DOMContentLoaded", function() {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');

    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        try {
            const response = await fetch('http://127.0.0.1:8000/api/token/', {
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
                // 서버가 보낸 오류 메시지를 표시
                errorMessage.textContent = errorData.detail || '아이디 또는 비밀번호가 올바르지 않습니다.';
                errorMessage.style.display = 'block';
            }
        } catch (error) {
            // 실제 발생한 오류를 콘솔에 출력하여 디버깅
            console.error('로그인 중 심각한 오류 발생:', error);
            errorMessage.textContent = '서버에 연결할 수 없거나 응답을 처리할 수 없습니다. 개발자 콘솔(F12)을 확인하세요.';
            errorMessage.style.display = 'block';
        }
    });
});

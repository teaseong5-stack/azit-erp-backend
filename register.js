document.addEventListener("DOMContentLoaded", function() {
    const registerForm = document.getElementById('register-form');
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');

    registerForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const password2 = document.getElementById('password2').value;

        if (password !== password2) {
            errorMessage.textContent = '비밀번호가 일치하지 않습니다.';
            errorMessage.style.display = 'block';
            return;
        }

        try {
            const response = await fetch('http://127.0.0.1:8000/api/register/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                successMessage.textContent = '계정 등록에 성공했습니다! 로그인 페이지로 이동합니다.';
                successMessage.style.display = 'block';
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000); // 2초 후 로그인 페이지로 이동
            } else {
                // 서버에서 보낸 오류 메시지를 조합하여 표시
                let errorText = '';
                for (const key in data) {
                    errorText += `${key}: ${data[key].join(', ')}\n`;
                }
                errorMessage.textContent = errorText || '계정 등록에 실패했습니다.';
                errorMessage.style.display = 'block';
            }
        } catch (error) {
            errorMessage.textContent = '서버에 연결할 수 없습니다.';
            errorMessage.style.display = 'block';
        }
    });
});

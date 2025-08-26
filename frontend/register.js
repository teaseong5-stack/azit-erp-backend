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
        const passwordConfirm = document.getElementById('password-confirm').value;

        if (password !== passwordConfirm) {
            errorMessage.textContent = '비밀번호가 일치하지 않습니다.';
            errorMessage.style.display = 'block';
            return;
        }

        try {
            const response = await window.apiFetch('register', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });

            if (response) {
                successMessage.textContent = '계정 등록에 성공했습니다! 3초 후 로그인 페이지로 이동합니다.';
                successMessage.style.display = 'block';
                registerForm.reset();
                
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 3000);
            } else {
                errorMessage.textContent = '계정 등록에 실패했습니다. 사용자 이름이 이미 존재할 수 있습니다.';
                errorMessage.style.display = 'block';
            }
        } catch (error) {
            console.error('계정 등록 중 심각한 오류 발생:', error);
            errorMessage.textContent = '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.';
            errorMessage.style.display = 'block';
        }
    });
});

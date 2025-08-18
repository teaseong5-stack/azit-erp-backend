// 이 파일은 모든 페이지에서 공통으로 사용하는 기능(API 통신, 로그인/로그아웃 등)을 담당합니다.

// --- 1. API 기본 주소 설정 (가장 중요한 부분) ---
// 아래 따옴표 안에, Render에서 복사한 당신의 백엔드 주소를 붙여넣으세요.
const API_BASE_URL = 'https://azit-erp-backend.onrender.com'; 
// 예시: const API_BASE_URL = 'https://azit-erp-backend.onrender.com/api';

// --- 2. 인증 확인 ---
(function() {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken && !window.location.pathname.endsWith('login.html') && !window.location.pathname.endsWith('register.html')) {
        window.location.href = 'login.html';
    }
})();

// --- 3. 공통 유틸리티 함수 ---
window.apiFetch = async function(endpoint, options = {}, isBlob = false) {
    const headers = {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
    };
    if (!isBlob) {
        headers['Content-Type'] = 'application/json';
    }
    const config = { ...options, headers };
    
    try {
        const url = `${API_BASE_URL}/${endpoint.startsWith('/') ? endpoint.substring(1) : endpoint}`;
        const finalUrl = url.endsWith('/') || url.includes('?') ? url : `${url}/`;
        const response = await fetch(finalUrl, config);
        
        if (response.status === 401) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = 'login.html';
            return null;
        }
        if (!response.ok) {
            const errorBody = await response.json();
            console.error(`API Error on ${endpoint}:`, errorBody);
            alert(`오류가 발생했습니다: ${JSON.stringify(errorBody)}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        if (response.status === 204) return null;
        return isBlob ? await response.blob() : await response.json();
    } catch (error) {
        console.error(`Error during fetch for ${endpoint}:`, error);
        return null;
    }
}

// --- 4. 공통 UI 이벤트 리스너 ---
window.addEventListener('load', async () => {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = 'login.html';
        });
    }

    const adminMenu = document.getElementById('admin-menu');
    if (adminMenu) {
        const user = await window.apiFetch('user-info');
        if (user && user.is_superuser) {
            adminMenu.style.display = 'block';
        }
    }
});

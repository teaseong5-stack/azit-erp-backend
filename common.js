// 이 파일은 모든 페이지에서 공통으로 사용하는 기능(API 통신, 로그인/로그아웃 등)을 담당합니다.

// --- 1. API 기본 주소 설정 (가장 중요한 부분) ---
// URL 끝에 /api를 포함시켜 일관성을 유지하고, 다른 파일에서 사용 가능하도록 전역 변수로 노출합니다.
window.API_BASE_URL = 'https://azit-erp-backend-1.onrender.com/api'; 

// --- 2. 인증 확인 ---
(function() {
    const accessToken = localStorage.getItem('accessToken');
    // 로그인 페이지(index.html)나 회원가입 페이지가 아닐 때만 인증을 확인합니다.
    if (!accessToken && !window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('register.html')) {
        window.location.href = 'index.html'; // 수정됨
    }
})();

// --- 3. 공통 유틸리티 함수 ---
window.apiFetch = async function(endpoint, options = {}, isBlob = false) {
    const headers = {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
    };
    if (!options.body || !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    
    const config = { ...options, headers };
    
    try {
        // URL 조합 방식을 개선하여 중복 슬래시 문제를 원천적으로 방지합니다.
        // API_BASE_URL은 '/api'로 끝나고, endpoint는 'customers/' 처럼 '/'로 끝납니다.
        const url = `${window.API_BASE_URL}/${endpoint}`;
        
        const response = await fetch(url, config);
        
        if (response.status === 401) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = 'index.html'; // 수정됨
            return null;
        }
        if (!response.ok) {
            const errorBody = await response.json();
            console.error(`API Error on ${endpoint}:`, errorBody);
            alert(`오류가 발생했습니다: ${JSON.stringify(errorBody)}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        if (response.status === 204) return null; // No Content
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
            window.location.href = 'index.html'; // 수정됨
        });
    }

    const adminMenu = document.getElementById('admin-menu');
    if (adminMenu) {
        // 로그인 페이지에서는 user-info를 호출하지 않도록 예외 처리합니다.
        if (!window.location.pathname.endsWith('index.html')) {
            const user = await window.apiFetch('user-info/');
            if (user && user.is_superuser) {
                adminMenu.style.display = 'block';
            }
        }
    }
});


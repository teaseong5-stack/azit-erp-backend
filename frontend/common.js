// 이 파일은 모든 페이지에서 공통으로 사용하는 기능(API 통신, 로그인/로그아웃 등)을 담당합니다.

// --- 1. API 기본 주소 설정 (가장 중요한 부분) ---
window.API_BASE_URL = 'https://azit-erp-backend-1.onrender.com/api'; 

// --- 2. 인증 확인 ---
(function() {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken && !window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('register.html')) {
        window.location.href = 'index.html';
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
        // [수정 사항]
        // URL에 파라미터(?가 포함된 경우)가 있어도 올바른 위치에 슬래시(/)를 추가하도록 로직을 개선합니다.
        const [path, queryString] = endpoint.split('?');
        const formattedPath = path.endsWith('/') ? path : `${path}/`;
        const finalEndpoint = queryString ? `${formattedPath}?${queryString}` : formattedPath;
        
        const url = `${window.API_BASE_URL}/${finalEndpoint}`;
        
        const response = await fetch(url, config);
        
        if (response.status === 401) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = 'index.html';
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
            window.location.href = 'index.html';
        });
    }

    const adminMenu = document.getElementById('admin-menu');
    if (adminMenu) {
        if (!window.location.pathname.endsWith('index.html')) {
            // user-info 요청 시에도 /가 자동으로 붙도록 수정되었습니다.
            const user = await window.apiFetch('user-info');
            if (user && user.is_superuser) {
                adminMenu.style.display = 'block';
            }
        }
    }
});

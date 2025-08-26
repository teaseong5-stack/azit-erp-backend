// 이 파일은 모든 페이지에서 공통으로 사용하는 기능(API 통신, 로그인/로그아웃 등)을 담당합니다.

// --- 1. API 기본 주소 설정 ---
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
        const cleanedBase = window.API_BASE_URL.replace(/\/$/, '');
        const cleanedEndpoint = endpoint.replace(/^\//, '');
        const url = `${cleanedBase}/${cleanedEndpoint}`;

        const response = await fetch(url, config);
        
        if (response.status === 401) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = 'index.html';
            return null;
        }

        // [수정] 204 No Content 상태 코드를 확인하는 로직을 추가합니다.
        // 삭제 성공 시에는 내용이 없으므로, json() 파싱을 건너뜁니다.
        if (response.status === 204) {
            return null; 
        }

        if (!response.ok) {
            const errorBody = await response.json();
            console.error(`API Error on ${endpoint}:`, errorBody);
            alert(`오류가 발생했습니다: ${JSON.stringify(errorBody)}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
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
            const user = await window.apiFetch('user-info');
            if (user && user.is_superuser) {
                adminMenu.style.display = 'block';
            }
        }
    }

    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');

    if (mobileMenuToggle && sidebar) {
        mobileMenuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!sidebar.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                sidebar.classList.remove('show');
            }
        });
    }
});

// 이 파일은 모든 페이지에서 공통으로 사용하는 기능(API 통신, 로그인/로그아웃 등)을 담당합니다.

window.API_BASE_URL = 'https://azit-erp-backend-1.onrender.com/api'; 

(function() {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken && !window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('register.html')) {
        window.location.href = 'index.html';
    }
})();

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

        if (response.status === 204) {
            return { success: true }; // 삭제 성공 시에도 성공 객체를 반환하도록 수정
        }

        if (!response.ok) {
            // [수정] 서버가 JSON이 아닌 다른 형식의 오류를 보내도 처리할 수 있도록 로직을 강화합니다.
            let errorBody;
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                errorBody = await response.json();
            } else {
                errorBody = { error: await response.text() };
            }
            
            console.error(`API Error on ${endpoint}:`, errorBody);
            const errorMessage = errorBody.detail || JSON.stringify(errorBody);
            alert(`오류가 발생했습니다: ${errorMessage}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return isBlob ? await response.blob() : await response.json();
    } catch (error) {
        console.error(`Error during fetch for ${endpoint}:`, error);
        return null;
    }
}

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

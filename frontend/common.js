// --- 1. 환경 설정 ---
// API 기본 URL 및 토큰 갱신 엔드포인트를 중앙에서 관리합니다.
window.ERP_CONFIG = {
    API_BASE_URL: 'https://azit-erp-backend-1.onrender.com/api',
    TOKEN_REFRESH_URL: 'token/refresh/' // API 베이스 URL에 상대적인 경로
};

// --- 2. Toast 알림 라이브러리 연동 (사전 준비 필요) ---
/**
 * Toast 알림을 위한 래퍼(wrapper) 함수입니다.
 * 사용 전, HTML 파일에 Toastify.js 같은 라이브러리를 먼저 추가해야 합니다.
 * 예시: <script src="https://cdn.jsdelivr.net/npm/toastify-js"></script>
 */
window.toast = {
    show: (message, type = 'success') => {
        const backgroundColor = type === 'success' ? "linear-gradient(to right, #00b09b, #96c93d)" : "linear-gradient(to right, #ff5f6d, #ffc371)";
        console.log(`Toast (${type}): ${message}`); // 라이브러리 없을 때를 대비한 fallback
        if (typeof Toastify === 'function') {
            Toastify({
                text: message,
                duration: 3000,
                close: true,
                gravity: "top", // `top` or `bottom`
                position: "right", // `left`, `center` or `right`
                backgroundColor: backgroundColor,
                stopOnFocus: true, 
            }).showToast();
        }
    },
    error: (message) => {
        window.toast.show(message, 'error');
    }
};

// --- 3. 인증 확인 즉시 실행 함수 ---
// 페이지 로드 시 즉시 실행되어 비로그인 사용자를 로그인 페이지로 리디렉션합니다.
(function() {
    if (!localStorage.getItem('accessToken') && !window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('register.html')) {
        window.location.href = 'index.html';
    }
})();

// --- 4. 자동 토큰 갱신 및 API 호출 함수 ---

// 토큰 갱신 중 중복 요청을 방지하기 위한 플래그
let isRefreshing = false;

/**
 * 만료된 Access Token을 자동으로 갱신합니다.
 */
async function refreshToken() {
    if (isRefreshing) {
        // 이미 갱신 중이면 추가 요청을 보내지 않고 대기합니다.
        // 실제 구현에서는 Promise를 반환하여 대기 후 재시도하는 방식이 더 좋습니다.
        return; 
    }
    isRefreshing = true;

    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
        isRefreshing = false;
        throw new Error("No refresh token available.");
    }

    try {
        const response = await fetch(`${window.ERP_CONFIG.API_BASE_URL}/${window.ERP_CONFIG.TOKEN_REFRESH_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh: refreshToken })
        });

        if (!response.ok) {
            throw new Error("Failed to refresh token.");
        }

        const data = await response.json();
        localStorage.setItem('accessToken', data.access);
        
        // 백엔드가 새 refresh 토큰을 반환하는 경우 (선택적)
        if (data.refresh) {
            localStorage.setItem('refreshToken', data.refresh);
        }

        isRefreshing = false;
        return data.access; // 새 access token 반환

    } catch (error) {
        console.error("Token refresh error:", error);
        // 토큰 갱신 실패 시, 모든 인증 정보를 지우고 로그아웃 처리합니다.
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = 'index.html';
        isRefreshing = false;
        throw error;
    }
}

/**
 * API 호출을 위한 공통 Fetch 함수입니다. (자동 토큰 갱신 기능 포함)
 */
window.apiFetch = async function(endpoint, options = {}, isBlob = false) {
    async function executeFetch(isRetry = false) {
        const accessToken = localStorage.getItem('accessToken');
        if (!accessToken) {
            // 재시도 중에도 토큰이 없으면 인증 오류로 처리
            if (isRetry) throw new Error("Authentication failed after retry.");
            // 첫 시도에 토큰이 없으면 로그인 페이지로
            window.location.href = 'index.html';
            throw new Error("No access token found.");
        }

        const headers = { 'Authorization': `Bearer ${accessToken}` };
        if (!options.body || !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        const config = { ...options, headers };
        const url = `${window.ERP_CONFIG.API_BASE_URL}/${endpoint.replace(/^\//, '')}`;

        try {
            const response = await fetch(url, config);

            if (response.status === 401 && !isRetry) {
                // 401 오류 발생 시, 토큰 갱신 후 원래 요청을 재시도 (단 한 번만)
                console.log("Access token expired. Attempting to refresh...");
                await refreshToken();
                return await executeFetch(true); // 재시도 플래그를 true로 설정하여 다시 실행
            }

            if (response.status === 204) {
                return { success: true };
            }
            
            if (!response.ok) {
                // 기타 HTTP 오류 처리
                const errorBody = await response.json().catch(() => ({ error: `HTTP error! Status: ${response.status}` }));
                const errorMessage = errorBody.detail || JSON.stringify(errorBody);
                throw new Error(errorMessage);
            }
            
            // 성공 처리
            return isBlob ? await response.blob() : await response.json();

        } catch (error) {
            // 네트워크 오류 또는 위에서 발생시킨 예외를 최종적으로 처리
            console.error(`API Fetch Error on ${endpoint}:`, error);
            // refreshToken 함수에서 이미 리디렉션 처리한 경우는 제외
            if (error.message !== "Failed to refresh token.") {
                toast.error(error.message || "서버 통신 중 오류가 발생했습니다.");
            }
            throw error; // 호출자에게 오류 전파
        }
    }

    return await executeFetch();
};


// --- 5. 공통 이벤트 리스너 ---
window.addEventListener('load', () => {
    // 로그아웃 버튼
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = 'index.html';
        });
    }

    // 모바일 메뉴 토글
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (mobileMenuToggle && sidebar) {
        mobileMenuToggle.addEventListener('click', () => sidebar.classList.toggle('show'));
        document.addEventListener('click', (e) => {
            if (!sidebar.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                sidebar.classList.remove('show');
            }
        });
    }
});
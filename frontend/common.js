window.API_BASE_URL = 'https://azit-erp-backend-1.onrender.com/api'; 

// 즉시 실행 함수: 인증 확인 및 리디렉션 (기존과 동일)
(function() {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken && !window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('register.html')) {
        window.location.href = 'index.html';
    }
})();

/**
 * API 호출을 위한 공통 Fetch 함수입니다.
 * [수정됨] 호출 실패 시, 예외를 발생시킵니다 (null을 반환하지 않음).
 */
window.apiFetch = async function(endpoint, options = {}, isBlob = false) {
    const headers = {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
    };
    if (!options.body || !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    
    const config = { ...options, headers };

    // URL 조합 로직 (기존 코드 유지)
    const cleanedBase = window.API_BASE_URL.replace(/\/$/, '');
    const [path, queryString] = endpoint.split('?');
    const cleanedPath = path.replace(/^\//, '');
    const formattedPath = cleanedPath.endsWith('/') ? cleanedPath : `${cleanedPath}/`;
    const finalEndpoint = queryString ? `${formattedPath}?${queryString}` : formattedPath;
    const url = `${cleanedBase}/${finalEndpoint}`;

    let response;
    try {
        // 네트워크 요청 실행
        response = await fetch(url, config);
    } catch (error) {
        // [수정] 네트워크 오류 처리 (서버 접속 불가, CORS 문제 등)
        console.error(`Network or Fetch Error for ${endpoint}:`, error);
        alert("서버에 연결할 수 없습니다. 네트워크 상태나 서버 설정을 확인해주세요.");
        throw error; // 호출자에게 오류 전파
    }
        
    if (response.status === 401) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        alert("인증이 만료되었습니다. 다시 로그인해주세요.");
        window.location.href = 'index.html';
        // [중요] 호출자가 처리를 중단할 수 있도록 예외 발생
        throw new Error("Unauthorized");
    }

    if (response.status === 204) {
        // 성공적으로 처리되었으나 반환할 내용이 없음 (예: DELETE 성공)
        return { success: true };
    }

    if (!response.ok) {
        // 기타 HTTP 오류 처리 (400, 403, 500 등)
        let errorBody;
        const contentType = response.headers.get("content-type");

        // [개선] 에러 응답 파싱 실패 대비
        try {
            if (contentType && contentType.indexOf("application/json") !== -1) {
                errorBody = await response.json();
            } else {
                errorBody = { error: await response.text() };
            }
        } catch (parseError) {
            errorBody = { error: `Failed to parse error response (Status: ${response.status})` };
        }
        
        console.error(`API Error on ${endpoint}:`, errorBody);
        const errorMessage = errorBody.detail || JSON.stringify(errorBody) || `HTTP error! status: ${response.status}`;
        alert(`오류가 발생했습니다: ${errorMessage}`);
        // 호출자에게 예외 전파
        throw new Error(errorMessage);
    }
        
    // 성공 처리
    return isBlob ? await response.blob() : await response.json();
}

// 공통 이벤트 리스너 (페이지 로드 완료 후 실행)
window.addEventListener('load', async () => {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = 'index.html';
        });
    }

    /*
    [제거됨] 관리자 메뉴 표시를 위한 user-info 중복 호출 제거.
    각 페이지 스크립트(예: reservations.js)에서 이미 사용자 정보를 로드하므로 여기서 다시 호출할 필요가 없습니다.
    const adminMenu = document.getElementById('admin-menu');
    ...
    */

    // 모바일 메뉴 토글 로직 (기존과 동일)
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
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  ko: {
    translation: {
      nav: {
        appTitle: "내 스트리밍 앱",
        admin: "관리자",
        studio: "스튜디오",
        logout: "로그아웃",
        login: "로그인",
        signup: "회원가입"
      },
      common: {
        goHome: "홈으로",
        loading: "로딩 중...",
        serverError: "서버 오류가 발생했습니다."
      },
      main: {
        leftBar: "팔로잉 채널 목록",
      },
      channel: {
        move: "채널로 이동",
        loading: "채널 정보 로딩 중...",
        notFound: "채널 정보를 찾을 수 없습니다.",
        home: "홈",
        videos: "동영상",
        community: "커뮤니티",
        about: "정보",
        watchLive: "라이브 시청하기",
        offline: "현재는 방송 중이 아닙니다. 이전에 업로드된 영상을 확인해 보세요.",
        extra: "다시보기, 클립, 등",
        communityPlaceholder: "채널 게시판(커뮤니티) 공간입니다.",
        infoTitle: "채널 정보",
        name: "채널 이름",
        joinedAt: "가입일"
      },
      video: {
        notFound: "비디오를 찾을 수 없습니다.",
        channel: "채널",
        uploadedAt: "업로드 일자"
      },
      studio: {
        title: "방송 설정 (스트림 키)",
        desc: "OBS 등에서 아래 서버 주소와 스트림 키를 사용하세요. 스트림 키는 가입 시 자동 발급되며, 필요 시 재발급할 수 있습니다.",
        serverUrl: "서버 주소",
        streamKey: "스트림 키",
        loadingKey: "불러오는 중...",
        processing: "처리 중...",
        regenerate: "스트림 키 재발급",
        regenerateSuccess: "새 스트림 키가 발급되었습니다.",
        regenerateFail: "스트림 키 재발급에 실패했습니다.",
        currentHint: "위 키로 방송을 시작하면 자동으로 방송 중으로 표시됩니다."
      },
      chat: {
        inputPlaceholder: "채팅을 입력하세요.",
        send: "전송",
        loginRequired: "로그인 후 채팅 가능합니다.",
        system: "시스템",
        systemNotice: "시스템 알림"
      },
      auth: {
        loginTitle: "로그인",
        email: "이메일",
        password: "비밀번호",
        loginSuccess: "로그인되었습니다.",
        noAccount: "계정이 없으신가요?",
        signupLink: "회원가입",
        signupTitle: "회원가입",
        username: "사용자명",
        passwordConfirm: "비밀번호 확인",
        hasAccount: "이미 계정이 있으신가요?",
        passwordMismatch: "비밀번호가 일치하지 않습니다.",
        passwordMin: "비밀번호는 6자 이상이어야 합니다.",
        signupSuccess: "회원가입이 완료되었습니다. 로그인해 주세요."
      },
      admin: {
        title: "관리자 페이지 - 유저 목록",
        loading: "불러오는 중...",
        back: "메인으로 돌아가기",
        roleChanged: "권한이 변경되었습니다.",
        table: {
          id: "ID",
          email: "이메일",
          username: "사용자명",
          role: "권한",
          createdAt: "가입일"
        }
      },
      errorPage: {
        notFound: "페이지를 찾을 수 없습니다."
      },
      errors: {
        AUTH_REQUIRED: "로그인이 필요합니다.",
        INVALID_TOKEN: "유효하지 않은 토큰입니다.",
        ADMIN_REQUIRED: "관리자 권한이 필요합니다.",
        LOGIN_MISSING_FIELDS: "이메일과 비밀번호를 입력해주세요.",
        LOGIN_INVALID_CREDENTIALS: "이메일 또는 비밀번호가 올바르지 않습니다.",
        LOGIN_FAILED: "로그인 처리 중 오류가 발생했습니다.",
        SIGNUP_MISSING_FIELDS: "이메일, 사용자명, 비밀번호를 모두 입력해주세요.",
        SIGNUP_PASSWORD_TOO_SHORT: "비밀번호는 6자 이상이어야 합니다.",
        SIGNUP_DUPLICATE_EMAIL: "이미 사용 중인 이메일입니다.",
        SIGNUP_FAILED: "회원가입 처리 중 오류가 발생했습니다.",
        USER_NOT_FOUND: "유저를 찾을 수 없습니다.",
        STREAM_KEY_FETCH_FAILED: "스트림 키를 불러오지 못했습니다.",
        STREAM_KEY_REGENERATE_FAILED: "스트림 키 재발급에 실패했습니다.",
        USERS_FETCH_FAILED: "유저 목록을 불러오지 못했습니다.",
        ROLE_MISSING: "권한(role) 값을 보내주세요.",
        ROLE_INVALID: "권한은 1~4 사이의 숫자여야 합니다.",
        ROLE_UPDATE_FAILED: "권한 변경에 실패했습니다.",
        CHANNEL_NOT_FOUND: "채널을 찾을 수 없습니다.",
        CHANNEL_INFO_FETCH_FAILED: "채널 정보를 불러오지 못했습니다.",
        CHANNEL_VIDEOS_FETCH_FAILED: "비디오 목록을 불러오지 못했습니다.",
        VIDEO_NOT_FOUND: "비디오를 찾을 수 없습니다.",
        VIDEO_INFO_FETCH_FAILED: "비디오 정보를 불러오지 못했습니다.",
        MAINPAGE_FETCH_FAILED: "메인 정보를 불러오지 못했습니다.",
        LIVE_LIST_FETCH_FAILED: "라이브 목록을 불러오지 못했습니다.",
        LIVE_INFO_FETCH_FAILED: "방송 정보를 불러올 수 없습니다.",
        LIVE_BROWSER_NOT_SUPPORTED: "지원되지 않는 브라우저입니다.",
        LIVE_AUTOPLAY_BLOCKED: "자동 재생이 차단되었습니다.",
        WS_CHANNEL_ID_REQUIRED: "채널 정보가 누락되었습니다.",
        WS_CONNECTION_INIT_FAILED: "채팅 연결 초기화에 실패했습니다.",
        WS_INVALID_MESSAGE_FORMAT: "잘못된 메시지 형식입니다.",
        WS_MESSAGE_REQUIRED: "메시지를 입력해주세요.",
        WS_SESSION_NOT_FOUND: "진행 중인 라이브 세션을 찾을 수 없습니다.",
        WS_CHAT_SEND_FAILED: "채팅 전송에 실패했습니다.",
        WS_CONNECTION_NOT_READY: "채팅 서버 연결이 준비되지 않았습니다. 잠시 후 다시 시도해주세요.",
        WS_BROADCAST_ENDED: "방송이 종료되었습니다.",
        WS_RATE_LIMIT: "채팅을 너무 자주 보낼 수 없습니다.",
        CSRF_INVALID: "보안 토큰이 유효하지 않습니다.",
        LOGOUT_FAILED: "로그아웃 처리 중 오류가 발생했습니다."
      }
    }
  },
  en: {
    translation: {
      nav: {
        appTitle: "My Streaming App",
        admin: "Admin",
        studio: "Studio",
        logout: "Logout",
        login: "Login",
        signup: "Sign up"
      },
      common: {
        goHome: "Go home",
        loading: "Loading...",
        serverError: "A server error occurred."
      },
      chat: {
        inputPlaceholder: "Type a message.",
        send: "Send",
        loginRequired: "Login is required to chat.",
        system: "System",
        systemNotice: "System notice"
      },
      errors: {
        WS_CHANNEL_ID_REQUIRED: "Channel id is required.",
        WS_CONNECTION_INIT_FAILED: "Failed to initialize chat connection.",
        WS_INVALID_MESSAGE_FORMAT: "Invalid message format.",
        WS_MESSAGE_REQUIRED: "Please enter a message.",
        WS_SESSION_NOT_FOUND: "Active live session was not found.",
        WS_CHAT_SEND_FAILED: "Failed to send chat message.",
        WS_CONNECTION_NOT_READY: "Chat connection is not ready. Please try again shortly.",
        WS_BROADCAST_ENDED: "The broadcast has ended.",
        AUTH_REQUIRED: "Login is required.",
        USER_NOT_FOUND: "User not found.",
        CSRF_INVALID: "Security token is invalid.",
        LOGOUT_FAILED: "Logout failed."
      }
    }
  }
};

i18n.use(initReactI18next).init({
  resources,
  lng: "ko",
  fallbackLng: "ko",
  interpolation: { escapeValue: false }
});

export default i18n;

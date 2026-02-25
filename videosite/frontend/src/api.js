import axios from 'axios';
import i18n from './i18n';

const baseURL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';

export const api = axios.create({ baseURL, timeout: 5000, withCredentials: true });
api.defaults.xsrfCookieName = 'XSRF-TOKEN';
api.defaults.xsrfHeaderName = 'X-XSRF-TOKEN';

function tErrorCode(errorCode, fallbackKey) {
  if (errorCode) {
    return i18n.t(`errors.${errorCode}`, { defaultValue: '' });
  }
  return i18n.t(fallbackKey);
}

function normalizeSuccessData(response) {
  if (response.status === 204) {
    return { code: '', data: null };
  }

  const payload = response.data;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { code: '', data: payload };
  }

  const code = payload.code || '';
  if (!Object.prototype.hasOwnProperty.call(payload, 'code')) {
    return { code: '', data: payload };
  }

  const { code: _ignored, ...rest } = payload;
  return { code, data: rest };
}

function normalizeError(err, fallbackKey) {
  const errorCode = err.response?.data?.code || '';
  const translated = tErrorCode(errorCode, fallbackKey);
  return {
    ok: false,
    status: err.response?.status || 0,
    errorCode,
    error: translated || err.response?.data?.error || i18n.t('common.serverError'),
    data: err.response?.data || null,
  };
}

async function request(config, fallbackKey = 'common.serverError') {
  try {
    const response = await api.request(config);
    const normalized = normalizeSuccessData(response);
    return {
      ok: true,
      status: response.status,
      data: normalized.data,
      errorCode: normalized.code,
      error: '',
    };
  } catch (err) {
    return normalizeError(err, fallbackKey);
  }
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setAuth(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem('user');
}

export const API = {
  client: api,
  getStoredUser,
  setAuth,
  clearAuth,

  getMainPage() {
    return request({ method: 'get', url: '/api/mainpage' }, 'errors.MAINPAGE_FETCH_FAILED')
      .then((result) => {
        if (!result.ok) return result;
        return { ...result, data: Array.isArray(result.data?.sections) ? result.data.sections : [] };
      });
  },

  getChannelInfo(channelid) {
    return request({ method: 'get', url: `/api/channel/info/${channelid}` }, 'errors.CHANNEL_INFO_FETCH_FAILED');
  },

  getChannelVideos(channelid, lastid = 0) {
    return request(
      { method: 'get', url: '/api/channel/videos', params: { channelid, lastid } },
      'errors.CHANNEL_VIDEOS_FETCH_FAILED'
    );
  },

  getChannelPosts(channelid, lastid = 0) {
    return request(
      { method: 'get', url: '/api/channel/posts', params: { channelid, lastid } },
      'errors.CHANNEL_POSTS_FETCH_FAILED'
    );
  },

  writeChannelPost(channelid, post) {
    return request(
      { method: 'post', url: '/api/channel/writepost', data: { channelid, post } },
      'errors.POST_WRITE_FAILED'
    );
  },

  getVideoInfo(id) {
    return request({ method: 'get', url: '/api/video/info', params: { id } }, 'errors.VIDEO_INFO_FETCH_FAILED');
  },

  getVideoChat(videoId, at, window = 5) {
    return request(
      { method: 'get', url: `/api/video/${videoId}/chat`, params: { at, window } },
      'errors.VIDEO_CHAT_FETCH_FAILED'
    );
  },

  getVideoThumbnailUrl(url) {
    return `${baseURL}${url}`;
  },

  getLiveUrl(channelid) {
    return request({ method: 'get', url: '/api/liveurl', params: { channelid } }, 'errors.LIVE_INFO_FETCH_FAILED');
  },

  getMyStreamKey() {
    return request({ method: 'post', url: '/api/me/streamkey' }, 'errors.STREAM_KEY_FETCH_FAILED');
  },

  regenerateStreamKey() {
    return request({ method: 'post', url: '/api/me/stream-key/regenerate' }, 'errors.STREAM_KEY_REGENERATE_FAILED');
  },

  login(email, password) {
    return request({ method: 'post', url: '/api/login', data: { email, password } }, 'errors.LOGIN_FAILED');
  },

  signup(email, username, password) {
    return request(
      { method: 'post', url: '/api/signup', data: { email, username, password } },
      'errors.SIGNUP_FAILED'
    );
  },

  getUsers() {
    return request({ method: 'post', url: '/api/users' }, 'errors.USERS_FETCH_FAILED')
      .then((result) => {
        if (!result.ok) return result;
        return { ...result, data: Array.isArray(result.data?.users) ? result.data.users : [] };
      });
  },

  updateUserRole(userId, role) {
    return request({ method: 'post', url: `/api/users/${userId}`, data: { role } }, 'errors.ROLE_UPDATE_FAILED');
  },

  logout() {
    return request({ method: 'post', url: '/api/logout' }, 'errors.LOGOUT_FAILED');
  },
};

export { getStoredUser, setAuth, clearAuth };

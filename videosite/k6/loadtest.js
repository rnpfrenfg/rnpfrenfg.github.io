import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL;
const TOTAL_VUS = Number(__ENV.TOTAL_VUS || 200);
const DURATION = __ENV.DURATION || '2m';

const LIVE_CHANNEL_ID = (__ENV.LIVE_CHANNEL_ID || '1').trim() || null;
const CHATTER_VUS = Math.round(TOTAL_VUS * 0.5);
const LURKER_VUS = TOTAL_VUS - CHATTER_VUS;

const CHAT_EVERY_SEC = Number(__ENV.CHAT_EVERY_SEC || 0.4);
const HLS_POLL_SEC = Number(__ENV.HLS_POLL_SEC || 1);

const AUTH_RETRY_SLEEP_SEC = Number(__ENV.AUTH_RETRY_SLEEP_SEC || 1);
const WS_RETRY_SLEEP_SEC = Number(__ENV.WS_RETRY_SLEEP_SEC || 1);

const failures = new Counter('failures'); // {where, reason, status}

function logFail(where, reason, extra = {}) {
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      vu: __VU,
      iter: __ITER,
      where,
      reason,
      ...extra,
    })
  );

  failures.add(1, {
    where,
    reason,
    status: String(extra.status ?? ''),
  });
}

function randSuffix() {
  return `${__VU}-${Math.floor(Math.random() * 1e9)}`;
}

function cookieHeaderFor(url) {
  const jar = http.cookieJar();
  const cookies = jar.cookiesForURL(url) || {};
  const parts = [];
  for (const [name, value] of Object.entries(cookies)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v != null && String(v) !== '') parts.push(`${name}=${v}`);
      }
      continue;
    }
    if (value != null && String(value) !== '') parts.push(`${name}=${value}`);
  }
  return parts.join('; ');
}

function hasCookie(url, cookieName) {
  const jar = http.cookieJar();
  const cookies = jar.cookiesForURL(url) || {};
  const value = cookies[cookieName];
  if (Array.isArray(value)) return value.length > 0 && String(value[0] || '') !== '';
  return value != null && String(value) !== '';
}

function parseDurationToMs(s) {
  const m = String(s).trim().match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 'ms') return n;
  if (unit === 's') return n * 1000;
  if (unit === 'm') return n * 60 * 1000;
  if (unit === 'h') return n * 60 * 60 * 1000;
  return 0;
}

function endAtMs() {
  const durMs = parseDurationToMs(DURATION);
  const safe = durMs > 0 ? durMs : 2 * 60 * 1000;
  return Date.now() + safe;
}

function signupAndLoginOrRetry(untilMs) {
  const password = __ENV.PASSWORD || 'password123';

  while (Date.now() < untilMs) {
    const email = `k6_${randSuffix()}@test.local`;
    const username = `k6_${randSuffix()}`;

    const s = http.post(
      `${BASE_URL}/api/signup`,
      JSON.stringify({ email, username, password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (!check(s, { 'signup 200/204': (r) => r.status === 200 || r.status === 204 })) {
      logFail('auth', 'signup_not_204', { status: s.status, body: String(s.body || '').slice(0, 200) });
      sleep(AUTH_RETRY_SLEEP_SEC);
      continue;
    }

    const l = http.post(
      `${BASE_URL}/api/login`,
      JSON.stringify({ email, password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (!check(l, { 'login 200': (r) => r.status === 200 })) {
      logFail('auth', 'login_not_200', { status: l.status, body: String(l.body || '').slice(0, 200) });
      sleep(AUTH_RETRY_SLEEP_SEC);
      continue;
    }

    let body = null;
    try {
      body = l.json();
    } catch (e) {
      logFail('auth', 'login_json_parse_fail', { status: l.status });
      sleep(AUTH_RETRY_SLEEP_SEC);
      continue;
    }

    // Current server authenticates WebSocket via cookies; older versions may return a token field.
    const token = body?.token || null;

    if (!hasCookie(BASE_URL, 'access_token') && !token) {
      logFail('auth', 'login_missing_access_token', { status: l.status });
      sleep(AUTH_RETRY_SLEEP_SEC);
      continue;
    }

    return { token, cookieHeader: cookieHeaderFor(BASE_URL), user: body?.user, email };
  }

  return null;
}


let cachedTargetChannelId = null;
let cachedTargetFetchedAt = 0;
const TARGET_CHANNEL_REFRESH_MS = 5 * 1000;

function getTargetChannelIdOrRetry() {
  if (LIVE_CHANNEL_ID) return LIVE_CHANNEL_ID;

  const now = Date.now();
  if (cachedTargetChannelId && now - cachedTargetFetchedAt < TARGET_CHANNEL_REFRESH_MS) {
    return cachedTargetChannelId;
  }

  const r = http.get(`${BASE_URL}/api/mainpage`);
  if (!check(r, { 'mainpage 200': (x) => x.status === 200 })) {
    logFail('channel', 'mainpage_not_200', { status: r.status, body: String(r.body || '').slice(0, 200) });
    return null;
  }

  let json = null;
  try {
    json = r.json();
  } catch {
    logFail('channel', 'mainpage_json_parse_fail', { status: r.status });
    return null;
  }

  const sections = Array.isArray(json?.sections) ? json.sections : [];
  for (const section of sections) {
    const list = Array.isArray(section?.list) ? section.list : [];
    for (const item of list) {
      const channelid = item?.channelid != null ? String(item.channelid).trim() : '';
      const link = item?.link != null ? String(item.link) : '';
      if (channelid && link.startsWith('/live/')) {
        cachedTargetChannelId = channelid;
        cachedTargetFetchedAt = now;
        return channelid;
      }
    }
  }

  return null;
}

function fetchM3u8(channelid) {
  const r = http.get(`${BASE_URL}/api/liveurl?channelid=${encodeURIComponent(channelid)}`);
  if (!check(r, { 'liveurl 200': (x) => x.status === 200 })) {
    logFail('hls', 'liveurl_not_200', { status: r.status, body: String(r.body || '').slice(0, 200) });
    return;
  }

  let url = null;
  try {
    url = r.json()?.url;
  } catch (e) {
    logFail('hls', 'liveurl_json_parse_fail', { status: r.status });
    return;
  }

  if (!url) {
    logFail('hls', 'liveurl_missing_url', { status: r.status });
    return;
  }

  const m = http.get(url);
  const ok = check(m, {
    'm3u8 status 200': (x) => x.status === 200,
    'm3u8 has EXTM3U': (x) => String(x.body || '').includes('#EXTM3U'),
  });

  if (!ok) {
    logFail('hls', 'm3u8_bad', { status: m.status, body: String(m.body || '').slice(0, 200) });
  }
}

export const options = {
  scenarios: {
    viewers_chat: {
      executor: 'constant-vus',
      vus: CHATTER_VUS,
      duration: DURATION,
      exec: 'viewerChat',
      gracefulStop: '0s',
    },
    viewers_lurk: {
      executor: 'constant-vus',
      vus: LURKER_VUS,
      duration: DURATION,
      exec: 'viewerLurk',
      gracefulStop: '0s',
    },
  },
};

export function viewerLurk() {
  const untilMs = endAtMs();

  const auth = signupAndLoginOrRetry(untilMs);
  if (!auth) {
    logFail('viewerLurk', 'auth_failed_until_end');
  }

  while (Date.now() < untilMs) {
    const channelid = getTargetChannelIdOrRetry();
    if (channelid) fetchM3u8(channelid);
    sleep(HLS_POLL_SEC);
  }
}

export function viewerChat() {
  const untilMs = endAtMs();

  const auth = signupAndLoginOrRetry(untilMs);
  if (!auth) {
    logFail('viewerChat', 'auth_failed_until_end');
    while (Date.now() < untilMs) sleep(1);
    return;
  }

  const channelid = getTargetChannelIdOrRetry();
  if (!channelid) {
    logFail('viewerChat', 'no_channel_until_end');
    while (Date.now() < untilMs) sleep(1);
    return;
  }

  const wsUrl =
    BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://') +
    `/ws/livechat?channelid=${encodeURIComponent(channelid)}&token=${encodeURIComponent(auth.token)}`;

  while (Date.now() < untilMs) {
    const remainingMs = untilMs - Date.now();
    const sessionMs = Math.min(remainingMs, 60 * 1000);

    const res = ws.connect(wsUrl, { headers:  { Cookie: auth.cookieHeader } }, (socket) => {
      socket.on('open', () => {
        socket.setInterval(() => {
          try {
            socket.send(JSON.stringify({ type: 'chat', message: `k6 hello ${__VU}` }));
          } catch (e) {
            logFail('ws', 'send_exception');
          }
        }, Math.floor(CHAT_EVERY_SEC * 1000));

        socket.setInterval(() => {
          fetchM3u8(channelid);
        }, Math.floor(HLS_POLL_SEC * 1000));

        socket.setTimeout(() => socket.close(), sessionMs);
      });

      socket.on('error', (e) => {
        logFail('ws', 'socket_error', { message: String(e?.error() || e || '') });
      });
    });

    if (!check(res, { 'ws connected status 101': (r) => r && r.status === 101 })) {
      logFail('ws', 'connect_failed', { status: res?.status });
      sleep(WS_RETRY_SLEEP_SEC);
      continue;
    }
  }
}

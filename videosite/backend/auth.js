const jwt = require('jsonwebtoken');
const cookie = require("cookie");
const crypto = require('crypto');

const jwtSecret = process.env.JWT_SECRET;
const jwtVerifyOptions = { algorithms: ['HS256'] };

const isProduction = 0//process.env.IS_PRODUCTION;

const COOKIE = {
  accessTokenName: 'access_token',
  csrfCookieName: 'XSRF-TOKEN',
  path: '/',
  secure: isProduction,
  sameSite: (isProduction ? 'None' : 'Lax'),
};

function containControlPermission(role){
  return role>1;
}

function safePath(req) {
  return req?.path || (req?.originalUrl ? String(req.originalUrl).split('?')[0] : '');
}

function sendFailure(req, res, status, code) {
  const warnLevel = status >= 500 ? 2 : status >= 400 ? 1 : 0;
  console.log(`[${warnLevel}] bad request! code : [${req.method}][${safePath(req)}] : ${code}`);
  return res.status(status).json({ code });
}

function parseCookies(header) {
  return cookie.parse(header || "");
}

function decodeUserFromToken(token) {
  if (!token) return null;
  if (!jwtSecret) return null;
  try {
    const decoded = jwt.verify(token, jwtSecret, jwtVerifyOptions);
    return { id: decoded.userId, role: decoded.role };
  } catch {
    return null;
  }
}

function signAccessToken({ userId, role }, signOptions = {}) {
  if (!jwtSecret) throw new Error('signAccessToken: JWT secret is not set');
  return jwt.sign({ userId, role }, jwtSecret, { algorithm: 'HS256', ...signOptions });
}

function getAccessTokenCookieOptions(accessMaxAgeSec) {
  const options = {
    httpOnly: true,
    secure: COOKIE.secure,
    sameSite: COOKIE.sameSite,
    path: COOKIE.path,
    domain: COOKIE.domain,
  };
  if (accessMaxAgeSec != null) options.maxAge = Number(accessMaxAgeSec) * 1000;
  return options;
}

function getCsrfCookieOptions(accessMaxAgeSec) {
  const options = {
    httpOnly: false,
    secure: COOKIE.secure,
    sameSite: COOKIE.sameSite,
    path: COOKIE.path,
    domain: COOKIE.domain,
  };
  if (accessMaxAgeSec != null) options.maxAge = Number(accessMaxAgeSec) * 1000;
  return options;
}

function setAuthCookies(res, { accessToken, csrfToken, accessMaxAgeSec } = {}) {
  const xsrf = csrfToken || crypto.randomBytes(32).toString('hex');

  if (typeof res?.cookie !== 'function') {
    throw new Error('setAuthCookies: res.cookie is required');
  }

  res.cookie(COOKIE.accessTokenName, accessToken || '', getAccessTokenCookieOptions(accessMaxAgeSec));
  res.cookie(COOKIE.csrfCookieName, xsrf, getCsrfCookieOptions(accessMaxAgeSec));

  return xsrf;
}

function clearAuthCookies(res) {
  if (typeof res?.clearCookie !== 'function') {
    throw new Error('clearAuthCookies: res.clearCookie is required');
  }

  const clearAccess = getAccessTokenCookieOptions();
  const clearCsrf = getCsrfCookieOptions();

  res.clearCookie(COOKIE.accessTokenName, clearAccess);
  res.clearCookie(COOKIE.csrfCookieName, clearCsrf);
}

function shouldRequireCsrf(req, authType) {
  if (authType === 'bearer') return false;
  const method = String(req.method || '').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false;
  return true;
}

function verifyCsrf(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const csrfCookie = cookies[COOKIE.csrfCookieName];
  const csrfHeader = req.headers['x-xsrf-token'] || req.headers['x-csrf-token'];
  return Boolean(csrfCookie && csrfHeader && csrfCookie === csrfHeader);
}

function extractToken(req) {
  const authHeader = req.headers.authorization;
  const cookies = parseCookies(req.headers.cookie || '');
  const bearer = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieToken = cookies[COOKIE.accessTokenName] || null;
  return { token: bearer || cookieToken, authType: bearer ? 'bearer' : 'cookie' };
}

function authMiddleware(req, res, next) {
  const { token, authType } = extractToken(req);
  if (!token) return sendFailure(req, res, 401, 'AUTH_REQUIRED');

  const user = decodeUserFromToken(token);
  if (!user) return sendFailure(req, res, 401, 'INVALID_TOKEN');

  req.user = user;
  req.authType = authType;

  if (shouldRequireCsrf(req, authType) && !verifyCsrf(req)) {
    return sendFailure(req, res, 403, 'CSRF_INVALID');
  }

  return next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !containControlPermission(req.user.role)) {
    return sendFailure(req, res, 403, 'ADMIN_REQUIRED');
  }
  return next();
}

module.exports = {
  authMiddleware,
  requireAdmin,
  
  decodeUserFromToken,
  signAccessToken,
  
  setAuthCookies,
  parseCookies,
  clearAuthCookies,
  COOKIE,
};

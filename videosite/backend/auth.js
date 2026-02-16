const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function sendFailure(req, res, status, code) {
  const warnLevel = status >= 500 ? 2 : status >= 400 ? 1 : 0;
  console.log(`[${warnLevel}] bad request! code : [${req.method}][${req.originalUrl}] : ${code}`);
  return res.status(status).json({ code });
}

function parseCookies(header) {
  if (!header) return {};
  return header.split(';').reduce((acc, part) => {
    const [rawKey, ...rest] = part.trim().split('=');
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rest.join('=') || '');
    return acc;
  }, {});
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const cookies = parseCookies(req.headers.cookie || '');
  const bearer = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;
  const token = bearer || cookies.access_token;

  if (!token) {
    return sendFailure(req, res, 401, 'AUTH_REQUIRED');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.userId, role: decoded.role };

    if (bearer) {
      req.authType = 'bearer';
      return next();
    }

    req.authType = 'cookie';
    const method = (req.method || '').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return next();
    }

    const csrfCookie = cookies['XSRF-TOKEN'];
    const csrfHeader = req.headers['x-xsrf-token'] || req.headers['x-csrf-token'];
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return sendFailure(req, res, 403, 'CSRF_INVALID');
    }

    return next();
  } catch {
    return sendFailure(req, res, 401, 'INVALID_TOKEN');
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role < 2) {
    return sendFailure(req, res, 403, 'ADMIN_REQUIRED');
  }
  next();
}

module.exports = { authMiddleware, requireAdmin };

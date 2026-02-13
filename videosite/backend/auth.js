const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function sendError(res, status, errorCode, error) {
  return res.status(status).json({ errorCode, error });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'AUTH_REQUIRED', '로그인이 필요합니다.');
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.userId, role: decoded.role };
    next();
  } catch {
    return sendError(res, 401, 'INVALID_TOKEN', '유효하지 않은 토큰입니다.');
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role < 2) {
    return sendError(res, 403, 'ADMIN_REQUIRED', '관리자 권한이 필요합니다.');
  }
  next();
}

module.exports = { authMiddleware, requireAdmin, JWT_SECRET };

import { getDb } from '../models/database.js';

export function auditLog(userId, actor, action, details = {}, ipAddress = null) {
  const db = getDb();
  db.prepare(
    `INSERT INTO audit_log (user_id, actor, action, details, ip_address) VALUES (?, ?, ?, ?, ?)`
  ).run(userId, actor, action, JSON.stringify(details), ipAddress);
}

export function auditMiddleware(action) {
  return (req, res, next) => {
    const originalSend = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode < 400) {
        auditLog(req.userId, req.userId || 'anonymous', action, {
          method: req.method,
          path: req.path,
        }, req.ip);
      }
      return originalSend(body);
    };
    next();
  };
}

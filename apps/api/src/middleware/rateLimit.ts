import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const windowMs = 60 * 1000; // 1 minute
const maxRequests = 30; // 30 requests per minute
const hitMap = new Map<string, RateLimitEntry>();

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of hitMap.entries()) {
    if (value.resetAt <= now) {
      hitMap.delete(key);
    }
  }
}, 30000);

export function authRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  const entry = hitMap.get(ip);
  if (!entry || entry.resetAt <= now) {
    hitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return next();
  }

  entry.count += 1;
  if (entry.count > maxRequests) {
    res.status(429).json({
      error: 'Quá nhiều yêu cầu. Vui lòng chờ 1 phút trước khi thử lại.',
      retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
    });
    return;
  }

  next();
}

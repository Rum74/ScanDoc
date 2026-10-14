import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.ts';
import { store } from '../models/store.ts';
import { User } from '../models/types.ts';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function generateTokens(userId: string) {
  const accessToken = jwt.sign({ userId }, config.jwtSecret, {
    expiresIn: '15m',
  });
  const refreshToken = jwt.sign({ userId }, config.refreshSecret, {
    expiresIn: '7d',
  });
  return { accessToken, refreshToken };
}

export function verifyRefreshToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, config.refreshSecret) as { userId: string };
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token = '';

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    res.status(401).json({ error: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn' });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as { userId: string };
    const user = store.getUserById(payload.userId);
    if (!user) {
      res.status(401).json({ error: 'Tài khoản không tồn tại' });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại' });
  }
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  let token = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret) as { userId: string };
      const user = store.getUserById(payload.userId);
      if (user) {
        req.user = user;
      }
    } catch {
      // ignore expired optional token
    }
  }
  next();
}

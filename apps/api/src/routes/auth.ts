import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { store } from '../models/store.ts';
import { generateTokens, verifyRefreshToken, requireAuth, AuthenticatedRequest } from '../middleware/auth.ts';
import { authRateLimiter } from '../middleware/rateLimit.ts';
import { config } from '../config/index.ts';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email('Email không đúng định dạng'),
  password: z.string().min(6, 'Mật khẩu phải từ 6 ký tự trở lên'),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Email không đúng định dạng'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

// Helper to set cookie
function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000, // 15 mins
  });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

// POST /api/auth/register
authRouter.post('/register', authRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.issues[0]?.message || 'Dữ liệu không hợp lệ' });
      return;
    }

    const { email, password, name } = parseResult.data;
    const existing = store.getUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'Email này đã được đăng ký' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const id = 'usr_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    const now = Date.now();

    const newUser = store.saveUser({
      id,
      email,
      name: name || email.split('@')[0],
      passwordHash,
      usedBytes: 0,
      createdAt: now,
      updatedAt: now,
    });

    const { accessToken, refreshToken } = generateTokens(newUser.id);
    setAuthCookies(res, accessToken, refreshToken);

    res.status(201).json({
      message: 'Đăng ký thành công',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        usedBytes: newUser.usedBytes,
        maxBytes: config.maxUserBytes,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Đã xảy ra lỗi máy chủ khi đăng ký' });
  }
});

// POST /api/auth/login
authRouter.post('/login', authRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.issues[0]?.message || 'Dữ liệu không hợp lệ' });
      return;
    }

    const { email, password } = parseResult.data;
    const user = store.getUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
      return;
    }

    const { accessToken, refreshToken } = generateTokens(user.id);
    setAuthCookies(res, accessToken, refreshToken);

    res.json({
      message: 'Đăng nhập thành công',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        usedBytes: user.usedBytes || 0,
        maxBytes: config.maxUserBytes,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Đã xảy ra lỗi khi đăng nhập' });
  }
});

// POST /api/auth/refresh
authRouter.post('/refresh', (req: Request, res: Response): void => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) {
    res.status(401).json({ error: 'Thiếu refresh token' });
    return;
  }

  const payload = verifyRefreshToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Refresh token không hợp lệ hoặc đã hết hạn' });
    return;
  }

  const user = store.getUserById(payload.userId);
  if (!user) {
    res.status(401).json({ error: 'Người dùng không tồn tại' });
    return;
  }

  const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id);
  setAuthCookies(res, accessToken, newRefreshToken);

  res.json({
    accessToken,
    refreshToken: newRefreshToken,
  });
});

// POST /api/auth/logout
authRouter.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ message: 'Đăng xuất thành công' });
});

// GET /api/me
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      usedBytes: user.usedBytes || 0,
      maxBytes: config.maxUserBytes,
      createdAt: user.createdAt,
    },
  });
});

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.ts';
import { documentsRouter } from './routes/documents.ts';
import { pagesRouter } from './routes/pages.ts';
import { filesRouter } from './routes/files.ts';
import { healthRouter } from './routes/health.ts';

export function createExpressApp(): Express {
  const app = express();

  // Helmet with relaxed directives for camera & canvas PWA environment
  app.use(
    helmet({
      contentSecurityPolicy: false, // Let reverse-proxy / Vite handle CSP to allow blob: and worker scripts
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // CORS configuration
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // API Routes
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/documents', documentsRouter);
  app.use('/api/pages', pagesRouter);
  app.use('/api/files', filesRouter);

  // Error handling middleware
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[API Error Handler]:', err);
    const message = err instanceof Error ? err.message : 'Lỗi máy chủ không xác định';
    res.status(500).json({ error: message });
  });

  return app;
}

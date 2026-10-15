import { Router, Request, Response } from 'express';
import os from 'os';
import { config } from '../config/index.ts';
import { isMongoConnected } from '../models/mongo.ts';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  const mongoOk = isMongoConnected();

  res.json({
    status: 'ok',
    appName: 'ScanDoc API',
    version: '1.2.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: config.nodeEnv,
    database: {
      type: mongoOk ? 'mongodb_atlas' : 'local_storage_fallback',
      connected: mongoOk,
      cloudDatabase: 'scandoc',
    },
    storage: {
      uploadDir: config.uploadDir,
      maxUserBytes: config.maxUserBytes,
    },
    system: {
      platform: os.platform(),
      freeMemoryMb: Math.round(os.freemem() / (1024 * 1024)),
      totalMemoryMb: Math.round(os.totalmem() / (1024 * 1024)),
    },
  });
});

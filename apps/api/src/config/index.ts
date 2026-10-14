import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  domain: process.env.DOMAIN || 'localhost',
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  
  // Database
  mongoUri: process.env.MONGO_URI || '',
  
  // Authentication
  jwtSecret: process.env.JWT_SECRET || 'scandoc_jwt_secret_dev_key_2026_super_secure',
  refreshSecret: process.env.REFRESH_SECRET || 'scandoc_refresh_secret_dev_key_2026_super_secure',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.REFRESH_EXPIRES_IN || '7d',
  
  // Storage
  uploadDir: process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'data/uploads'),
  maxUserBytes: parseInt(process.env.MAX_USER_BYTES || '1073741824', 10), // 1GB
  maxFileSize: 15 * 1024 * 1024, // 15MB
  
  // CORS
  allowedOrigins: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://127.0.0.1:3000', process.env.APP_URL || '*'],
};

import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  domain: process.env.DOMAIN || 'scandoc.click',
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',

  // Database: Default to user's MongoDB Atlas cluster
  mongoUri:
    process.env.MONGO_URI ||
    'mongodb+srv://huynhvanphong7402_db_user:rIaZ7RXFv2VMPfSY@cluster0.yjxovpz.mongodb.net/scandoc?retryWrites=true&w=majority&appName=Cluster0',

  // Authentication
  jwtSecret: process.env.JWT_SECRET || 'scandoc_jwt_947f89b6c430e7fa1209b55891d4e0e8f3b2a1975e840d',
  refreshSecret: process.env.REFRESH_SECRET || 'scandoc_refresh_8b21c49e0f31a78dc1249b55891d4e0e8f3b2a1975e840',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.REFRESH_EXPIRES_IN || '7d',

  // Storage
  uploadDir: process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'data/uploads'),
  maxUserBytes: parseInt(process.env.MAX_USER_BYTES || '1073741824', 10), // 1GB
  maxFileSize: 25 * 1024 * 1024, // 25MB

  // CORS
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://scandoc.click', 'https://www.scandoc.click', process.env.APP_URL || '*'],
};

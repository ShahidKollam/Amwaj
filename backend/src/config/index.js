import dotenv from 'dotenv';
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || '';

// Production must set a strong secret; never ship with the dev default
if (nodeEnv === 'production') {
  if (!jwtSecret || jwtSecret === 'dev-secret-change-me' || jwtSecret.length < 32) {
    console.error(
      '[FATAL] JWT_SECRET must be set to a random string of at least 32 characters in production.'
    );
    process.exit(1);
  }
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret: jwtSecret || 'dev-secret-change-me',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  nodeEnv,
};

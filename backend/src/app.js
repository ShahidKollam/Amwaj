import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { errorHandler } from './middlewares/error.js';

import authRoutes from './modules/auth.js';
import productRoutes from './modules/products.js';
import customerRoutes from './modules/customers.js';
import billingRoutes from './modules/billing.js';
import settingsRoutes from './modules/settings.js';

const app = express();

// Behind Render/Nginx/etc. so rate-limit and IP logging are correct
if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

// Disable ETag so API clients always get full JSON bodies (avoid empty 304 responses)
app.set('etag', false);

app.use(
  helmet({
    // SPA + API: default CSP is fine for API-only responses
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: config.frontendOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));

// Login brute-force protection
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, try again later' },
});

// General API rate limit (generous for POS use; still blocks abuse)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down' },
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'amwaj-pos', time: new Date().toISOString() });
});

app.use('/api/v1', apiLimiter);
app.use('/api/v1/auth', loginLimiter, authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/settings', settingsRoutes);

app.use(errorHandler);

export default app;

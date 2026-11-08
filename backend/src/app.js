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

// Disable ETag so API clients always get full JSON bodies (avoid empty 304 responses)
app.set('etag', false);

app.use(helmet());
app.use(cors({ origin: config.frontendOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts, try again later' },
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'amwaj-pos', time: new Date().toISOString() });
});

app.use('/api/v1/auth', loginLimiter, authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/settings', settingsRoutes);

app.use(errorHandler);

export default app;

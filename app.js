require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const swaggerUi  = require('swagger-ui-express');
const swaggerSpec = require('./src/config/swagger');

const listingsRoutes      = require('./listingsRoutes');
const usersRoutes         = require('./routes/users');
const watchlistRoutes     = require('./routes/watchlist');
const notificationsRoutes = require('./routes/notifications');
const ordersRoutes        = require('./routes/orders');
const paymentsRoutes      = require('./routes/payments');

const path = require('path');

const app = express();

// ── Security headers ────────────────────────────────────
// contentSecurityPolicy disabled so Cloudinary images and inline scripts load
app.use(helmet({ contentSecurityPolicy: false }));

// ── Serve frontend ──────────────────────────────────────
app.use(express.static(path.join(__dirname, 'frontend')));

// ── CORS ────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Request logging ─────────────────────────────────────
app.use(morgan('dev'));

// ── Stripe webhook needs raw body — must come BEFORE express.json() ─────────
app.use('/payments/webhook', express.raw({ type: 'application/json' }));

// ── Body parsing ─────────────────────────────────────────
app.use(express.json());

// ── Rate limiting ────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
});
app.use(limiter);

// ── Swagger docs ─────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerSpec));

// ── Health check ─────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    data: { name: 'CampusMarket API' },
    message: 'API is running',
  });
});

// ── Routes ───────────────────────────────────────────────
app.use('/listings', listingsRoutes);
app.use('/users',    usersRoutes);
app.use('/watchlist', watchlistRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/orders',   ordersRoutes);
app.use('/payments', paymentsRoutes);

// ── 404 handler ──────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    message: 'Route not found',
  });
});

// ── Global error handler ─────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    data: null,
    message: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`CampusMarket API listening on port ${PORT}`);
  });
}

module.exports = app;

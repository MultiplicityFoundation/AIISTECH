'use strict';

const express        = require('express');
const session        = require('express-session');
const rateLimit      = require('express-rate-limit');
const path           = require('path');
const requireAuth    = require('./middleware/requireAuth');
const authRoutes     = require('./routes/authRoutes');
const fsRoutes       = require('./routes/fsRoutes');
const gitRoutes      = require('./routes/gitRoutes');
const terminalRoutes = require('./routes/terminalRoutes');
const aiRoutes       = require('./routes/aiRoutes');

const app = express();

// Body parsing
app.use(express.json());

// Session
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error('SESSION_SECRET environment variable is required when Studio is enabled');
}
app.use(
  session({
    secret:            sessionSecret,
    resave:            false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   86400000, // 24 hours
    },
  })
);

// ---------------------------------------------------------------------------
// Rate limiting — applies to all Studio routes.
// Max 60 req/min per IP covers public paths (login page) and auth-gated paths.
// ---------------------------------------------------------------------------
const studioLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      60,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too Many Requests' },
});
app.use(studioLimiter);

// ---------------------------------------------------------------------------
// CSRF protection — require custom header on all state-changing API requests.
// SameSite=Strict cookie prevents cross-site cookie transmission; the custom
// header double-submit pattern adds explicit defence-in-depth.
// ---------------------------------------------------------------------------
function csrfCheck(req, res, next) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) return next();
  if (req.headers['x-studio-request'] === '1') return next();
  return res.status(403).json({ error: 'CSRF check failed: X-Studio-Request header required' });
}

// Public routes (no auth required)
app.use('/auth', authRoutes);

// Serve login page (static)
app.get('/login', (req, res) => {
  const distIndex = path.join(__dirname, '../../sites/multiplic-studio/dist/index.html');
  res.sendFile(distIndex);
});

// Auth-gated static frontend
const studioDistPath = path.join(__dirname, '../../sites/multiplic-studio/dist');
app.use(requireAuth, express.static(studioDistPath));

// Auth-gated API routes (CSRF check on all mutation methods)
app.use('/api/fs',       requireAuth, csrfCheck, fsRoutes);
app.use('/api/git',      requireAuth, csrfCheck, gitRoutes);
app.use('/api/terminal', requireAuth, csrfCheck, terminalRoutes);
app.use('/api/ai',       requireAuth, aiRoutes);

// SPA fallback (auth-gated)
app.get('*', requireAuth, (req, res) => {
  const distIndex = path.join(__dirname, '../../sites/multiplic-studio/dist/index.html');
  res.sendFile(distIndex);
});

module.exports = app;

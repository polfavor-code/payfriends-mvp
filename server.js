const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');

// --- basic setup ---
const app = express();
const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;
const SESSION_EXPIRY_DAYS = 30;

// make sure data folder exists
if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data');
}

// --- database setup ---
const db = new Database('./data/payfriends.db');
db.pragma('journal_mode = WAL');

// Create all tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS agreements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lender_user_id INTEGER,
    lender_name TEXT NOT NULL,
    borrower_email TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    due_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    FOREIGN KEY (lender_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    agreement_id INTEGER,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    read_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (agreement_id) REFERENCES agreements(id)
  );
`);

// --- middleware ---
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(cookieParser());

// Session middleware - loads user from session cookie
app.use((req, res, next) => {
  req.user = null;

  const sessionId = req.cookies.session_id;
  if (!sessionId) {
    return next();
  }

  try {
    const session = db.prepare(`
      SELECT s.*, u.email, u.id as user_id
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ? AND s.expires_at > datetime('now')
    `).get(sessionId);

    if (session) {
      req.user = {
        id: session.user_id,
        email: session.email
      };
    }
  } catch (err) {
    console.error('Session lookup error:', err);
  }

  next();
});

// Auth middleware - requires valid session
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// --- helper functions ---

// convert euros → cents
function toCents(amountStr) {
  const n = Number(amountStr);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

// create a new session for a user
function createSession(userId) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (id, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, userId, createdAt, expiresAt);

  return sessionId;
}

// validate email format
function isValidEmail(email) {
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// --- AUTH ROUTES ---

// Signup
app.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // Check if user already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const createdAt = new Date().toISOString();

    // Create user
    const result = db.prepare(`
      INSERT INTO users (email, password_hash, created_at)
      VALUES (?, ?, ?)
    `).run(email, passwordHash, createdAt);

    const userId = result.lastInsertRowid;

    // Create session
    const sessionId = createSession(userId);

    // Set cookie
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    res.status(201).json({
      success: true,
      user: { id: userId, email }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Find user
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Create session
    const sessionId = createSession(user.id);

    // Set cookie
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    res.json({
      success: true,
      user: { id: user.id, email: user.email }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Logout
app.post('/auth/logout', (req, res) => {
  const sessionId = req.cookies.session_id;

  if (sessionId) {
    // Delete session from database
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  }

  // Clear cookie
  res.clearCookie('session_id');
  res.json({ success: true });
});

// Get current user
app.get('/api/user', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// --- API ROUTES ---

// List agreements for logged-in user
app.get('/api/agreements', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM agreements
    WHERE lender_user_id = ?
    ORDER BY created_at DESC
  `).all(req.user.id);

  res.json(rows);
});

// Create new agreement
app.post('/api/agreements', requireAuth, (req, res) => {
  const { lenderName, borrowerEmail, amount, dueDate } = req.body || {};

  if (!lenderName || !borrowerEmail || !amount || !dueDate) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const amountCents = toCents(amount);
  if (amountCents === null) {
    return res.status(400).json({ error: 'Amount must be a positive number.' });
  }

  const createdAt = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO agreements (lender_user_id, lender_name, borrower_email, amount_cents, due_date, created_at, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
  `);

  const info = stmt.run(req.user.id, lenderName, borrowerEmail, amountCents, dueDate, createdAt);

  res.status(201).json({
    id: info.lastInsertRowid,
    lender_user_id: req.user.id,
    lenderName,
    borrowerEmail,
    amountCents,
    dueDate,
    createdAt,
    status: 'active'
  });
});

// Update agreement status (mark as paid → settled)
app.patch('/api/agreements/:id/status', requireAuth, (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};

  if (!status) {
    return res.status(400).json({ error: 'Status is required.' });
  }

  // When marking as paid, set status to "settled"
  const newStatus = status === 'paid' ? 'settled' : status;

  // Verify agreement belongs to user
  const agreement = db.prepare(`
    SELECT id FROM agreements WHERE id = ? AND lender_user_id = ?
  `).get(id, req.user.id);

  if (!agreement) {
    return res.status(404).json({ error: 'Agreement not found.' });
  }

  const stmt = db.prepare('UPDATE agreements SET status = ? WHERE id = ?');
  stmt.run(newStatus, id);

  res.json({ success: true, id: Number(id), status: newStatus });
});

// Get messages for logged-in user
app.get('/api/messages', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM messages
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(req.user.id);

  res.json(rows);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// --- PAGE ROUTES ---

// Root: serve login page if not authenticated, else redirect to /app
app.get('/', (req, res) => {
  if (!req.user) {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  } else {
    res.redirect('/app');
  }
});

// App: serve app page if authenticated, else redirect to /
app.get('/app', (req, res) => {
  if (req.user) {
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
  } else {
    res.redirect('/');
  }
});

// Serve other static files from "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Start server
app.listen(PORT, () => {
  console.log(`PayFriends MVP running at http://localhost:${PORT}`);
});

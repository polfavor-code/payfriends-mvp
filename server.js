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
    created_at TEXT NOT NULL,
    full_name TEXT
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
    borrower_user_id INTEGER,
    friend_first_name TEXT,
    direction TEXT NOT NULL DEFAULT 'lend',
    repayment_type TEXT NOT NULL DEFAULT 'one_time',
    amount_cents INTEGER NOT NULL,
    due_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    FOREIGN KEY (lender_user_id) REFERENCES users(id),
    FOREIGN KEY (borrower_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS agreement_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agreement_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL,
    accepted_at TEXT,
    FOREIGN KEY (agreement_id) REFERENCES agreements(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    agreement_id INTEGER,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    read_at TEXT,
    event_type TEXT,
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
      SELECT s.*, u.email, u.id as user_id, u.full_name
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ? AND s.expires_at > datetime('now')
    `).get(sessionId);

    if (session) {
      req.user = {
        id: session.user_id,
        email: session.email,
        full_name: session.full_name
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

// Auto-link pending agreements to borrower when they log in/signup
function autoLinkPendingAgreements(userId, userEmail, userFullName) {
  try {
    // Find all pending agreements where borrower_email matches and borrower_user_id is NULL
    const pendingAgreements = db.prepare(`
      SELECT id, lender_user_id, lender_name, amount_cents
      FROM agreements
      WHERE borrower_email = ? AND borrower_user_id IS NULL AND status = 'pending'
    `).all(userEmail);

    const now = new Date().toISOString();

    for (const agreement of pendingAgreements) {
      // Update agreement to link borrower_user_id
      db.prepare(`
        UPDATE agreements
        SET borrower_user_id = ?
        WHERE id = ?
      `).run(userId, agreement.id);

      // Create activity entry for borrower
      const lenderName = agreement.lender_name;
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        agreement.id,
        'New agreement waiting for review',
        `New agreement from ${lenderName} waiting for your review.`,
        now,
        'AGREEMENT_ASSIGNED_TO_BORROWER'
      );
    }

    return pendingAgreements.length;
  } catch (err) {
    console.error('Error auto-linking pending agreements:', err);
    return 0;
  }
}

// --- AUTH ROUTES ---

// Signup
app.post('/auth/signup', async (req, res) => {
  const { email, password, fullName } = req.body || {};

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
      INSERT INTO users (email, password_hash, created_at, full_name)
      VALUES (?, ?, ?, ?)
    `).run(email, passwordHash, createdAt, fullName || null);

    const userId = result.lastInsertRowid;

    // Create session
    const sessionId = createSession(userId);

    // Set cookie
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    // Auto-link any pending agreements
    autoLinkPendingAgreements(userId, email, fullName || null);

    res.status(201).json({
      success: true,
      user: { id: userId, email, full_name: fullName || null }
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

    // Auto-link any pending agreements
    autoLinkPendingAgreements(user.id, user.email, user.full_name);

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

// Update user profile
app.post('/api/profile', requireAuth, (req, res) => {
  const { fullName } = req.body || {};

  if (!fullName || !fullName.trim()) {
    return res.status(400).json({ error: 'Full name is required' });
  }

  try {
    db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(fullName.trim(), req.user.id);
    res.json({ success: true, full_name: fullName.trim() });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Server error updating profile' });
  }
});

// --- API ROUTES ---

// List agreements for logged-in user (both as lender and borrower)
app.get('/api/agreements', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT a.*,
      u_lender.full_name as lender_full_name,
      u_lender.email as lender_email,
      u_borrower.full_name as borrower_full_name,
      u_borrower.email as borrower_email
    FROM agreements a
    LEFT JOIN users u_lender ON a.lender_user_id = u_lender.id
    LEFT JOIN users u_borrower ON a.borrower_user_id = u_borrower.id
    WHERE lender_user_id = ? OR borrower_user_id = ?
    ORDER BY created_at DESC
  `).all(req.user.id, req.user.id);

  res.json(rows);
});

// Create new agreement with invite (two-sided flow)
app.post('/api/agreements', requireAuth, (req, res) => {
  const { lenderName, borrowerEmail, friendFirstName, amount, dueDate, direction, repaymentType } = req.body || {};

  if (!borrowerEmail || !amount || !dueDate) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const amountCents = toCents(amount);
  if (amountCents === null) {
    return res.status(400).json({ error: 'Amount must be a positive number.' });
  }

  // Validate due date is not in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDateObj = new Date(dueDate);
  dueDateObj.setHours(0, 0, 0, 0);

  if (dueDateObj < today) {
    return res.status(400).json({ error: 'Due date cannot be in the past.' });
  }

  const createdAt = new Date().toISOString();

  // Use user's full_name as lender_name if available, otherwise use provided lenderName
  const finalLenderName = req.user.full_name || lenderName || req.user.email;

  try {
    // Create agreement
    const agreementStmt = db.prepare(`
      INSERT INTO agreements (
        lender_user_id, lender_name, borrower_email, friend_first_name,
        direction, repayment_type, amount_cents, due_date, created_at, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `);

    const agreementInfo = agreementStmt.run(
      req.user.id,
      finalLenderName,
      borrowerEmail,
      friendFirstName || null,
      direction || 'lend',
      repaymentType || 'one_time',
      amountCents,
      dueDate,
      createdAt
    );

    const agreementId = agreementInfo.lastInsertRowid;

    // Create invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');

    const inviteStmt = db.prepare(`
      INSERT INTO agreement_invites (agreement_id, email, token, created_at)
      VALUES (?, ?, ?, ?)
    `);

    inviteStmt.run(agreementId, borrowerEmail, inviteToken, createdAt);

    // Create activity message for lender
    const borrowerDisplay = friendFirstName || borrowerEmail;
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      agreementId,
      'Agreement sent',
      `Agreement sent to ${borrowerEmail}`,
      createdAt,
      'AGREEMENT_SENT'
    );

    // Build invite URL
    const inviteUrl = `http://localhost:${PORT}/review?token=${inviteToken}`;

    res.status(201).json({
      id: agreementId,
      lender_user_id: req.user.id,
      lenderName: finalLenderName,
      borrowerEmail,
      friendFirstName,
      direction: direction || 'lend',
      repaymentType: repaymentType || 'one_time',
      amountCents,
      dueDate,
      createdAt,
      status: 'pending',
      inviteUrl
    });
  } catch (err) {
    console.error('Error creating agreement:', err);
    res.status(500).json({ error: 'Server error creating agreement' });
  }
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
    SELECT m.*,
      a.status as agreement_status,
      a.borrower_email,
      u_borrower.full_name as borrower_full_name,
      a.friend_first_name
    FROM messages m
    LEFT JOIN agreements a ON m.agreement_id = a.id
    LEFT JOIN users u_borrower ON a.borrower_user_id = u_borrower.id
    WHERE m.user_id = ?
    ORDER BY m.created_at DESC
  `).all(req.user.id);

  res.json(rows);
});

// Get single agreement by ID (for logged-in users)
app.get('/api/agreements/:id', requireAuth, (req, res) => {
  const { id } = req.params;

  try {
    const agreement = db.prepare(`
      SELECT a.*,
        u_lender.full_name as lender_full_name,
        u_lender.email as lender_email,
        u_borrower.full_name as borrower_full_name,
        u_borrower.email as borrower_email
      FROM agreements a
      LEFT JOIN users u_lender ON a.lender_user_id = u_lender.id
      LEFT JOIN users u_borrower ON a.borrower_user_id = u_borrower.id
      WHERE a.id = ? AND (a.lender_user_id = ? OR a.borrower_user_id = ?)
    `).get(id, req.user.id, req.user.id);

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    res.json(agreement);
  } catch (err) {
    console.error('Error fetching agreement:', err);
    res.status(500).json({ error: 'Server error fetching agreement' });
  }
});

// Accept agreement (logged-in, without token)
app.post('/api/agreements/:id/accept', requireAuth, (req, res) => {
  const { id } = req.params;

  try {
    // Get agreement
    const agreement = db.prepare(`
      SELECT * FROM agreements WHERE id = ?
    `).get(id);

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    // Verify user is the borrower
    if (agreement.borrower_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to accept this agreement' });
    }

    // Verify status is pending
    if (agreement.status !== 'pending') {
      return res.status(400).json({ error: 'Agreement is not pending' });
    }

    const now = new Date().toISOString();

    // Update agreement status
    db.prepare(`
      UPDATE agreements
      SET status = 'active'
      WHERE id = ?
    `).run(id);

    // Create activity messages for both parties
    const borrowerName = req.user.full_name || agreement.friend_first_name || req.user.email;
    const lenderName = agreement.lender_name;

    // Message for lender
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      agreement.lender_user_id,
      id,
      'Agreement accepted',
      `Agreement accepted by ${borrowerName}`,
      now,
      'AGREEMENT_ACCEPTED'
    );

    // Message for borrower
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      id,
      'Agreement accepted',
      `Agreement accepted from ${lenderName}`,
      now,
      'AGREEMENT_ACCEPTED'
    );

    res.json({ success: true, agreementId: Number(id) });
  } catch (err) {
    console.error('Error accepting agreement:', err);
    res.status(500).json({ error: 'Server error accepting agreement' });
  }
});

// Decline agreement (logged-in, without token)
app.post('/api/agreements/:id/decline', requireAuth, (req, res) => {
  const { id } = req.params;

  try {
    // Get agreement
    const agreement = db.prepare(`
      SELECT * FROM agreements WHERE id = ?
    `).get(id);

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    // Verify user is the borrower
    if (agreement.borrower_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to decline this agreement' });
    }

    // Verify status is pending
    if (agreement.status !== 'pending') {
      return res.status(400).json({ error: 'Agreement is not pending' });
    }

    const now = new Date().toISOString();

    // Update agreement status
    db.prepare(`
      UPDATE agreements
      SET status = 'declined'
      WHERE id = ?
    `).run(id);

    const borrowerName = req.user.full_name || agreement.friend_first_name || req.user.email;
    const lenderName = agreement.lender_name;

    // Message for lender
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      agreement.lender_user_id,
      id,
      'Agreement declined',
      `Agreement declined by ${borrowerName}`,
      now,
      'AGREEMENT_DECLINED'
    );

    // Message for borrower
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      id,
      'Agreement declined',
      `Agreement declined from ${lenderName}`,
      now,
      'AGREEMENT_DECLINED'
    );

    res.json({ success: true, agreementId: Number(id) });
  } catch (err) {
    console.error('Error declining agreement:', err);
    res.status(500).json({ error: 'Server error declining agreement' });
  }
});

// Review later (logged-in or token-based)
app.post('/api/agreements/:id/review-later', requireAuth, (req, res) => {
  const { id } = req.params;

  try {
    // Get agreement
    const agreement = db.prepare(`
      SELECT * FROM agreements WHERE id = ?
    `).get(id);

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    // Verify user is the borrower
    if (agreement.borrower_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to access this agreement' });
    }

    // Don't change the status, just create an activity entry
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      id,
      'Agreement review postponed',
      'You chose to review this agreement later.',
      now,
      'AGREEMENT_REVIEW_LATER'
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error handling review later:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Review later for token-based flow
app.post('/api/invites/:token/review-later', requireAuth, (req, res) => {
  const { token } = req.params;

  try {
    // Get invite and agreement
    const invite = db.prepare(`
      SELECT i.*, a.*,
        i.id as invite_id,
        a.id as agreement_id
      FROM agreement_invites i
      JOIN agreements a ON i.agreement_id = a.id
      WHERE i.token = ?
    `).get(token);

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    // Verify the logged-in user's email matches the invite email
    if (req.user.email !== invite.email) {
      return res.status(403).json({ error: 'This invite was sent to a different email address' });
    }

    // If borrower_user_id is still NULL, set it now
    if (!invite.borrower_user_id) {
      db.prepare(`
        UPDATE agreements
        SET borrower_user_id = ?
        WHERE id = ?
      `).run(req.user.id, invite.agreement_id);
    }

    // Don't change the status, just create activity entries for both borrower and lender
    const now = new Date().toISOString();

    // Create activity entry for borrower (the person clicking "Review later")
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      invite.agreement_id,
      'Agreement review postponed',
      'You chose to review this agreement later.',
      now,
      'AGREEMENT_REVIEW_LATER'
    );

    // Create activity entry for lender so they know borrower has seen it
    const borrowerName = req.user.full_name || invite.friend_first_name || req.user.email;
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      invite.lender_user_id,
      invite.agreement_id,
      'Agreement review postponed',
      `${borrowerName} chose to review your agreement later.`,
      now,
      'AGREEMENT_REVIEW_LATER'
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error handling review later:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Get invite details by token (public)
app.get('/api/invites/:token', (req, res) => {
  const { token } = req.params;

  try {
    const invite = db.prepare(`
      SELECT i.*, a.*,
        i.id as invite_id,
        a.id as agreement_id
      FROM agreement_invites i
      JOIN agreements a ON i.agreement_id = a.id
      WHERE i.token = ?
    `).get(token);

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    // Get lender user info
    const lender = db.prepare('SELECT id, email, full_name FROM users WHERE id = ?').get(invite.lender_user_id);

    res.json({
      invite: {
        id: invite.invite_id,
        token: invite.token,
        email: invite.email,
        created_at: invite.created_at,
        accepted_at: invite.accepted_at
      },
      agreement: {
        id: invite.agreement_id,
        lender_user_id: invite.lender_user_id,
        lender_name: invite.lender_name,
        borrower_email: invite.borrower_email,
        borrower_user_id: invite.borrower_user_id,
        friend_first_name: invite.friend_first_name,
        direction: invite.direction,
        repayment_type: invite.repayment_type,
        amount_cents: invite.amount_cents,
        due_date: invite.due_date,
        status: invite.status
      },
      lender: lender || null
    });
  } catch (err) {
    console.error('Error fetching invite:', err);
    res.status(500).json({ error: 'Server error fetching invite' });
  }
});

// Accept agreement
app.post('/api/invites/:token/accept', requireAuth, (req, res) => {
  const { token } = req.params;

  try {
    // Get invite and agreement
    const invite = db.prepare(`
      SELECT i.*, a.*,
        i.id as invite_id,
        a.id as agreement_id
      FROM agreement_invites i
      JOIN agreements a ON i.agreement_id = a.id
      WHERE i.token = ?
    `).get(token);

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    // Verify the logged-in user's email matches the invite email
    if (req.user.email !== invite.email) {
      return res.status(403).json({ error: 'This invite was sent to a different email address' });
    }

    if (invite.accepted_at) {
      return res.status(400).json({ error: 'Invite already accepted' });
    }

    const now = new Date().toISOString();

    // Update agreement status and borrower_user_id
    db.prepare(`
      UPDATE agreements
      SET status = 'active', borrower_user_id = ?
      WHERE id = ?
    `).run(req.user.id, invite.agreement_id);

    // Mark invite as accepted
    db.prepare(`
      UPDATE agreement_invites
      SET accepted_at = ?
      WHERE id = ?
    `).run(now, invite.invite_id);

    // Create activity messages for both parties
    const borrowerName = req.user.full_name || invite.friend_first_name || req.user.email;
    const lenderName = invite.lender_name;

    // Message for lender
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      invite.lender_user_id,
      invite.agreement_id,
      'Agreement accepted',
      `Agreement accepted by ${borrowerName}`,
      now,
      'AGREEMENT_ACCEPTED'
    );

    // Message for borrower
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      invite.agreement_id,
      'Agreement accepted',
      `Agreement accepted from ${lenderName}`,
      now,
      'AGREEMENT_ACCEPTED'
    );

    res.json({ success: true, agreementId: invite.agreement_id });
  } catch (err) {
    console.error('Error accepting invite:', err);
    res.status(500).json({ error: 'Server error accepting invite' });
  }
});

// Decline agreement
app.post('/api/invites/:token/decline', requireAuth, (req, res) => {
  const { token } = req.params;

  try {
    // Get invite and agreement
    const invite = db.prepare(`
      SELECT i.*, a.*,
        i.id as invite_id,
        a.id as agreement_id
      FROM agreement_invites i
      JOIN agreements a ON i.agreement_id = a.id
      WHERE i.token = ?
    `).get(token);

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    // Verify the logged-in user's email matches the invite email
    if (req.user.email !== invite.email) {
      return res.status(403).json({ error: 'This invite was sent to a different email address' });
    }

    if (invite.accepted_at) {
      return res.status(400).json({ error: 'Invite already accepted, cannot decline' });
    }

    const now = new Date().toISOString();

    // Update agreement status and borrower_user_id
    db.prepare(`
      UPDATE agreements
      SET status = 'declined', borrower_user_id = ?
      WHERE id = ?
    `).run(req.user.id, invite.agreement_id);

    const borrowerName = req.user.full_name || invite.friend_first_name || req.user.email;
    const lenderName = invite.lender_name;

    // Message for lender
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      invite.lender_user_id,
      invite.agreement_id,
      'Agreement declined',
      `Agreement declined by ${borrowerName}`,
      now,
      'AGREEMENT_DECLINED'
    );

    // Message for borrower
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      invite.agreement_id,
      'Agreement declined',
      `Agreement declined from ${lenderName}`,
      now,
      'AGREEMENT_DECLINED'
    );

    res.json({ success: true, agreementId: invite.agreement_id });
  } catch (err) {
    console.error('Error declining invite:', err);
    res.status(500).json({ error: 'Server error declining invite' });
  }
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

// Profile: serve profile page if authenticated, else redirect to /
app.get('/profile', (req, res) => {
  if (req.user) {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
  } else {
    res.redirect('/');
  }
});

// Review: serve review page for agreement invites
app.get('/review', (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.sendFile(path.join(__dirname, 'public', 'review-invalid.html'));
  }

  // Verify token exists
  const invite = db.prepare(`
    SELECT id FROM agreement_invites WHERE token = ?
  `).get(token);

  if (!invite) {
    return res.sendFile(path.join(__dirname, 'public', 'review-invalid.html'));
  }

  res.sendFile(path.join(__dirname, 'public', 'review.html'));
});

// Review agreement (logged-in borrower)
app.get('/agreements/:id/review', (req, res) => {
  if (!req.user) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'review-details.html'));
});

// View agreement (logged-in lender or borrower)
app.get('/agreements/:id/view', (req, res) => {
  if (!req.user) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'review-details.html'));
});

// Serve other static files from "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Start server
app.listen(PORT, () => {
  console.log(`PayFriends MVP running at http://localhost:${PORT}`);
});

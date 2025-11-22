const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');
const { formatCurrency0, formatCurrency2, formatEuro0, formatEuro2 } = require('./lib/formatters');

// --- basic setup ---
const app = express();
const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;
const SESSION_EXPIRY_DAYS = 30;

// make sure data folder exists
if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data');
}

// make sure uploads folder exists
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}
if (!fs.existsSync('./uploads/payments')) {
  fs.mkdirSync('./uploads/payments', { recursive: true });
}
if (!fs.existsSync('./uploads/profiles')) {
  fs.mkdirSync('./uploads/profiles', { recursive: true });
}
if (!fs.existsSync('./uploads/grouptabs')) {
  fs.mkdirSync('./uploads/grouptabs', { recursive: true });
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
    description TEXT,
    has_repayment_issue INTEGER DEFAULT 0,
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

  CREATE TABLE IF NOT EXISTS hardship_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agreement_id INTEGER NOT NULL,
    borrower_user_id INTEGER NOT NULL,
    reason_category TEXT NOT NULL,
    reason_text TEXT,
    can_pay_now_cents INTEGER,
    preferred_adjustments TEXT NOT NULL,
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    FOREIGN KEY (agreement_id) REFERENCES agreements(id),
    FOREIGN KEY (borrower_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS renegotiation_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agreement_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    stage TEXT NOT NULL,
    initiated_by TEXT NOT NULL DEFAULT 'borrower',
    loan_type TEXT NOT NULL,
    selected_type TEXT NOT NULL,
    lender_suggested_type TEXT,
    agreed_type TEXT,
    can_pay_now_cents INTEGER,
    borrower_note TEXT,
    trouble_reason TEXT,
    trouble_reason_other TEXT,
    borrower_values_proposal TEXT,
    lender_values_proposal TEXT,
    lender_response_note TEXT,
    history TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (agreement_id) REFERENCES agreements(id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agreement_id INTEGER NOT NULL,
    recorded_by_user_id INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    method TEXT,
    note TEXT,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'approved',
    proof_file_path TEXT,
    proof_original_name TEXT,
    proof_mime_type TEXT,
    FOREIGN KEY (agreement_id) REFERENCES agreements(id),
    FOREIGN KEY (recorded_by_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS grouptabs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    total_amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EUR',
    people_count INTEGER,
    event_date TEXT,
    bill_image_url TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    public_slug TEXT UNIQUE NOT NULL,
    bank_details TEXT,
    paypal_details TEXT,
    other_payment_details TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (owner_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS grouptab_contributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grouptab_id INTEGER NOT NULL,
    guest_name TEXT NOT NULL,
    guest_user_id INTEGER,
    amount_cents INTEGER NOT NULL,
    method TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    comment TEXT,
    proof_image_url TEXT,
    proof_original_name TEXT,
    proof_mime_type TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    confirmed_at TEXT,
    rejected_reason TEXT,
    FOREIGN KEY (grouptab_id) REFERENCES grouptabs(id),
    FOREIGN KEY (guest_user_id) REFERENCES users(id)
  );
`);

// Add proof of payment columns if they don't exist (for existing databases)
try {
  db.exec(`ALTER TABLE payments ADD COLUMN proof_file_path TEXT;`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE payments ADD COLUMN proof_original_name TEXT;`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE payments ADD COLUMN proof_mime_type TEXT;`);
} catch (e) {
  // Column already exists, ignore
}

// Add description column to agreements if it doesn't exist (for existing databases)
try {
  db.exec(`ALTER TABLE agreements ADD COLUMN description TEXT;`);
} catch (e) {
  // Column already exists, ignore
}

// Add profile_picture column to users if it doesn't exist (for existing databases)
try {
  db.exec(`ALTER TABLE users ADD COLUMN profile_picture TEXT;`);
} catch (e) {
  // Column already exists, ignore
}

// Add phone_number column to users if it doesn't exist (for existing databases)
try {
  db.exec(`ALTER TABLE users ADD COLUMN phone_number TEXT;`);
} catch (e) {
  // Column already exists, ignore
}

// Add timezone column to users if it doesn't exist (for existing databases)
try {
  db.exec(`ALTER TABLE users ADD COLUMN timezone TEXT;`);
} catch (e) {
  // Column already exists, ignore
}

// Add installment and interest fields to agreements if they don't exist (for existing databases)
try {
  db.exec(`ALTER TABLE agreements ADD COLUMN installment_count INTEGER;`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE agreements ADD COLUMN installment_amount REAL;`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE agreements ADD COLUMN first_payment_date TEXT;`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE agreements ADD COLUMN final_due_date TEXT;`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE agreements ADD COLUMN interest_rate REAL DEFAULT 0;`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE agreements ADD COLUMN total_interest REAL DEFAULT 0;`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE agreements ADD COLUMN total_repay_amount REAL;`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE agreements ADD COLUMN payment_preference_method TEXT;`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE hardship_requests ADD COLUMN resolved_at TEXT;`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE agreements ADD COLUMN reminder_enabled INTEGER DEFAULT 1;`);
} catch (e) {
  // Column already exists, ignore
}

// Add new fields for flexible installments and improved preferences
try {
  db.exec(`ALTER TABLE agreements ADD COLUMN plan_length INTEGER;`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE agreements ADD COLUMN plan_unit TEXT;`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE agreements ADD COLUMN payment_other_description TEXT;`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE agreements ADD COLUMN reminder_mode TEXT DEFAULT 'auto';`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE agreements ADD COLUMN reminder_offsets TEXT;`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE agreements ADD COLUMN proof_required INTEGER DEFAULT 0;`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE agreements ADD COLUMN debt_collection_clause INTEGER DEFAULT 0;`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE agreements ADD COLUMN money_sent_date TEXT;`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE agreements ADD COLUMN payment_frequency TEXT DEFAULT 'monthly';`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE agreements ADD COLUMN fairness_accepted INTEGER DEFAULT 0;`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE agreements ADD COLUMN one_time_due_option TEXT;`);
} catch (e) {
  // Column already exists, ignore
}

// Add payment method detail fields
try {
  db.exec(`ALTER TABLE agreements ADD COLUMN payment_methods_json TEXT;`);
} catch (e) {
  // Column already exists, ignore
}

// --- multer setup for file uploads ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/payments/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'payment-proof-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and PDFs only
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, PNG, GIF, WebP) and PDF files are allowed'));
    }
  }
});

// Profile picture upload configuration
const profilePictureStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/profiles/');
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `profile-${userId}-${timestamp}${ext}`);
  }
});

const uploadProfilePicture = multer({
  storage: profilePictureStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for profile pictures
  },
  fileFilter: (req, file, cb) => {
    // Accept only images
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, PNG, WebP) are allowed for profile pictures'));
    }
  }
});

// GroupTab bill and contribution proof upload configuration
const grouptabStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/grouptabs/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const prefix = file.fieldname === 'billImage' ? 'bill' : 'proof';
    cb(null, `grouptab-${prefix}-${uniqueSuffix}${ext}`);
  }
});

const uploadGrouptab = multer({
  storage: grouptabStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, PNG, GIF, WebP) and PDF files are allowed'));
    }
  }
});

// --- middleware ---
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(cookieParser());

// Proof of payment files are now served via the secure /api/payments/:id/proof endpoint
// which requires authentication and authorization (lender or borrower only)
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session middleware - loads user from session cookie
app.use((req, res, next) => {
  req.user = null;

  const sessionId = req.cookies.session_id;
  if (!sessionId) {
    return next();
  }

  try {
    const session = db.prepare(`
      SELECT s.*, u.email, u.id as user_id, u.full_name, u.profile_picture, u.phone_number, u.timezone
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ? AND s.expires_at > datetime('now')
    `).get(sessionId);

    if (session) {
      req.user = {
        id: session.user_id,
        email: session.email,
        full_name: session.full_name,
        profile_picture: session.profile_picture,
        phone_number: session.phone_number,
        timezone: session.timezone
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

// Currency formatters imported from lib/formatters.js
// - formatCurrency0(cents) - for compact displays (no decimals, nl-NL locale)
// - formatCurrency2(cents) - for details and notifications (2 decimals, nl-NL locale)
// - formatEuro0(euros), formatEuro2(euros) - for euro amounts (not cents)

// compute payment totals for an agreement (only approved payments)
function getPaymentTotals(agreementId) {
  const result = db.prepare(`
    SELECT COALESCE(SUM(amount_cents), 0) as total_paid_cents
    FROM payments
    WHERE agreement_id = ? AND status = 'approved'
  `).get(agreementId);

  return {
    total_paid_cents: result.total_paid_cents
  };
}

// get the total amount due for an agreement (principal + interest if available)
function getAgreementTotalDueCents(agreement) {
  if (agreement.total_repay_amount != null) {
    // total_repay_amount is stored as a REAL in euros, convert to cents
    return Math.round(agreement.total_repay_amount * 100);
  }
  return agreement.amount_cents;
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

// normalize a date value to YYYY-MM-DD format (for financial dates)
// Accepts ISO strings, Date objects, or YYYY-MM-DD strings
function toDateOnly(dateValue) {
  if (!dateValue) return null;

  // If already in YYYY-MM-DD format, return as-is
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }

  // Parse to Date and extract date components
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return null;

  // Format as YYYY-MM-DD in UTC
  return date.toISOString().split('T')[0];
}

// Generate unique public slug for GroupTab
function generateGrouptabSlug() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';

  // Try up to 10 times to generate a unique slug
  for (let attempts = 0; attempts < 10; attempts++) {
    slug = 'gt-';
    for (let i = 0; i < 8; i++) {
      slug += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Check if slug already exists
    const exists = db.prepare('SELECT id FROM grouptabs WHERE public_slug = ?').get(slug);
    if (!exists) {
      return slug;
    }
  }

  // Fallback to timestamp-based slug if all attempts failed
  return 'gt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
}

// compute contribution totals for a grouptab
function getGrouptabContributionTotals(grouptabId) {
  const confirmed = db.prepare(`
    SELECT COALESCE(SUM(amount_cents), 0) as total_cents
    FROM grouptab_contributions
    WHERE grouptab_id = ? AND status = 'confirmed'
  `).get(grouptabId);

  const pending = db.prepare(`
    SELECT COALESCE(SUM(amount_cents), 0) as total_cents
    FROM grouptab_contributions
    WHERE grouptab_id = ? AND status = 'pending'
  `).get(grouptabId);

  return {
    confirmed_cents: confirmed.total_cents,
    pending_cents: pending.total_cents,
    total_reported_cents: confirmed.total_cents + pending.total_cents
  };
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
  const { email, password, fullName, phoneNumber, timezone } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Phone number is now optional during signup
  // Basic phone validation if provided: must contain at least some digits
  if (phoneNumber && !/\d/.test(phoneNumber)) {
    return res.status(400).json({ error: 'Phone number must contain at least one digit' });
  }

  // Validate timezone if provided (basic check for IANA format)
  if (timezone && !/^[A-Za-z_]+\/[A-Za-z_]+/.test(timezone)) {
    return res.status(400).json({ error: 'Invalid timezone format' });
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
      INSERT INTO users (email, password_hash, created_at, full_name, phone_number, timezone)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(email, passwordHash, createdAt, fullName || null, phoneNumber || null, timezone || null);

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

// Update user timezone preference
app.patch('/api/settings/timezone', requireAuth, (req, res) => {
  const { timezone } = req.body || {};

  if (!timezone || !timezone.trim()) {
    return res.status(400).json({ error: 'Timezone is required' });
  }

  // Validate timezone format (basic check for IANA format)
  if (!/^[A-Za-z_]+\/[A-Za-z_]+/.test(timezone)) {
    return res.status(400).json({ error: 'Invalid timezone format' });
  }

  try {
    db.prepare('UPDATE users SET timezone = ? WHERE id = ?')
      .run(timezone.trim(), req.user.id);
    res.json({ success: true, timezone: timezone.trim() });
  } catch (err) {
    console.error('Error updating timezone:', err);
    res.status(500).json({ error: 'Server error updating timezone' });
  }
});

// Update user profile
app.post('/api/profile', requireAuth, (req, res) => {
  const { fullName, phoneNumber, timezone } = req.body || {};

  // Get current user data to check if we need to update or preserve existing values
  const currentUserData = db.prepare('SELECT full_name, phone_number, timezone FROM users WHERE id = ?').get(req.user.id);

  // Determine which values to update
  const newFullName = fullName !== undefined ? (fullName.trim() || null) : currentUserData.full_name;
  const newPhoneNumber = phoneNumber !== undefined ? (phoneNumber || null) : currentUserData.phone_number;
  const newTimezone = timezone !== undefined ? (timezone || null) : currentUserData.timezone;

  // If updating full_name, it must not be empty
  if (fullName !== undefined && (!fullName || !fullName.trim())) {
    return res.status(400).json({ error: 'Full name cannot be empty' });
  }

  // Phone number validation if provided
  if (newPhoneNumber !== null && newPhoneNumber !== '') {
    if (!/\d/.test(newPhoneNumber)) {
      return res.status(400).json({ error: 'Phone number must contain at least one digit' });
    }
  }

  // Validate timezone if provided (basic check for IANA format)
  if (newTimezone !== null && newTimezone !== '') {
    if (!/^[A-Za-z_]+\/[A-Za-z_]+/.test(newTimezone)) {
      return res.status(400).json({ error: 'Invalid timezone format' });
    }
  }

  try {
    db.prepare('UPDATE users SET full_name = ?, phone_number = ?, timezone = ? WHERE id = ?')
      .run(newFullName, newPhoneNumber, newTimezone, req.user.id);
    res.json({ success: true, full_name: newFullName, phone_number: newPhoneNumber, timezone: newTimezone });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Server error updating profile' });
  }
});

// Upload profile picture
app.post('/api/profile/picture', requireAuth, (req, res, next) => {
  uploadProfilePicture.single('picture')(req, res, (err) => {
    // Handle multer errors
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File size too large. Maximum size is 5MB.'
        });
      }
      return res.status(400).json({
        success: false,
        error: `Upload error: ${err.message}`
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        error: err.message || 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.'
      });
    }

    // Wrap in try-catch to ensure JSON response even on unexpected errors
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      // Delete old profile picture if it exists
      const user = db.prepare('SELECT profile_picture FROM users WHERE id = ?').get(req.user.id);
      if (user?.profile_picture) {
        const oldPath = path.join(__dirname, user.profile_picture);
        try {
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        } catch (deleteErr) {
          console.error('Error deleting old profile picture:', deleteErr);
          // Continue anyway - not critical
        }
      }

      // Store relative path to the profile picture
      const relativePath = `/uploads/profiles/${req.file.filename}`;
      db.prepare('UPDATE users SET profile_picture = ? WHERE id = ?').run(relativePath, req.user.id);

      return res.json({
        success: true,
        profilePictureUrl: relativePath
      });
    } catch (err) {
      console.error('Error uploading profile picture:', err);
      return res.status(500).json({
        success: false,
        error: 'Server error uploading profile picture'
      });
    }
  });
});

// Delete profile picture
app.delete('/api/profile/picture', requireAuth, (req, res) => {
  try {
    const user = db.prepare('SELECT profile_picture FROM users WHERE id = ?').get(req.user.id);

    if (user?.profile_picture) {
      const filePath = path.join(__dirname, user.profile_picture);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error('Error deleting profile picture file:', err);
      }
    }

    db.prepare('UPDATE users SET profile_picture = NULL WHERE id = ?').run(req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting profile picture:', err);
    res.status(500).json({ error: 'Server error deleting profile picture' });
  }
});

// Serve profile picture (authenticated only, with access control)
app.get('/api/profile/picture/:userId', requireAuth, (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    // Check authorization: user can access their own picture or pictures of users they have agreements with
    if (req.user.id !== userId) {
      // Check if current user has any agreements with the requested user
      const hasAgreement = db.prepare(`
        SELECT COUNT(*) as count
        FROM agreements
        WHERE (lender_user_id = ? AND borrower_user_id = ?)
           OR (lender_user_id = ? AND borrower_user_id = ?)
      `).get(req.user.id, userId, userId, req.user.id);

      if (hasAgreement.count === 0) {
        return res.status(403).json({ error: 'You are not authorized to access this profile picture' });
      }
    }

    const user = db.prepare('SELECT profile_picture FROM users WHERE id = ?').get(userId);

    if (!user || !user.profile_picture) {
      return res.status(404).json({ error: 'Profile picture not found' });
    }

    const filePath = path.join(__dirname, user.profile_picture);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Profile picture file not found' });
    }

    res.sendFile(filePath);
  } catch (err) {
    console.error('Error serving profile picture:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- API ROUTES ---

// List agreements for logged-in user (both as lender and borrower)
app.get('/api/agreements', requireAuth, (req, res) => {
  // Auto-link any pending agreements for this user
  autoLinkPendingAgreements(req.user.id, req.user.email, req.user.full_name);

  const rows = db.prepare(`
    SELECT a.*,
      u_lender.full_name as lender_full_name,
      u_lender.email as lender_email,
      u_lender.profile_picture as lender_profile_picture,
      u_borrower.full_name as borrower_full_name,
      u_borrower.email as borrower_email,
      u_borrower.profile_picture as borrower_profile_picture
    FROM agreements a
    LEFT JOIN users u_lender ON a.lender_user_id = u_lender.id
    LEFT JOIN users u_borrower ON a.borrower_user_id = u_borrower.id
    WHERE lender_user_id = ? OR borrower_user_id = ?
    ORDER BY created_at DESC
  `).all(req.user.id, req.user.id);

  // Add payment totals and counterparty info to each agreement
  const agreementsWithTotals = rows.map(agreement => {
    const totals = getPaymentTotals(agreement.id);
    const isLender = agreement.lender_user_id === req.user.id;

    // Determine counterparty name and role
    let counterparty_name;
    let counterparty_role;

    if (isLender) {
      // Current user is lender, show borrower info
      counterparty_role = 'Borrower';
      counterparty_name = agreement.borrower_full_name || agreement.friend_first_name || agreement.borrower_email;
    } else {
      // Current user is borrower, show lender info
      counterparty_role = 'Lender';
      counterparty_name = agreement.lender_full_name || agreement.lender_name || agreement.lender_email;
    }

    // Check for open hardship requests
    const hasOpenDifficulty = db.prepare(`
      SELECT COUNT(*) as count
      FROM hardship_requests
      WHERE agreement_id = ?
    `).get(agreement.id).count > 0;

    // Check for pending payments that need lender confirmation
    // Only set to true if current user is the lender
    const hasPendingPaymentToConfirm = isLender && db.prepare(`
      SELECT COUNT(*) as count
      FROM payments
      WHERE agreement_id = ? AND status = 'pending'
    `).get(agreement.id).count > 0;

    // Calculate outstanding based on total due (principal + interest)
    const totalDueCents = getAgreementTotalDueCents(agreement);
    let outstanding_cents = totalDueCents - totals.total_paid_cents;
    if (outstanding_cents < 0) outstanding_cents = 0;

    return {
      ...agreement,
      total_paid_cents: totals.total_paid_cents,
      outstanding_cents,
      counterparty_name,
      counterparty_role,
      hasOpenDifficulty,
      hasPendingPaymentToConfirm
    };
  });

  res.json(agreementsWithTotals);
});

// Create new agreement with invite (two-sided flow)
app.post('/api/agreements', requireAuth, (req, res) => {
  let {
    lenderName, borrowerEmail, friendFirstName, amount, moneySentDate, dueDate, direction, repaymentType, description,
    planLength, planUnit, installmentCount, installmentAmount, firstPaymentDate, finalDueDate,
    interestRate, totalInterest, totalRepayAmount,
    paymentPreferenceMethod, paymentMethodsJson, paymentOtherDescription, reminderMode, reminderOffsets,
    proofRequired, debtCollectionClause, phoneNumber, paymentFrequency, oneTimeDueOption
  } = req.body || {};

  if (!borrowerEmail || !amount || !dueDate || !description) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  // Validate description length (max 30 characters)
  if (description && description.length > 30) {
    return res.status(400).json({ error: 'Description must be 30 characters or less.' });
  }

  // Capitalize first letter of description
  if (description && description.length > 0) {
    description = description.trim();
    description = description.charAt(0).toUpperCase() + description.slice(1);
  }

  const amountCents = toCents(amount);
  if (amountCents === null) {
    return res.status(400).json({ error: 'Amount must be a positive number.' });
  }

  // Worst case scenario (debt collection clause) is only allowed for loans >= 6000 EUR (600000 cents)
  const WORST_CASE_MIN_AMOUNT_CENTS = 600000; // 6000 EUR
  if (debtCollectionClause && amountCents < WORST_CASE_MIN_AMOUNT_CENTS) {
    // Silently ignore the flag for small loans instead of rejecting the request
    debtCollectionClause = false;
  }

  // Allow past dates for existing loans (no validation needed)

  const createdAt = new Date().toISOString();

  // Use user's full_name as lender_name if available, otherwise use provided lenderName
  const finalLenderName = req.user.full_name || lenderName || req.user.email;

  try {
    // Update user's phone number if provided
    if (phoneNumber) {
      // Basic phone validation: must contain at least some digits
      if (!/\d/.test(phoneNumber)) {
        return res.status(400).json({ error: 'Phone number must contain at least one digit' });
      }
      db.prepare('UPDATE users SET phone_number = ? WHERE id = ?')
        .run(phoneNumber, req.user.id);
    }

    // Create agreement
    const agreementStmt = db.prepare(`
      INSERT INTO agreements (
        lender_user_id, lender_name, borrower_email, friend_first_name,
        direction, repayment_type, amount_cents, money_sent_date, due_date, created_at, status, description,
        plan_length, plan_unit, installment_count, installment_amount, first_payment_date, final_due_date,
        interest_rate, total_interest, total_repay_amount,
        payment_preference_method, payment_methods_json, payment_other_description, reminder_mode, reminder_offsets,
        proof_required, debt_collection_clause, payment_frequency, one_time_due_option
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Normalize financial dates to YYYY-MM-DD format (pure dates, no time component)
    const normalizedMoneySentDate = toDateOnly(moneySentDate);
    const normalizedDueDate = toDateOnly(dueDate);
    const normalizedFirstPaymentDate = toDateOnly(firstPaymentDate);
    const normalizedFinalDueDate = toDateOnly(finalDueDate);

    const agreementInfo = agreementStmt.run(
      req.user.id,
      finalLenderName,
      borrowerEmail,
      friendFirstName || null,
      direction || 'lend',
      repaymentType || 'one_time',
      amountCents,
      normalizedMoneySentDate,
      normalizedDueDate,
      createdAt,
      description,
      planLength || null,
      planUnit || null,
      installmentCount || null,
      installmentAmount || null,
      normalizedFirstPaymentDate,
      normalizedFinalDueDate,
      interestRate || 0,
      totalInterest || 0,
      totalRepayAmount || null,
      paymentPreferenceMethod || null,
      paymentMethodsJson || null,
      paymentOtherDescription || null,
      reminderMode || 'auto',
      reminderOffsets ? JSON.stringify(reminderOffsets) : null,
      proofRequired ? 1 : 0,
      debtCollectionClause ? 1 : 0,
      paymentFrequency || 'monthly',
      oneTimeDueOption || null
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
      description,
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

// Update payment method details (lender only, for active agreements)
app.patch('/api/agreements/:id/payment-methods/:method', requireAuth, (req, res) => {
  const { id, method } = req.params;
  const { details } = req.body || {};

  if (!details && details !== '') {
    return res.status(400).json({ error: 'Details are required.' });
  }

  // Verify agreement belongs to lender
  const agreement = db.prepare(`
    SELECT id, lender_user_id, borrower_user_id, status, payment_methods_json
    FROM agreements WHERE id = ? AND lender_user_id = ?
  `).get(id, req.user.id);

  if (!agreement) {
    return res.status(404).json({ error: 'Agreement not found or you do not have permission to edit it.' });
  }

  // Only allow editing for active or settled agreements
  if (agreement.status !== 'active' && agreement.status !== 'settled') {
    return res.status(400).json({ error: 'Payment methods can only be edited for active agreements.' });
  }

  try {
    // Parse existing payment methods
    let paymentMethods = [];
    if (agreement.payment_methods_json) {
      try {
        paymentMethods = JSON.parse(agreement.payment_methods_json);
      } catch (e) {
        console.error('Error parsing payment_methods_json:', e);
        return res.status(500).json({ error: 'Invalid payment methods data.' });
      }
    }

    // Find and update the method
    const methodIndex = paymentMethods.findIndex(pm => pm.method === method);
    if (methodIndex === -1) {
      return res.status(404).json({ error: 'Payment method not found.' });
    }

    const oldDetails = paymentMethods[methodIndex].details;
    paymentMethods[methodIndex].details = details;

    // Save updated payment methods
    const updatedJson = JSON.stringify(paymentMethods);
    db.prepare('UPDATE agreements SET payment_methods_json = ? WHERE id = ?')
      .run(updatedJson, id);

    // Create activity log entry
    const methodNames = {
      'bank': 'bank transfer',
      'paypal': 'PayPal',
      'crypto': 'crypto',
      'cash': 'cash',
      'other': 'other'
    };
    const methodName = methodNames[method] || method;
    const now = new Date().toISOString();

    // Notify borrower
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      agreement.borrower_user_id,
      id,
      'Payment method details updated',
      `The lender updated the ${methodName} details. Please review before making a payment.`,
      now,
      'PAYMENT_METHOD_DETAILS_UPDATED'
    );

    res.json({ success: true, paymentMethods });
  } catch (err) {
    console.error('Error updating payment method details:', err);
    res.status(500).json({ error: 'Server error updating payment method details.' });
  }
});

// Add a new payment method (lender only, for active agreements)
app.post('/api/agreements/:id/payment-methods', requireAuth, (req, res) => {
  const { id } = req.params;
  const { method, details } = req.body || {};

  if (!method) {
    return res.status(400).json({ error: 'Method is required.' });
  }

  // Verify agreement belongs to lender
  const agreement = db.prepare(`
    SELECT id, lender_user_id, borrower_user_id, status, payment_methods_json
    FROM agreements WHERE id = ? AND lender_user_id = ?
  `).get(id, req.user.id);

  if (!agreement) {
    return res.status(404).json({ error: 'Agreement not found or you do not have permission to edit it.' });
  }

  // Only allow adding for active or settled agreements
  if (agreement.status !== 'active' && agreement.status !== 'settled') {
    return res.status(400).json({ error: 'Payment methods can only be added to active agreements.' });
  }

  try {
    // Parse existing payment methods
    let paymentMethods = [];
    if (agreement.payment_methods_json) {
      try {
        paymentMethods = JSON.parse(agreement.payment_methods_json);
      } catch (e) {
        console.error('Error parsing payment_methods_json:', e);
        return res.status(500).json({ error: 'Invalid payment methods data.' });
      }
    }

    // Check if method already exists
    if (paymentMethods.some(pm => pm.method === method && pm.status === 'active')) {
      return res.status(400).json({ error: 'This payment method already exists.' });
    }

    // Add new method
    paymentMethods.push({
      method,
      details: details || '',
      status: 'active'
    });

    // Save updated payment methods
    const updatedJson = JSON.stringify(paymentMethods);
    db.prepare('UPDATE agreements SET payment_methods_json = ? WHERE id = ?')
      .run(updatedJson, id);

    // Create activity log entry
    const methodNames = {
      'bank': 'Bank transfer',
      'paypal': 'PayPal',
      'crypto': 'Crypto',
      'cash': 'Cash',
      'other': 'Other'
    };
    const methodName = methodNames[method] || method;
    const now = new Date().toISOString();

    // Notify borrower
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      agreement.borrower_user_id,
      id,
      'New payment method added',
      `A new payment method was added. You can now also repay using ${methodName}.`,
      now,
      'PAYMENT_METHOD_ADDED'
    );

    res.json({ success: true, paymentMethods });
  } catch (err) {
    console.error('Error adding payment method:', err);
    res.status(500).json({ error: 'Server error adding payment method.' });
  }
});

// Request removal of a payment method (requires borrower approval)
app.delete('/api/agreements/:id/payment-methods/:method', requireAuth, (req, res) => {
  const { id, method } = req.params;

  // Verify agreement belongs to lender
  const agreement = db.prepare(`
    SELECT id, lender_user_id, borrower_user_id, status, payment_methods_json
    FROM agreements WHERE id = ? AND lender_user_id = ?
  `).get(id, req.user.id);

  if (!agreement) {
    return res.status(404).json({ error: 'Agreement not found or you do not have permission to edit it.' });
  }

  // Only allow removal request for active agreements
  if (agreement.status !== 'active') {
    return res.status(400).json({ error: 'Payment methods can only be removed from active agreements.' });
  }

  try {
    // Parse existing payment methods
    let paymentMethods = [];
    if (agreement.payment_methods_json) {
      try {
        paymentMethods = JSON.parse(agreement.payment_methods_json);
      } catch (e) {
        console.error('Error parsing payment_methods_json:', e);
        return res.status(500).json({ error: 'Invalid payment methods data.' });
      }
    }

    // Find the method
    const methodIndex = paymentMethods.findIndex(pm => pm.method === method && pm.status === 'active');
    if (methodIndex === -1) {
      return res.status(404).json({ error: 'Payment method not found.' });
    }

    // Ensure at least one active method remains
    const activeCount = paymentMethods.filter(pm => pm.status === 'active' || pm.status === 'pending_removal').length;
    if (activeCount <= 1) {
      return res.status(400).json({ error: 'Cannot remove the last payment method. At least one method must remain available.' });
    }

    // Mark as pending removal (requires borrower approval)
    paymentMethods[methodIndex].status = 'pending_removal';

    // Save updated payment methods
    const updatedJson = JSON.stringify(paymentMethods);
    db.prepare('UPDATE agreements SET payment_methods_json = ? WHERE id = ?')
      .run(updatedJson, id);

    // Create activity log entry
    const methodNames = {
      'bank': 'Bank transfer',
      'paypal': 'PayPal',
      'crypto': 'Crypto',
      'cash': 'Cash',
      'other': 'Other'
    };
    const methodName = methodNames[method] || method;
    const now = new Date().toISOString();

    // Notify borrower (requires approval)
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      agreement.borrower_user_id,
      id,
      'Payment method removal requested',
      `The lender wants to remove ${methodName} as a payment method. Approve or decline this change.`,
      now,
      'PAYMENT_METHOD_REMOVAL_REQUESTED'
    );

    res.json({ success: true, paymentMethods });
  } catch (err) {
    console.error('Error requesting payment method removal:', err);
    res.status(500).json({ error: 'Server error requesting payment method removal.' });
  }
});

// Approve payment method removal (borrower only)
app.post('/api/agreements/:id/payment-methods/:method/approve-removal', requireAuth, (req, res) => {
  const { id, method } = req.params;

  // Verify agreement belongs to borrower
  const agreement = db.prepare(`
    SELECT id, lender_user_id, borrower_user_id, status, payment_methods_json
    FROM agreements WHERE id = ? AND borrower_user_id = ?
  `).get(id, req.user.id);

  if (!agreement) {
    return res.status(404).json({ error: 'Agreement not found or you do not have permission to approve this.' });
  }

  try {
    // Parse existing payment methods
    let paymentMethods = [];
    if (agreement.payment_methods_json) {
      try {
        paymentMethods = JSON.parse(agreement.payment_methods_json);
      } catch (e) {
        console.error('Error parsing payment_methods_json:', e);
        return res.status(500).json({ error: 'Invalid payment methods data.' });
      }
    }

    // Find the method pending removal
    const methodIndex = paymentMethods.findIndex(pm => pm.method === method && pm.status === 'pending_removal');
    if (methodIndex === -1) {
      return res.status(404).json({ error: 'Payment method removal request not found.' });
    }

    // Remove the method
    paymentMethods.splice(methodIndex, 1);

    // Save updated payment methods
    const updatedJson = JSON.stringify(paymentMethods);
    db.prepare('UPDATE agreements SET payment_methods_json = ? WHERE id = ?')
      .run(updatedJson, id);

    // Create activity log entry
    const methodNames = {
      'bank': 'Bank transfer',
      'paypal': 'PayPal',
      'crypto': 'Crypto',
      'cash': 'Cash',
      'other': 'Other'
    };
    const methodName = methodNames[method] || method;
    const now = new Date().toISOString();

    // Notify lender
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      agreement.lender_user_id,
      id,
      'Payment method removal approved',
      `The borrower approved removal of ${methodName}.`,
      now,
      'PAYMENT_METHOD_REMOVAL_APPROVED'
    );

    res.json({ success: true, paymentMethods });
  } catch (err) {
    console.error('Error approving payment method removal:', err);
    res.status(500).json({ error: 'Server error approving payment method removal.' });
  }
});

// Decline payment method removal (borrower only)
app.post('/api/agreements/:id/payment-methods/:method/decline-removal', requireAuth, (req, res) => {
  const { id, method } = req.params;

  // Verify agreement belongs to borrower
  const agreement = db.prepare(`
    SELECT id, lender_user_id, borrower_user_id, status, payment_methods_json
    FROM agreements WHERE id = ? AND borrower_user_id = ?
  `).get(id, req.user.id);

  if (!agreement) {
    return res.status(404).json({ error: 'Agreement not found or you do not have permission to decline this.' });
  }

  try {
    // Parse existing payment methods
    let paymentMethods = [];
    if (agreement.payment_methods_json) {
      try {
        paymentMethods = JSON.parse(agreement.payment_methods_json);
      } catch (e) {
        console.error('Error parsing payment_methods_json:', e);
        return res.status(500).json({ error: 'Invalid payment methods data.' });
      }
    }

    // Find the method pending removal
    const methodIndex = paymentMethods.findIndex(pm => pm.method === method && pm.status === 'pending_removal');
    if (methodIndex === -1) {
      return res.status(404).json({ error: 'Payment method removal request not found.' });
    }

    // Revert to active status
    paymentMethods[methodIndex].status = 'active';

    // Save updated payment methods
    const updatedJson = JSON.stringify(paymentMethods);
    db.prepare('UPDATE agreements SET payment_methods_json = ? WHERE id = ?')
      .run(updatedJson, id);

    // Create activity log entry
    const methodNames = {
      'bank': 'Bank transfer',
      'paypal': 'PayPal',
      'crypto': 'Crypto',
      'cash': 'Cash',
      'other': 'Other'
    };
    const methodName = methodNames[method] || method;
    const now = new Date().toISOString();

    // Notify lender
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      agreement.lender_user_id,
      id,
      'Payment method removal declined',
      `The borrower declined removal of ${methodName}.`,
      now,
      'PAYMENT_METHOD_REMOVAL_DECLINED'
    );

    res.json({ success: true, paymentMethods });
  } catch (err) {
    console.error('Error declining payment method removal:', err);
    res.status(500).json({ error: 'Server error declining payment method removal.' });
  }
});

// Get messages for logged-in user
app.get('/api/messages', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT m.*,
      a.status as agreement_status,
      a.borrower_email,
      a.borrower_user_id,
      a.lender_user_id,
      u_borrower.full_name as borrower_full_name,
      a.friend_first_name
    FROM messages m
    LEFT JOIN agreements a ON m.agreement_id = a.id
    LEFT JOIN users u_borrower ON a.borrower_user_id = u_borrower.id
    WHERE m.user_id = ?
    ORDER BY m.created_at DESC
  `).all(req.user.id);

  // Get unread count
  const unreadCount = db.prepare(`
    SELECT COUNT(*) as count
    FROM messages
    WHERE user_id = ? AND read_at IS NULL
  `).get(req.user.id).count;

  res.json({
    messages: rows,
    unread_count: unreadCount
  });
});

// Mark all messages as read for current user
app.post('/api/activity/mark-all-read', requireAuth, (req, res) => {
  try {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE messages
      SET read_at = ?
      WHERE user_id = ? AND read_at IS NULL
    `).run(now, req.user.id);

    res.json({ success: true });
  } catch (err) {
    console.error('Error marking all messages as read:', err);
    res.status(500).json({ error: 'Server error marking messages as read' });
  }
});

// Mark a single message as read
app.post('/api/activity/:id/mark-read', requireAuth, (req, res) => {
  const { id } = req.params;

  try {
    // Verify message belongs to current user
    const message = db.prepare(`
      SELECT id FROM messages WHERE id = ? AND user_id = ?
    `).get(id, req.user.id);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE messages
      SET read_at = ?
      WHERE id = ? AND read_at IS NULL
    `).run(now, id);

    res.json({ success: true });
  } catch (err) {
    console.error('Error marking message as read:', err);
    res.status(500).json({ error: 'Server error marking message as read' });
  }
});

// Get invite info for an agreement (lender only)
app.get('/api/agreements/:id/invite', requireAuth, (req, res) => {
  const { id } = req.params;

  try {
    // Verify user is the lender
    const agreement = db.prepare('SELECT lender_user_id FROM agreements WHERE id = ?').get(id);
    if (!agreement || agreement.lender_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get invite data
    const invite = db.prepare(`
      SELECT token, created_at, accepted_at
      FROM agreement_invites
      WHERE agreement_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(id);

    if (!invite) {
      return res.status(404).json({ error: 'No invite found for this agreement' });
    }

    res.json(invite);
  } catch (err) {
    console.error('Error fetching invite:', err);
    res.status(500).json({ error: 'Server error fetching invite' });
  }
});

// Get single agreement by ID (for logged-in users)
app.get('/api/agreements/:id', requireAuth, (req, res) => {
  const { id } = req.params;

  try {
    const agreement = db.prepare(`
      SELECT a.*,
        u_lender.full_name as lender_full_name,
        u_lender.email as lender_email,
        u_lender.profile_picture as lender_profile_picture,
        u_borrower.full_name as borrower_full_name,
        u_borrower.email as borrower_email,
        u_borrower.profile_picture as borrower_profile_picture
      FROM agreements a
      LEFT JOIN users u_lender ON a.lender_user_id = u_lender.id
      LEFT JOIN users u_borrower ON a.borrower_user_id = u_borrower.id
      WHERE a.id = ? AND (a.lender_user_id = ? OR a.borrower_user_id = ?)
    `).get(id, req.user.id, req.user.id);

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    // Add payment totals and calculate outstanding
    const totals = getPaymentTotals(id);
    const totalDueCents = getAgreementTotalDueCents(agreement);
    let outstanding_cents = totalDueCents - totals.total_paid_cents;
    if (outstanding_cents < 0) outstanding_cents = 0;

    const agreementWithTotals = {
      ...agreement,
      total_paid_cents: totals.total_paid_cents,
      outstanding_cents
    };

    res.json(agreementWithTotals);
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

// Cancel agreement (lender only, pending agreements)
app.post('/api/agreements/:id/cancel', requireAuth, (req, res) => {
  const { id } = req.params;

  try {
    // Get agreement
    const agreement = db.prepare(`
      SELECT * FROM agreements WHERE id = ?
    `).get(id);

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    // Verify user is the lender
    if (agreement.lender_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to cancel this agreement' });
    }

    // Verify status is pending
    if (agreement.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending agreements can be cancelled' });
    }

    const now = new Date().toISOString();

    // Update agreement status
    db.prepare(`
      UPDATE agreements
      SET status = 'cancelled'
      WHERE id = ?
    `).run(id);

    const lenderName = req.user.full_name || agreement.lender_name;

    // Message for lender
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      id,
      'Agreement cancelled',
      'You cancelled this agreement request.',
      now,
      'AGREEMENT_CANCELLED_LENDER'
    );

    // If borrower is linked, notify them too
    if (agreement.borrower_user_id) {
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        agreement.borrower_user_id,
        id,
        'Agreement cancelled',
        `${lenderName} cancelled this agreement request.`,
        now,
        'AGREEMENT_CANCELLED_BORROWER'
      );
    }

    res.json({ success: true, agreementId: Number(id) });
  } catch (err) {
    console.error('Error cancelling agreement:', err);
    res.status(500).json({ error: 'Server error cancelling agreement' });
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

// Create hardship request (borrower only)
app.post('/api/agreements/:id/hardship-request', requireAuth, (req, res) => {
  const { id } = req.params;
  const { reasonCategory, reasonText, canPayNowCents, preferredAdjustments } = req.body || {};

  if (!reasonCategory || !preferredAdjustments) {
    return res.status(400).json({ error: 'Reason category and preferred adjustments are required' });
  }

  try {
    // Get agreement and verify it's active and user is borrower
    const agreement = db.prepare(`
      SELECT a.*,
        u_lender.full_name as lender_full_name,
        u_lender.email as lender_email,
        u_borrower.full_name as borrower_full_name,
        u_borrower.email as borrower_email
      FROM agreements a
      LEFT JOIN users u_lender ON a.lender_user_id = u_lender.id
      LEFT JOIN users u_borrower ON a.borrower_user_id = u_borrower.id
      WHERE a.id = ?
    `).get(id);

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    if (agreement.borrower_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the borrower can request hardship assistance' });
    }

    if (agreement.status !== 'active') {
      return res.status(400).json({ error: 'Can only request hardship assistance for active agreements' });
    }

    const now = new Date().toISOString();

    // Convert preferredAdjustments array to comma-separated string
    const adjustmentsStr = Array.isArray(preferredAdjustments)
      ? preferredAdjustments.join(',')
      : preferredAdjustments;

    // Create hardship request
    const result = db.prepare(`
      INSERT INTO hardship_requests (
        agreement_id, borrower_user_id, reason_category, reason_text,
        can_pay_now_cents, preferred_adjustments, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.user.id,
      reasonCategory,
      reasonText || null,
      canPayNowCents || null,
      adjustmentsStr,
      now
    );

    // Create activity event for borrower
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      id,
      'Payment assistance requested',
      'You asked for a new payment plan and explained why this payment is difficult.',
      now,
      'HARDSHIP_REQUEST_BORROWER'
    );

    // Create activity event for lender with more details
    const borrowerName = agreement.borrower_full_name || agreement.friend_first_name || agreement.borrower_email;
    const canPayText = canPayNowCents
      ? ` They can pay €${Math.round(canPayNowCents / 100)} now.`
      : ' They cannot pay anything right now.';

    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      agreement.lender_user_id,
      id,
      'Payment assistance requested',
      `${borrowerName} reported difficulty making payments and requested a new plan.${canPayText}`,
      now,
      'HARDSHIP_REQUEST_LENDER'
    );

    res.status(201).json({
      success: true,
      hardshipRequestId: result.lastInsertRowid
    });
  } catch (err) {
    console.error('Error creating hardship request:', err);
    res.status(500).json({ error: 'Server error creating hardship request' });
  }
});

// Get hardship requests for an agreement
app.get('/api/agreements/:id/hardship-requests', requireAuth, (req, res) => {
  const { id } = req.params;

  try {
    // Verify user has access to this agreement
    const agreement = db.prepare(`
      SELECT id, lender_user_id, borrower_user_id
      FROM agreements
      WHERE id = ? AND (lender_user_id = ? OR borrower_user_id = ?)
    `).get(id, req.user.id, req.user.id);

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    // Get unresolved hardship requests for this agreement
    const requests = db.prepare(`
      SELECT * FROM hardship_requests
      WHERE agreement_id = ? AND resolved_at IS NULL
      ORDER BY created_at DESC
    `).all(id);

    res.json(requests);
  } catch (err) {
    console.error('Error fetching hardship requests:', err);
    res.status(500).json({ error: 'Server error fetching hardship requests' });
  }
});

// ===== Renegotiation Routes =====

// Create renegotiation request (borrower initiates - Step 0 & 1)
app.post('/api/agreements/:id/renegotiation', requireAuth, (req, res) => {
  const { id } = req.params;
  const { selectedType, canPayNowCents, borrowerNote, troubleReason, troubleReasonOther } = req.body || {};

  if (!selectedType) {
    return res.status(400).json({ error: 'Solution type is required' });
  }

  if (!troubleReason) {
    return res.status(400).json({ error: 'Reason for trouble paying is required' });
  }

  try {
    // Get agreement and verify user is borrower
    const agreement = db.prepare(`
      SELECT id, borrower_user_id, lender_user_id, repayment_type, status,
             lender_name, friend_first_name
      FROM agreements
      WHERE id = ?
    `).get(id);

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    if (agreement.borrower_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the borrower can initiate renegotiation' });
    }

    if (agreement.status !== 'active') {
      return res.status(400).json({ error: 'Can only renegotiate active agreements' });
    }

    // Check if there's already an open renegotiation
    const existingRenegotiation = db.prepare(`
      SELECT id FROM renegotiation_requests
      WHERE agreement_id = ? AND status = 'open'
    `).get(id);

    if (existingRenegotiation) {
      return res.status(400).json({ error: 'There is already an open renegotiation request for this agreement' });
    }

    const now = new Date().toISOString();

    // CRITICAL: Determine loan type to ensure correct renegotiation options are shown
    // Database stores 'installments' (plural), but module uses 'installment' (singular)
    // This distinction is important - installment and one-time loans have different solution options
    const loanType = agreement.repayment_type === 'installments' ? 'installment' : 'one_time';

    // Create history event
    const history = JSON.stringify([{
      timestamp: now,
      actor: 'borrower',
      type: 'initiated',
      message: `Borrower initiated renegotiation. Selected type: ${selectedType}.`
    }]);

    // Create renegotiation request
    const result = db.prepare(`
      INSERT INTO renegotiation_requests (
        agreement_id, status, stage, initiated_by, loan_type, selected_type,
        can_pay_now_cents, borrower_note, trouble_reason, trouble_reason_other,
        history, created_at, updated_at
      )
      VALUES (?, 'open', 'type_pending_lender_response', 'borrower', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      loanType,
      selectedType,
      canPayNowCents || null,
      borrowerNote || null,
      troubleReason,
      troubleReasonOther || null,
      history,
      now,
      now
    );

    // Set repayment issue flag on agreement
    db.prepare(`
      UPDATE agreements SET has_repayment_issue = 1 WHERE id = ?
    `).run(id);

    // Create repayment issue warning messages for both parties
    const borrowerName = agreement.friend_first_name || 'The borrower';

    // Get human-readable reason text
    let reasonText = '';
    switch(troubleReason) {
      case 'unexpected_expenses':
        reasonText = 'unexpected expenses';
        break;
      case 'income_delay':
        reasonText = 'income delay (salary, client, invoice, etc)';
        break;
      case 'tight_budget':
        reasonText = 'tight budget this month';
        break;
      case 'prefer_not_say':
        reasonText = 'prefers not to share details';
        break;
      case 'other':
        reasonText = troubleReasonOther ? troubleReasonOther : 'other reasons';
        break;
      default:
        reasonText = 'payment difficulties';
    }

    // Message for borrower
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      agreement.borrower_user_id,
      id,
      'Repayment issue reported',
      `You reported having trouble paying due to ${reasonText}.`,
      now,
      'repayment_issue_reported'
    );

    // Message for lender
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      agreement.lender_user_id,
      id,
      'Repayment issue reported',
      `${borrowerName} reported having trouble paying${troubleReason === 'prefer_not_say' ? ' but prefers not to share details' : ' due to ' + reasonText}.`,
      now,
      'repayment_issue_reported'
    );

    // Create notification message for lender
    const lenderName = agreement.friend_first_name || agreement.lender_name;
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      agreement.lender_user_id,
      id,
      'Renegotiation requested',
      `The borrower has requested to renegotiate the payment plan.`,
      now,
      'renegotiation_requested'
    );

    res.status(201).json({
      success: true,
      renegotiationId: result.lastInsertRowid
    });
  } catch (err) {
    console.error('Error creating renegotiation request:', err);
    res.status(500).json({ error: 'Server error creating renegotiation request' });
  }
});

// Get active renegotiation for an agreement
app.get('/api/agreements/:id/renegotiation', requireAuth, (req, res) => {
  const { id } = req.params;

  try {
    // Verify user has access to this agreement
    const agreement = db.prepare(`
      SELECT id, lender_user_id, borrower_user_id
      FROM agreements
      WHERE id = ? AND (lender_user_id = ? OR borrower_user_id = ?)
    `).get(id, req.user.id, req.user.id);

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    // Get active renegotiation (open status only)
    const renegotiation = db.prepare(`
      SELECT * FROM renegotiation_requests
      WHERE agreement_id = ? AND status = 'open'
      ORDER BY created_at DESC
      LIMIT 1
    `).get(id);

    if (!renegotiation) {
      return res.json(null);
    }

    // Parse JSON fields
    renegotiation.history = JSON.parse(renegotiation.history);
    if (renegotiation.borrower_values_proposal) {
      renegotiation.borrower_values_proposal = JSON.parse(renegotiation.borrower_values_proposal);
    }
    if (renegotiation.lender_values_proposal) {
      renegotiation.lender_values_proposal = JSON.parse(renegotiation.lender_values_proposal);
    }

    res.json(renegotiation);
  } catch (err) {
    console.error('Error fetching renegotiation:', err);
    res.status(500).json({ error: 'Server error fetching renegotiation' });
  }
});

// Lender responds to solution type (approve/suggest alternative/decline)
app.post('/api/agreements/:id/renegotiation/respond-type', requireAuth, (req, res) => {
  const { id } = req.params;
  const { action, suggestedType, responseNote } = req.body || {};

  if (!action || !['approve', 'suggest', 'decline'].includes(action)) {
    return res.status(400).json({ error: 'Valid action is required (approve, suggest, decline)' });
  }

  if (action === 'suggest' && !suggestedType) {
    return res.status(400).json({ error: 'Suggested type is required when suggesting alternative' });
  }

  try {
    // Get agreement and verify user is lender
    const agreement = db.prepare(`
      SELECT id, lender_user_id, borrower_user_id
      FROM agreements
      WHERE id = ?
    `).get(id);

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    if (agreement.lender_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the lender can respond to renegotiation' });
    }

    // Get active renegotiation
    const renegotiation = db.prepare(`
      SELECT * FROM renegotiation_requests
      WHERE agreement_id = ? AND status = 'open' AND stage = 'type_pending_lender_response'
    `).get(id);

    if (!renegotiation) {
      return res.status(404).json({ error: 'No pending renegotiation found' });
    }

    const now = new Date().toISOString();
    const history = JSON.parse(renegotiation.history);

    if (action === 'approve') {
      // Lender approves the borrower's selected type
      history.push({
        timestamp: now,
        actor: 'lender',
        type: 'type_approved',
        message: `Lender approved solution type: ${renegotiation.selected_type}.`
      });

      db.prepare(`
        UPDATE renegotiation_requests
        SET stage = 'values_to_be_set',
            agreed_type = ?,
            lender_response_note = ?,
            history = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        renegotiation.selected_type,
        responseNote || null,
        JSON.stringify(history),
        now,
        renegotiation.id
      );

      // Notify borrower
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        agreement.borrower_user_id,
        id,
        'Solution type approved',
        `Your lender approved the renegotiation approach. Now propose the specific amounts and dates.`,
        now,
        'renegotiation_type_approved'
      );

    } else if (action === 'suggest') {
      // Lender suggests alternative type
      history.push({
        timestamp: now,
        actor: 'lender',
        type: 'type_counter_proposed',
        message: `Lender suggested solution type: ${suggestedType} instead of ${renegotiation.selected_type}.`
      });

      db.prepare(`
        UPDATE renegotiation_requests
        SET stage = 'type_counter_proposed_to_borrower',
            lender_suggested_type = ?,
            lender_response_note = ?,
            history = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        suggestedType,
        responseNote || null,
        JSON.stringify(history),
        now,
        renegotiation.id
      );

      // Notify borrower
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        agreement.borrower_user_id,
        id,
        'Alternative solution suggested',
        `Your lender suggested a different approach. Check the renegotiation to see their proposal.`,
        now,
        'renegotiation_type_suggested'
      );

    } else if (action === 'decline') {
      // Lender declines renegotiation
      history.push({
        timestamp: now,
        actor: 'lender',
        type: 'declined',
        message: `Lender declined renegotiation request.${responseNote ? ' Reason: ' + responseNote : ''}`
      });

      db.prepare(`
        UPDATE renegotiation_requests
        SET status = 'closed_declined',
            stage = 'closed_declined',
            lender_response_note = ?,
            history = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        responseNote || null,
        JSON.stringify(history),
        now,
        renegotiation.id
      );

      // Notify borrower
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        agreement.borrower_user_id,
        id,
        'Renegotiation declined',
        `Your lender declined the renegotiation request. The original payment plan remains active.`,
        now,
        'renegotiation_declined'
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error responding to renegotiation type:', err);
    res.status(500).json({ error: 'Server error responding to renegotiation' });
  }
});

// Borrower responds to lender's suggested type (accept/decline)
app.post('/api/agreements/:id/renegotiation/respond-suggested-type', requireAuth, (req, res) => {
  const { id } = req.params;
  const { action } = req.body || {};

  if (!action || !['accept', 'decline'].includes(action)) {
    return res.status(400).json({ error: 'Valid action is required (accept, decline)' });
  }

  try {
    // Get agreement and verify user is borrower
    const agreement = db.prepare(`
      SELECT id, lender_user_id, borrower_user_id
      FROM agreements
      WHERE id = ?
    `).get(id);

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    if (agreement.borrower_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the borrower can respond to suggested type' });
    }

    // Get active renegotiation
    const renegotiation = db.prepare(`
      SELECT * FROM renegotiation_requests
      WHERE agreement_id = ? AND status = 'open' AND stage = 'type_counter_proposed_to_borrower'
    `).get(id);

    if (!renegotiation) {
      return res.status(404).json({ error: 'No pending type counter-proposal found' });
    }

    const now = new Date().toISOString();
    const history = JSON.parse(renegotiation.history);

    if (action === 'accept') {
      // Borrower accepts lender's suggested type
      history.push({
        timestamp: now,
        actor: 'borrower',
        type: 'type_counter_accepted',
        message: `Borrower accepted lender's suggested solution type: ${renegotiation.lender_suggested_type}.`
      });

      db.prepare(`
        UPDATE renegotiation_requests
        SET stage = 'values_to_be_set',
            agreed_type = ?,
            history = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        renegotiation.lender_suggested_type,
        JSON.stringify(history),
        now,
        renegotiation.id
      );

      // Notify lender
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        agreement.lender_user_id,
        id,
        'Solution type accepted',
        `The borrower accepted your suggested solution. They will now propose specific values.`,
        now,
        'renegotiation_type_accepted'
      );

    } else {
      // Borrower declines lender's suggestion - close renegotiation
      history.push({
        timestamp: now,
        actor: 'borrower',
        type: 'declined',
        message: `Borrower declined lender's suggested solution type. Renegotiation closed.`
      });

      db.prepare(`
        UPDATE renegotiation_requests
        SET status = 'closed_declined',
            stage = 'closed_declined',
            history = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        JSON.stringify(history),
        now,
        renegotiation.id
      );

      // Notify lender
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        agreement.lender_user_id,
        id,
        'Renegotiation closed',
        `The borrower declined the suggested solution. The original payment plan remains active.`,
        now,
        'renegotiation_closed'
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error responding to suggested type:', err);
    res.status(500).json({ error: 'Server error responding to suggested type' });
  }
});

// Borrower proposes values (Step 2)
app.post('/api/agreements/:id/renegotiation/propose-values', requireAuth, (req, res) => {
  const { id } = req.params;
  const { values } = req.body || {};

  if (!values || typeof values !== 'object') {
    return res.status(400).json({ error: 'Values object is required' });
  }

  try {
    // Get agreement and verify user is borrower
    const agreement = db.prepare(`
      SELECT id, lender_user_id, borrower_user_id
      FROM agreements
      WHERE id = ?
    `).get(id);

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    if (agreement.borrower_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the borrower can propose values' });
    }

    // Get active renegotiation
    const renegotiation = db.prepare(`
      SELECT * FROM renegotiation_requests
      WHERE agreement_id = ? AND status = 'open' AND stage = 'values_to_be_set'
    `).get(id);

    if (!renegotiation) {
      return res.status(404).json({ error: 'No renegotiation at values stage found' });
    }

    const now = new Date().toISOString();
    const history = JSON.parse(renegotiation.history);

    history.push({
      timestamp: now,
      actor: 'borrower',
      type: 'values_proposed',
      message: `Borrower proposed new values for agreed type: ${renegotiation.agreed_type}.`
    });

    db.prepare(`
      UPDATE renegotiation_requests
      SET stage = 'values_pending_lender_response',
          borrower_values_proposal = ?,
          history = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(values),
      JSON.stringify(history),
      now,
      renegotiation.id
    );

    // Notify lender
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      agreement.lender_user_id,
      id,
      'New payment plan proposed',
      `The borrower has proposed specific amounts and dates. Review and respond to the proposal.`,
      now,
      'renegotiation_values_proposed'
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error proposing values:', err);
    res.status(500).json({ error: 'Server error proposing values' });
  }
});

// Lender responds to values (approve/counter/decline)
app.post('/api/agreements/:id/renegotiation/respond-values', requireAuth, (req, res) => {
  const { id } = req.params;
  const { action, counterValues, responseNote } = req.body || {};

  if (!action || !['approve', 'counter', 'decline'].includes(action)) {
    return res.status(400).json({ error: 'Valid action is required (approve, counter, decline)' });
  }

  if (action === 'counter' && !counterValues) {
    return res.status(400).json({ error: 'Counter values are required when countering' });
  }

  try {
    // Get agreement and verify user is lender
    const agreement = db.prepare(`
      SELECT id, lender_user_id, borrower_user_id
      FROM agreements
      WHERE id = ?
    `).get(id);

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    if (agreement.lender_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the lender can respond to values' });
    }

    // Get active renegotiation
    const renegotiation = db.prepare(`
      SELECT * FROM renegotiation_requests
      WHERE agreement_id = ? AND status = 'open' AND stage = 'values_pending_lender_response'
    `).get(id);

    if (!renegotiation) {
      return res.status(404).json({ error: 'No pending values proposal found' });
    }

    const now = new Date().toISOString();
    const history = JSON.parse(renegotiation.history);

    if (action === 'approve') {
      // Lender approves values - renegotiation is complete
      history.push({
        timestamp: now,
        actor: 'lender',
        type: 'accepted',
        message: `Lender accepted renegotiation with proposed values.`
      });

      db.prepare(`
        UPDATE renegotiation_requests
        SET status = 'accepted',
            stage = 'accepted',
            lender_response_note = ?,
            history = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        responseNote || null,
        JSON.stringify(history),
        now,
        renegotiation.id
      );

      // Clear repayment issue flag and create resolved messages
      db.prepare(`
        UPDATE agreements SET has_repayment_issue = 0 WHERE id = ?
      `).run(id);

      // Create "Repayment issue resolved" messages for both parties
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        agreement.borrower_user_id,
        id,
        'Repayment issue resolved',
        `Your repayment issue has been resolved with the new payment plan.`,
        now,
        'repayment_issue_resolved'
      );

      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        agreement.lender_user_id,
        id,
        'Repayment issue resolved',
        `The repayment issue has been resolved with the new payment plan.`,
        now,
        'repayment_issue_resolved'
      );

      // Notify borrower about acceptance
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        agreement.borrower_user_id,
        id,
        'Payment plan accepted!',
        `Your lender accepted the new payment plan. The agreement schedule will be updated shortly.`,
        now,
        'renegotiation_accepted'
      );

      // Mark any open hardship requests as resolved
      db.prepare(`
        UPDATE hardship_requests
        SET resolved_at = ?
        WHERE agreement_id = ? AND resolved_at IS NULL
      `).run(now, id);

      // Send "Repayment issue resolved" messages to both parties
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        agreement.borrower_user_id,
        id,
        'Repayment issue resolved',
        `Your payment difficulties have been resolved with a new payment plan.`,
        now,
        'HARDSHIP_RESOLVED'
      );

      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        agreement.lender_user_id,
        id,
        'Repayment issue resolved',
        `The borrower's payment difficulties have been resolved with a new payment plan.`,
        now,
        'HARDSHIP_RESOLVED'
      );

      // TODO: Apply renegotiation to agreement (recalculate schedule, update dates, etc.)
      // This would be implemented in a separate function that handles schedule recalculation

    } else if (action === 'counter') {
      // Lender proposes counter values
      history.push({
        timestamp: now,
        actor: 'lender',
        type: 'values_counter_proposed',
        message: `Lender counter-proposed different values.`
      });

      db.prepare(`
        UPDATE renegotiation_requests
        SET stage = 'values_counter_proposed_to_borrower',
            lender_values_proposal = ?,
            lender_response_note = ?,
            history = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        JSON.stringify(counterValues),
        responseNote || null,
        JSON.stringify(history),
        now,
        renegotiation.id
      );

      // Notify borrower
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        agreement.borrower_user_id,
        id,
        'Alternative values proposed',
        `Your lender proposed different amounts or dates. Review their counter-proposal.`,
        now,
        'renegotiation_values_countered'
      );

    } else if (action === 'decline') {
      // Lender declines values proposal
      history.push({
        timestamp: now,
        actor: 'lender',
        type: 'declined',
        message: `Lender declined renegotiation after reviewing values.${responseNote ? ' Reason: ' + responseNote : ''}`
      });

      db.prepare(`
        UPDATE renegotiation_requests
        SET status = 'closed_declined',
            stage = 'closed_declined',
            lender_response_note = ?,
            history = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        responseNote || null,
        JSON.stringify(history),
        now,
        renegotiation.id
      );

      // Notify borrower
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        agreement.borrower_user_id,
        id,
        'Renegotiation declined',
        `Your lender declined the proposed payment plan. The original schedule remains active.`,
        now,
        'renegotiation_declined'
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error responding to values:', err);
    res.status(500).json({ error: 'Server error responding to values' });
  }
});

// Borrower responds to lender's counter values (accept/decline)
app.post('/api/agreements/:id/renegotiation/respond-counter-values', requireAuth, (req, res) => {
  const { id } = req.params;
  const { action } = req.body || {};

  if (!action || !['accept', 'decline'].includes(action)) {
    return res.status(400).json({ error: 'Valid action is required (accept, decline)' });
  }

  try {
    // Get agreement and verify user is borrower
    const agreement = db.prepare(`
      SELECT id, lender_user_id, borrower_user_id
      FROM agreements
      WHERE id = ?
    `).get(id);

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    if (agreement.borrower_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the borrower can respond to counter values' });
    }

    // Get active renegotiation
    const renegotiation = db.prepare(`
      SELECT * FROM renegotiation_requests
      WHERE agreement_id = ? AND status = 'open' AND stage = 'values_counter_proposed_to_borrower'
    `).get(id);

    if (!renegotiation) {
      return res.status(404).json({ error: 'No pending counter-values proposal found' });
    }

    const now = new Date().toISOString();
    const history = JSON.parse(renegotiation.history);

    if (action === 'accept') {
      // Borrower accepts lender's counter values - renegotiation complete
      history.push({
        timestamp: now,
        actor: 'borrower',
        type: 'accepted',
        message: `Borrower accepted lender's counter-proposed values.`
      });

      db.prepare(`
        UPDATE renegotiation_requests
        SET status = 'accepted',
            stage = 'accepted',
            history = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        JSON.stringify(history),
        now,
        renegotiation.id
      );

      // Clear repayment issue flag and create resolved messages
      db.prepare(`
        UPDATE agreements SET has_repayment_issue = 0 WHERE id = ?
      `).run(id);

      // Create "Repayment issue resolved" messages for both parties
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        agreement.borrower_user_id,
        id,
        'Repayment issue resolved',
        `Your repayment issue has been resolved with the new payment plan.`,
        now,
        'repayment_issue_resolved'
      );

      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        agreement.lender_user_id,
        id,
        'Repayment issue resolved',
        `The repayment issue has been resolved with the new payment plan.`,
        now,
        'repayment_issue_resolved'
      );

      // Notify lender about acceptance
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        agreement.lender_user_id,
        id,
        'Payment plan accepted!',
        `The borrower accepted your proposed payment plan. The agreement schedule will be updated shortly.`,
        now,
        'renegotiation_accepted'
      );

      // Mark any open hardship requests as resolved
      db.prepare(`
        UPDATE hardship_requests
        SET resolved_at = ?
        WHERE agreement_id = ? AND resolved_at IS NULL
      `).run(now, id);

      // Send "Repayment issue resolved" messages to both parties
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        agreement.borrower_user_id,
        id,
        'Repayment issue resolved',
        `Your payment difficulties have been resolved with a new payment plan.`,
        now,
        'HARDSHIP_RESOLVED'
      );

      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        agreement.lender_user_id,
        id,
        'Repayment issue resolved',
        `The borrower's payment difficulties have been resolved with a new payment plan.`,
        now,
        'HARDSHIP_RESOLVED'
      );

      // TODO: Apply renegotiation to agreement

    } else {
      // Borrower declines lender's counter values - close renegotiation
      history.push({
        timestamp: now,
        actor: 'borrower',
        type: 'declined',
        message: `Borrower declined lender's counter-proposed values. Renegotiation closed.`
      });

      db.prepare(`
        UPDATE renegotiation_requests
        SET status = 'closed_declined',
            stage = 'closed_declined',
            history = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        JSON.stringify(history),
        now,
        renegotiation.id
      );

      // Notify lender
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        agreement.lender_user_id,
        id,
        'Renegotiation closed',
        `The borrower declined your counter-proposal. The original payment plan remains active.`,
        now,
        'renegotiation_closed'
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error responding to counter values:', err);
    res.status(500).json({ error: 'Server error responding to counter values' });
  }
});

// Create a payment for an agreement
app.post('/api/agreements/:id/payments', requireAuth, upload.single('proof'), (req, res) => {
  const { id } = req.params;
  const { amount, method, note } = req.body || {};

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Valid amount is required' });
  }

  const amountCents = toCents(amount);
  if (amountCents === null) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  if (!method) {
    return res.status(400).json({ error: 'Payment method is required' });
  }

  try {
    // Get agreement and verify user has access
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

    // Verify agreement is active
    if (agreement.status !== 'active') {
      return res.status(400).json({ error: 'Can only record payments for active agreements' });
    }

    // Validate payment method is allowed by the agreement
    if (agreement.payment_preference_method) {
      const allowedMethods = agreement.payment_preference_method.split(',').map(m => m.trim());
      if (!allowedMethods.includes(method)) {
        return res.status(400).json({ error: 'Payment method not allowed for this agreement' });
      }
    }

    const now = new Date().toISOString();

    // Determine if user is borrower or lender
    const isBorrower = agreement.borrower_user_id === req.user.id;
    const isLender = agreement.lender_user_id === req.user.id;

    // Set status based on who is recording
    const paymentStatus = isBorrower ? 'pending' : 'approved';

    // Handle proof of payment file if uploaded
    let proofFilePath = null;
    let proofOriginalName = null;
    let proofMimeType = null;

    if (req.file) {
      proofFilePath = '/uploads/payments/' + path.basename(req.file.path);
      proofOriginalName = req.file.originalname;
      proofMimeType = req.file.mimetype;
    }

    // Insert payment with proof fields
    const result = db.prepare(`
      INSERT INTO payments (agreement_id, recorded_by_user_id, amount_cents, method, note, created_at, status, proof_file_path, proof_original_name, proof_mime_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.user.id, amountCents, method || null, note || null, now, paymentStatus, proofFilePath, proofOriginalName, proofMimeType);

    const paymentId = result.lastInsertRowid;

    // Create activity events based on who recorded the payment
    if (isBorrower) {
      // Borrower reported a payment - pending approval
      const borrowerName = agreement.borrower_full_name || agreement.friend_first_name || agreement.borrower_email;
      const lenderName = agreement.lender_full_name || agreement.lender_name;
      const amountFormatted = formatCurrency2(amountCents);

      // Activity for borrower
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        req.user.id,
        id,
        'Payment reported',
        `You reported a payment of ${amountFormatted} — waiting for ${lenderName.split(' ')[0] || lenderName}'s confirmation.`,
        now,
        'PAYMENT_REPORTED_BORROWER'
      );

      // Activity for lender
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        agreement.lender_user_id,
        id,
        'Payment reported by borrower',
        `${borrowerName} reported a payment of ${amountFormatted} — please review.`,
        now,
        'PAYMENT_REPORTED_LENDER'
      );
    } else if (isLender) {
      // Lender added a received payment - approved immediately
      const borrowerName = agreement.borrower_full_name || agreement.friend_first_name || agreement.borrower_email;
      const lenderName = agreement.lender_full_name || agreement.lender_name;
      const amountFormatted = formatCurrency2(amountCents);

      // Create activity messages for both parties
      // Activity for lender
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        req.user.id,
        id,
        'Payment recorded',
        `You recorded a payment of ${amountFormatted} from ${borrowerName}.`,
        now,
        'PAYMENT_RECORDED_LENDER'
      );

      // Activity for borrower
      if (agreement.borrower_user_id) {
        db.prepare(`
          INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          agreement.borrower_user_id,
          id,
          'Payment confirmed',
          `${lenderName.split(' ')[0] || lenderName} confirmed a payment of ${amountFormatted}.`,
          now,
          'PAYMENT_RECORDED_BORROWER'
        );
      }

      // Get payment totals (only approved payments)
      const totals = getPaymentTotals(id);
      const totalDueCents = getAgreementTotalDueCents(agreement);
      let outstanding = totalDueCents - totals.total_paid_cents;
      if (outstanding < 0) outstanding = 0;

      // Auto-settle if fully paid
      if (outstanding === 0 && agreement.status === 'active') {
        db.prepare(`
          UPDATE agreements
          SET status = 'settled'
          WHERE id = ?
        `).run(id);

        // Create activity messages for both parties
        db.prepare(`
          INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          agreement.lender_user_id,
          id,
          'Agreement settled',
          'Agreement has been fully paid and is now settled.',
          now,
          'AGREEMENT_SETTLED'
        );

        if (agreement.borrower_user_id) {
          db.prepare(`
            INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            agreement.borrower_user_id,
            id,
            'Agreement settled',
            'Agreement has been fully paid and is now settled.',
            now,
            'AGREEMENT_SETTLED'
          );
        }
      }
    }

    // Get updated agreement with totals
    const updatedAgreement = db.prepare(`
      SELECT a.*,
        u_lender.full_name as lender_full_name,
        u_lender.email as lender_email,
        u_borrower.full_name as borrower_full_name,
        u_borrower.email as borrower_email
      FROM agreements a
      LEFT JOIN users u_lender ON a.lender_user_id = u_lender.id
      LEFT JOIN users u_borrower ON a.borrower_user_id = u_borrower.id
      WHERE a.id = ?
    `).get(id);

    const updatedTotals = getPaymentTotals(id);
    const totalDueCents = getAgreementTotalDueCents(updatedAgreement);
    let outstanding_cents = totalDueCents - updatedTotals.total_paid_cents;
    if (outstanding_cents < 0) outstanding_cents = 0;

    res.status(201).json({
      success: true,
      paymentId: paymentId,
      agreement: {
        ...updatedAgreement,
        total_paid_cents: updatedTotals.total_paid_cents,
        outstanding_cents
      }
    });
  } catch (err) {
    console.error('Error creating payment:', err);
    res.status(500).json({ error: 'Server error creating payment' });
  }
});

// Get payments for an agreement
app.get('/api/agreements/:id/payments', requireAuth, (req, res) => {
  const { id } = req.params;

  try {
    // Verify user has access to this agreement
    const agreement = db.prepare(`
      SELECT id, lender_user_id, borrower_user_id
      FROM agreements
      WHERE id = ? AND (lender_user_id = ? OR borrower_user_id = ?)
    `).get(id, req.user.id, req.user.id);

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    // Get all payments for this agreement with user info
    const payments = db.prepare(`
      SELECT p.*,
        u.full_name as recorded_by_name,
        u.email as recorded_by_email
      FROM payments p
      LEFT JOIN users u ON p.recorded_by_user_id = u.id
      WHERE p.agreement_id = ?
      ORDER BY p.created_at DESC
    `).all(id);

    res.json(payments);
  } catch (err) {
    console.error('Error fetching payments:', err);
    res.status(500).json({ error: 'Server error fetching payments' });
  }
});

// Approve a pending payment (lender only)
app.post('/api/payments/:id/approve', requireAuth, (req, res) => {
  const { id } = req.params;

  try {
    // Get payment and agreement
    const payment = db.prepare(`
      SELECT p.*, a.lender_user_id, a.borrower_user_id, a.amount_cents as agreement_amount_cents, a.total_repay_amount, a.status as agreement_status,
        u_lender.full_name as lender_full_name,
        u_borrower.full_name as borrower_full_name,
        a.friend_first_name
      FROM payments p
      JOIN agreements a ON p.agreement_id = a.id
      LEFT JOIN users u_lender ON a.lender_user_id = u_lender.id
      LEFT JOIN users u_borrower ON a.borrower_user_id = u_borrower.id
      WHERE p.id = ?
    `).get(id);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Verify current user is the lender
    if (payment.lender_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the lender can approve payments' });
    }

    // Verify payment is pending
    if (payment.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending payments can be approved' });
    }

    const now = new Date().toISOString();

    // Update payment status to approved
    db.prepare(`
      UPDATE payments
      SET status = 'approved'
      WHERE id = ?
    `).run(id);

    const amountFormatted = formatCurrency2(payment.amount_cents);
    const lenderName = payment.lender_full_name || req.user.full_name;
    const borrowerName = payment.borrower_full_name || payment.friend_first_name;

    // Create activity for lender
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      payment.agreement_id,
      'Payment confirmed',
      `You confirmed a payment of ${amountFormatted} from ${borrowerName}.`,
      now,
      'PAYMENT_APPROVED_LENDER'
    );

    // Create activity for borrower
    if (payment.borrower_user_id) {
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        payment.borrower_user_id,
        payment.agreement_id,
        'Payment confirmed',
        `${lenderName.split(' ')[0] || lenderName} confirmed your payment of ${amountFormatted}.`,
        now,
        'PAYMENT_APPROVED_BORROWER'
      );
    }

    // Recompute totals
    const totals = getPaymentTotals(payment.agreement_id);
    // Create agreement object for helper function
    const agreement = {
      amount_cents: payment.agreement_amount_cents,
      total_repay_amount: payment.total_repay_amount
    };
    const totalDueCents = getAgreementTotalDueCents(agreement);
    let outstanding = totalDueCents - totals.total_paid_cents;
    if (outstanding < 0) outstanding = 0;

    // Auto-settle if fully paid
    if (outstanding === 0 && payment.agreement_status === 'active') {
      db.prepare(`
        UPDATE agreements
        SET status = 'settled'
        WHERE id = ?
      `).run(payment.agreement_id);

      // Create activity messages for both parties
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        payment.lender_user_id,
        payment.agreement_id,
        'Agreement settled',
        'Agreement has been fully paid and is now settled.',
        now,
        'AGREEMENT_SETTLED'
      );

      if (payment.borrower_user_id) {
        db.prepare(`
          INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          payment.borrower_user_id,
          payment.agreement_id,
          'Agreement settled',
          'Agreement has been fully paid and is now settled.',
          now,
          'AGREEMENT_SETTLED'
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error approving payment:', err);
    res.status(500).json({ error: 'Server error approving payment' });
  }
});

// Decline a pending payment (lender only)
app.post('/api/payments/:id/decline', requireAuth, (req, res) => {
  const { id } = req.params;

  try {
    // Get payment and agreement
    const payment = db.prepare(`
      SELECT p.*, a.lender_user_id, a.borrower_user_id,
        u_lender.full_name as lender_full_name,
        u_borrower.full_name as borrower_full_name,
        a.friend_first_name
      FROM payments p
      JOIN agreements a ON p.agreement_id = a.id
      LEFT JOIN users u_lender ON a.lender_user_id = u_lender.id
      LEFT JOIN users u_borrower ON a.borrower_user_id = u_borrower.id
      WHERE p.id = ?
    `).get(id);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Verify current user is the lender
    if (payment.lender_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the lender can decline payments' });
    }

    // Verify payment is pending
    if (payment.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending payments can be declined' });
    }

    const now = new Date().toISOString();

    // Update payment status to declined
    db.prepare(`
      UPDATE payments
      SET status = 'declined'
      WHERE id = ?
    `).run(id);

    const amountFormatted = formatCurrency2(payment.amount_cents);
    const lenderName = payment.lender_full_name || req.user.full_name;
    const borrowerName = payment.borrower_full_name || payment.friend_first_name;

    // Create activity for lender
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      payment.agreement_id,
      'Payment declined',
      `You declined the reported payment of ${amountFormatted} from ${borrowerName}.`,
      now,
      'PAYMENT_DECLINED_LENDER'
    );

    // Create activity for borrower
    if (payment.borrower_user_id) {
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        payment.borrower_user_id,
        payment.agreement_id,
        'Payment not confirmed',
        `${lenderName.split(' ')[0] || lenderName} did not confirm your reported payment of ${amountFormatted}.`,
        now,
        'PAYMENT_DECLINED_BORROWER'
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error declining payment:', err);
    res.status(500).json({ error: 'Server error declining payment' });
  }
});

// Get proof of payment file (secure, authenticated)
app.get('/api/payments/:id/proof', requireAuth, (req, res) => {
  const { id } = req.params;

  try {
    // Get payment and its agreement to check authorization
    const payment = db.prepare(`
      SELECT p.proof_file_path, p.proof_mime_type, p.proof_original_name,
        a.lender_user_id, a.borrower_user_id
      FROM payments p
      JOIN agreements a ON p.agreement_id = a.id
      WHERE p.id = ?
    `).get(id);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Check if proof file exists
    if (!payment.proof_file_path) {
      return res.status(404).json({ error: 'No proof of payment for this payment' });
    }

    // Authorization: only lender or borrower can access
    if (req.user.id !== payment.lender_user_id && req.user.id !== payment.borrower_user_id) {
      return res.status(403).json({ error: 'You are not authorized to access this file' });
    }

    // Construct file path (proof_file_path is stored as /uploads/payments/filename)
    const filePath = path.join(__dirname, payment.proof_file_path);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Proof file not found on server' });
    }

    // Set content type and send file
    res.type(payment.proof_mime_type || 'application/octet-stream');
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error('Error serving proof of payment:', err);
    res.status(500).json({ error: 'Server error serving proof file' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// ============================================
// GroupTab API Endpoints
// ============================================

// Create a new GroupTab
app.post('/api/grouptabs', requireAuth, uploadGrouptab.single('billImage'), (req, res) => {
  try {
    const {
      title,
      description,
      totalAmount,
      currency = 'EUR',
      eventDate,
      peopleCount,
      bankDetails,
      paypalDetails,
      otherPaymentDetails
    } = req.body;

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const totalAmountCents = toCents(totalAmount);
    if (!totalAmountCents) {
      return res.status(400).json({ error: 'Valid total amount is required' });
    }

    // Generate unique public slug
    const publicSlug = generateGrouptabSlug();

    // Handle uploaded bill image
    const billImageUrl = req.file ? req.file.path : null;

    const now = new Date().toISOString();
    const normalizedEventDate = toDateOnly(eventDate) || toDateOnly(now);

    const result = db.prepare(`
      INSERT INTO grouptabs (
        owner_user_id, title, description, total_amount_cents, currency,
        people_count, event_date, bill_image_url, status, public_slug,
        bank_details, paypal_details, other_payment_details,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      title.trim(),
      description || null,
      totalAmountCents,
      currency,
      peopleCount ? parseInt(peopleCount, 10) : null,
      normalizedEventDate,
      billImageUrl,
      publicSlug,
      bankDetails || null,
      paypalDetails || null,
      otherPaymentDetails || null,
      now,
      now
    );

    res.json({
      success: true,
      grouptabId: result.lastInsertRowid,
      publicSlug: publicSlug
    });
  } catch (err) {
    console.error('Error creating grouptab:', err);
    res.status(500).json({ error: 'Server error creating grouptab' });
  }
});

// Get all grouptabs for the logged-in user
app.get('/api/grouptabs', requireAuth, (req, res) => {
  try {
    const grouptabs = db.prepare(`
      SELECT * FROM grouptabs
      WHERE owner_user_id = ?
      ORDER BY created_at DESC
    `).all(req.user.id);

    // Add totals for each grouptab
    const grouptabsWithTotals = grouptabs.map(gt => {
      const totals = getGrouptabContributionTotals(gt.id);
      return {
        ...gt,
        ...totals,
        remaining_confirmed_cents: Math.max(0, gt.total_amount_cents - totals.confirmed_cents)
      };
    });

    res.json({ grouptabs: grouptabsWithTotals });
  } catch (err) {
    console.error('Error fetching grouptabs:', err);
    res.status(500).json({ error: 'Server error fetching grouptabs' });
  }
});

// Get a specific grouptab (authenticated - for host)
app.get('/api/grouptabs/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;

    const grouptab = db.prepare('SELECT * FROM grouptabs WHERE id = ?').get(id);

    if (!grouptab) {
      return res.status(404).json({ error: 'GroupTab not found' });
    }

    // Verify ownership
    if (grouptab.owner_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all contributions
    const contributions = db.prepare(`
      SELECT * FROM grouptab_contributions
      WHERE grouptab_id = ?
      ORDER BY created_at DESC
    `).all(id);

    // Calculate totals
    const totals = getGrouptabContributionTotals(id);

    res.json({
      grouptab: {
        ...grouptab,
        ...totals,
        remaining_confirmed_cents: Math.max(0, grouptab.total_amount_cents - totals.confirmed_cents)
      },
      contributions
    });
  } catch (err) {
    console.error('Error fetching grouptab:', err);
    res.status(500).json({ error: 'Server error fetching grouptab' });
  }
});

// Update grouptab status (close/reopen)
app.patch('/api/grouptabs/:id/status', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['open', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be "open" or "closed"' });
    }

    const grouptab = db.prepare('SELECT * FROM grouptabs WHERE id = ?').get(id);

    if (!grouptab) {
      return res.status(404).json({ error: 'GroupTab not found' });
    }

    if (grouptab.owner_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE grouptabs
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(status, now, id);

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating grouptab status:', err);
    res.status(500).json({ error: 'Server error updating grouptab status' });
  }
});

// ============================================
// GroupTab Contributions API (Authenticated - Host Only)
// ============================================

// Confirm a contribution
app.post('/api/grouptab-contributions/:id/confirm', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { amount, method } = req.body; // Optional: allow editing amount/method

    const contribution = db.prepare(`
      SELECT c.*, g.owner_user_id
      FROM grouptab_contributions c
      JOIN grouptabs g ON c.grouptab_id = g.id
      WHERE c.id = ?
    `).get(id);

    if (!contribution) {
      return res.status(404).json({ error: 'Contribution not found' });
    }

    // Verify ownership of the grouptab
    if (contribution.owner_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const now = new Date().toISOString();

    // If amount or method is provided, update them
    if (amount !== undefined) {
      const amountCents = toCents(amount);
      if (!amountCents) {
        return res.status(400).json({ error: 'Invalid amount' });
      }

      db.prepare(`
        UPDATE grouptab_contributions
        SET status = 'confirmed', confirmed_at = ?, amount_cents = ?, method = ?, updated_at = ?
        WHERE id = ?
      `).run(now, amountCents, method || contribution.method, now, id);
    } else {
      db.prepare(`
        UPDATE grouptab_contributions
        SET status = 'confirmed', confirmed_at = ?, updated_at = ?
        WHERE id = ?
      `).run(now, now, id);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error confirming contribution:', err);
    res.status(500).json({ error: 'Server error confirming contribution' });
  }
});

// Reject a contribution
app.post('/api/grouptab-contributions/:id/reject', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const contribution = db.prepare(`
      SELECT c.*, g.owner_user_id
      FROM grouptab_contributions c
      JOIN grouptabs g ON c.grouptab_id = g.id
      WHERE c.id = ?
    `).get(id);

    if (!contribution) {
      return res.status(404).json({ error: 'Contribution not found' });
    }

    if (contribution.owner_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE grouptab_contributions
      SET status = 'rejected', rejected_reason = ?, updated_at = ?
      WHERE id = ?
    `).run(reason || 'Rejected by host', now, id);

    res.json({ success: true });
  } catch (err) {
    console.error('Error rejecting contribution:', err);
    res.status(500).json({ error: 'Server error rejecting contribution' });
  }
});

// ============================================
// Public GroupTab API (No Authentication Required)
// ============================================

// Get grouptab by public slug (for guests)
app.get('/api/public/grouptabs/:slug', (req, res) => {
  try {
    const { slug } = req.params;

    const grouptab = db.prepare(`
      SELECT g.*, u.full_name as owner_name
      FROM grouptabs g
      JOIN users u ON g.owner_user_id = u.id
      WHERE g.public_slug = ?
    `).get(slug);

    if (!grouptab) {
      return res.status(404).json({ error: 'GroupTab not found' });
    }

    // Get all non-rejected contributions
    const contributions = db.prepare(`
      SELECT
        id, grouptab_id, guest_name, amount_cents, method, status,
        comment, created_at, confirmed_at
      FROM grouptab_contributions
      WHERE grouptab_id = ? AND status != 'rejected'
      ORDER BY confirmed_at DESC, created_at DESC
    `).all(grouptab.id);

    // Calculate totals
    const totals = getGrouptabContributionTotals(grouptab.id);

    // Group contributions by guest_name
    const contributionsByGuest = {};
    contributions.forEach(c => {
      if (!contributionsByGuest[c.guest_name]) {
        contributionsByGuest[c.guest_name] = {
          guest_name: c.guest_name,
          confirmed_cents: 0,
          pending_cents: 0,
          contributions: []
        };
      }

      if (c.status === 'confirmed') {
        contributionsByGuest[c.guest_name].confirmed_cents += c.amount_cents;
      } else if (c.status === 'pending') {
        contributionsByGuest[c.guest_name].pending_cents += c.amount_cents;
      }

      contributionsByGuest[c.guest_name].contributions.push(c);
    });

    const guestsList = Object.values(contributionsByGuest);

    // Return safe, public data (no sensitive owner info)
    res.json({
      grouptab: {
        id: grouptab.id,
        title: grouptab.title,
        description: grouptab.description,
        total_amount_cents: grouptab.total_amount_cents,
        currency: grouptab.currency,
        people_count: grouptab.people_count,
        event_date: grouptab.event_date,
        bill_image_url: grouptab.bill_image_url,
        status: grouptab.status,
        public_slug: grouptab.public_slug,
        owner_name: grouptab.owner_name ? grouptab.owner_name.split(' ')[0] : 'Host', // First name only
        bank_details: grouptab.bank_details,
        paypal_details: grouptab.paypal_details,
        other_payment_details: grouptab.other_payment_details,
        ...totals,
        remaining_confirmed_cents: Math.max(0, grouptab.total_amount_cents - totals.confirmed_cents)
      },
      guests: guestsList
    });
  } catch (err) {
    console.error('Error fetching public grouptab:', err);
    res.status(500).json({ error: 'Server error fetching grouptab' });
  }
});

// Submit a contribution as a guest (no auth required)
app.post('/api/public/grouptabs/:slug/contributions', uploadGrouptab.single('proof'), (req, res) => {
  try {
    const { slug } = req.params;
    const { guestName, amount, method, comment } = req.body;

    // Validation
    if (!guestName || !guestName.trim()) {
      return res.status(400).json({ error: 'Your name is required' });
    }

    const amountCents = toCents(amount);
    if (!amountCents) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    // Find grouptab by slug
    const grouptab = db.prepare('SELECT * FROM grouptabs WHERE public_slug = ?').get(slug);

    if (!grouptab) {
      return res.status(404).json({ error: 'GroupTab not found' });
    }

    // Check if grouptab is closed
    if (grouptab.status === 'closed') {
      return res.status(400).json({ error: 'This GroupTab is closed and no longer accepting contributions' });
    }

    const now = new Date().toISOString();
    const proofImageUrl = req.file ? req.file.path : null;

    const result = db.prepare(`
      INSERT INTO grouptab_contributions (
        grouptab_id, guest_name, amount_cents, method, status, comment,
        proof_image_url, proof_original_name, proof_mime_type,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
    `).run(
      grouptab.id,
      guestName.trim(),
      amountCents,
      method || null,
      comment || null,
      proofImageUrl,
      req.file?.originalname || null,
      req.file?.mimetype || null,
      now,
      now
    );

    res.json({
      success: true,
      contributionId: result.lastInsertRowid
    });
  } catch (err) {
    console.error('Error submitting contribution:', err);
    res.status(500).json({ error: 'Server error submitting contribution' });
  }
});

// Serve grouptab images (public)
app.get('/api/grouptab-images/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = `./uploads/grouptabs/${filename}`;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Send the file
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error('Error serving grouptab image:', err);
    res.status(500).json({ error: 'Server error serving image' });
  }
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
        status: invite.status,
        description: invite.description,
        money_sent_date: invite.money_sent_date,
        installment_count: invite.installment_count,
        installment_amount: invite.installment_amount,
        first_payment_date: invite.first_payment_date,
        final_due_date: invite.final_due_date,
        interest_rate: invite.interest_rate,
        total_interest: invite.total_interest,
        total_repay_amount: invite.total_repay_amount,
        payment_preference_method: invite.payment_preference_method,
        reminder_enabled: invite.reminder_enabled,
        plan_length: invite.plan_length,
        plan_unit: invite.plan_unit,
        payment_other_description: invite.payment_other_description,
        reminder_mode: invite.reminder_mode,
        reminder_offsets: invite.reminder_offsets,
        proof_required: invite.proof_required,
        debt_collection_clause: invite.debt_collection_clause,
        created_at: invite.created_at
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
  const { fairnessAccepted } = req.body;

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
      SET status = 'active', borrower_user_id = ?, fairness_accepted = ?
      WHERE id = ?
    `).run(req.user.id, fairnessAccepted ? 1 : 0, invite.agreement_id);

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

// Settings: serve settings page if authenticated, else redirect to /
app.get('/settings', (req, res) => {
  if (req.user) {
    res.sendFile(path.join(__dirname, 'public', 'settings.html'));
  } else {
    res.redirect('/');
  }
});

// Security: serve security page if authenticated, else redirect to /
app.get('/security', (req, res) => {
  if (req.user) {
    res.sendFile(path.join(__dirname, 'public', 'security.html'));
  } else {
    res.redirect('/');
  }
});

// Legal & About: serve legal page if authenticated, else redirect to /
app.get('/legal', (req, res) => {
  if (req.user) {
    res.sendFile(path.join(__dirname, 'public', 'legal.html'));
  } else {
    res.redirect('/');
  }
});

// GroupTabs: serve grouptabs overview page if authenticated, else redirect to /
app.get('/group-tabs', (req, res) => {
  if (req.user) {
    res.sendFile(path.join(__dirname, 'public', 'group-tabs.html'));
  } else {
    res.redirect('/');
  }
});

// GroupTab Create: serve grouptab creation page if authenticated, else redirect to /
app.get('/group-tabs/create', (req, res) => {
  if (req.user) {
    res.sendFile(path.join(__dirname, 'public', 'group-tab-create.html'));
  } else {
    res.redirect('/');
  }
});

// GroupTab Detail: serve grouptab detail/management page if authenticated, else redirect to /
app.get('/group-tabs/:id', (req, res) => {
  if (req.user) {
    res.sendFile(path.join(__dirname, 'public', 'group-tab-detail.html'));
  } else {
    res.redirect('/');
  }
});

// Public GroupTab: serve public grouptab page (no auth required)
app.get('/gt/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'gt.html'));
});

// Review: serve review page for agreement invites
app.get('/review', (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.sendFile(path.join(__dirname, 'public', 'review-invalid.html'));
  }

  // Verify token exists and get agreement_id
  const invite = db.prepare(`
    SELECT id, agreement_id FROM agreement_invites WHERE token = ?
  `).get(token);

  if (!invite) {
    return res.sendFile(path.join(__dirname, 'public', 'review-invalid.html'));
  }

  // If user is logged in, redirect to the canonical review page
  if (req.user) {
    return res.redirect(302, `/agreements/${invite.agreement_id}/review`);
  }

  // If user is NOT logged in, serve the token-based review/signup page
  res.sendFile(path.join(__dirname, 'public', 'review.html'));
});

// Review agreement (logged-in borrower)
app.get('/agreements/:id/review', (req, res) => {
  if (!req.user) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'review-details.html'));
});

// Manage agreement (logged-in lender or borrower)
app.get('/agreements/:id/manage', (req, res) => {
  if (!req.user) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'review-details.html'));
});

// Legacy redirect: /view → /manage
app.get('/agreements/:id/view', (req, res) => {
  res.redirect(302, `/agreements/${req.params.id}/manage`);
});

// Serve other static files from "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Start server
app.listen(PORT, () => {
  console.log(`PayFriends MVP running at http://localhost:${PORT}`);
});

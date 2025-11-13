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
    FOREIGN KEY (agreement_id) REFERENCES agreements(id),
    FOREIGN KEY (borrower_user_id) REFERENCES users(id)
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
      SELECT s.*, u.email, u.id as user_id, u.full_name, u.profile_picture, u.phone_number
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
        phone_number: session.phone_number
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
  const { email, password, fullName, phoneNumber } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Phone number is now optional during signup
  // Basic phone validation if provided: must contain at least some digits
  if (phoneNumber && !/\d/.test(phoneNumber)) {
    return res.status(400).json({ error: 'Phone number must contain at least one digit' });
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
      INSERT INTO users (email, password_hash, created_at, full_name, phone_number)
      VALUES (?, ?, ?, ?, ?)
    `).run(email, passwordHash, createdAt, fullName || null, phoneNumber || null);

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
  const { fullName, phoneNumber } = req.body || {};

  if (!fullName || !fullName.trim()) {
    return res.status(400).json({ error: 'Full name is required' });
  }

  // Phone number validation if provided
  if (phoneNumber !== undefined && phoneNumber !== null && phoneNumber !== '') {
    if (!/\d/.test(phoneNumber)) {
      return res.status(400).json({ error: 'Phone number must contain at least one digit' });
    }
  }

  try {
    db.prepare('UPDATE users SET full_name = ?, phone_number = ? WHERE id = ?')
      .run(fullName.trim(), phoneNumber || null, req.user.id);
    res.json({ success: true, full_name: fullName.trim(), phone_number: phoneNumber || null });
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

    return {
      ...agreement,
      total_paid_cents: totals.total_paid_cents,
      outstanding_cents: agreement.amount_cents - totals.total_paid_cents,
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
    paymentPreferenceMethod, paymentOtherDescription, reminderMode, reminderOffsets,
    proofRequired, debtCollectionClause, phoneNumber, paymentFrequency
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
        payment_preference_method, payment_other_description, reminder_mode, reminder_offsets,
        proof_required, debt_collection_clause, payment_frequency
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const agreementInfo = agreementStmt.run(
      req.user.id,
      finalLenderName,
      borrowerEmail,
      friendFirstName || null,
      direction || 'lend',
      repaymentType || 'one_time',
      amountCents,
      moneySentDate || null,
      dueDate,
      createdAt,
      description,
      planLength || null,
      planUnit || null,
      installmentCount || null,
      installmentAmount || null,
      firstPaymentDate || null,
      finalDueDate || null,
      interestRate || 0,
      totalInterest || 0,
      totalRepayAmount || null,
      paymentPreferenceMethod || null,
      paymentOtherDescription || null,
      reminderMode || 'auto',
      reminderOffsets ? JSON.stringify(reminderOffsets) : null,
      proofRequired ? 1 : 0,
      debtCollectionClause ? 1 : 0,
      paymentFrequency || 'monthly'
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

    // Add payment totals
    const totals = getPaymentTotals(id);
    const agreementWithTotals = {
      ...agreement,
      total_paid_cents: totals.total_paid_cents,
      outstanding_cents: agreement.amount_cents - totals.total_paid_cents
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

    // Get all hardship requests for this agreement
    const requests = db.prepare(`
      SELECT * FROM hardship_requests
      WHERE agreement_id = ?
      ORDER BY created_at DESC
    `).all(id);

    res.json(requests);
  } catch (err) {
    console.error('Error fetching hardship requests:', err);
    res.status(500).json({ error: 'Server error fetching hardship requests' });
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
      const outstanding = agreement.amount_cents - totals.total_paid_cents;

      // Auto-settle if fully paid
      if (outstanding <= 0 && agreement.status === 'active') {
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

    res.status(201).json({
      success: true,
      paymentId: paymentId,
      agreement: {
        ...updatedAgreement,
        total_paid_cents: updatedTotals.total_paid_cents,
        outstanding_cents: updatedAgreement.amount_cents - updatedTotals.total_paid_cents
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
      SELECT p.*, a.lender_user_id, a.borrower_user_id, a.amount_cents as agreement_amount_cents, a.status as agreement_status,
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
    const outstanding = payment.agreement_amount_cents - totals.total_paid_cents;

    // Auto-settle if fully paid
    if (outstanding <= 0 && payment.agreement_status === 'active') {
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

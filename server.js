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
    full_name TEXT,
    public_id TEXT UNIQUE
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

  CREATE TABLE IF NOT EXISTS initial_payment_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agreement_id INTEGER NOT NULL,
    reported_by_user_id INTEGER NOT NULL,
    payment_method TEXT,
    proof_file_path TEXT,
    proof_original_name TEXT,
    proof_mime_type TEXT,
    reported_at TEXT,
    created_at TEXT NOT NULL,
    is_completed INTEGER DEFAULT 0,
    FOREIGN KEY (agreement_id) REFERENCES agreements(id),
    FOREIGN KEY (reported_by_user_id) REFERENCES users(id)
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

// Add public_id column to users if it doesn't exist (for friend profile URLs)
try {
  db.exec(`ALTER TABLE users ADD COLUMN public_id TEXT UNIQUE;`);
} catch (e) {
  // Column already exists, ignore
}

// Generate public IDs for existing users that don't have one OR have invalid ones
// A valid public_id should be 32 characters (16 bytes hex = 32 chars)
const usersWithoutPublicId = db.prepare(`
  SELECT id, public_id FROM users
  WHERE public_id IS NULL OR LENGTH(public_id) != 32
`).all();
if (usersWithoutPublicId.length > 0) {
  console.log(`[Startup] Generating public_ids for ${usersWithoutPublicId.length} users`);
  const updateStmt = db.prepare('UPDATE users SET public_id = ? WHERE id = ?');
  for (const user of usersWithoutPublicId) {
    const publicId = crypto.randomBytes(16).toString('hex');
    console.log(`[Startup] User ${user.id}: old public_id="${user.public_id}" -> new public_id="${publicId}"`);
    updateStmt.run(publicId, user.id);
  }
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
  db.exec(`ALTER TABLE agreements ADD COLUMN borrower_phone TEXT;`);
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

// Add overpayment tracking columns to payments table
try {
  db.exec(`ALTER TABLE payments ADD COLUMN applied_amount_cents INTEGER NOT NULL DEFAULT 0;`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE payments ADD COLUMN overpaid_amount_cents INTEGER NOT NULL DEFAULT 0;`);
} catch (e) {
  // Column already exists, ignore
}

// Migrate existing payment data: set applied_amount_cents = amount_cents for all existing rows where applied_amount_cents is still 0
try {
  const existingPayments = db.prepare(`SELECT id, amount_cents, applied_amount_cents FROM payments WHERE applied_amount_cents = 0`).all();
  if (existingPayments.length > 0) {
    const updateStmt = db.prepare(`UPDATE payments SET applied_amount_cents = amount_cents WHERE id = ?`);
    for (const payment of existingPayments) {
      updateStmt.run(payment.id);
    }
  }
} catch (e) {
  // Migration already done or error, ignore
}

// Add accepted_at column to agreements table
try {
  db.exec(`ALTER TABLE agreements ADD COLUMN accepted_at TEXT;`);
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

// Initial payment proof upload configuration
const initialPaymentProofStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/payments/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'initial-payment-proof-' + uniqueSuffix + ext);
  }
});

const uploadInitialPaymentProof = multer({
  storage: initialPaymentProofStorage,
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
// Uses applied_amount_cents to ensure overpayments don't reduce outstanding below 0
function getPaymentTotals(agreementId) {
  const result = db.prepare(`
    SELECT COALESCE(SUM(applied_amount_cents), 0) as total_paid_cents
    FROM payments
    WHERE agreement_id = ? AND status = 'approved'
  `).get(agreementId);

  return {
    total_paid_cents: result.total_paid_cents
  };
}

/**
 * Enrich a raw agreement with display-friendly fields for UI
 * This is the single source of truth for agreement display data
 * Used by /api/agreements, /app dashboard, and wizard Step 5
 */
function enrichAgreementForDisplay(agreement, currentUserId) {
  const totals = getPaymentTotals(agreement.id);
  const isLender = agreement.lender_user_id === currentUserId;

  // Determine counterparty name and role
  let counterpartyName;
  let roleLabel;

  if (isLender) {
    counterpartyName = agreement.borrower_full_name || agreement.friend_first_name || agreement.borrower_email;
    roleLabel = 'You lent';
  } else {
    counterpartyName = agreement.lender_full_name || agreement.lender_name || agreement.lender_email;
    roleLabel = 'You borrowed';
  }

  // Calculate outstanding using dynamic interest
  const interestInfo = getAgreementInterestInfo(agreement, new Date());
  const totalDueCentsToday = interestInfo.total_due_cents;
  const plannedTotalCents = interestInfo.planned_total_due_cents;

  let outstandingCents = totalDueCentsToday - totals.total_paid_cents;
  if (outstandingCents < 0) outstandingCents = 0;

  // Format amounts (formatCurrency0 returns "€ 6.000" with symbol)
  const principalFormatted = formatCurrency0(agreement.amount_cents);
  const totalToRepayFormatted = formatCurrency0(plannedTotalCents);
  const outstandingFormatted = formatCurrency0(outstandingCents);

  // Calculate next payment amount and date label
  let nextPaymentLabel = null;
  let nextPaymentAmountFormatted = null;
  let nextPaymentDate = null;
  let nextPaymentAmountCents = null;

  if (agreement.status === 'active' || agreement.status === 'pending') {
    if (agreement.repayment_type === 'one_time') {
      // For one-time: show full total due and due date
      const dueDate = new Date(agreement.due_date);
      nextPaymentLabel = formatDateShort(dueDate);
      nextPaymentAmountFormatted = totalToRepayFormatted;
      nextPaymentDate = agreement.due_date;
      nextPaymentAmountCents = plannedTotalCents;
    } else if (agreement.repayment_type === 'installments' && agreement.first_payment_date) {
      // For installments: show first payment date and installment amount
      // TODO: Calculate actual next unpaid installment date and amount
      const firstPayment = new Date(agreement.first_payment_date);
      nextPaymentLabel = formatDateShort(firstPayment);
      nextPaymentDate = agreement.first_payment_date;
      // Use installment amount if available, otherwise divide total by number of installments
      if (agreement.installment_amount) {
        const amountCents = Math.round(agreement.installment_amount * 100);
        nextPaymentAmountFormatted = formatCurrency0(amountCents);
        nextPaymentAmountCents = amountCents;
      } else if (agreement.installment_count && agreement.installment_count > 0) {
        const perInstallment = Math.round(plannedTotalCents / agreement.installment_count);
        nextPaymentAmountFormatted = formatCurrency0(perInstallment);
        nextPaymentAmountCents = perInstallment;
      }
    }
  } else if (agreement.status === 'settled') {
    nextPaymentLabel = 'Paid off';
    nextPaymentAmountFormatted = null;
  }

  // Generate full repayment schedule for timeline (only for active agreements)
  let futurePayments = [];
  if (agreement.status === 'active' && agreement.accepted_at) {
    try {
      const { generateRepaymentSchedule } = require('./lib/repayments/repaymentSchedule.js');

      const loanStartDate = agreement.money_sent_date || agreement.accepted_at;
      const config = {
        principal: agreement.amount_cents,
        annualInterestRate: agreement.interest_rate || 0,
        repaymentType: agreement.repayment_type || 'one_time',
        numInstallments: agreement.installment_count || 1,
        paymentFrequency: agreement.payment_frequency || 'once',
        loanStartMode: 'fixed_date',
        loanStartDate: loanStartDate,
        firstPaymentOffsetDays: agreement.first_payment_offset_days || 0,
        context: {
          preview: false,
          agreementStatus: 'active',
          hasRealStartDate: true
        }
      };

      const schedule = generateRepaymentSchedule(config);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Filter to future payments only
      futurePayments = schedule.rows
        .filter(row => row.date && new Date(row.date) >= today)
        .map(row => ({
          date: row.date.toISOString().split('T')[0],
          dateLabel: row.dateLabel,
          amountCents: row.totalPayment,
          amountFormatted: formatCurrency0(row.totalPayment)
        }));
    } catch (err) {
      console.error('Error generating repayment schedule for agreement', agreement.id, err);
    }
  }

  // Generate avatar initials and color
  const initials = getInitials(counterpartyName);
  const colorClass = getColorClassFromName(counterpartyName);

  // Get counterparty profile picture and user ID
  const counterpartyUserId = isLender ? agreement.borrower_user_id : agreement.lender_user_id;
  const counterpartyProfilePicture = isLender ? agreement.borrower_profile_picture : agreement.lender_profile_picture;
  const counterpartyProfilePictureUrl = counterpartyProfilePicture && counterpartyUserId
    ? `/api/profile/picture/${counterpartyUserId}`
    : null;

  // Check for open hardship requests
  const hasOpenDifficulty = db.prepare(`
    SELECT COUNT(*) as count
    FROM hardship_requests
    WHERE agreement_id = ?
  `).get(agreement.id).count > 0;

  // Check for open renegotiation requests
  const hasOpenRenegotiation = db.prepare(`
    SELECT COUNT(*) as count
    FROM renegotiation_requests
    WHERE agreement_id = ? AND status = 'open'
  `).get(agreement.id).count > 0;

  // Check for pending payments that need lender confirmation
  const hasPendingPaymentToConfirm = isLender && db.prepare(`
    SELECT COUNT(*) as count
    FROM payments
    WHERE agreement_id = ? AND status = 'pending'
  `).get(agreement.id).count > 0;

  // Check for pending initial payment report (lender needs to report)
  // Only show this task if:
  // - User is lender
  // - Agreement is active
  // - Loan start is "upon acceptance" (money_sent_date is on-acceptance or matches accepted_at)
  // - No completed report exists (either no row OR is_completed = 0)
  let needsInitialPaymentReport = false;
  if (isLender && agreement.status === 'active') {
    const moneySentDate = agreement.money_sent_date;
    const acceptedDate = agreement.accepted_at ? agreement.accepted_at.split('T')[0] : null;
    const isUponAcceptance = moneySentDate === 'on-acceptance' ||
                             moneySentDate === 'upon agreement acceptance' ||
                             (acceptedDate && moneySentDate === acceptedDate);

    if (isUponAcceptance) {
      // Check if there's a completed report
      const report = db.prepare(`
        SELECT is_completed FROM initial_payment_reports WHERE agreement_id = ?
      `).get(agreement.id);

      // Show task if no report exists OR report exists but not completed
      needsInitialPaymentReport = !report || report.is_completed === 0;
    }
  }

  // Return enriched agreement
  return {
    ...agreement,
    // Core identifiers
    id: agreement.id,
    status: agreement.status,

    // Display fields
    counterpartyName,
    roleLabel,
    statusLabel: agreement.status.charAt(0).toUpperCase() + agreement.status.slice(1),

    // Amounts (formatted strings already include € symbol)
    principalFormatted,        // "€ 6.000" - base loan amount
    totalToRepayFormatted,     // "€ 6.300" - total with interest
    outstandingFormatted,      // "€ 6.300" - what's left to pay (after payments)
    outstandingCents,          // cents value for calculations
    totalCents: plannedTotalCents,
    totalPaidCents: totals.total_paid_cents,

    // Next payment info
    nextPaymentLabel,          // "27 Nov 2026" or "Paid off"
    nextPaymentAmountFormatted, // "€ 6.300" - amount of next payment
    nextPaymentDate,           // ISO date string
    nextPaymentAmountCents,    // cents value

    // Full repayment schedule (future payments only)
    futurePayments,

    // Avatar info
    avatarInitials: initials,  // "BO"
    avatarColorClass: colorClass, // "color-1" etc
    avatarUrl: counterpartyProfilePictureUrl, // URL or null

    // Flags
    isLender,
    hasOpenDifficulty,
    hasOpenRenegotiation,
    hasPendingPaymentToConfirm,
    needsInitialPaymentReport
  };
}

/**
 * Get initials from a name (e.g., "Alex Smith" -> "AS", "Alex" -> "A")
 */
function getInitials(name) {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Get consistent color class based on name hash
 */
function getColorClassFromName(name) {
  if (!name) return 'color-1';
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = (Math.abs(hash) % 7) + 1; // 1-7
  return `color-${colorIndex}`;
}

/**
 * Format a date as short locale string (e.g., "26 Nov 2026")
 */
function formatDateShort(date) {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;

  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

// get the total amount due for an agreement (principal + interest if available)
// DEPRECATED: Use getAgreementInterestInfo instead for dynamic interest calculation
function getAgreementTotalDueCents(agreement) {
  if (agreement.total_repay_amount != null) {
    // total_repay_amount is stored as a REAL in euros, convert to cents
    return Math.round(agreement.total_repay_amount * 100);
  }
  return agreement.amount_cents;
}

/**
 * Calculate dynamic daily interest for an agreement as of a specific date
 * For one-time loans, interest accrues daily based on actual time the money was held
 * Interest is capped at the planned maximum (from start date to full repayment date)
 *
 * @param {Object} agreement - Agreement object from database
 * @param {Date} asOfDate - Date to calculate interest for (defaults to today)
 * @returns {Object} Interest information including principal, interest, totals
 */
function getAgreementInterestInfo(agreement, asOfDate = new Date()) {
  const principalCents = agreement.amount_cents;

  // For installments or agreements without interest rate, use static calculation
  if (agreement.repayment_type === 'installments' || !agreement.interest_rate) {
    const plannedTotalDueCents = getAgreementTotalDueCents(agreement);
    const plannedInterestMaxCents = plannedTotalDueCents - principalCents;

    return {
      principal_cents: principalCents,
      interest_cents: plannedInterestMaxCents,
      total_due_cents: plannedTotalDueCents,
      planned_interest_max_cents: plannedInterestMaxCents,
      planned_total_due_cents: plannedTotalDueCents,
      as_of_date: asOfDate
    };
  }

  // One-time loan with interest - calculate dynamic daily interest
  const annualRate = agreement.interest_rate / 100; // Convert percentage to decimal
  const loanStartDate = agreement.money_sent_date ? new Date(agreement.money_sent_date) : null;
  const plannedDueDate = agreement.due_date ? new Date(agreement.due_date) : null;

  // If no start date or it's in the future, no interest yet
  if (!loanStartDate || loanStartDate > asOfDate) {
    return {
      principal_cents: principalCents,
      interest_cents: 0,
      total_due_cents: principalCents,
      planned_interest_max_cents: 0,
      planned_total_due_cents: principalCents,
      as_of_date: asOfDate
    };
  }

  // Calculate days held (from start date to asOfDate)
  const msPerDay = 24 * 60 * 60 * 1000;
  const loanStartDateOnly = new Date(loanStartDate.getFullYear(), loanStartDate.getMonth(), loanStartDate.getDate());
  const asOfDateOnly = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), asOfDate.getDate());
  const daysHeld = Math.max(0, Math.floor((asOfDateOnly - loanStartDateOnly) / msPerDay));

  // Calculate planned maximum interest (from start to due date)
  let plannedDays = 0;
  let plannedInterestMaxCents = 0;

  if (plannedDueDate) {
    const plannedDueDateOnly = new Date(plannedDueDate.getFullYear(), plannedDueDate.getMonth(), plannedDueDate.getDate());
    plannedDays = Math.max(0, Math.floor((plannedDueDateOnly - loanStartDateOnly) / msPerDay));
    const dailyRate = annualRate / 365;
    plannedInterestMaxCents = Math.round(principalCents * dailyRate * plannedDays);
  }

  // Calculate actual interest for days held
  const dailyRate = annualRate / 365;
  const rawInterestCents = principalCents * dailyRate * daysHeld;

  // Cap interest at planned maximum
  const interestCents = Math.min(Math.round(rawInterestCents), plannedInterestMaxCents);

  const totalDueCents = principalCents + interestCents;
  const plannedTotalDueCents = principalCents + plannedInterestMaxCents;

  return {
    principal_cents: principalCents,
    interest_cents: interestCents,
    total_due_cents: totalDueCents,
    planned_interest_max_cents: plannedInterestMaxCents,
    planned_total_due_cents: plannedTotalDueCents,
    as_of_date: asOfDate
  };
}

/**
 * Derive the loan start date display string based on agreement status and money_sent_date
 * Now uses the centralized loan start label helper for consistency
 *
 * Rules:
 * - PENDING: Show wizard choice ("When agreement is accepted" or concrete date)
 * - ACTIVE/SETTLED: Show actual start date (derived from accepted_at if needed) or soft fallback
 *
 * @param {Object} agreement - Agreement object from database
 * @param {string|null} acceptedAt - ISO timestamp when agreement was accepted (from agreement_invites)
 * @returns {string} Display-ready loan start date string
 */
function getLoanStartDateDisplay(agreement, acceptedAt = null) {
  const { getLoanStartLabel } = require('./lib/repayments/loanStartLabels.js');

  const status = agreement.status;
  const moneySentDate = agreement.money_sent_date;

  // Determine loan start mode and date
  let loanStartMode;
  let loanStartDate = null;

  if (moneySentDate === 'on-acceptance') {
    loanStartMode = 'upon_acceptance';
    // If agreement is active/settled and we have acceptedAt, that's the actual date
    if ((status === 'active' || status === 'settled') && acceptedAt) {
      loanStartDate = acceptedAt;
    }
  } else if (moneySentDate) {
    loanStartMode = 'fixed_date';
    loanStartDate = moneySentDate;
  } else {
    // Edge case: no money_sent_date set (shouldn't happen in normal flow)
    return 'To be confirmed';
  }

  // Use centralized helper
  return getLoanStartLabel(loanStartMode, loanStartDate);
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
    const publicId = crypto.randomBytes(16).toString('hex');

    // Create user
    const result = db.prepare(`
      INSERT INTO users (email, password_hash, created_at, full_name, phone_number, timezone, public_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(email, passwordHash, createdAt, fullName || null, phoneNumber || null, timezone || null, publicId);

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
  const user = { ...req.user };

  // If user has no phone number set, try to get it from invite (for borrowers)
  // This provides a fallback phone for My Profile pre-fill
  if (!user.phone_number) {
    try {
      // Get the most recent agreement where this user is the borrower
      // and the lender provided a phone number during invite
      const invitePhone = db.prepare(`
        SELECT borrower_phone
        FROM agreements
        WHERE borrower_user_id = ? AND borrower_phone IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1
      `).get(user.id);

      if (invitePhone && invitePhone.borrower_phone) {
        user.invitePhoneFallback = invitePhone.borrower_phone;
      }
    } catch (err) {
      console.error('Error fetching invite phone fallback:', err);
      // Don't fail the request, just skip the fallback
    }
  }

  res.json({ user });
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

// Change password
app.post('/api/security/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  try {
    // Get current user's password hash
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(newPasswordHash, req.user.id);

    res.json({ success: true });
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ error: 'Server error while changing password' });
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
      u_borrower.profile_picture as borrower_profile_picture,
      COALESCE(a.accepted_at, invite.accepted_at) as accepted_at
    FROM agreements a
    LEFT JOIN users u_lender ON a.lender_user_id = u_lender.id
    LEFT JOIN users u_borrower ON a.borrower_user_id = u_borrower.id
    LEFT JOIN agreement_invites invite ON a.id = invite.agreement_id
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

    // Check for pending initial payment report (lender needs to report)
    // Only show this task if:
    // - User is lender
    // - Agreement is active
    // - Loan start is "upon acceptance" (money_sent_date is on-acceptance or matches accepted_at)
    // - No completed report exists (either no row OR is_completed = 0)
    let needsInitialPaymentReport = false;
    if (isLender && agreement.status === 'active') {
      const moneySentDate = agreement.money_sent_date;
      const acceptedDate = agreement.accepted_at ? agreement.accepted_at.split('T')[0] : null;
      const isUponAcceptance = moneySentDate === 'on-acceptance' ||
                               moneySentDate === 'upon agreement acceptance' ||
                               (acceptedDate && moneySentDate === acceptedDate);

      if (isUponAcceptance) {
        // Check if there's a completed report
        const report = db.prepare(`
          SELECT is_completed FROM initial_payment_reports WHERE agreement_id = ?
        `).get(agreement.id);

        // Show task if no report exists OR report exists but not completed
        needsInitialPaymentReport = !report || report.is_completed === 0;
      }
    }

    // Calculate outstanding based on dynamic interest
    const interestInfo = getAgreementInterestInfo(agreement, new Date());
    const totalDueCentsToday = interestInfo.total_due_cents;
    const plannedTotalCents = interestInfo.planned_total_due_cents;

    let outstanding_cents = totalDueCentsToday - totals.total_paid_cents;
    if (outstanding_cents < 0) outstanding_cents = 0;

    return {
      ...agreement,
      total_paid_cents: totals.total_paid_cents,
      outstanding_cents,
      // For dashboard display: use planned total as the "Total" in "Outstanding / Total"
      planned_total_cents: plannedTotalCents,
      counterparty_name,
      counterparty_role,
      counterparty_profile_picture_url: isLender ? agreement.borrower_profile_picture : agreement.lender_profile_picture,
      hasOpenDifficulty,
      hasPendingPaymentToConfirm,
      needsInitialPaymentReport,
      isLender,
      // Include accepted_at to identify agreements cancelled before approval
      accepted_at: agreement.accepted_at
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

  // Worst case scenario (debt collection clause) is only allowed for loans >= 3000 EUR (300000 cents)
  const WORST_CASE_MIN_AMOUNT_CENTS = 300000; // 3000 EUR
  if (debtCollectionClause && amountCents < WORST_CASE_MIN_AMOUNT_CENTS) {
    // Silently ignore the flag for small loans instead of rejecting the request
    debtCollectionClause = false;
  }

  // Allow past dates for existing loans (no validation needed)

  const createdAt = new Date().toISOString();

  // Use user's full_name as lender_name if available, otherwise use provided lenderName
  const finalLenderName = req.user.full_name || lenderName || req.user.email;

  try {
    // Note: phoneNumber parameter is the BORROWER's phone (entered by lender in wizard)
    // We store it in the agreements table, not the users table
    // Validate borrower phone if provided
    if (phoneNumber && !/\d/.test(phoneNumber)) {
      return res.status(400).json({ error: 'Phone number must contain at least one digit' });
    }

    // Create agreement
    const agreementStmt = db.prepare(`
      INSERT INTO agreements (
        lender_user_id, lender_name, borrower_email, borrower_phone, friend_first_name,
        direction, repayment_type, amount_cents, money_sent_date, due_date, created_at, status, description,
        plan_length, plan_unit, installment_count, installment_amount, first_payment_date, final_due_date,
        interest_rate, total_interest, total_repay_amount,
        payment_preference_method, payment_methods_json, payment_other_description, reminder_mode, reminder_offsets,
        proof_required, debt_collection_clause, payment_frequency, one_time_due_option
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      phoneNumber || null, // Borrower's phone entered by lender
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

// ========================
// FRIENDS ENDPOINTS
// ========================

// Get list of friends for the current user
app.get('/api/friends', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;

    // Get all unique users this person has agreements with
    const friendsAsLender = db.prepare(`
      SELECT DISTINCT
        u.id as friend_id,
        u.public_id as friend_public_id,
        u.full_name,
        u.email,
        u.profile_picture
      FROM agreements a
      JOIN users u ON a.borrower_user_id = u.id
      WHERE a.lender_user_id = ? AND a.borrower_user_id IS NOT NULL
    `).all(userId);

    const friendsAsBorrower = db.prepare(`
      SELECT DISTINCT
        u.id as friend_id,
        u.public_id as friend_public_id,
        u.full_name,
        u.email,
        u.profile_picture
      FROM agreements a
      JOIN users u ON a.lender_user_id = u.id
      WHERE a.borrower_user_id = ? AND a.lender_user_id IS NOT NULL
    `).all(userId);

    // Combine and deduplicate friends
    const friendMap = new Map();

    for (const friend of friendsAsLender) {
      if (!friendMap.has(friend.friend_id)) {
        friendMap.set(friend.friend_id, {
          friendId: friend.friend_id, // Internal use only
          friendPublicId: friend.friend_public_id, // For URLs
          name: friend.full_name || friend.email,
          avatarUrl: friend.profile_picture,
          isLender: false,
          isBorrower: false,
          activeAgreementsCount: 0,
          settledAgreementsCount: 0
        });
      }
      friendMap.get(friend.friend_id).isLender = true;
    }

    for (const friend of friendsAsBorrower) {
      if (!friendMap.has(friend.friend_id)) {
        friendMap.set(friend.friend_id, {
          friendId: friend.friend_id, // Internal use only
          friendPublicId: friend.friend_public_id, // For URLs
          name: friend.full_name || friend.email,
          avatarUrl: friend.profile_picture,
          isLender: false,
          isBorrower: false,
          activeAgreementsCount: 0,
          settledAgreementsCount: 0
        });
      }
      friendMap.get(friend.friend_id).isBorrower = true;
    }

    // Get agreement counts for each friend
    for (const [friendId, friendData] of friendMap.entries()) {
      const counts = db.prepare(`
        SELECT
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
          SUM(CASE WHEN status = 'settled' THEN 1 ELSE 0 END) as settled_count
        FROM agreements
        WHERE (lender_user_id = ? AND borrower_user_id = ?)
           OR (lender_user_id = ? AND borrower_user_id = ?)
      `).get(userId, friendId, friendId, userId);

      friendData.activeAgreementsCount = counts.active_count || 0;
      friendData.settledAgreementsCount = counts.settled_count || 0;

      // Determine role summary
      if (friendData.isLender && friendData.isBorrower) {
        friendData.roleSummary = 'both';
      } else if (friendData.isLender) {
        friendData.roleSummary = 'you lent';
      } else {
        friendData.roleSummary = 'you borrowed';
      }

      // Clean up temporary flags
      delete friendData.isLender;
      delete friendData.isBorrower;
    }

    const friends = Array.from(friendMap.values());
    res.json({ friends });

  } catch (err) {
    console.error('Error fetching friends:', err);
    res.status(500).json({ error: 'Server error fetching friends.' });
  }
});

// Get profile for a specific friend
app.get('/api/friends/:friendPublicId', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const friendPublicId = req.params.friendPublicId;

    console.log('[Friend Profile] ========== START ==========');
    console.log('[Friend Profile] Request from userId:', userId, 'for friendPublicId:', friendPublicId);
    console.log('[Friend Profile] friendPublicId length:', friendPublicId ? friendPublicId.length : 'null');

    if (!friendPublicId || typeof friendPublicId !== 'string') {
      console.log('[Friend Profile] Invalid friend ID - empty or wrong type');
      return res.status(400).json({ error: 'Invalid friend ID.' });
    }

    // Validate public_id format (should be 32-character hex string)
    if (friendPublicId.length !== 32 || !/^[a-f0-9]{32}$/.test(friendPublicId)) {
      console.log('[Friend Profile] Invalid friend ID format - expected 32 hex chars, got:', friendPublicId);
      return res.status(400).json({ error: 'Friend not found or no longer accessible.' });
    }

    // Look up friend by public ID
    const friend = db.prepare(`
      SELECT id, public_id, full_name, email, phone_number, timezone, profile_picture
      FROM users
      WHERE public_id = ?
    `).get(friendPublicId);

    if (!friend) {
      console.log('[Friend Profile] Friend NOT found for public_id:', friendPublicId);
      console.log('[Friend Profile] Checking if any user has this public_id...');
      const anyUser = db.prepare(`SELECT COUNT(*) as count FROM users WHERE public_id = ?`).get(friendPublicId);
      console.log('[Friend Profile] Users with this public_id:', anyUser.count);
      console.log('[Friend Profile] Checking if public_id is NULL for any users...');
      const nullCount = db.prepare(`SELECT COUNT(*) as count FROM users WHERE public_id IS NULL`).get();
      console.log('[Friend Profile] Users with NULL public_id:', nullCount.count);
      return res.status(404).json({ error: 'Friend not found or no longer accessible.' });
    }

    console.log('[Friend Profile] Found friend - id:', friend.id, 'name:', friend.full_name, 'public_id:', friend.public_id);

    const friendId = friend.id;

    // SECURITY: Check if current user actually has agreements with this friend
    const hasRelationship = db.prepare(`
      SELECT COUNT(*) as count
      FROM agreements
      WHERE (lender_user_id = ? AND borrower_user_id = ?)
         OR (lender_user_id = ? AND borrower_user_id = ?)
    `).get(userId, friendId, friendId, userId);

    console.log('[Friend Profile] Relationship check - agreements count:', hasRelationship.count);

    if (hasRelationship.count === 0) {
      // User is trying to access someone they have no agreements with
      console.log('[Friend Profile] No relationship found between userId:', userId, 'and friendId:', friendId);
      return res.status(404).json({ error: 'Friend not found or no longer accessible.' });
    }

    // Check if current user is lender in any agreement with this friend
    const isLenderInAny = db.prepare(`
      SELECT COUNT(*) as count
      FROM agreements
      WHERE lender_user_id = ? AND borrower_user_id = ?
    `).get(userId, friendId);

    const canSeeContact = isLenderInAny.count > 0;

    // Get borrower phone from agreement if lender is viewing
    // This is the phone the lender entered during agreement creation
    let agreementBorrowerPhone = null;
    if (canSeeContact) {
      const agreementWithPhone = db.prepare(`
        SELECT borrower_phone
        FROM agreements
        WHERE lender_user_id = ? AND borrower_user_id = ? AND borrower_phone IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1
      `).get(userId, friendId);

      if (agreementWithPhone && agreementWithPhone.borrower_phone) {
        agreementBorrowerPhone = agreementWithPhone.borrower_phone;
      }
    }

    // Get all agreements with this friend
    const agreements = db.prepare(`
      SELECT
        id,
        lender_user_id,
        borrower_user_id,
        amount_cents,
        status,
        description,
        created_at,
        repayment_type,
        total_repay_amount
      FROM agreements
      WHERE (lender_user_id = ? AND borrower_user_id = ?)
         OR (lender_user_id = ? AND borrower_user_id = ?)
      ORDER BY created_at DESC
    `).all(userId, friendId, friendId, userId);

    // Format agreements for response
    console.log('[Friend Profile] Found', agreements.length, 'agreements');
    const agreementsWithThisFriend = agreements.map(agr => {
      console.log('[Friend Profile] Processing agreement', agr.id, '- lender:', agr.lender_user_id, 'borrower:', agr.borrower_user_id);
      return {
        agreementId: agr.id,
        roleForCurrentUser: agr.lender_user_id === userId ? 'lender' : 'borrower',
        amountCents: agr.amount_cents || 0,
        totalRepayAmountCents: agr.total_repay_amount ? Math.round(agr.total_repay_amount * 100) : (agr.amount_cents || 0),
        status: agr.status || 'pending',
        description: agr.description || 'Loan',
        repaymentType: agr.repayment_type || 'one_time'
      };
    });

    // Build response
    const response = {
      friendId: friend.id, // Internal ID for profile picture endpoint
      friendPublicId: friend.public_id,
      name: friend.full_name || friend.email,
      avatarUrl: friend.profile_picture,
      timezone: friend.timezone || null,
      agreementsWithThisFriend
    };

    // Only include contact details if current user is lender
    if (canSeeContact) {
      response.friendCurrentEmail = friend.email;
      response.friendCurrentPhone = friend.phone_number || null; // Verified phone from user profile
      response.friendAgreementPhone = agreementBorrowerPhone; // Phone entered by lender during wizard
    }

    console.log('[Friend Profile] Returning profile with', agreementsWithThisFriend.length, 'agreements');
    res.json(response);

  } catch (err) {
    console.error('[Friend Profile] EXCEPTION caught:', err);
    console.error('[Friend Profile] Error stack:', err.stack);
    console.error('[Friend Profile] Error message:', err.message);
    console.error('[Friend Profile] Request params - userId:', req.user.id, 'friendPublicId:', req.params.friendPublicId);
    res.status(500).json({ error: 'Server error. Please try again later.' });
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

  console.log('[Agreement API] Fetching agreement', id, 'for user', req.user.id);

  try {
    const agreement = db.prepare(`
      SELECT a.*,
        u_lender.full_name as lender_full_name,
        u_lender.email as lender_email,
        u_lender.profile_picture as lender_profile_picture,
        u_lender.public_id as lender_public_id,
        u_borrower.full_name as borrower_full_name,
        u_borrower.email as borrower_email,
        u_borrower.profile_picture as borrower_profile_picture,
        u_borrower.public_id as borrower_public_id
      FROM agreements a
      LEFT JOIN users u_lender ON a.lender_user_id = u_lender.id
      LEFT JOIN users u_borrower ON a.borrower_user_id = u_borrower.id
      WHERE a.id = ? AND (a.lender_user_id = ? OR a.borrower_user_id = ?)
    `).get(id, req.user.id, req.user.id);

    if (!agreement) {
      console.log('[Agreement API] Agreement not found or user lacks access');
      return res.status(404).json({ error: 'Agreement not found' });
    }

    console.log('[Agreement API] Agreement found - lender_public_id:', agreement.lender_public_id, 'borrower_public_id:', agreement.borrower_public_id);

    // Get accepted_at timestamp (prefer from agreements table, fallback to invites)
    let acceptedAt = agreement.accepted_at;
    if (!acceptedAt) {
      const invite = db.prepare(`
        SELECT accepted_at FROM agreement_invites WHERE agreement_id = ? ORDER BY created_at DESC LIMIT 1
      `).get(id);
      acceptedAt = invite ? invite.accepted_at : null;
    }

    // Add payment totals and calculate outstanding with dynamic interest
    const totals = getPaymentTotals(id);
    const interestInfo = getAgreementInterestInfo(agreement, new Date());

    const totalDueCentsToday = interestInfo.total_due_cents;
    let outstanding_cents = totalDueCentsToday - totals.total_paid_cents;
    if (outstanding_cents < 0) outstanding_cents = 0;

    // Derive loan start date display
    const loanStartDateDisplay = getLoanStartDateDisplay(agreement, acceptedAt);

    const agreementWithTotals = {
      ...agreement,
      total_paid_cents: totals.total_paid_cents,
      outstanding_cents,
      // Dynamic interest fields for manage view
      today_total_due_cents: interestInfo.total_due_cents,
      today_interest_cents: interestInfo.interest_cents,
      planned_total_due_cents: interestInfo.planned_total_due_cents,
      planned_interest_max_cents: interestInfo.planned_interest_max_cents,
      // Loan start date display
      loan_start_date_display: loanStartDateDisplay
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
    const nowDate = now.split('T')[0]; // YYYY-MM-DD format

    // Check if money_sent_date needs to be updated
    const moneySentDate = agreement.money_sent_date;
    const shouldUpdateMoneySentDate = !moneySentDate ||
                                       moneySentDate === 'on-acceptance' ||
                                       moneySentDate === 'upon agreement acceptance';

    // Update agreement status and dates
    if (shouldUpdateMoneySentDate) {
      db.prepare(`
        UPDATE agreements
        SET status = 'active',
            accepted_at = ?,
            money_sent_date = ?
        WHERE id = ?
      `).run(now, nowDate, id);
    } else {
      db.prepare(`
        UPDATE agreements
        SET status = 'active',
            accepted_at = ?
        WHERE id = ?
      `).run(now, id);
    }

    // If loan start is upon acceptance, create a pending initial payment report for lender
    if (shouldUpdateMoneySentDate) {
      // Check if a report already exists
      const existingReport = db.prepare(`
        SELECT id FROM initial_payment_reports WHERE agreement_id = ?
      `).get(id);

      if (!existingReport) {
        db.prepare(`
          INSERT INTO initial_payment_reports (
            agreement_id,
            reported_by_user_id,
            created_at,
            is_completed
          ) VALUES (?, ?, ?, 0)
        `).run(id, agreement.lender_user_id, now);
      }
    }

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

// Get initial payment report status (lender and borrower can access)
app.get('/api/agreements/:id/initial-payment-report', requireAuth, (req, res) => {
  const { id } = req.params;

  try {
    // Get agreement
    const agreement = db.prepare(`
      SELECT * FROM agreements WHERE id = ?
    `).get(id);

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    // Verify user is lender or borrower
    if (agreement.lender_user_id !== req.user.id && agreement.borrower_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to access this agreement' });
    }

    // Get payment report
    const report = db.prepare(`
      SELECT * FROM initial_payment_reports WHERE agreement_id = ?
    `).get(id);

    if (!report) {
      return res.json({ success: true, data: null });
    }

    res.json({
      success: true,
      data: {
        id: report.id,
        agreementId: report.agreement_id,
        paymentMethod: report.payment_method,
        reportedAt: report.reported_at,
        isCompleted: report.is_completed === 1,
        hasProof: !!report.proof_file_path
      }
    });
  } catch (err) {
    console.error('Error fetching initial payment report:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit initial payment report (lender only)
app.post('/api/agreements/:id/initial-payment-report', requireAuth, uploadInitialPaymentProof.single('proof'), (req, res) => {
  const { id } = req.params;
  const { paymentMethod } = req.body || {};

  try {
    // Get agreement
    const agreement = db.prepare(`
      SELECT a.*,
        u_borrower.full_name as borrower_full_name,
        u_borrower.email as borrower_email
      FROM agreements a
      LEFT JOIN users u_borrower ON a.borrower_user_id = u_borrower.id
      WHERE a.id = ?
    `).get(id);

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    // Verify user is the lender
    if (agreement.lender_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the lender can report the initial payment' });
    }

    // Verify agreement is active
    if (agreement.status !== 'active') {
      return res.status(400).json({ error: 'Agreement must be active to report initial payment' });
    }

    // Verify loan start is upon acceptance
    const moneySentDate = agreement.money_sent_date;
    const isUponAcceptance = !moneySentDate || moneySentDate === 'on-acceptance' ||
                             moneySentDate === 'upon agreement acceptance' ||
                             (agreement.accepted_at && moneySentDate === agreement.accepted_at.split('T')[0]);

    if (!isUponAcceptance) {
      return res.status(400).json({ error: 'Initial payment report is only for agreements with loan start upon acceptance' });
    }

    const now = new Date().toISOString();

    // Get or create payment report
    let report = db.prepare(`
      SELECT * FROM initial_payment_reports WHERE agreement_id = ?
    `).get(id);

    if (!report) {
      db.prepare(`
        INSERT INTO initial_payment_reports (
          agreement_id,
          reported_by_user_id,
          created_at,
          is_completed
        ) VALUES (?, ?, ?, 0)
      `).run(id, req.user.id, now);

      report = db.prepare(`
        SELECT * FROM initial_payment_reports WHERE agreement_id = ?
      `).get(id);
    }

    // Check if already completed
    if (report.is_completed === 1) {
      return res.status(400).json({ error: 'Initial payment has already been reported' });
    }

    // Update the report
    const proofFilePath = req.file ? req.file.path : null;
    const proofOriginalName = req.file ? req.file.originalname : null;
    const proofMimeType = req.file ? req.file.mimetype : null;

    db.prepare(`
      UPDATE initial_payment_reports
      SET payment_method = ?,
          proof_file_path = ?,
          proof_original_name = ?,
          proof_mime_type = ?,
          reported_at = ?,
          is_completed = 1
      WHERE id = ?
    `).run(
      paymentMethod || null,
      proofFilePath,
      proofOriginalName,
      proofMimeType,
      now,
      report.id
    );

    // Create activity message for borrower
    const lenderName = req.user.full_name || agreement.lender_name || req.user.email;
    const lenderFirstName = lenderName.split(' ')[0];

    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      agreement.borrower_user_id,
      id,
      'Initial payment reported',
      `${lenderFirstName} reported the initial payment for your loan agreement.`,
      now,
      'LENDER_REPORTED_INITIAL_PAYMENT'
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error submitting initial payment report:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get initial payment report proof file (lender and borrower only)
app.get('/api/agreements/:id/initial-payment-report/proof', requireAuth, (req, res) => {
  const { id } = req.params;

  try {
    // Get agreement
    const agreement = db.prepare(`
      SELECT * FROM agreements WHERE id = ?
    `).get(id);

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    // Verify user is lender or borrower
    if (agreement.lender_user_id !== req.user.id && agreement.borrower_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to access this proof' });
    }

    // Get payment report
    const report = db.prepare(`
      SELECT * FROM initial_payment_reports WHERE agreement_id = ?
    `).get(id);

    if (!report || !report.proof_file_path) {
      return res.status(404).json({ error: 'Proof file not found' });
    }

    // Serve the file
    res.sendFile(path.resolve(report.proof_file_path));
  } catch (err) {
    console.error('Error fetching proof file:', err);
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

    // Calculate current outstanding BEFORE this payment
    const totals = getPaymentTotals(id);
    const interestInfo = getAgreementInterestInfo(agreement, new Date());
    const currentOutstandingCents = Math.max(0, interestInfo.total_due_cents - totals.total_paid_cents);

    // Compute overpayment handling
    const reportedAmountCents = amountCents;
    const appliedAmountCents = Math.min(reportedAmountCents, currentOutstandingCents);
    const overpaidAmountCents = Math.max(0, reportedAmountCents - appliedAmountCents);

    // Handle proof of payment file if uploaded
    let proofFilePath = null;
    let proofOriginalName = null;
    let proofMimeType = null;

    if (req.file) {
      proofFilePath = '/uploads/payments/' + path.basename(req.file.path);
      proofOriginalName = req.file.originalname;
      proofMimeType = req.file.mimetype;
    }

    // Insert payment with proof fields and overpayment tracking
    const result = db.prepare(`
      INSERT INTO payments (agreement_id, recorded_by_user_id, amount_cents, applied_amount_cents, overpaid_amount_cents, method, note, created_at, status, proof_file_path, proof_original_name, proof_mime_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.user.id, reportedAmountCents, appliedAmountCents, overpaidAmountCents, method || null, note || null, now, paymentStatus, proofFilePath, proofOriginalName, proofMimeType);

    const paymentId = result.lastInsertRowid;

    // Create activity events based on who recorded the payment
    if (isBorrower) {
      // Borrower reported a payment - pending approval
      const borrowerName = agreement.borrower_full_name || agreement.friend_first_name || agreement.borrower_email;
      const lenderName = agreement.lender_full_name || agreement.lender_name;
      const amountFormatted = formatCurrency2(reportedAmountCents);

      // Build message with optional overpayment note
      let borrowerMsg = `You reported a payment of ${amountFormatted}`;
      let lenderMsg = `${borrowerName} reported a payment of ${amountFormatted}`;

      if (overpaidAmountCents > 0) {
        const overpaidFormatted = formatCurrency2(overpaidAmountCents);
        borrowerMsg += `. This fully repaid the loan. Includes ${overpaidFormatted} overpayment`;
        lenderMsg += `. The loan is now fully repaid. Includes ${overpaidFormatted} overpayment`;
      } else {
        borrowerMsg += ` — waiting for ${lenderName.split(' ')[0] || lenderName}'s confirmation`;
        lenderMsg += ` — please review`;
      }

      // Activity for borrower
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        req.user.id,
        id,
        'Payment reported',
        borrowerMsg + '.',
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
        lenderMsg + '.',
        now,
        'PAYMENT_REPORTED_LENDER'
      );
    } else if (isLender) {
      // Lender added a received payment - approved immediately
      const borrowerName = agreement.borrower_full_name || agreement.friend_first_name || agreement.borrower_email;
      const lenderName = agreement.lender_full_name || agreement.lender_name;
      const amountFormatted = formatCurrency2(reportedAmountCents);

      // Build message with optional overpayment note
      let lenderMsg = `You recorded a payment of ${amountFormatted} from ${borrowerName}`;
      let borrowerMsg = `${lenderName.split(' ')[0] || lenderName} confirmed a payment of ${amountFormatted}`;

      if (overpaidAmountCents > 0) {
        const overpaidFormatted = formatCurrency2(overpaidAmountCents);
        lenderMsg += `. The loan is now fully repaid. Includes ${overpaidFormatted} overpayment`;
        borrowerMsg += `. The loan is now fully repaid. Includes ${overpaidFormatted} overpayment`;
      }

      // Create activity messages for both parties
      // Activity for lender
      db.prepare(`
        INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        req.user.id,
        id,
        'Payment recorded',
        lenderMsg + '.',
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
          borrowerMsg + '.',
          now,
          'PAYMENT_RECORDED_BORROWER'
        );
      }

      // Check if loan is now fully paid after applying this payment
      // Use currentOutstandingCents - appliedAmountCents (calculated before payment was inserted)
      const newOutstanding = currentOutstandingCents - appliedAmountCents;

      // Auto-settle if fully paid
      if (newOutstanding <= 0 && agreement.status === 'active') {
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
        p.amount_cents as reported_amount_cents,
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
    // Get payment and agreement with overpayment fields
    const payment = db.prepare(`
      SELECT p.*,
        a.lender_user_id, a.borrower_user_id, a.amount_cents as agreement_amount_cents,
        a.total_repay_amount, a.status as agreement_status,
        a.repayment_type, a.interest_rate, a.money_sent_date, a.due_date,
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

    // Check for overpayment
    const hasOverpayment = payment.overpaid_amount_cents > 0;
    const overpaidFormatted = hasOverpayment ? formatCurrency2(payment.overpaid_amount_cents) : null;

    // Build message with optional overpayment note
    let lenderMsg = `You confirmed a payment of ${amountFormatted} from ${borrowerName}`;
    let borrowerMsg = `${lenderName.split(' ')[0] || lenderName} confirmed your payment of ${amountFormatted}`;

    if (hasOverpayment) {
      lenderMsg += `. The loan is now fully repaid. Includes ${overpaidFormatted} overpayment`;
      borrowerMsg += `. The loan is now fully repaid. Includes ${overpaidFormatted} overpayment`;
    }

    // Create activity for lender
    db.prepare(`
      INSERT INTO messages (user_id, agreement_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      payment.agreement_id,
      'Payment confirmed',
      lenderMsg + '.',
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
        borrowerMsg + '.',
        now,
        'PAYMENT_APPROVED_BORROWER'
      );
    }

    // Recompute totals (including this newly approved payment)
    const totals = getPaymentTotals(payment.agreement_id);
    // Create agreement object for helper function
    const agreement = {
      amount_cents: payment.agreement_amount_cents,
      total_repay_amount: payment.total_repay_amount,
      repayment_type: payment.repayment_type,
      interest_rate: payment.interest_rate,
      money_sent_date: payment.money_sent_date,
      due_date: payment.due_date
    };
    const interestInfo = getAgreementInterestInfo(agreement, new Date());
    const totalDueCentsToday = interestInfo.total_due_cents;
    let outstanding = totalDueCentsToday - totals.total_paid_cents;
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

// Calculate repayment schedule (for playground)
app.post('/api/calculate-schedule', (req, res) => {
  try {
    const { generateRepaymentSchedule } = require('./lib/repayments/repaymentSchedule.js');
    const { getLoanStartLabel } = require('./lib/repayments/loanStartLabels.js');

    const config = req.body;

    // Generate schedule
    const result = generateRepaymentSchedule(config);

    // Add loan start label
    const loanStartLabel = getLoanStartLabel(
      config.loanStartMode,
      config.loanStartDate
    );

    res.json({
      ...result,
      loanStartLabel
    });
  } catch (err) {
    console.error('Error calculating schedule:', err);
    res.status(500).json({ error: err.message });
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

    // Build agreement object for loan start date derivation
    const agreementForDisplay = {
      status: invite.status,
      money_sent_date: invite.money_sent_date
    };
    const loanStartDateDisplay = getLoanStartDateDisplay(agreementForDisplay, invite.accepted_at);

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
        lender_full_name: lender ? lender.full_name : null,
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
        created_at: invite.created_at,
        loan_start_date_display: loanStartDateDisplay
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
    const nowDate = now.split('T')[0]; // YYYY-MM-DD format

    // Check if money_sent_date needs to be updated
    const moneySentDate = invite.money_sent_date;
    const shouldUpdateMoneySentDate = !moneySentDate ||
                                       moneySentDate === 'on-acceptance' ||
                                       moneySentDate === 'upon agreement acceptance';

    // Update agreement status, borrower_user_id, and dates
    if (shouldUpdateMoneySentDate) {
      db.prepare(`
        UPDATE agreements
        SET status = 'active',
            borrower_user_id = ?,
            fairness_accepted = ?,
            accepted_at = ?,
            money_sent_date = ?
        WHERE id = ?
      `).run(req.user.id, fairnessAccepted ? 1 : 0, now, nowDate, invite.agreement_id);
    } else {
      db.prepare(`
        UPDATE agreements
        SET status = 'active',
            borrower_user_id = ?,
            fairness_accepted = ?,
            accepted_at = ?
        WHERE id = ?
      `).run(req.user.id, fairnessAccepted ? 1 : 0, now, invite.agreement_id);
    }

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
  if (!req.user) {
    return res.redirect('/');
  }

  try {
    // Auto-link any pending agreements for this user
    autoLinkPendingAgreements(req.user.id, req.user.email, req.user.full_name);

    // Fetch agreements with all necessary joins
    const rawAgreements = db.prepare(`
      SELECT a.*,
        u_lender.full_name as lender_full_name,
        u_lender.email as lender_email,
        u_lender.profile_picture as lender_profile_picture,
        u_borrower.full_name as borrower_full_name,
        u_borrower.email as borrower_email,
        u_borrower.profile_picture as borrower_profile_picture,
        COALESCE(a.accepted_at, invite.accepted_at) as accepted_at
      FROM agreements a
      LEFT JOIN users u_lender ON a.lender_user_id = u_lender.id
      LEFT JOIN users u_borrower ON a.borrower_user_id = u_borrower.id
      LEFT JOIN agreement_invites invite ON a.id = invite.agreement_id
      WHERE lender_user_id = ? OR borrower_user_id = ?
      ORDER BY created_at DESC
    `).all(req.user.id, req.user.id);

    // Enrich all agreements using shared helper (single source of truth)
    const agreements = rawAgreements.map(a => enrichAgreementForDisplay(a, req.user.id));

    // Calculate stats from enriched agreements
    const totalAgreements = agreements.length;
    const totalPendingAgreements = agreements.filter(a => a.status === 'pending').length;
    const totalActiveAgreements = agreements.filter(a => a.status === 'active').length;
    const totalSettledAgreements = agreements.filter(a => a.status === 'settled').length;
    const totalOverdueAgreements = 0; // TODO: implement overdue tracking

    // GroupTabs not yet implemented, use empty array
    const groupTabs = [];
    const totalGroupTabs = groupTabs.length;

    // Take first 3 agreements for summary display (already enriched)
    const agreementsSummary = agreements.slice(0, 3);

    // Read the HTML template
    const htmlPath = path.join(__dirname, 'public', 'app.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    // Inject dashboard data as JSON
    const dashboardData = JSON.stringify({
      user: {
        id: req.user.id,
        email: req.user.email,
        fullName: req.user.full_name,
        firstName: req.user.full_name ? req.user.full_name.split(' ')[0] : req.user.email.split('@')[0],
        profile_picture_url: req.user.profile_picture ? `/api/profile/picture/${req.user.id}` : null
      },
      stats: {
        totalAgreements,
        totalPendingAgreements,
        totalActiveAgreements,
        totalSettledAgreements,
        totalOverdueAgreements,
        totalGroupTabs
      },
      agreementsSummary,
      agreements, // Include ALL agreements for pending tasks checking
      hasAnyAgreements: totalAgreements > 0,
      hasAnyGroupTabs: totalGroupTabs > 0,
      isZeroState: totalAgreements === 0 && totalGroupTabs === 0
    });

    // Replace the placeholder with actual data
    html = html.replace('/*DASHBOARD_DATA_INJECTION*/', `window.__DASHBOARD_DATA__ = ${dashboardData};`);

    res.send(html);
  } catch (err) {
    console.error('Error loading dashboard:', err);
    res.status(500).send('Error loading dashboard');
  }
});

// Profile pages: All profile routes now use app.html with client-side routing
// Profile
app.get('/app/profile', (req, res) => {
  if (req.user) {
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
  } else {
    res.redirect('/');
  }
});

// Settings
app.get('/app/settings', (req, res) => {
  if (req.user) {
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
  } else {
    res.redirect('/');
  }
});

// Security
app.get('/app/security', (req, res) => {
  if (req.user) {
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
  } else {
    res.redirect('/');
  }
});

// Redirect old profile routes to new routes
app.get('/profile', (req, res) => {
  res.redirect('/app/profile');
});

app.get('/settings', (req, res) => {
  res.redirect('/app/settings');
});

app.get('/security', (req, res) => {
  res.redirect('/app/security');
});

// Legal pages: All legal routes now use app.html with client-side routing
// Main legal index
app.get('/app/legal', (req, res) => {
  if (req.user) {
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
  } else {
    res.redirect('/');
  }
});

// Legal - Terms of Service
app.get('/app/legal/terms', (req, res) => {
  if (req.user) {
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
  } else {
    res.redirect('/');
  }
});

// Legal - Privacy Policy
app.get('/app/legal/privacy', (req, res) => {
  if (req.user) {
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
  } else {
    res.redirect('/');
  }
});

// Legal - Cookie Notice
app.get('/app/legal/cookies', (req, res) => {
  if (req.user) {
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
  } else {
    res.redirect('/');
  }
});

// Redirect old legal routes to new app/legal routes
app.get('/legal', (req, res) => {
  if (req.user) {
    res.redirect('/app/legal');
  } else {
    res.redirect('/');
  }
});

app.get('/legal/terms', (req, res) => {
  if (req.user) {
    res.redirect('/app/legal/terms');
  } else {
    res.redirect('/');
  }
});

app.get('/legal/privacy', (req, res) => {
  if (req.user) {
    res.redirect('/app/legal/privacy');
  } else {
    res.redirect('/');
  }
});

app.get('/legal/cookies', (req, res) => {
  if (req.user) {
    res.redirect('/app/legal/cookies');
  } else {
    res.redirect('/');
  }
});

// Calculator playground: internal testing page (no auth required)
app.get('/calculate', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'calculate.html'));
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

// Report initial payment (logged-in lender only)
app.get('/agreements/:id/report-payment', (req, res) => {
  if (!req.user) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'report-payment.html'));
});

// Legacy redirect: /view → /manage
app.get('/agreements/:id/view', (req, res) => {
  res.redirect(302, `/agreements/${req.params.id}/manage`);
});

// Friend profile route (serves friend-profile.html for clean URLs)
app.get('/friends/:publicId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'friend-profile.html'));
});

// Features page (serves features.html)
app.get('/features', (req, res) => {
  if (req.user) {
    res.sendFile(path.join(__dirname, 'public', 'features.html'));
  } else {
    res.redirect('/');
  }
});

// Agreements page (serves agreements.html)
app.get('/agreements', (req, res) => {
  if (req.user) {
    res.sendFile(path.join(__dirname, 'public', 'agreements.html'));
  } else {
    res.redirect('/');
  }
});

// GroupTabs page (serves grouptabs.html)
app.get('/grouptabs', (req, res) => {
  if (req.user) {
    res.sendFile(path.join(__dirname, 'public', 'grouptabs.html'));
  } else {
    res.redirect('/');
  }
});

// FAQ page (serves faq.html)
app.get('/faq', (req, res) => {
  if (req.user) {
    res.sendFile(path.join(__dirname, 'public', 'faq.html'));
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

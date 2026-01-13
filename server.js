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
const { nanoid } = require('nanoid');
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
    tab_id INTEGER,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    read_at TEXT,
    event_type TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (agreement_id) REFERENCES agreements(id),
    FOREIGN KEY (tab_id) REFERENCES group_tabs(id)
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

  -- GroupTabs tables (Two types: one_bill, multi_bill)
  CREATE TABLE IF NOT EXISTS group_tabs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    tab_type TEXT NOT NULL,
    template TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    -- One-bill specific fields
    total_amount_cents INTEGER,
    split_mode TEXT DEFAULT 'equal',
    expected_pay_rate INTEGER DEFAULT 100,
    seat_count INTEGER,
    people_count INTEGER DEFAULT 2,
    receipt_file_path TEXT,
    -- Common fields
    proof_required TEXT DEFAULT 'optional',
    magic_token TEXT UNIQUE NOT NULL,
    owner_token TEXT UNIQUE,
    event_date TEXT,
    created_at TEXT NOT NULL,
    closed_at TEXT,
    FOREIGN KEY (creator_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS group_tab_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_tab_id INTEGER NOT NULL,
    user_id INTEGER,
    guest_name TEXT,
    role TEXT NOT NULL DEFAULT 'participant',
    is_member INTEGER NOT NULL DEFAULT 0,
    seats_claimed INTEGER DEFAULT 1,
    tier_name TEXT,
    tier_multiplier REAL DEFAULT 1.0,
    custom_amount_cents INTEGER,
    guest_session_token TEXT UNIQUE,
    joined_at TEXT NOT NULL,
    added_by_creator INTEGER DEFAULT 0,
    FOREIGN KEY (group_tab_id) REFERENCES group_tabs(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS group_tab_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_tab_id INTEGER NOT NULL,
    payer_participant_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    category TEXT,
    expense_date TEXT NOT NULL,
    receipt_file_path TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (group_tab_id) REFERENCES group_tabs(id),
    FOREIGN KEY (payer_participant_id) REFERENCES group_tab_participants(id)
  );

  CREATE TABLE IF NOT EXISTS group_tab_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_tab_id INTEGER NOT NULL,
    from_participant_id INTEGER NOT NULL,
    to_participant_id INTEGER,
    amount_cents INTEGER NOT NULL,
    method TEXT,
    note TEXT,
    proof_file_path TEXT,
    status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL,
    FOREIGN KEY (group_tab_id) REFERENCES group_tabs(id),
    FOREIGN KEY (from_participant_id) REFERENCES group_tab_participants(id),
    FOREIGN KEY (to_participant_id) REFERENCES group_tab_participants(id)
  );

  CREATE TABLE IF NOT EXISTS group_tab_price_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_tab_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    emoji TEXT,
    amount_cents INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (group_tab_id) REFERENCES group_tabs(id)
  );

  CREATE TABLE IF NOT EXISTS group_tab_tiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_tab_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    multiplier REAL NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (group_tab_id) REFERENCES group_tabs(id)
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

// Add event_date column to group_tabs table
try {
  db.exec(`ALTER TABLE group_tabs ADD COLUMN event_date TEXT;`);
} catch (e) {
  // Column already exists, ignore
}

// Add receipt_file_path column to group_tabs table (for one-bill receipt uploads)
try {
  db.exec(`ALTER TABLE group_tabs ADD COLUMN receipt_file_path TEXT;`);
} catch (e) {
  // Column already exists, ignore
}

// Add price_group_id column to group_tab_participants table
try {
  db.exec(`ALTER TABLE group_tab_participants ADD COLUMN price_group_id INTEGER;`);
} catch (e) {
  // Column already exists, ignore
}

// Add tier_id column to group_tab_participants table
try {
  db.exec(`ALTER TABLE group_tab_participants ADD COLUMN tier_id INTEGER;`);
} catch (e) {
  // Column already exists, ignore
}

// Add assigned_seats column to group_tab_participants table
try {
  db.exec(`ALTER TABLE group_tab_participants ADD COLUMN assigned_seats TEXT;`);
} catch (e) {
  // Column already exists, ignore
}

// Add added_by_creator column to group_tab_participants table
try {
  db.exec(`ALTER TABLE group_tab_participants ADD COLUMN added_by_creator INTEGER DEFAULT 0;`);
} catch (e) {
  // Column already exists, ignore
}

// Add owner_token column to group_tabs for creator-only access
try {
  db.exec(`ALTER TABLE group_tabs ADD COLUMN owner_token TEXT;`);
  console.log('[Startup] Added owner_token column to group_tabs');
} catch (e) {
  // Column already exists or other error - check if column exists
  if (!e.message.includes('duplicate column')) {
    console.log('[Startup] owner_token column may already exist');
  }
}

// Generate owner_tokens for existing group_tabs that don't have one
try {
  const tabsWithoutOwnerToken = db.prepare(`
    SELECT id FROM group_tabs WHERE owner_token IS NULL
  `).all();
  if (tabsWithoutOwnerToken.length > 0) {
    console.log(`[Startup] Generating owner_tokens for ${tabsWithoutOwnerToken.length} group tabs`);
    const updateStmt = db.prepare('UPDATE group_tabs SET owner_token = ? WHERE id = ?');
    for (const tab of tabsWithoutOwnerToken) {
      const ownerToken = crypto.randomBytes(32).toString('hex');
      updateStmt.run(ownerToken, tab.id);
    }
  }
} catch (e) {
  console.error('[Startup] Error generating owner_tokens:', e.message);
}

// =============================================
// SHORT URL CODES (user-friendly tokens)
// =============================================

// Add invite_code column (12 char nanoid) for short invite URLs
try {
  db.exec(`ALTER TABLE group_tabs ADD COLUMN invite_code TEXT;`);
  console.log('[Startup] Added invite_code column to group_tabs');
} catch (e) {
  // Column already exists - check if it's there
  if (e.message && e.message.includes('duplicate column')) {
    // Column exists, good
  } else {
    console.log('[Startup] invite_code column check:', e.message);
  }
}

// Add manage_code column (12 char nanoid) for short manage URLs  
try {
  db.exec(`ALTER TABLE group_tabs ADD COLUMN manage_code TEXT;`);
  console.log('[Startup] Added manage_code column to group_tabs');
} catch (e) {
  // Column already exists
  if (e.message && e.message.includes('duplicate column')) {
    // Column exists, good
  } else {
    console.log('[Startup] manage_code column check:', e.message);
  }
}

// Migrate existing group_tabs: generate short codes for tabs that don't have them
try {
  const tabsWithoutInviteCode = db.prepare(`
    SELECT id FROM group_tabs WHERE invite_code IS NULL
  `).all();
  if (tabsWithoutInviteCode.length > 0) {
    console.log(`[Startup] Generating invite_codes for ${tabsWithoutInviteCode.length} group tabs`);
    const updateStmt = db.prepare('UPDATE group_tabs SET invite_code = ?, manage_code = ? WHERE id = ?');
    for (const tab of tabsWithoutInviteCode) {
      const inviteCode = nanoid(12);
      const manageCode = nanoid(12);
      updateStmt.run(inviteCode, manageCode, tab.id);
    }
  }
} catch (e) {
  console.error('[Startup] Error generating invite_codes:', e.message);
}

// =============================================
// GROUPTAB PAYMENT LOGIC SCHEMA MIGRATIONS
// =============================================

// Add host_overpaid_cents column to group_tabs table
try {
  db.exec(`ALTER TABLE group_tabs ADD COLUMN host_overpaid_cents INTEGER DEFAULT 0;`);
  console.log('[Startup] Added host_overpaid_cents column to group_tabs');
} catch (e) {
  // Column already exists, ignore
}

// Add paid_up_cents column to group_tabs table
try {
  db.exec(`ALTER TABLE group_tabs ADD COLUMN paid_up_cents INTEGER DEFAULT 0;`);
  console.log('[Startup] Added paid_up_cents column to group_tabs');
} catch (e) {
  // Column already exists, ignore
}

// Add remaining_cents column to group_tab_participants table
try {
  db.exec(`ALTER TABLE group_tab_participants ADD COLUMN remaining_cents INTEGER;`);
  console.log('[Startup] Added remaining_cents column to group_tab_participants');
} catch (e) {
  // Column already exists, ignore
}

// Add fair_share_cents column to group_tab_participants table
try {
  db.exec(`ALTER TABLE group_tab_participants ADD COLUMN fair_share_cents INTEGER;`);
  console.log('[Startup] Added fair_share_cents column to group_tab_participants');
} catch (e) {
  // Column already exists, ignore
}

// Add hide_name column to group_tab_participants table (privacy option)
try {
  db.exec(`ALTER TABLE group_tab_participants ADD COLUMN hide_name INTEGER DEFAULT 0;`);
  console.log('[Startup] Added hide_name column to group_tab_participants');
} catch (e) {
  // Column already exists, ignore
}

// Add payment_type column to group_tab_payments table
try {
  db.exec(`ALTER TABLE group_tab_payments ADD COLUMN payment_type TEXT DEFAULT 'normal';`);
  console.log('[Startup] Added payment_type column to group_tab_payments');
} catch (e) {
  // Column already exists, ignore
}

// Add applied_cents column to group_tab_payments table
try {
  db.exec(`ALTER TABLE group_tab_payments ADD COLUMN applied_cents INTEGER;`);
  console.log('[Startup] Added applied_cents column to group_tab_payments');
} catch (e) {
  // Column already exists, ignore
}

// Add overpay_cents column to group_tab_payments table
try {
  db.exec(`ALTER TABLE group_tab_payments ADD COLUMN overpay_cents INTEGER DEFAULT 0;`);
  console.log('[Startup] Added overpay_cents column to group_tab_payments');
} catch (e) {
  // Column already exists, ignore
}

// Add beneficiary_ids column to group_tab_payments table (JSON array for multi-person payments)
try {
  db.exec(`ALTER TABLE group_tab_payments ADD COLUMN beneficiary_ids TEXT;`);
  console.log('[Startup] Added beneficiary_ids column to group_tab_payments');
} catch (e) {
  // Column already exists, ignore
}

// =============================================
// GROUP GIFT SPECIFIC COLUMNS
// =============================================

// Add gift_mode column to group_tabs table (gift_debt, gift_pot_target, gift_pot_open)
try {
  db.exec(`ALTER TABLE group_tabs ADD COLUMN gift_mode TEXT;`);
  console.log('[Startup] Added gift_mode column to group_tabs');
} catch (e) {
  // Column already exists, ignore
}

// Add group_gift_mode column to group_tabs table ('gift' or 'fundraiser')
try {
  db.exec(`ALTER TABLE group_tabs ADD COLUMN group_gift_mode TEXT DEFAULT 'gift';`);
  console.log('[Startup] Added group_gift_mode column to group_tabs');
} catch (e) {
  // Column already exists, ignore
}

// Add recipient_name column to group_tabs table
try {
  db.exec(`ALTER TABLE group_tabs ADD COLUMN recipient_name TEXT;`);
  console.log('[Startup] Added recipient_name column to group_tabs');
} catch (e) {
  // Column already exists, ignore
}

// Add about_text column to group_tabs table
try {
  db.exec(`ALTER TABLE group_tabs ADD COLUMN about_text TEXT;`);
  console.log('[Startup] Added about_text column to group_tabs');
} catch (e) {
  // Column already exists, ignore
}

// Add about_image_path column to group_tabs table
try {
  db.exec(`ALTER TABLE group_tabs ADD COLUMN about_image_path TEXT;`);
  console.log('[Startup] Added about_image_path column to group_tabs');
} catch (e) {
  // Column already exists, ignore
}

// Add about_link column to group_tabs table
try {
  db.exec(`ALTER TABLE group_tabs ADD COLUMN about_link TEXT;`);
  console.log('[Startup] Added about_link column to group_tabs');
} catch (e) {
  // Column already exists, ignore
}

// Add is_raising_money_only column to group_tabs table
try {
  db.exec(`ALTER TABLE group_tabs ADD COLUMN is_raising_money_only INTEGER DEFAULT 0;`);
  console.log('[Startup] Added is_raising_money_only column to group_tabs');
} catch (e) {
  // Column already exists, ignore
}

// Add amount_target column to group_tabs table (for pot modes)
try {
  db.exec(`ALTER TABLE group_tabs ADD COLUMN amount_target INTEGER;`);
  console.log('[Startup] Added amount_target column to group_tabs');
} catch (e) {
  // Column already exists, ignore
}

// Add contributor_count column to group_tabs table
try {
  db.exec(`ALTER TABLE group_tabs ADD COLUMN contributor_count INTEGER;`);
  console.log('[Startup] Added contributor_count column to group_tabs');
} catch (e) {
  // Column already exists, ignore
}

// Add raising_for_text column to group_tabs table
try {
  db.exec(`ALTER TABLE group_tabs ADD COLUMN raising_for_text TEXT;`);
  console.log('[Startup] Added raising_for_text column to group_tabs');
} catch (e) {
  // Column already exists, ignore
}

// Add raising_for_image_path column to group_tabs table
try {
  db.exec(`ALTER TABLE group_tabs ADD COLUMN raising_for_image_path TEXT;`);
  console.log('[Startup] Added raising_for_image_path column to group_tabs');
} catch (e) {
  // Column already exists, ignore
}

// Add raising_for_link column to group_tabs table
try {
  db.exec(`ALTER TABLE group_tabs ADD COLUMN raising_for_link TEXT;`);
  console.log('[Startup] Added raising_for_link column to group_tabs');
} catch (e) {
  // Column already exists, ignore
}

// Add is_open_pot column to group_tabs table
try {
  db.exec(`ALTER TABLE group_tabs ADD COLUMN is_open_pot INTEGER DEFAULT 0;`);
  console.log('[Startup] Added is_open_pot column to group_tabs');
} catch (e) {
  // Column already exists, ignore
}

// Add total_raised_cents column to group_tabs table (track contributions for pot modes)
try {
  db.exec(`ALTER TABLE group_tabs ADD COLUMN total_raised_cents INTEGER DEFAULT 0;`);
  console.log('[Startup] Added total_raised_cents column to group_tabs');
} catch (e) {
  // Column already exists, ignore
}

// Add payment_methods_json column to group_tabs table (how people should pay the starter)
try {
  db.exec(`ALTER TABLE group_tabs ADD COLUMN payment_methods_json TEXT;`);
  console.log('[Startup] Added payment_methods_json column to group_tabs');
} catch (e) {
  // Column already exists, ignore
}

// Create payment_reports table for Group Gift payment tracking
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS group_tab_payment_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_tab_id INTEGER NOT NULL,
      participant_id INTEGER,
      reporter_name TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      method TEXT NOT NULL,
      paid_at TEXT NOT NULL,
      proof_file_path TEXT,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TEXT,
      reviewed_by INTEGER,
      additional_names TEXT,
      FOREIGN KEY (group_tab_id) REFERENCES group_tabs(id),
      FOREIGN KEY (participant_id) REFERENCES group_tab_participants(id),
      FOREIGN KEY (reviewed_by) REFERENCES users(id)
    )
  `);
  console.log('[Startup] Created group_tab_payment_reports table');
} catch (e) {
  // Table already exists, ignore
}

// Add additional_names column to payment_reports for multi-person payments
try {
  db.exec(`ALTER TABLE group_tab_payment_reports ADD COLUMN additional_names TEXT;`);
  console.log('[Migration] Added additional_names column to group_tab_payment_reports');
} catch (e) {
  // Column already exists, ignore
}

// =============================================
// MIGRATE EXISTING GROUPTABS TO NEW PAYMENT LOGIC
// =============================================
function migrateExistingGroupTabs() {
  try {
    // First, add total_paid_cents column if it doesn't exist
    try {
      db.exec(`ALTER TABLE group_tab_participants ADD COLUMN total_paid_cents INTEGER DEFAULT 0;`);
      console.log('[Migration] Added total_paid_cents column');
    } catch (e) {
      // Column already exists
    }
    
    // Find tabs that need migration (where participants have null fair_share_cents)
    const tabsNeedingMigration = db.prepare(`
      SELECT DISTINCT gt.id, gt.total_amount_cents, gt.people_count, gt.creator_user_id, gt.split_mode
      FROM group_tabs gt
      INNER JOIN group_tab_participants gtp ON gt.id = gtp.group_tab_id
      WHERE gt.total_amount_cents IS NOT NULL 
        AND gt.total_amount_cents > 0
        AND (gtp.fair_share_cents IS NULL OR gtp.remaining_cents IS NULL)
    `).all();
    
    if (tabsNeedingMigration.length === 0) {
      console.log('[Migration] No existing tabs need migration');
      return;
    }
    
    console.log(`[Migration] Migrating ${tabsNeedingMigration.length} existing tabs to new payment logic`);
    
    for (const tab of tabsNeedingMigration) {
      const peopleCount = tab.people_count || 1;
      const fairShareCents = Math.floor(tab.total_amount_cents / peopleCount);
      
      // Get all participants for this tab with their payment totals
      const participants = db.prepare(`
        SELECT gtp.id, gtp.role, gtp.guest_name,
          (SELECT COALESCE(SUM(amount_cents), 0) FROM group_tab_payments WHERE from_participant_id = gtp.id) as payments_made
        FROM group_tab_participants gtp
        WHERE gtp.group_tab_id = ?
      `).all(tab.id);
      
      let hostOverpaidCents = 0;
      let paidUpCents = 0;
      
      for (const participant of participants) {
        const isHost = participant.role === 'organizer';
        const paymentsMade = participant.payments_made || 0;
        
        let remainingCents;
        let totalPaidCents;
        
        if (isHost) {
          // Check if host has an initial payment for the full bill
          const initialPayment = db.prepare(`
            SELECT * FROM group_tab_payments 
            WHERE from_participant_id = ? AND amount_cents = ?
          `).get(participant.id, tab.total_amount_cents);
          
          if (initialPayment) {
            // Host paid the full bill
            remainingCents = 0;
            totalPaidCents = tab.total_amount_cents;
            hostOverpaidCents = tab.total_amount_cents - fairShareCents;
            paidUpCents += fairShareCents;
          } else {
            // Normal calculation
            totalPaidCents = paymentsMade;
            remainingCents = Math.max(0, fairShareCents - paymentsMade);
            paidUpCents += Math.min(paymentsMade, fairShareCents);
          }
        } else {
          // Non-host participants
          totalPaidCents = paymentsMade;
          remainingCents = Math.max(0, fairShareCents - paymentsMade);
          
          // If they've paid, reduce host overpaid
          if (paymentsMade > 0 && hostOverpaidCents > 0) {
            const reduction = Math.min(paymentsMade, hostOverpaidCents, fairShareCents);
            hostOverpaidCents = Math.max(0, hostOverpaidCents - reduction);
          }
          
          paidUpCents += Math.min(paymentsMade, fairShareCents);
        }
        
        // Update participant
        db.prepare(`
          UPDATE group_tab_participants 
          SET fair_share_cents = ?, remaining_cents = ?, total_paid_cents = ?
          WHERE id = ?
        `).run(fairShareCents, remainingCents, totalPaidCents, participant.id);
      }
      
      // Update tab state
      db.prepare(`
        UPDATE group_tabs 
        SET host_overpaid_cents = ?, paid_up_cents = ?
        WHERE id = ?
      `).run(hostOverpaidCents, paidUpCents, tab.id);
    }
    
    console.log('[Migration] Migration complete');
  } catch (err) {
    console.error('[Migration] Error migrating existing tabs:', err);
  }
}

// Run migration on startup
migrateExistingGroupTabs();

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

// GroupTabs file upload configuration
const grouptabsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/grouptabs/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'grouptab-' + uniqueSuffix + ext);
  }
});

const uploadGrouptabs = multer({
  storage: grouptabsStorage,
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

// Serve GroupTab uploads (receipts, gift images) - these are public files for tab participants
app.use('/uploads/grouptabs', express.static(path.join(__dirname, 'uploads', 'grouptabs')));

// Serve profile pictures - needed for public pages like GroupTab invite links
app.use('/uploads/profiles', express.static(path.join(__dirname, 'uploads', 'profiles')));

// GroupTab receipts are also served via dedicated API endpoint below (see /api/grouptabs/receipt/:filename)

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

  // Generate timeline payments for active agreements
  // This includes:
  // - ALL unpaid schedule rows (future or overdue)
  // - Amounts match the repayment schedule EXACTLY (Payment total)
  // - Dates match the repayment schedule EXACTLY
  // - Only CONFIRMED payments reduce outstanding/mark rows as paid
  // - Pending payments do NOT affect the schedule
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

      // Get total CONFIRMED payments only (pending payments do NOT count)
      const totalConfirmedPaidCents = totals.total_paid_cents;

      // Helper to format date as YYYY-MM-DD in local timezone (avoids UTC shift)
      const formatLocalDate = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      if (agreement.repayment_type === 'one_time') {
        // For bullet (one-time) loans:
        // Use agreement.due_date as the authoritative due date
        // Use schedule to calculate the total amount (principal + interest)
        if (outstandingCents > 0 && agreement.due_date) {
          const dueDate = new Date(agreement.due_date);
          dueDate.setHours(0, 0, 0, 0);
          
          // Get the payment total from schedule (if available) for accurate interest calculation
          // Otherwise use the outstanding amount
          let paymentTotal = outstandingCents;
          if (schedule.rows.length > 0) {
            // Schedule totalPayment includes principal + interest
            paymentTotal = schedule.rows[0].totalPayment;
          }
          
          // For one-time loans, show remaining outstanding (original total minus paid)
          // This is different from installment loans which show exact schedule amounts
          futurePayments.push({
            date: formatLocalDate(dueDate), // Use agreement's due_date
            dateLabel: formatDateShort(dueDate), // Formatted date for display
            amountCents: outstandingCents, // Remaining amount to pay
            amountFormatted: formatCurrency2(outstandingCents),
            status: dueDate < today ? 'overdue' : 'scheduled'
          });
        }
      } else {
        // For installment loans:
        // Show ALL unpaid schedule rows with EXACT amounts from schedule (Payment Total)
        // Apply confirmed payments to determine which rows are fully paid (and skip them)
        // But always show the EXACT schedule amount - never reduce it for partial payments
        let remainingPaidCents = totalConfirmedPaidCents;

        for (const row of schedule.rows) {
          if (!row.date) continue;

          const rowDate = new Date(row.date);
          rowDate.setHours(0, 0, 0, 0);
          
          // Check if this row is fully paid by confirmed payments
          if (remainingPaidCents >= row.totalPayment) {
            // This installment is fully paid - deduct and skip
            remainingPaidCents -= row.totalPayment;
            continue;
          }

          // This row is not fully paid - show it with the EXACT schedule amount
          // Note: We don't reduce the amount for partial payments, we show the full schedule amount
          // Any remaining paid credit is "consumed" but doesn't affect display
          if (remainingPaidCents > 0) {
            // There's some partial payment credit, but we still show full amount
            remainingPaidCents = 0;
          }

          // Determine status based on date
          const status = rowDate < today ? 'overdue' : 'scheduled';

          // Use the EXACT Payment Total from schedule - matches repayment schedule table exactly
          futurePayments.push({
            date: formatLocalDate(rowDate), // Local timezone date for JavaScript parsing
            dateLabel: row.dateLabel, // Formatted date for display
            amountCents: row.totalPayment, // EXACT schedule amount (Payment Total)
            amountFormatted: formatCurrency2(row.totalPayment), // Use 2 decimal places to match schedule
            status: status
          });
        }
      }
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
      console.log('Login failed: User not found', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      console.log('Login failed: Password invalid for', email);
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

// Dev routes for God Mode
app.get('/api/dev/users', (req, res) => {
  try {
    const users = db.prepare('SELECT id, full_name, email FROM users ORDER BY id').all();
    res.json({ users });
  } catch (err) {
    console.error('Error fetching users for dev mode:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/dev/switch-user', (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'User ID required' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create new session
    const sessionId = createSession(user.id);
    
    // Set cookie
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'lax'
    });

    res.json({ success: true, user: { id: user.id, email: user.email, full_name: user.full_name } });
  } catch (err) {
    console.error('Error switching user:', err);
    res.status(500).json({ error: 'Failed to switch user' });
  }
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

  // Automatic third-party handling is only allowed for loans >= 3000 EUR (300000 cents)
  const THIRD_PARTY_MIN_AMOUNT_CENTS = 300000; // 3000 EUR
  if (debtCollectionClause && amountCents < THIRD_PARTY_MIN_AMOUNT_CENTS) {
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

    // Get agreement counts and total outstanding for each friend
    const today = new Date();
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

      // Calculate total outstanding for active agreements with this friend
      // Outstanding = principal + interest accrued to date - payments made
      // Sign convention: positive = they owe me, negative = I owe them
      const activeAgreements = db.prepare(`
        SELECT * FROM agreements
        WHERE status = 'active'
          AND ((lender_user_id = ? AND borrower_user_id = ?)
            OR (lender_user_id = ? AND borrower_user_id = ?))
      `).all(userId, friendId, friendId, userId);

      let totalOutstandingCents = 0;
      for (const agreement of activeAgreements) {
        // Get payment totals
        const totals = getPaymentTotals(agreement.id);
        // Calculate dynamic interest info (principal + interest accrued to today)
        const interestInfo = getAgreementInterestInfo(agreement, today);
        const totalDueCentsToday = interestInfo.total_due_cents;

        // Outstanding for this agreement
        let outstandingCents = totalDueCentsToday - totals.total_paid_cents;
        if (outstandingCents < 0) outstandingCents = 0;

        // Apply sign based on who owes whom
        if (agreement.lender_user_id === userId) {
          // I'm the lender: they owe me (positive)
          totalOutstandingCents += outstandingCents;
        } else {
          // I'm the borrower: I owe them (negative)
          totalOutstandingCents -= outstandingCents;
        }
      }

      friendData.totalOutstandingCents = totalOutstandingCents;

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

    // Calculate total outstanding for active agreements with this friend
    const today = new Date();
    const activeAgreements = db.prepare(`
      SELECT * FROM agreements
      WHERE status = 'active'
        AND ((lender_user_id = ? AND borrower_user_id = ?)
          OR (lender_user_id = ? AND borrower_user_id = ?))
    `).all(userId, friendId, friendId, userId);

    let totalOutstandingCents = 0;
    for (const agreement of activeAgreements) {
      const totals = getPaymentTotals(agreement.id);
      const interestInfo = getAgreementInterestInfo(agreement, today);
      const totalDueCentsToday = interestInfo.total_due_cents;

      let outstandingCents = totalDueCentsToday - totals.total_paid_cents;
      if (outstandingCents < 0) outstandingCents = 0;

      // Always add as positive (absolute value for display)
      totalOutstandingCents += outstandingCents;
    }

    // Build response
    const response = {
      friendId: friend.id, // Internal ID for profile picture endpoint
      friendPublicId: friend.public_id,
      name: friend.full_name || friend.email,
      avatarUrl: friend.profile_picture,
      timezone: friend.timezone || null,
      totalOutstandingCents,
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
      m.tab_id,
      a.status as agreement_status,
      a.borrower_email,
      a.borrower_user_id,
      a.lender_user_id,
      u_borrower.full_name as borrower_full_name,
      a.friend_first_name,
      gt.name as tab_name,
      gt.tab_type as tab_type
    FROM messages m
    LEFT JOIN agreements a ON m.agreement_id = a.id
    LEFT JOIN users u_borrower ON a.borrower_user_id = u_borrower.id
    LEFT JOIN group_tabs gt ON m.tab_id = gt.id
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
    switch (troubleReason) {
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

// =============================================
// GROUPTABS API ENDPOINTS (v1)
// Two types: one_bill, multi_bill
// =============================================

// Guest session helper
function getGuestParticipant(req, tabId) {
  const token = req.cookies.grouptab_guest_session;
  if (!token) return null;
  return db.prepare('SELECT * FROM group_tab_participants WHERE group_tab_id = ? AND guest_session_token = ?').get(tabId, token);
}

// Check if requester has access to a tab (either as authenticated participant or guest)
function checkTabAccess(req, tabId) {
  // Check if authenticated user is a participant
  if (req.user) {
    const participant = db.prepare(`
      SELECT * FROM group_tab_participants WHERE group_tab_id = ? AND user_id = ?
    `).get(tabId, req.user.id);
    if (participant) {
      return { hasAccess: true, participant, isAuthenticated: true };
    }
    // Also check if user is the creator (they may not be in participants table yet)
    const tab = db.prepare(`SELECT creator_user_id FROM group_tabs WHERE id = ?`).get(tabId);
    if (tab && tab.creator_user_id === req.user.id) {
      return { hasAccess: true, participant: null, isAuthenticated: true, isCreator: true };
    }
  }
  
  // Check for guest session
  const guestParticipant = getGuestParticipant(req, tabId);
  if (guestParticipant) {
    return { hasAccess: true, participant: guestParticipant, isAuthenticated: false };
  }
  
  return { hasAccess: false, participant: null, isAuthenticated: false };
}

// Create new tab (with optional receipt/image uploads)
app.post('/api/grouptabs', requireAuth, (req, res) => {
  
  // Handle multer upload with proper error handling - accept multiple file fields for gift flow
  const uploadFields = uploadGrouptabs.fields([
    { name: 'receipt', maxCount: 1 },
    { name: 'aboutImage', maxCount: 1 },
    { name: 'raisingForImage', maxCount: 1 }
  ]);
  
  uploadFields(req, res, (uploadErr) => {
    if (uploadErr) {
      console.error('File upload error:', uploadErr);
      if (uploadErr instanceof multer.MulterError) {
        if (uploadErr.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size too large. Maximum size is 10MB.' });
        }
        return res.status(400).json({ error: `Upload error: ${uploadErr.message}` });
      }
      return res.status(400).json({ error: uploadErr.message || 'File upload failed' });
    }
    
    // Continue with tab creation
    createGroupTab(req, res);
  });
});

function createGroupTab(req, res) {
  const { name, tabType, template, splitMode, proofRequired, description, tiers } = req.body;
  // Parse numeric values from FormData (they come as strings)
  const totalAmountCents = req.body.totalAmountCents ? parseInt(req.body.totalAmountCents) : null;
  const expectedPayRate = req.body.expectedPayRate ? parseInt(req.body.expectedPayRate) : 100;
  const seatCount = req.body.seatCount ? parseInt(req.body.seatCount) : null;
  const peopleCount = req.body.peopleCount ? parseInt(req.body.peopleCount) : 2;
  
  // Parse priceGroups if present (it might be a JSON string from FormData)
  let priceGroups = [];
  if (req.body.priceGroups) {
    try {
      priceGroups = typeof req.body.priceGroups === 'string' 
        ? JSON.parse(req.body.priceGroups) 
        : req.body.priceGroups;
    } catch (e) {
      console.warn('Failed to parse priceGroups:', e);
    }
  }
  
  // Parse hostGroupId (the price group the host selected for themselves in the wizard)
  const hostGroupId = req.body.hostGroupId ? parseInt(req.body.hostGroupId) : null;
  
  // ===== GROUP GIFT SPECIFIC FIELDS =====
  const giftMode = req.body.giftMode || null; // 'gift_debt', 'gift_pot_target', 'gift_pot_open'
  const groupGiftMode = req.body.groupGiftMode || null; // NEW: 'gift' or 'fundraiser'
  const recipientName = req.body.recipientName || null;
  const aboutText = req.body.aboutText || null;
  const aboutLink = req.body.aboutLink || null;
  const isRaisingMoneyOnly = req.body.isRaisingMoneyOnly === 'true' || req.body.isRaisingMoneyOnly === true;
  const amountTarget = req.body.amountTarget ? parseInt(req.body.amountTarget) : null;
  const contributorCount = req.body.contributorCount ? parseInt(req.body.contributorCount) : null;
  const raisingForText = req.body.raisingForText || null;
  const raisingForLink = req.body.raisingForLink || null;
  const isOpenPot = req.body.isOpenPot === 'true' || req.body.isOpenPot === true;
  
  // Payment methods for how participants should pay the starter
  const paymentMethodsJson = req.body.paymentMethodsJson || null;
  
  if (!name || !tabType) {
    return res.status(400).json({ error: 'Name and tab type are required' });
  }
  
  if (!['one_bill', 'multi_bill'].includes(tabType)) {
    return res.status(400).json({ error: 'Invalid tab type. Must be one_bill or multi_bill' });
  }
  
  try {
    const magicToken = crypto.randomBytes(32).toString('hex');
    const ownerToken = crypto.randomBytes(32).toString('hex');
    // Short, user-friendly codes (12 chars) for sharing
    const inviteCode = nanoid(12);
    const manageCode = nanoid(12);
    const createdAt = new Date().toISOString();
    
    // Handle file paths from req.files (using .fields() for multiple file support)
    const receiptFile = req.files?.receipt?.[0];
    const aboutImageFile = req.files?.aboutImage?.[0];
    const raisingForImageFile = req.files?.raisingForImage?.[0];
    
    const receiptFilePath = receiptFile ? `/uploads/grouptabs/${receiptFile.filename}` : null;
    const aboutImagePath = aboutImageFile ? `/uploads/grouptabs/${aboutImageFile.filename}` : null;
    const raisingForImagePath = raisingForImageFile ? `/uploads/grouptabs/${raisingForImageFile.filename}` : null;

    // Calculate payment logic values for host's initial payment
    let hostOverpaidCents = 0;
    let paidUpCents = 0;
    let fairShareCents = 0;
    
    // Gift modes have different payment logic
    const isGiftDebtMode = giftMode === 'gift_debt';
    const isGiftPotMode = giftMode === 'gift_pot_target' || giftMode === 'gift_pot_open';
    
    if (isGiftDebtMode && totalAmountCents && totalAmountCents > 0 && peopleCount > 0) {
      // Gift debt mode: creator paid upfront, others owe their share
      fairShareCents = Math.floor(totalAmountCents / peopleCount);
      hostOverpaidCents = totalAmountCents - fairShareCents;
      paidUpCents = fairShareCents; // Only host's fair share is considered "settled"
    } else if (isGiftPotMode) {
      // Pot modes: no debt, just collecting contributions
      fairShareCents = 0;
      hostOverpaidCents = 0;
      paidUpCents = 0;
    } else if (totalAmountCents && totalAmountCents > 0 && peopleCount > 0) {
      // Regular restaurant bill flow
      fairShareCents = Math.floor(totalAmountCents / peopleCount);
      hostOverpaidCents = totalAmountCents - fairShareCents;
      paidUpCents = fairShareCents; // Only host's fair share is considered "settled"
    }
    
    const result = db.prepare(`
      INSERT INTO group_tabs (
        creator_user_id, name, description, tab_type, template, total_amount_cents, 
        split_mode, expected_pay_rate, seat_count, people_count, proof_required, 
        magic_token, owner_token, invite_code, manage_code, receipt_file_path, host_overpaid_cents, paid_up_cents, created_at,
        gift_mode, group_gift_mode, recipient_name, about_text, about_link, is_raising_money_only,
        amount_target, contributor_count, raising_for_text, raising_for_link, is_open_pot,
        about_image_path, raising_for_image_path, payment_methods_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      name,
      description || null,
      tabType,
      template || null,
      totalAmountCents || null,
      splitMode || 'equal',
      expectedPayRate || 100,
      seatCount || null,
      peopleCount || 2,
      proofRequired || 'optional',
      magicToken,
      ownerToken,
      inviteCode,
      manageCode,
      receiptFilePath,
      hostOverpaidCents,
      paidUpCents,
      createdAt,
      // Gift-specific fields
      giftMode,
      groupGiftMode, // NEW: 'gift' or 'fundraiser'
      recipientName,
      aboutText,
      aboutLink,
      isRaisingMoneyOnly ? 1 : 0,
      amountTarget,
      contributorCount,
      raisingForText,
      raisingForLink,
      isOpenPot ? 1 : 0,
      aboutImagePath,
      raisingForImagePath,
      paymentMethodsJson
    );
    
    const tabId = result.lastInsertRowid;
    
    // Add creator as organizer with payment logic fields
    // For pot modes, creator has NOT paid yet. For debt modes (restaurant & gift_debt), creator paid upfront.
    const creatorPaidUpfront = !isGiftPotMode && totalAmountCents && totalAmountCents > 0;
    const participantResult = db.prepare(`
      INSERT INTO group_tab_participants (group_tab_id, user_id, role, is_member, joined_at, fair_share_cents, remaining_cents, total_paid_cents)
      VALUES (?, ?, 'organizer', 1, ?, ?, ?, ?)
    `).run(
      tabId, 
      req.user.id, 
      createdAt, 
      fairShareCents, 
      isGiftPotMode ? 0 : 0, // For pot modes, no debt; for debt modes, creator owes 0 (already paid)
      creatorPaidUpfront ? totalAmountCents : 0
    );
    
    const organizerParticipantId = participantResult.lastInsertRowid;
    
    // Record organizer's payment for the full bill (they paid the bill upfront)
    // This applies to: restaurant bills, price_groups, AND gift_debt mode
    // It does NOT apply to: gift_pot_target, gift_pot_open (pot modes where creator is just collecting)
    if (!isGiftPotMode && (splitMode === 'equal' || splitMode === 'price_groups') && totalAmountCents && totalAmountCents > 0) {
      const paymentNote = isGiftDebtMode ? 'Paid for the gift upfront' : 'Paid the full bill';
      console.log(`Creating initial host payment: tab=${tabId}, org=${organizerParticipantId}, amt=${totalAmountCents}, fairShare=${fairShareCents}, overpaid=${hostOverpaidCents}, giftMode=${giftMode || 'none'}`);
      try {
        db.prepare(`
          INSERT INTO group_tab_payments (group_tab_id, from_participant_id, to_participant_id, amount_cents, method, note, status, payment_type, applied_cents, overpay_cents, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(tabId, organizerParticipantId, null, totalAmountCents, 'paid_bill', paymentNote, 'confirmed', 'initial_host', fairShareCents, hostOverpaidCents, createdAt);
      } catch (payErr) {
        console.error('Failed to create initial payment:', payErr);
        // Don't fail the whole tab creation for this, just log it
      }
    }
    
    // Create tiers if tiered split mode
    if (splitMode === 'tiered' && tiers && Array.isArray(tiers)) {
      tiers.forEach((tier, index) => {
        db.prepare(`
          INSERT INTO group_tab_tiers (group_tab_id, name, multiplier, sort_order, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(tabId, tier.name, tier.multiplier, index, createdAt);
      });
    }
    
    // Create price groups if price_groups split mode
    // Map wizard group IDs to database IDs
    const wizardToDbIdMap = {};
    if (splitMode === 'price_groups' && priceGroups && Array.isArray(priceGroups)) {
      priceGroups.forEach((group) => {
        const result = db.prepare(`
          INSERT INTO group_tab_price_groups (group_tab_id, name, emoji, amount_cents, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(tabId, group.name, group.emoji || '🏷️', group.amountCents, createdAt);
        
        // Map wizard ID to database ID
        wizardToDbIdMap[group.id] = result.lastInsertRowid;
      });
      
      // Assign host to their selected price group (from wizard)
      if (hostGroupId && wizardToDbIdMap[hostGroupId]) {
        const dbGroupId = wizardToDbIdMap[hostGroupId];
        const selectedGroup = priceGroups.find(g => g.id === hostGroupId);
        const hostFairShare = selectedGroup ? selectedGroup.amountCents : fairShareCents;
        
        // Update organizer's price_group_id and fair_share_cents
        db.prepare(`
          UPDATE group_tab_participants SET price_group_id = ?, fair_share_cents = ? WHERE id = ?
        `).run(dbGroupId, hostFairShare, organizerParticipantId);
        
        console.log(`Assigned host to price group: dbId=${dbGroupId}, wizardId=${hostGroupId}, fairShare=${hostFairShare}`);
      }
    }
    
    // Create activity message for creator
    db.prepare(`
      INSERT INTO messages (user_id, tab_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      tabId,
      'GroupTab Created',
      `You created a new ${tabType === 'one_bill' ? 'One-Bill' : 'Multi-Bill'} tab: "${name}"`,
      createdAt,
      'GROUPTAB_CREATED'
    );
    
    // Fetch created price groups with their IDs
    const createdPriceGroups = db.prepare(`
      SELECT id, name, emoji, amount_cents FROM group_tab_price_groups WHERE group_tab_id = ? ORDER BY id
    `).all(tabId);
    
    res.status(201).json({
      success: true,
      tab: {
        id: tabId,
        name,
        tabType,
        template,
        magicToken,
        ownerToken,
        inviteCode,
        manageCode,
        // Short, user-friendly tab link (primary sharing URL)
        tabLink: `${req.protocol}://${req.get('host')}/tab/${inviteCode}`,
        // Legacy long-form links (still supported but redirect to short)
        magicLink: `${req.protocol}://${req.get('host')}/tab/${magicToken}`,
        ownerLink: `${req.protocol}://${req.get('host')}/grouptabs/manage/${ownerToken}`,
        organizerParticipantId: organizerParticipantId,
        priceGroups: createdPriceGroups,
        // Gift-specific fields
        giftMode: giftMode || null,
        recipientName: recipientName || null,
        amountTarget: amountTarget || null,
        isOpenPot: isOpenPot || false,
        receipt_file_path: receiptFilePath
      }
    });
  } catch (err) {
    console.error('Error creating tab:', err);
    console.error('Error details:', err.message, err.stack);
    res.status(500).json({ error: err.message || 'Failed to create tab' });
  }
}

// List user's tabs
app.get('/api/grouptabs', requireAuth, (req, res) => {
  try {
    const tabs = db.prepare(`
      SELECT gt.*, 
        u.full_name as creator_name,
        (SELECT COUNT(*) FROM group_tab_participants WHERE group_tab_id = gt.id) as participant_count,
        (SELECT COUNT(*) FROM group_tab_expenses WHERE group_tab_id = gt.id) as expense_count,
        (SELECT COALESCE(SUM(amount_cents), 0) FROM group_tab_expenses WHERE group_tab_id = gt.id) as total_expenses_cents,
        (SELECT COALESCE(SUM(amount_cents), 0) FROM group_tab_payments WHERE group_tab_id = gt.id) as total_payments_cents,
        (SELECT MAX(created_at) FROM group_tab_payments WHERE group_tab_id = gt.id) as last_payment_at
      FROM group_tabs gt
      JOIN users u ON gt.creator_user_id = u.id
      WHERE gt.id IN (SELECT group_tab_id FROM group_tab_participants WHERE user_id = ?)
      ORDER BY gt.created_at DESC
    `).all(req.user.id);
    
    res.json({ success: true, tabs });
  } catch (err) {
    console.error('Error listing tabs:', err);
    res.status(500).json({ error: 'Failed to list tabs' });
  }
});

// Get tab details (public read access for open tabs)
app.get('/api/grouptabs/:id', (req, res) => {
  const tabId = parseInt(req.params.id);
  
  try {
    const tab = db.prepare(`
      SELECT gt.*, u.full_name as creator_name, u.profile_picture as creator_avatar_url
      FROM group_tabs gt
      JOIN users u ON gt.creator_user_id = u.id
      WHERE gt.id = ?
    `).get(tabId);
    
    if (!tab) {
      return res.status(404).json({ error: 'Tab not found' });
    }
    
    // Check access - open tabs are publicly viewable, closed tabs require participant access
    const access = checkTabAccess(req, tabId);
    
    // For closed tabs, require participant access
    if (tab.status === 'closed' && !access.hasAccess) {
      return res.status(403).json({ error: 'This tab is closed. Only participants can view it.' });
    }
    
    // For open tabs, allow public read access (anyone with the link can view)
    // access.hasAccess may be false for first-time visitors, but that's OK for open tabs
    
    const currentParticipant = access.participant;
    const isAuthenticated = access.isAuthenticated;
    
    // Get all participants - filter sensitive fields for non-authenticated callers
    let participants;
    if (isAuthenticated) {
      participants = db.prepare(`
        SELECT gtp.*, u.full_name, u.email, u.profile_picture
        FROM group_tab_participants gtp
        LEFT JOIN users u ON gtp.user_id = u.id
        WHERE gtp.group_tab_id = ?
        ORDER BY gtp.role DESC, gtp.joined_at ASC
      `).all(tabId);
    } else {
      // Guest callers: exclude email and profile_picture
      participants = db.prepare(`
        SELECT gtp.*, u.full_name
        FROM group_tab_participants gtp
        LEFT JOIN users u ON gtp.user_id = u.id
        WHERE gtp.group_tab_id = ?
        ORDER BY gtp.role DESC, gtp.joined_at ASC
      `).all(tabId);
    }
    
    // Get expenses (for multi_bill tabs)
    const expenses = db.prepare(`
      SELECT gte.*, gtp.guest_name, u.full_name as payer_name
      FROM group_tab_expenses gte
      JOIN group_tab_participants gtp ON gte.payer_participant_id = gtp.id
      LEFT JOIN users u ON gtp.user_id = u.id
      WHERE gte.group_tab_id = ?
      ORDER BY gte.expense_date DESC
    `).all(tabId);
    
    // Get payments
    const payments = db.prepare(`
      SELECT gtp.*,
        fp.guest_name as from_guest_name, fu.full_name as from_name,
        tp.guest_name as to_guest_name, tu.full_name as to_name
      FROM group_tab_payments gtp
      JOIN group_tab_participants fp ON gtp.from_participant_id = fp.id
      LEFT JOIN users fu ON fp.user_id = fu.id
      LEFT JOIN group_tab_participants tp ON gtp.to_participant_id = tp.id
      LEFT JOIN users tu ON tp.user_id = tu.id
      WHERE gtp.group_tab_id = ?
      ORDER BY gtp.created_at DESC
    `).all(tabId);

    // Get tiers (if applicable)
    let tiers = [];
    try {
      const tiersTableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='group_tab_tiers'`).get();
      if (tiersTableExists) {
        tiers = db.prepare(`SELECT * FROM group_tab_tiers WHERE group_tab_id = ? ORDER BY sort_order`).all(tabId);
      }
    } catch (e) {
      console.warn('Error fetching tiers:', e);
    }
    
    // Get price groups (if applicable)
    let priceGroups = [];
    try {
      const pgTableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='group_tab_price_groups'`).get();
      if (pgTableExists) {
        priceGroups = db.prepare(`SELECT * FROM group_tab_price_groups WHERE group_tab_id = ?`).all(tabId);
      }
    } catch (e) {
      console.warn('Error fetching price groups:', e);
    }
    
    // Determine if current user is the creator
    const isCreator = access.isCreator || (req.user && tab.creator_user_id === req.user.id);
    
    res.json({
      success: true,
      tab,
      participants,
      expenses,
      payments,
      currentParticipant,
      tiers,
      priceGroups,
      isCreator,
      // Include owner token for creators to enable receipt uploads
      ownerToken: isCreator ? tab.owner_token : null
    });
  } catch (err) {
    console.error('Error getting tab:', err);
    res.status(500).json({ error: 'Failed to get tab details' });
  }
});

// Update tab
app.patch('/api/grouptabs/:id', requireAuth, (req, res) => {
  const tabId = parseInt(req.params.id);
  const { name, totalAmountCents, splitMode, expectedPayRate, seatCount, proofRequired, description, peopleCount, tiers, eventDate, status } = req.body;
  
  try {
    const organizer = db.prepare(`
      SELECT * FROM group_tab_participants WHERE group_tab_id = ? AND user_id = ? AND role = 'organizer'
    `).get(tabId, req.user.id);
    
    if (!organizer) {
      return res.status(403).json({ error: 'Only the organizer can update tab settings' });
    }
    
    const updates = [];
    const params = [];
    
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (totalAmountCents !== undefined) { updates.push('total_amount_cents = ?'); params.push(totalAmountCents); }
    if (splitMode !== undefined) { updates.push('split_mode = ?'); params.push(splitMode); }
    if (expectedPayRate !== undefined) { updates.push('expected_pay_rate = ?'); params.push(expectedPayRate); }
    if (seatCount !== undefined) { updates.push('seat_count = ?'); params.push(seatCount); }
    if (proofRequired !== undefined) { updates.push('proof_required = ?'); params.push(proofRequired); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (peopleCount !== undefined) { updates.push('people_count = ?'); params.push(peopleCount); }
    if (eventDate !== undefined) { updates.push('event_date = ?'); params.push(eventDate); }
    if (status !== undefined && ['open', 'closed'].includes(status)) { updates.push('status = ?'); params.push(status); }
    
    if (updates.length > 0) {
      params.push(tabId);
      db.prepare(`UPDATE group_tabs SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    
    // Handle tiers update (only if the group_tab_tiers table exists)
    if (tiers && Array.isArray(tiers) && splitMode === 'tiered') {
      // Check if group_tab_tiers table exists before operating on it
      const tiersTableExists = db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='group_tab_tiers'
      `).get();
      
      if (tiersTableExists) {
        // Delete existing tiers
        db.prepare(`DELETE FROM group_tab_tiers WHERE group_tab_id = ?`).run(tabId);
        
        // Insert new tiers
        const insertTier = db.prepare(`
          INSERT INTO group_tab_tiers (group_tab_id, name, multiplier, sort_order, created_at)
          VALUES (?, ?, ?, ?, ?)
        `);
        
        const now = new Date().toISOString();
        tiers.forEach((tier, idx) => {
          insertTier.run(tabId, tier.name, tier.multiplier, idx, now);
        });
      }
      // If table doesn't exist, silently skip tier operations
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating tab:', err);
    res.status(500).json({ error: 'Failed to update tab' });
  }
});

// Get tab tiers
app.get('/api/grouptabs/:id/tiers', requireAuth, (req, res) => {
  const tabId = parseInt(req.params.id);
  
  try {
    // Verify user is a participant
    const participant = db.prepare(`
      SELECT * FROM group_tab_participants WHERE group_tab_id = ? AND user_id = ?
    `).get(tabId, req.user.id);
    
    if (!participant) {
      return res.status(403).json({ error: 'Not a participant of this tab' });
    }
    
    // Check if group_tab_tiers table exists
    const tiersTableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='group_tab_tiers'
    `).get();
    
    if (!tiersTableExists) {
      // Table doesn't exist, return empty array
      return res.json({ tiers: [] });
    }
    
    const tiers = db.prepare(`
      SELECT id, name, multiplier, sort_order
      FROM group_tab_tiers
      WHERE group_tab_id = ?
      ORDER BY sort_order
    `).all(tabId);
    
    res.json({ tiers });
  } catch (err) {
    console.error('Error loading tiers:', err);
    res.status(500).json({ error: 'Failed to load tiers' });
  }
});

// Close tab
app.post('/api/grouptabs/:id/close', requireAuth, (req, res) => {
  const tabId = parseInt(req.params.id);
  
  try {
    const organizer = db.prepare(`
      SELECT * FROM group_tab_participants WHERE group_tab_id = ? AND user_id = ? AND role = 'organizer'
    `).get(tabId, req.user.id);
    
    if (!organizer) {
      return res.status(403).json({ error: 'Only the organizer can close the tab' });
    }
    
    const tab = db.prepare(`SELECT name FROM group_tabs WHERE id = ?`).get(tabId);
    const closedAt = new Date().toISOString();
    db.prepare(`UPDATE group_tabs SET status = 'closed', closed_at = ? WHERE id = ?`).run(closedAt, tabId);
    
    // Notify all member participants that the tab is closed
    const memberParticipants = db.prepare(`
      SELECT user_id FROM group_tab_participants WHERE group_tab_id = ? AND user_id IS NOT NULL
    `).all(tabId);
    
    for (const p of memberParticipants) {
      db.prepare(`
        INSERT INTO messages (user_id, tab_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        p.user_id,
        tabId,
        'GroupTab Closed',
        `The tab "${tab.name}" has been closed by the organizer.`,
        closedAt,
        'GROUPTAB_CLOSED'
      );
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error closing tab:', err);
    res.status(500).json({ error: 'Failed to close tab' });
  }
});

// Delete tab (organizer only)
app.delete('/api/grouptabs/:id', requireAuth, (req, res) => {
  const tabId = parseInt(req.params.id);

  try {
    // Verify user is the tab creator
    const tab = db.prepare(`
      SELECT * FROM group_tabs WHERE id = ? AND creator_user_id = ?
    `).get(tabId, req.user.id);

    if (!tab) {
      return res.status(403).json({ error: 'Only the organizer can delete this tab' });
    }

    // Delete all related data in correct order (respecting foreign key constraints)
    db.prepare(`DELETE FROM group_tab_payments WHERE group_tab_id = ?`).run(tabId);
    db.prepare(`DELETE FROM group_tab_expenses WHERE group_tab_id = ?`).run(tabId);
    
    // Delete payment_reports BEFORE participants (payment_reports references participant_id)
    const reportsTableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='group_tab_payment_reports'
    `).get();
    if (reportsTableExists) {
      db.prepare(`DELETE FROM group_tab_payment_reports WHERE group_tab_id = ?`).run(tabId);
    }
    
    db.prepare(`DELETE FROM group_tab_participants WHERE group_tab_id = ?`).run(tabId);
    
    // Check if price_groups table exists before deleting
    const priceGroupsTableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='group_tab_price_groups'
    `).get();
    if (priceGroupsTableExists) {
      db.prepare(`DELETE FROM group_tab_price_groups WHERE group_tab_id = ?`).run(tabId);
    }

    // Check if tiers table exists before deleting
    const tiersTableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='group_tab_tiers'
    `).get();
    if (tiersTableExists) {
      db.prepare(`DELETE FROM group_tab_tiers WHERE group_tab_id = ?`).run(tabId);
    }

    // Delete messages that reference this tab
    db.prepare(`DELETE FROM messages WHERE tab_id = ?`).run(tabId);

    // Delete the tab itself
    db.prepare(`DELETE FROM group_tabs WHERE id = ?`).run(tabId);

    console.log(`[GroupTabs] Tab ${tabId} deleted by user ${req.user.id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting tab:', err);
    res.status(500).json({ error: 'Failed to delete tab' });
  }
});

// =============================================
// UNIFIED TOKEN-BASED TAB ACCESS
// =============================================

// Get tab by short code (invite_code), manage_code, or legacy magic_token
// PRIMARY API for /tab/:code URLs
app.get('/api/grouptabs/code/:code', (req, res) => {
  const { code } = req.params;
  
  try {
    // First check if it's a manage_code (creator access)
    let tab = db.prepare(`
      SELECT gt.*, u.full_name as creator_name, u.id as creator_user_id, u.profile_picture as creator_avatar_url
      FROM group_tabs gt
      JOIN users u ON gt.creator_user_id = u.id
      WHERE gt.manage_code = ?
    `).get(code);
    
    let accessedViaManageCode = !!tab;
    
    // If not manage_code, try invite_code (viewer access)
    if (!tab) {
      tab = db.prepare(`
        SELECT gt.*, u.full_name as creator_name, u.id as creator_user_id, u.profile_picture as creator_avatar_url
        FROM group_tabs gt
        JOIN users u ON gt.creator_user_id = u.id
        WHERE gt.invite_code = ?
      `).get(code);
    }
    
    // If still not found, try legacy magic_token (for old URLs)
    if (!tab) {
      tab = db.prepare(`
        SELECT gt.*, u.full_name as creator_name, u.id as creator_user_id, u.profile_picture as creator_avatar_url
        FROM group_tabs gt
        JOIN users u ON gt.creator_user_id = u.id
        WHERE gt.magic_token = ?
      `).get(code);
    }
    
    if (!tab) {
      return res.status(404).json({ error: 'Tab not found' });
    }
    
    // Determine if user is the creator (either via manage_code OR logged in as creator)
    const isCreator = accessedViaManageCode || (req.user && req.user.id === tab.creator_user_id);
    
    if (tab.status === 'closed' && !isCreator) {
      return res.status(403).json({ error: 'This tab has been closed', closed: true });
    }
    
    // Get all participants with payment summaries
    const participants = db.prepare(`
      SELECT gtp.id, gtp.user_id, gtp.guest_name, gtp.guest_session_token, gtp.role, gtp.is_member, 
             gtp.seats_claimed, gtp.tier_id, gtp.price_group_id, gtp.joined_at, gtp.hide_name,
             gtp.fair_share_cents, gtp.remaining_cents, gtp.total_paid_cents as participant_paid_cents,
             COALESCE(u.full_name, gtp.guest_name) as display_name,
             u.profile_picture,
             (SELECT COALESCE(SUM(amount_cents), 0) FROM group_tab_payments WHERE from_participant_id = gtp.id AND status = 'confirmed') as total_paid_cents,
             (SELECT MAX(created_at) FROM group_tab_payments WHERE from_participant_id = gtp.id) as last_payment_at
      FROM group_tab_participants gtp
      LEFT JOIN users u ON gtp.user_id = u.id
      WHERE gtp.group_tab_id = ?
      ORDER BY gtp.role DESC, gtp.joined_at ASC
    `).all(tab.id);
    
    // Get all payments
    const payments = db.prepare(`
      SELECT p.*, 
             COALESCE(fp.guest_name, fu.full_name) as from_name,
             COALESCE(tp.guest_name, tu.full_name) as to_name
      FROM group_tab_payments p
      LEFT JOIN group_tab_participants fp ON p.from_participant_id = fp.id
      LEFT JOIN users fu ON fp.user_id = fu.id
      LEFT JOIN group_tab_participants tp ON p.to_participant_id = tp.id
      LEFT JOIN users tu ON tp.user_id = tu.id
      WHERE p.group_tab_id = ?
      ORDER BY p.created_at DESC
    `).all(tab.id);
    
    // Get price groups if applicable
    let priceGroups = [];
    if (tab.split_mode === 'price_groups') {
      priceGroups = db.prepare(`
        SELECT * FROM group_tab_price_groups WHERE group_tab_id = ? ORDER BY id
      `).all(tab.id);
    }
    
    // Determine current participant (from session or cookie)
    let currentParticipant = null;
    const guestSessionToken = req.cookies?.grouptab_guest_session;
    
    if (isCreator) {
      currentParticipant = participants.find(p => p.role === 'organizer') || null;
    } else if (req.user) {
      currentParticipant = participants.find(p => p.user_id === req.user.id) || null;
    } else if (guestSessionToken) {
      currentParticipant = participants.find(p => p.guest_session_token === guestSessionToken) || null;
    }
    
    // Calculate per-person share for equal split
    const peopleCount = tab.people_count || participants.length || 1;
    const totalAmountCents = tab.total_amount_cents || 0;
    const perPersonCents = Math.round(totalAmountCents / peopleCount);
    
    // Calculate collected totals
    const collectedTotal = payments
      .filter(p => p.status === 'confirmed')
      .reduce((sum, p) => sum + (p.amount_cents || 0), 0);
    
    // Determine if user has joined this tab
    let hasJoined = false;
    if (req.user) {
      hasJoined = !!currentParticipant || tab.creator_user_id === req.user.id;
    } else if (guestSessionToken) {
      hasJoined = !!currentParticipant;
    }
    
    // Return response in same format as /api/grouptabs/:id for compatibility
    res.json({
      success: true,
      isCreator,
      hasJoined, // Important: tells the page whether to show join screen
      // Return raw tab object with snake_case fields (frontend expects this format)
      tab: {
        ...tab,
        // Hide tokens from non-creators
        magic_token: isCreator ? tab.magic_token : undefined,
        owner_token: isCreator ? tab.owner_token : undefined,
        manage_code: isCreator ? tab.manage_code : undefined
      },
      // Return raw participants (frontend expects snake_case)
      participants: participants.map(p => ({
        ...p,
        display_name: p.hide_name ? 'Anonymous' : p.display_name
      })),
      // Return raw payments
      payments,
      priceGroups,
      currentParticipant: currentParticipant ? {
        id: currentParticipant.id,
        displayName: currentParticipant.display_name,
        role: currentParticipant.role
      } : null
    });
  } catch (err) {
    console.error('Error fetching tab by invite code:', err);
    res.status(500).json({ error: 'Failed to fetch tab' });
  }
});

// Get tab by either owner_token or magic_token (public) - LEGACY, still supported
// Returns isCreator: true if accessed via owner_token
app.get('/api/grouptabs/token/:token', (req, res) => {
  const { token } = req.params;
  
  try {
    // First check if it's an owner_token (creator access)
    let tab = db.prepare(`
      SELECT gt.*, u.full_name as creator_name, u.id as creator_user_id, u.profile_picture as creator_avatar_url
      FROM group_tabs gt
      JOIN users u ON gt.creator_user_id = u.id
      WHERE gt.owner_token = ?
    `).get(token);
    
    let isCreator = !!tab;
    
    // If not owner_token, try magic_token (viewer access)
    if (!tab) {
      tab = db.prepare(`
        SELECT gt.*, u.full_name as creator_name, u.id as creator_user_id, u.profile_picture as creator_avatar_url
        FROM group_tabs gt
        JOIN users u ON gt.creator_user_id = u.id
        WHERE gt.magic_token = ?
      `).get(token);
    }
    
    if (!tab) {
      return res.status(404).json({ error: 'Tab not found' });
    }
    
    if (tab.status === 'closed' && !isCreator) {
      return res.status(403).json({ error: 'This tab has been closed', closed: true });
    }
    
    // Get all participants with payment summaries
    const participants = db.prepare(`
      SELECT gtp.id, gtp.user_id, gtp.guest_name, gtp.guest_session_token, gtp.role, gtp.is_member, 
             gtp.seats_claimed, gtp.tier_id, gtp.price_group_id, gtp.joined_at,
             COALESCE(u.full_name, gtp.guest_name) as display_name,
             u.profile_picture,
             (SELECT COALESCE(SUM(amount_cents), 0) FROM group_tab_payments WHERE from_participant_id = gtp.id) as total_paid_cents,
             (SELECT MAX(created_at) FROM group_tab_payments WHERE from_participant_id = gtp.id) as last_payment_at
      FROM group_tab_participants gtp
      LEFT JOIN users u ON gtp.user_id = u.id
      WHERE gtp.group_tab_id = ?
      ORDER BY gtp.role DESC, gtp.joined_at ASC
    `).all(tab.id);
    
    // Get all payments
    const payments = db.prepare(`
      SELECT p.*, 
             COALESCE(fp.guest_name, fu.full_name) as from_name,
             COALESCE(tp.guest_name, tu.full_name) as to_name
      FROM group_tab_payments p
      LEFT JOIN group_tab_participants fp ON p.from_participant_id = fp.id
      LEFT JOIN users fu ON fp.user_id = fu.id
      LEFT JOIN group_tab_participants tp ON p.to_participant_id = tp.id
      LEFT JOIN users tu ON tp.user_id = tu.id
      WHERE p.group_tab_id = ?
      ORDER BY p.created_at DESC
    `).all(tab.id);
    
    // Determine current participant (from owner_token, session, or cookie)
    let currentParticipant = null;
    const guestSessionToken = req.cookies?.grouptab_guest_session;
    
    if (isCreator) {
      // For owner_token access, the current user is the organizer
      currentParticipant = participants.find(p => p.role === 'organizer') || null;
    } else if (req.user) {
      currentParticipant = participants.find(p => p.user_id === req.user.id) || null;
    } else if (guestSessionToken) {
      currentParticipant = participants.find(p => p.guest_session_token === guestSessionToken) || null;
    }
    
    // Calculate per-person share for equal split
    const peopleCount = tab.people_count || participants.length || 1;
    const totalAmountCents = tab.total_amount_cents || 0;
    const perPersonCents = Math.round(totalAmountCents / peopleCount);
    
    // Calculate collected totals
    const collectedTotal = payments.reduce((sum, p) => sum + (p.amount_cents || 0), 0);
    
    // Build activity feed
    const activityFeed = [];
    
    // Tab creation event
    activityFeed.push({
      type: 'created',
      message: `${tab.creator_name} created this tab`,
      timestamp: tab.created_at
    });
    
    // Participant join events
    participants.forEach(p => {
      if (p.user_id !== tab.creator_user_id) {
        activityFeed.push({
          type: 'joined',
          message: `${p.display_name} joined the tab`,
          timestamp: p.joined_at
        });
      }
    });
    
    // Payment events
    payments.forEach(p => {
      const formattedAmount = (p.amount_cents / 100).toFixed(2);
      activityFeed.push({
        type: 'payment',
        message: `${p.from_name} reported €${formattedAmount}${p.note ? ` (${p.note})` : ''}`,
        timestamp: p.created_at
      });
    });
    
    // Sort by timestamp descending (newest first)
    activityFeed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    const responseData = {
      success: true,
      isCreator,
      tab: {
        id: tab.id,
        name: tab.name,
        description: tab.description,
        tabType: tab.tab_type,
        template: tab.template,
        status: tab.status,
        totalAmountCents: tab.total_amount_cents,
        splitMode: tab.split_mode,
        peopleCount: tab.people_count,
        perPersonCents,
        receiptFilePath: tab.receipt_file_path,
        proofRequired: tab.proof_required,
        creatorName: tab.creator_name,
        createdAt: tab.created_at,
        magicToken: isCreator ? tab.magic_token : undefined,
        ownerToken: isCreator ? tab.owner_token : undefined
      },
      participants: participants.map(p => ({
        id: p.id,
        userId: p.user_id,
        displayName: p.display_name,
        profilePicture: p.profile_picture,
        role: p.role,
        isMember: p.is_member,
        totalPaidCents: p.total_paid_cents || 0,
        fairShareCents: perPersonCents,
        balanceCents: (p.total_paid_cents || 0) - perPersonCents,
        isCurrentUser: currentParticipant && p.id === currentParticipant.id,
        lastPaymentAt: p.last_payment_at,
        priceGroupId: p.price_group_id
      })),
      payments,
      currentParticipant: currentParticipant ? {
        id: currentParticipant.id,
        displayName: currentParticipant.display_name,
        totalPaidCents: currentParticipant.total_paid_cents || 0,
        fairShareCents: currentParticipant.fair_share_cents || perPersonCents,
        balanceCents: (currentParticipant.total_paid_cents || 0) - (currentParticipant.fair_share_cents || perPersonCents),
        price_group_id: currentParticipant.price_group_id,
        priceGroupId: currentParticipant.price_group_id
      } : null,
      summary: {
        totalBillCents: tab.total_amount_cents || 0,
        collectedTotalCents: collectedTotal,
        shortfallCents: Math.max(0, (tab.total_amount_cents || 0) - collectedTotal),
        surplusCents: Math.max(0, collectedTotal - (tab.total_amount_cents || 0)),
        peopleCount
      },
      activityFeed,
      isLoggedIn: !!req.user,
      priceGroups: []
    };
    
    // Load price groups if applicable
    try {
      const pgTableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='group_tab_price_groups'`).get();
      if (pgTableExists) {
        const rawPriceGroups = db.prepare(`SELECT * FROM group_tab_price_groups WHERE group_tab_id = ?`).all(tab.id);
        responseData.priceGroups = rawPriceGroups.map(pg => ({
          id: pg.id,
          groupTabId: pg.group_tab_id,
          name: pg.name,
          emoji: pg.emoji,
          amountCents: pg.amount_cents,
          createdAt: pg.created_at
        }));
      }
    } catch (e) {
      console.warn('Error loading price groups:', e);
    }
    
    res.json(responseData);
    
  } catch (err) {
    console.error('Error getting tab by token:', err);
    res.status(500).json({ error: 'Failed to get tab' });
  }
});

// Report payment for a tab (creator can report for anyone, others only for themselves)
app.post('/api/grouptabs/:id/report-payment', (req, res) => {
  const tabId = parseInt(req.params.id);
  const { participantId, amountCents, method, note, token } = req.body;
  
  if (!amountCents || amountCents <= 0) {
    return res.status(400).json({ error: 'Valid amount is required' });
  }
  
  try {
    // Determine access level via token
    let tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ? AND owner_token = ?`).get(tabId, token);
    let isCreator = !!tab;
    
    if (!tab) {
      tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ? AND magic_token = ?`).get(tabId, token);
    }
    
    if (!tab) {
      return res.status(404).json({ error: 'Tab not found or invalid token' });
    }
    
    if (tab.status === 'closed') {
      return res.status(403).json({ error: 'Cannot add payments to a closed tab' });
    }
    
    // Get all participants
    const participants = db.prepare(`SELECT * FROM group_tab_participants WHERE group_tab_id = ?`).all(tabId);
    
    // Determine which participant to record payment for
    let targetParticipantId = participantId;
    
    if (!isCreator) {
      // Non-creators can only report for themselves
      const guestSessionToken = req.cookies?.grouptab_guest_session;
      let currentParticipant = null;
      
      if (req.user) {
        currentParticipant = participants.find(p => p.user_id === req.user.id);
      } else if (guestSessionToken) {
        currentParticipant = participants.find(p => p.guest_session_token === guestSessionToken);
      }
      
      if (!currentParticipant) {
        return res.status(403).json({ error: 'You must be a participant to report a payment' });
      }
      
      targetParticipantId = currentParticipant.id;
    }
    
    // Validate target participant exists
    const targetParticipant = participants.find(p => p.id === targetParticipantId);
    if (!targetParticipant) {
      return res.status(400).json({ error: 'Invalid participant' });
    }
    
    // Get creator's participant ID (payments go to organizer)
    const organizerParticipant = participants.find(p => p.role === 'organizer');
    const toParticipantId = organizerParticipant ? organizerParticipant.id : null;
    
    // Record the payment
    const createdAt = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO group_tab_payments (group_tab_id, from_participant_id, to_participant_id, amount_cents, method, note, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?)
    `).run(tabId, targetParticipantId, toParticipantId, amountCents, method || null, note || null, createdAt);
    
    // Get participant name for activity message
    const participantName = targetParticipant.guest_name || 
      db.prepare(`SELECT full_name FROM users WHERE id = ?`).get(targetParticipant.user_id)?.full_name || 
      'Someone';
    
    // Get creator name if creator is reporting for someone else
    const { reportedByCreator } = req.body;
    let activityMessage = `${participantName} reported a payment of €${(amountCents / 100).toFixed(2)}`;
    
    if (isCreator && targetParticipantId !== participants.find(p => p.role === 'creator' || p.role === 'organizer')?.id) {
      // Creator is reporting for someone else
      const creatorUser = db.prepare(`SELECT full_name FROM users WHERE id = ?`).get(tab.creator_user_id);
      const creatorName = creatorUser?.full_name || 'Organizer';
      activityMessage = `${creatorName} reported €${(amountCents / 100).toFixed(2)} payment for ${participantName}`;
    }
    
    if (note) {
      activityMessage += ` (${note})`;
    }
    
    // Create activity message for the organizer
    db.prepare(`
      INSERT INTO messages (user_id, tab_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      tab.creator_user_id,
      tabId,
      'Payment Reported',
      activityMessage,
      createdAt,
      'GROUPTAB_PAYMENT_REPORTED'
    );
    
    res.json({
      success: true,
      payment: {
        id: result.lastInsertRowid,
        fromParticipantId: targetParticipantId,
        amountCents,
        method,
        note,
        createdAt
      }
    });
    
  } catch (err) {
    console.error('Error reporting payment:', err);
    res.status(500).json({ error: 'Failed to report payment' });
  }
});

// Creator adds a new price group to the tab
app.post('/api/grouptabs/:id/price-groups', (req, res) => {
  const tabId = parseInt(req.params.id);
  const { name, emoji, amountCents, token } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Group name is required' });
  }
  
  if (typeof amountCents !== 'number' || amountCents < 0) {
    return res.status(400).json({ error: 'Valid price is required' });
  }
  
  try {
    // Verify creator access via owner_token
    const tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ? AND owner_token = ?`).get(tabId, token);
    
    if (!tab) {
      return res.status(403).json({ error: 'Only the creator can add price groups' });
    }
    
    // Insert the new price group
    const result = db.prepare(`
      INSERT INTO group_tab_price_groups (group_tab_id, name, emoji, amount_cents, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(tabId, name.trim(), emoji || '🏷️', amountCents, new Date().toISOString());
    
    // Return the new group
    const newGroup = db.prepare(`SELECT * FROM group_tab_price_groups WHERE id = ?`).get(result.lastInsertRowid);
    
    res.json({
      success: true,
      priceGroup: {
        id: newGroup.id,
        name: newGroup.name,
        emoji: newGroup.emoji,
        amountCents: newGroup.amount_cents
      }
    });
    
  } catch (err) {
    console.error('Error adding price group:', err);
    res.status(500).json({ error: 'Failed to add price group' });
  }
});

// Creator adds a guest to the tab (for empty slots)
app.post('/api/grouptabs/:id/add-guest', (req, res) => {
  const tabId = parseInt(req.params.id);
  const { guestName, token, priceGroupId } = req.body;
  
  if (!guestName || !guestName.trim()) {
    return res.status(400).json({ error: 'Guest name is required' });
  }
  
  try {
    // Only allow via owner_token (creator only)
    const tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ? AND owner_token = ?`).get(tabId, token);
    
    if (!tab) {
      return res.status(403).json({ error: 'Only the organizer can add guests' });
    }
    
    if (tab.status === 'closed') {
      return res.status(403).json({ error: 'Cannot add guests to a closed tab' });
    }
    
    // Check if name already exists
    const existing = db.prepare(`
      SELECT * FROM group_tab_participants gtp
      LEFT JOIN users u ON gtp.user_id = u.id
      WHERE gtp.group_tab_id = ? AND (
        LOWER(gtp.guest_name) = LOWER(?) OR LOWER(u.full_name) = LOWER(?)
      )
    `).get(tabId, guestName.trim(), guestName.trim());
    
    if (existing) {
      return res.status(400).json({ error: 'A participant with this name already exists' });
    }
    
    const joinedAt = new Date().toISOString();
    
    // Calculate fair share for the new participant
    const fairShareCents = (tab.total_amount_cents && tab.people_count > 0)
      ? Math.floor(tab.total_amount_cents / tab.people_count)
      : 0;
    
    // Create the guest participant (no session token since creator added them)
    // Include price_group_id if provided (for price_groups mode)
    // Set remaining_cents = fair_share_cents (they owe their full share)
    const result = db.prepare(`
      INSERT INTO group_tab_participants (group_tab_id, guest_name, role, is_member, joined_at, added_by_creator, price_group_id, fair_share_cents, remaining_cents, total_paid_cents)
      VALUES (?, ?, 'participant', 0, ?, 1, ?, ?, ?, 0)
    `).run(tabId, guestName.trim(), joinedAt, priceGroupId || null, fairShareCents, fairShareCents);
    
    // Get creator name
    const creator = db.prepare(`SELECT full_name FROM users WHERE id = ?`).get(tab.creator_user_id);
    const creatorName = creator?.full_name || 'Organizer';
    
    // Activity message
    db.prepare(`
      INSERT INTO messages (user_id, tab_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      tab.creator_user_id,
      tabId,
      'Guest Added',
      `${creatorName} added ${guestName.trim()} to the tab`,
      joinedAt,
      'GROUPTAB_GUEST_ADDED'
    );
    
    res.json({
      success: true,
      participant: {
        id: result.lastInsertRowid,
        guestName: guestName.trim(),
        role: 'participant',
        isMember: false,
        addedByCreator: true
      }
    });
    
  } catch (err) {
    console.error('Error adding guest:', err);
    res.status(500).json({ error: 'Failed to add guest' });
  }
});

// Update tab via owner_token (creator only)
app.patch('/api/grouptabs/token/:ownerToken', uploadGrouptabs.single('receipt'), (req, res) => {
  const { ownerToken } = req.params;
  const { name, totalAmountCents, description, peopleCount, status } = req.body;
  
  try {
    // Only owner_token grants edit access
    const tab = db.prepare(`SELECT * FROM group_tabs WHERE owner_token = ?`).get(ownerToken);
    
    if (!tab) {
      return res.status(404).json({ error: 'Tab not found or invalid token' });
    }
    
    const updates = [];
    const params = [];
    
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (totalAmountCents !== undefined) { updates.push('total_amount_cents = ?'); params.push(parseInt(totalAmountCents)); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (peopleCount !== undefined) { updates.push('people_count = ?'); params.push(parseInt(peopleCount)); }
    if (status !== undefined && ['open', 'closed'].includes(status)) { 
      updates.push('status = ?'); 
      params.push(status);
      if (status === 'closed') {
        updates.push('closed_at = ?');
        params.push(new Date().toISOString());
      }
    }
    
    // Handle receipt upload
    if (req.file) {
      const receiptFilePath = `/uploads/grouptabs/${req.file.filename}`;
      updates.push('receipt_file_path = ?');
      params.push(receiptFilePath);
    }
    
    // Handle receipt deletion
    if (req.body.deleteReceipt === 'true') {
      // Optionally delete the file from disk
      if (tab.receipt_file_path) {
        const oldFilePath = path.join(__dirname, tab.receipt_file_path);
        if (fs.existsSync(oldFilePath)) {
          try {
            fs.unlinkSync(oldFilePath);
          } catch (e) {
            console.warn('Could not delete old receipt file:', e);
          }
        }
      }
      updates.push('receipt_file_path = ?');
      params.push(null);
    }
    
    if (updates.length > 0) {
      params.push(tab.id);
      db.prepare(`UPDATE group_tabs SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    
    // Get updated tab data
    const updatedTab = db.prepare(`SELECT * FROM group_tabs WHERE id = ?`).get(tab.id);
    
    res.json({ 
      success: true,
      tab: {
        id: updatedTab.id,
        name: updatedTab.name,
        totalAmountCents: updatedTab.total_amount_cents,
        peopleCount: updatedTab.people_count,
        description: updatedTab.description,
        receiptFilePath: updatedTab.receipt_file_path,
        status: updatedTab.status
      }
    });
    
  } catch (err) {
    console.error('Error updating tab:', err);
    res.status(500).json({ error: 'Failed to update tab' });
  }
});

// Join tab via token (for name capture flow)
app.post('/api/grouptabs/token/:token/join', (req, res) => {
  const { token } = req.params;
  const { guestName, priceGroupId, hideName } = req.body;
  
  try {
    // Only allow joining via magic_token (not owner_token)
    const tab = db.prepare(`SELECT * FROM group_tabs WHERE magic_token = ?`).get(token);
    
    if (!tab) {
      return res.status(404).json({ error: 'Tab not found' });
    }
    
    if (tab.status === 'closed') {
      return res.status(403).json({ error: 'This tab has been closed' });
    }
    
    const joinedAt = new Date().toISOString();
    
    // Check if already a participant (by user_id or guest session)
    const guestSessionToken = req.cookies?.grouptab_guest_session;
    
    if (req.user) {
      const existing = db.prepare(`
        SELECT * FROM group_tab_participants WHERE group_tab_id = ? AND user_id = ?
      `).get(tab.id, req.user.id);
      
      if (existing) {
        // If already joined but no group assigned and we have one now, update it
        if (priceGroupId && !existing.price_group_id) {
          db.prepare(`UPDATE group_tab_participants SET price_group_id = ? WHERE id = ?`)
            .run(priceGroupId, existing.id);
        }
        // Update hide_name if provided
        if (hideName !== undefined) {
          db.prepare(`UPDATE group_tab_participants SET hide_name = ? WHERE id = ?`)
            .run(hideName ? 1 : 0, existing.id);
          existing.hide_name = hideName ? 1 : 0;
        }
        return res.json({ success: true, participant: existing, alreadyJoined: true });
      }
      
      // Calculate fair share for the new participant
      const fairShareCents = (tab.total_amount_cents && tab.people_count > 0)
        ? Math.floor(tab.total_amount_cents / tab.people_count)
        : 0;
      
      const result = db.prepare(`
        INSERT INTO group_tab_participants (group_tab_id, user_id, role, is_member, joined_at, price_group_id, fair_share_cents, remaining_cents, total_paid_cents, hide_name)
        VALUES (?, ?, 'participant', 1, ?, ?, ?, ?, 0, ?)
      `).run(tab.id, req.user.id, joinedAt, priceGroupId || null, fairShareCents, fairShareCents, hideName ? 1 : 0);
      
      return res.json({
        success: true,
        participant: { id: result.lastInsertRowid, isMember: true, role: 'participant', priceGroupId: priceGroupId || null, fairShareCents, remainingCents: fairShareCents, hideName: hideName ? 1 : 0 }
      });
    }
    
    // Guest flow
    if (!guestName || !guestName.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const trimmedName = guestName.trim();
    
    // Check if guest already joined with this session
    if (guestSessionToken) {
      const existing = db.prepare(`
        SELECT * FROM group_tab_participants WHERE group_tab_id = ? AND guest_session_token = ?
      `).get(tab.id, guestSessionToken);
      
      if (existing) {
        // Update hide_name if provided
        if (hideName !== undefined) {
          db.prepare(`UPDATE group_tab_participants SET hide_name = ? WHERE id = ?`)
            .run(hideName ? 1 : 0, existing.id);
          existing.hide_name = hideName ? 1 : 0;
        }
        return res.json({ success: true, participant: existing, alreadyJoined: true });
      }
    }
    
    // Check if a participant with this name already exists (case-insensitive match)
    const existingByName = db.prepare(`
      SELECT gtp.*, COALESCE(gtp.guest_name, u.full_name) as display_name
      FROM group_tab_participants gtp
      LEFT JOIN users u ON gtp.user_id = u.id
      WHERE gtp.group_tab_id = ? AND (
        LOWER(gtp.guest_name) = LOWER(?) OR 
        LOWER(u.full_name) = LOWER(?)
      )
    `).get(tab.id, trimmedName, trimmedName);
    
    if (existingByName && !existingByName.guest_session_token && !existingByName.user_id) {
      // Link this guest to the existing participant row
      const newGuestSessionToken = crypto.randomBytes(32).toString('hex');
      db.prepare(`UPDATE group_tab_participants SET guest_session_token = ? WHERE id = ?`)
        .run(newGuestSessionToken, existingByName.id);
      
      res.cookie('grouptab_guest_session', newGuestSessionToken, {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        sameSite: 'lax'
      });
      
      return res.json({
        success: true,
        participant: { ...existingByName, guest_session_token: newGuestSessionToken },
        matched: true
      });
    }
    
    // Create new guest participant
    const newGuestSessionToken = crypto.randomBytes(32).toString('hex');
    
    // Calculate fair share for the new participant
    const fairShareCents = (tab.total_amount_cents && tab.people_count > 0)
      ? Math.floor(tab.total_amount_cents / tab.people_count)
      : 0;
    
    const result = db.prepare(`
      INSERT INTO group_tab_participants (group_tab_id, guest_name, guest_session_token, role, is_member, joined_at, price_group_id, fair_share_cents, remaining_cents, total_paid_cents, hide_name)
      VALUES (?, ?, ?, 'participant', 0, ?, ?, ?, ?, 0, ?)
    `).run(tab.id, trimmedName, newGuestSessionToken, joinedAt, priceGroupId || null, fairShareCents, fairShareCents, hideName ? 1 : 0);
    
    // Notify the organizer
    db.prepare(`
      INSERT INTO messages (user_id, tab_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      tab.creator_user_id,
      tab.id,
      'Guest Joined',
      `${trimmedName} joined your tab "${tab.name}" as a guest`,
      joinedAt,
      'GROUPTAB_GUEST_JOINED'
    );
    
    res.cookie('grouptab_guest_session', newGuestSessionToken, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'lax'
    });
    
    res.json({
      success: true,
      participant: { 
        id: result.lastInsertRowid, 
        isMember: false, 
        guestName: trimmedName, 
        role: 'participant',
        priceGroupId: priceGroupId || null
      }
    });
    
  } catch (err) {
    console.error('Error joining tab:', err);
    res.status(500).json({ error: 'Failed to join tab' });
  }
});

// Change participant's price group
app.patch('/api/grouptabs/token/:token/participant/:participantId/group', (req, res) => {
  const { token, participantId } = req.params;
  const { priceGroupId } = req.body;
  
  try {
    // Find the tab by either owner_token or magic_token
    let tab = db.prepare(`SELECT * FROM group_tabs WHERE owner_token = ?`).get(token);
    let isOwner = !!tab;
    
    if (!tab) {
      tab = db.prepare(`SELECT * FROM group_tabs WHERE magic_token = ?`).get(token);
    }
    
    if (!tab) {
      return res.status(404).json({ error: 'Tab not found' });
    }
    
    if (tab.status === 'closed') {
      return res.status(403).json({ error: 'This tab has been closed' });
    }
    
    // Check if tab uses price groups
    if (tab.split_mode !== 'price_groups') {
      return res.status(400).json({ error: 'This tab does not use price groups' });
    }
    
    // Validate price group ID exists for this tab
    if (priceGroupId) {
      const priceGroup = db.prepare(`
        SELECT * FROM group_tab_price_groups WHERE id = ? AND group_tab_id = ?
      `).get(priceGroupId, tab.id);
      
      if (!priceGroup) {
        return res.status(400).json({ error: 'Invalid price group' });
      }
    }
    
    // Get the participant
    const participant = db.prepare(`
      SELECT * FROM group_tab_participants WHERE id = ? AND group_tab_id = ?
    `).get(participantId, tab.id);
    
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }
    
    // Check authorization:
    // - Owner can change anyone's group
    // - Participant can only change their own group
    const guestSessionToken = req.cookies?.grouptab_guest_session;
    const isOwnParticipant = (req.user && participant.user_id === req.user.id) || 
                            (guestSessionToken && participant.guest_session_token === guestSessionToken);
    
    if (!isOwner && !isOwnParticipant) {
      return res.status(403).json({ error: 'Not authorized to change this participant\'s group' });
    }
    
    // Get the new group details
    const newGroup = priceGroupId ? db.prepare(`
      SELECT * FROM group_tab_price_groups WHERE id = ?
    `).get(priceGroupId) : null;
    
    const newFairShareCents = newGroup ? newGroup.amount_cents : Math.floor(tab.total_amount_cents / tab.people_count);
    
    // Check if this is the host (organizer)
    const isHost = participant.role === 'organizer';
    
    // Update the participant's price group and fair share
    db.prepare(`
      UPDATE group_tab_participants SET price_group_id = ?, fair_share_cents = ? WHERE id = ?
    `).run(priceGroupId || null, newFairShareCents, participantId);
    
    // If this is the host, also update the tab's host_overpaid_cents and paid_up_cents
    if (isHost && tab.total_amount_cents > 0) {
      const newHostOverpaidCents = tab.total_amount_cents - newFairShareCents;
      const newPaidUpCents = newFairShareCents; // Host's fair share is considered "settled"
      
      db.prepare(`
        UPDATE group_tabs SET host_overpaid_cents = ?, paid_up_cents = ? WHERE id = ?
      `).run(newHostOverpaidCents, newPaidUpCents, tab.id);
    }
    
    const participantName = participant.guest_name || 
      (participant.user_id ? db.prepare(`SELECT full_name FROM users WHERE id = ?`).get(participant.user_id)?.full_name : 'Unknown');
    
    // Log activity
    const now = new Date().toISOString();
    const groupName = newGroup ? newGroup.name : 'unassigned';
    
    db.prepare(`
      INSERT INTO messages (user_id, tab_id, subject, body, created_at, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.user?.id || tab.creator_user_id,
      tab.id,
      'Group Changed',
      `${participantName} moved to ${groupName}`,
      now,
      'GROUPTAB_GROUP_CHANGED'
    );
    
    res.json({
      success: true,
      participant: { id: participant.id, priceGroupId: priceGroupId || null, fairShareCents: newFairShareCents }
    });
    
  } catch (err) {
    console.error('Error changing participant group:', err);
    res.status(500).json({ error: 'Failed to change group' });
  }
});

// Get tab by magic token (public) - for share link access
app.get('/api/tabs/token/:token', (req, res) => {
  const { token } = req.params;
  
  try {
    const tab = db.prepare(`
      SELECT gt.*, u.full_name as creator_name, u.profile_picture as creator_avatar_url
      FROM group_tabs gt
      JOIN users u ON gt.creator_user_id = u.id
      WHERE gt.magic_token = ?
    `).get(token);
    
    if (!tab) {
      return res.status(404).json({ error: 'Tab not found' });
    }
    
    if (tab.status === 'closed') {
      return res.status(403).json({ error: 'This tab has been closed', closed: true });
    }
    
    // Get all participants with full details
    const participants = db.prepare(`
      SELECT gtp.*, u.full_name, u.profile_picture
      FROM group_tab_participants gtp
      LEFT JOIN users u ON gtp.user_id = u.id
      WHERE gtp.group_tab_id = ?
      ORDER BY gtp.role DESC, gtp.joined_at ASC
    `).all(tab.id);
    
    // Check if current user/guest is already a participant
    let currentParticipant = null;
    let hasJoined = false;
    
    if (req.user) {
      currentParticipant = db.prepare(`
        SELECT * FROM group_tab_participants WHERE group_tab_id = ? AND user_id = ?
      `).get(tab.id, req.user.id);
      hasJoined = !!currentParticipant || tab.creator_user_id === req.user.id;
    } else {
      currentParticipant = getGuestParticipant(req, tab.id);
      hasJoined = !!currentParticipant;
    }
    
    // Load price groups
    let priceGroups = [];
    try {
      const pgTableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='group_tab_price_groups'`).get();
      if (pgTableExists) {
        priceGroups = db.prepare(`SELECT * FROM group_tab_price_groups WHERE group_tab_id = ?`).all(tab.id);
      }
    } catch (e) {
      console.warn('Error loading price groups:', e);
    }
    
    // Load tiers
    let tiers = [];
    try {
      const tiersTableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='group_tab_tiers'`).get();
      if (tiersTableExists) {
        tiers = db.prepare(`SELECT * FROM group_tab_tiers WHERE group_tab_id = ? ORDER BY sort_order`).all(tab.id);
      }
    } catch (e) {
      console.warn('Error loading tiers:', e);
    }
    
    // Return full tab data (similar to /api/grouptabs/:id but via token)
    res.json({
      success: true,
      tab: tab, // Full tab object for view page compatibility
      participants,
      currentParticipant: currentParticipant ? {
        id: currentParticipant.id,
        displayName: currentParticipant.display_name || currentParticipant.guest_name,
        totalPaidCents: currentParticipant.total_paid_cents || 0,
        fairShareCents: currentParticipant.fair_share_cents || 0,
        priceGroupId: currentParticipant.price_group_id
      } : null,
      priceGroups,
      tiers,
      isLoggedIn: !!req.user,
      hasJoined, // Important: tells the page whether to show join screen
      magicToken: token, // Pass token back for join API calls
      isCreator: req.user && tab.creator_user_id === req.user.id
    });
    
  } catch (err) {
    console.error('Error getting tab by token:', err);
    res.status(500).json({ error: 'Failed to get tab' });
  }
});

// Join tab - supports both invite_code (short) and magic_token (legacy)
app.post('/api/tabs/token/:token/join', (req, res) => {
  const { token } = req.params;
  const { guestName, priceGroupId, hideName } = req.body;
  
  try {
    // Try invite_code first (short codes), then magic_token (legacy)
    let tab = db.prepare(`SELECT * FROM group_tabs WHERE invite_code = ?`).get(token);
    if (!tab) {
      tab = db.prepare(`SELECT * FROM group_tabs WHERE magic_token = ?`).get(token);
    }

    if (!tab) {
      return res.status(404).json({ error: 'Tab not found' });
    }
    
    if (tab.status === 'closed') {
      return res.status(403).json({ error: 'This tab has been closed' });
    }
    
    const joinedAt = new Date().toISOString();
    
    // Calculate fair share - use price group amount if provided, otherwise equal split
    let fairShareCents = (tab.total_amount_cents && tab.people_count > 0)
      ? Math.floor(tab.total_amount_cents / tab.people_count)
      : 0;
    
    if (priceGroupId) {
      const priceGroup = db.prepare(`SELECT * FROM group_tab_price_groups WHERE id = ? AND group_tab_id = ?`).get(priceGroupId, tab.id);
      if (priceGroup) {
        fairShareCents = priceGroup.amount_cents;
      }
    }
    
    if (req.user) {
      // Check if already a participant
      const existing = db.prepare(`
        SELECT * FROM group_tab_participants WHERE group_tab_id = ? AND user_id = ?
      `).get(tab.id, req.user.id);
      
      if (existing) {
        // Update hide_name if provided
        if (hideName !== undefined) {
          db.prepare(`UPDATE group_tab_participants SET hide_name = ? WHERE id = ?`)
            .run(hideName ? 1 : 0, existing.id);
          existing.hide_name = hideName ? 1 : 0;
        }
        return res.json({ success: true, participant: existing, alreadyJoined: true });
      }
      
      const result = db.prepare(`
        INSERT INTO group_tab_participants (group_tab_id, user_id, role, is_member, joined_at, price_group_id, fair_share_cents, remaining_cents, total_paid_cents, hide_name)
        VALUES (?, ?, 'participant', 1, ?, ?, ?, ?, 0, ?)
      `).run(tab.id, req.user.id, joinedAt, priceGroupId || null, fairShareCents, fairShareCents, hideName ? 1 : 0);
      
      // Notify the organizer that a member joined
      db.prepare(`
        INSERT INTO messages (user_id, tab_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        tab.creator_user_id,
        tab.id,
        'New Participant Joined',
        `${req.user.full_name || 'A member'} joined your tab "${tab.name}"`,
        joinedAt,
        'GROUPTAB_PARTICIPANT_JOINED'
      );
      
      res.json({
        success: true,
        participant: { id: result.lastInsertRowid, isMember: true, role: 'participant', fairShareCents, remainingCents: fairShareCents, priceGroupId: priceGroupId || null, hideName: hideName ? 1 : 0 }
      });
    } else {
      if (!guestName || !guestName.trim()) {
        return res.status(400).json({ error: 'Guest name is required' });
      }
      
      const guestSessionToken = crypto.randomBytes(32).toString('hex');
      
      const result = db.prepare(`
        INSERT INTO group_tab_participants (group_tab_id, guest_name, guest_session_token, role, is_member, joined_at, price_group_id, fair_share_cents, remaining_cents, total_paid_cents, hide_name)
        VALUES (?, ?, ?, 'participant', 0, ?, ?, ?, ?, 0, ?)
      `).run(tab.id, guestName.trim(), guestSessionToken, joinedAt, priceGroupId || null, fairShareCents, fairShareCents, hideName ? 1 : 0);
      
      // Notify the organizer that a guest joined
      db.prepare(`
        INSERT INTO messages (user_id, tab_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        tab.creator_user_id,
        tab.id,
        'Guest Joined',
        `${guestName.trim()} joined your tab "${tab.name}" as a guest`,
        joinedAt,
        'GROUPTAB_GUEST_JOINED'
      );
      
      res.cookie('grouptab_guest_session', guestSessionToken, {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: 'lax'
      });
      
      res.json({
        success: true,
        participant: { id: result.lastInsertRowid, isMember: false, guestName: guestName.trim(), role: 'participant' }
      });
    }
  } catch (err) {
    console.error('Error joining tab:', err);
    res.status(500).json({ error: 'Failed to join tab' });
  }
});

// Get fairness data by token (public for magic link access)
app.get('/api/tabs/token/:token/fairness', (req, res) => {
  const { token } = req.params;
  
  try {
    const tab = db.prepare(`SELECT * FROM group_tabs WHERE magic_token = ?`).get(token);
    if (!tab) {
      return res.status(404).json({ error: 'Tab not found' });
    }
    
    if (tab.status === 'closed') {
      return res.status(403).json({ error: 'This tab has been closed' });
    }
    
    const participants = db.prepare(`
      SELECT gtp.*, 
        COALESCE(gtp.guest_name, u.full_name) as display_name,
        (SELECT COALESCE(SUM(amount_cents), 0) FROM group_tab_expenses WHERE payer_participant_id = gtp.id) as expenses_paid_cents,
        (SELECT COALESCE(SUM(amount_cents), 0) FROM group_tab_payments WHERE from_participant_id = gtp.id) as payments_made_cents,
        (SELECT COALESCE(SUM(amount_cents), 0) FROM group_tab_payments WHERE to_participant_id = gtp.id) as payments_received_cents
      FROM group_tab_participants gtp
      LEFT JOIN users u ON gtp.user_id = u.id
      WHERE gtp.group_tab_id = ?
    `).all(tab.id);
    
    // Get price groups if applicable
    const priceGroups = db.prepare('SELECT * FROM group_tab_price_groups WHERE group_tab_id = ?').all(tab.id);
    const priceGroupMap = {};
    priceGroups.forEach(pg => priceGroupMap[pg.id] = pg);
    
    // Calculate total
    let totalAmount = 0;
    if (tab.tab_type === 'one_bill') {
      totalAmount = tab.total_amount_cents || 0;
    } else {
      const expenseSum = db.prepare(`
        SELECT COALESCE(SUM(amount_cents), 0) as total FROM group_tab_expenses WHERE group_tab_id = ?
      `).get(tab.id);
      totalAmount = expenseSum.total;
    }
    
    // Calculate fair shares and balances
    let totalWeight = 0;
    for (const p of participants) {
      let weight = p.tier_multiplier || 1;
      if (tab.seat_count && p.seats_claimed) {
        weight = p.seats_claimed;
      }
      p._weight = weight;
      totalWeight += weight;
    }
    
    const payRateMultiplier = tab.tab_type === 'one_bill' ? (tab.expected_pay_rate || 100) / 100 : 1;
    
    const fairnessData = [];
    let totalDeviation = 0;
    
    for (const p of participants) {
      let fairShare = 0;
      
      if (tab.split_mode === 'price_groups') {
        // Price Groups Mode
        if (p.price_group_id && priceGroupMap[p.price_group_id]) {
          fairShare = priceGroupMap[p.price_group_id].amount_cents;
        } else {
          // Default to first group or equal split if no groups
          fairShare = priceGroups.length > 0 
            ? priceGroups[0].amount_cents 
            : Math.round((totalAmount / participants.length) * payRateMultiplier);
        }
      } else {
        // Standard Weighted/Equal Mode
        fairShare = totalWeight > 0 ? Math.round((totalAmount * p._weight / totalWeight) * payRateMultiplier) : 0;
      }
      
      let actualContribution;
      if (tab.tab_type === 'multi_bill') {
        actualContribution = p.expenses_paid_cents + p.payments_made_cents - p.payments_received_cents;
      } else {
        actualContribution = p.payments_made_cents;
      }
      
      const balance = actualContribution - fairShare;
      totalDeviation += Math.abs(balance);
      
      fairnessData.push({
        participantId: p.id,
        displayName: p.display_name || 'Unknown',
        isMember: p.is_member === 1,
        fairShare,
        actualPaid: actualContribution,
        balance,
        percentOfFair: fairShare > 0 ? Math.round((actualContribution / fairShare) * 100) : 0
      });
    }
    
    // Global fairness score
    let globalScore = 100;
    if (totalAmount > 0) {
      globalScore = Math.max(0, Math.min(100, Math.round(100 * (1 - totalDeviation / (2 * totalAmount)))));
    }
    
    // Generate settlement suggestions
    const settlements = [];
    const debtors = fairnessData.filter(b => b.balance < -50).map(b => ({...b})).sort((a, b) => a.balance - b.balance);
    const creditors = fairnessData.filter(b => b.balance > 50).map(b => ({...b})).sort((a, b) => b.balance - a.balance);
    
    while (debtors.length > 0 && creditors.length > 0) {
      const debtor = debtors[0];
      const creditor = creditors[0];
      const amount = Math.min(Math.abs(debtor.balance), creditor.balance);
      
      if (amount >= 50) {
        settlements.push({
          fromId: debtor.participantId,
          fromName: debtor.displayName,
          toId: creditor.participantId,
          toName: creditor.displayName,
          amountCents: Math.round(amount)
        });
      }
      
      debtor.balance += amount;
      creditor.balance -= amount;
      
      if (Math.abs(debtor.balance) < 50) debtors.shift();
      if (creditor.balance < 50) creditors.shift();
    }
    
    // Calculate summary stats
    const totalPayments = participants.reduce((sum, p) => sum + (p.payments_made_cents || 0), 0);
    const projectedTotal = tab.split_mode === 'price_groups' 
      ? fairnessData.reduce((sum, p) => sum + p.fairShare, 0) 
      : totalAmount;

    res.json({
      success: true,
      tabType: tab.tab_type,
      splitMode: tab.split_mode,
      totalAmount,
      expectedPayRate: tab.expected_pay_rate,
      globalScore,
      participants: fairnessData,
      settlements,
      priceGroups,
      summary: {
        tabTotal: totalAmount,
        projectedTotal,
        totalPayments,
        shortfallSurplus: projectedTotal - totalAmount
      }
    });
  } catch (err) {
    console.error('Error calculating fairness:', err);
    res.status(500).json({ error: 'Failed to calculate fairness' });
  }
});

// Add participant (organizer only)
app.post('/api/grouptabs/:id/participants', requireAuth, (req, res) => {
  const tabId = parseInt(req.params.id);
  const { guestName, userId } = req.body;
  
  try {
    // Check if user is organizer
    const organizer = db.prepare(`
      SELECT * FROM group_tab_participants WHERE group_tab_id = ? AND user_id = ? AND role = 'organizer'
    `).get(tabId, req.user.id);
    
    if (!organizer) {
      return res.status(403).json({ error: 'Only the organizer can add participants' });
    }
    
    const tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ?`).get(tabId);
    if (!tab) {
      return res.status(404).json({ error: 'Tab not found' });
    }
    
    if (tab.status === 'closed') {
      return res.status(400).json({ error: 'Cannot add participants to a closed tab' });
    }
    
    const createdAt = new Date().toISOString();
    
    // Calculate fair share for the new participant
    const fairShareCents = (tab.total_amount_cents && tab.people_count > 0)
      ? Math.floor(tab.total_amount_cents / tab.people_count)
      : 0;
    
    if (userId) {
      // Adding an existing user
      const existingParticipant = db.prepare(`
        SELECT * FROM group_tab_participants WHERE group_tab_id = ? AND user_id = ?
      `).get(tabId, userId);
      
      if (existingParticipant) {
        return res.status(400).json({ error: 'User is already a participant' });
      }
      
      const result = db.prepare(`
        INSERT INTO group_tab_participants (group_tab_id, user_id, role, is_member, joined_at, fair_share_cents, remaining_cents, total_paid_cents)
        VALUES (?, ?, 'participant', 1, ?, ?, ?, 0)
      `).run(tabId, userId, createdAt, fairShareCents, fairShareCents);
      
      res.json({ success: true, participant: { id: result.lastInsertRowid, fairShareCents, remainingCents: fairShareCents } });
    } else if (guestName) {
      // Adding a guest
      const result = db.prepare(`
        INSERT INTO group_tab_participants (group_tab_id, guest_name, role, is_member, joined_at, fair_share_cents, remaining_cents, total_paid_cents)
        VALUES (?, ?, 'participant', 0, ?, ?, ?, 0)
      `).run(tabId, guestName.trim(), createdAt, fairShareCents, fairShareCents);
      
      res.json({ success: true, participant: { id: result.lastInsertRowid, fairShareCents, remainingCents: fairShareCents } });
    } else {
      return res.status(400).json({ error: 'Guest name or user ID is required' });
    }
  } catch (err) {
    console.error('Error adding participant:', err);
    res.status(500).json({ error: 'Failed to add participant' });
  }
});

// Remove pending participant (organizer only)
// Only allows removing participants who have no payments
app.delete('/api/grouptabs/:id/participants/:participantId', requireAuth, (req, res) => {
  const tabId = parseInt(req.params.id);
  const participantId = parseInt(req.params.participantId);
  
  try {
    // Check if user is the tab creator
    const tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ?`).get(tabId);
    if (!tab) {
      return res.status(404).json({ error: 'Tab not found' });
    }
    
    if (tab.creator_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the tab creator can remove participants' });
    }
    
    // Get the participant
    const participant = db.prepare(`
      SELECT * FROM group_tab_participants WHERE id = ? AND group_tab_id = ?
    `).get(participantId, tabId);
    
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }
    
    // Don't allow removing the organizer
    if (participant.role === 'organizer') {
      return res.status(400).json({ error: 'Cannot remove the organizer' });
    }
    
    // Check if participant has any payments
    const payments = db.prepare(`
      SELECT COUNT(*) as count FROM group_tab_payments WHERE from_participant_id = ?
    `).get(participantId);
    
    if (payments.count > 0) {
      return res.status(400).json({ error: 'Cannot remove participant who has made payments' });
    }
    
    // Delete the participant
    db.prepare(`DELETE FROM group_tab_participants WHERE id = ?`).run(participantId);
    
    res.json({ success: true, message: 'Participant removed' });
    
  } catch (err) {
    console.error('Error removing participant:', err);
    res.status(500).json({ error: 'Failed to remove participant' });
  }
});

// Update participant (seats, tier, price group)
app.patch('/api/grouptabs/:id/participants/:participantId', (req, res) => {
  const tabId = parseInt(req.params.id);
  const participantId = parseInt(req.params.participantId);
  const { assignedSeats, tierId, priceGroupId, customAmountCents } = req.body;
  
  try {
    const tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ?`).get(tabId);
    if (!tab) {
      return res.status(404).json({ error: 'Tab not found' });
    }
    
    // Verify participant exists and belongs to tab
    const participant = db.prepare(`
      SELECT * FROM group_tab_participants WHERE id = ? AND group_tab_id = ?
    `).get(participantId, tabId);
    
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }
    
    // Access control
    let isAuthorized = false;
    if (req.user && participant.user_id === req.user.id) {
      isAuthorized = true;
    } else if (req.cookies.grouptab_guest_session && participant.guest_session_token === req.cookies.grouptab_guest_session) {
      isAuthorized = true;
    } else if (req.user) {
      // Check if organizer
      const organizer = db.prepare(`
        SELECT * FROM group_tab_participants WHERE group_tab_id = ? AND user_id = ? AND role = 'organizer'
      `).get(tabId, req.user.id);
      if (organizer) isAuthorized = true;
    }
    
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Not authorized to update this participant' });
    }
    
    const updates = [];
    const params = [];
    
    if (assignedSeats !== undefined) {
      updates.push('assigned_seats = ?');
      params.push(JSON.stringify(assignedSeats));
      
      // Also update seats_claimed count
      if (Array.isArray(assignedSeats)) {
        updates.push('seats_claimed = ?');
        params.push(assignedSeats.length);
      }
    }
    
    if (tierId !== undefined) { 
      updates.push('tier_id = ?'); 
      params.push(tierId); 
    }
    
    if (priceGroupId !== undefined) { 
      updates.push('price_group_id = ?'); 
      params.push(priceGroupId); 
      
      // Also update fair_share_cents based on the price group amount
      if (priceGroupId) {
        const priceGroup = db.prepare(`
          SELECT amount_cents FROM group_tab_price_groups WHERE id = ? AND group_tab_id = ?
        `).get(priceGroupId, tabId);
        if (priceGroup) {
          updates.push('fair_share_cents = ?');
          params.push(priceGroup.amount_cents);
        }
      }
    }
    
    if (customAmountCents !== undefined) { 
      updates.push('custom_amount_cents = ?'); 
      params.push(customAmountCents); 
    }
    
    if (updates.length > 0) {
      params.push(participantId);
      db.prepare(`UPDATE group_tab_participants SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    
    // Return updated participant data
    const updatedParticipant = db.prepare(`
      SELECT * FROM group_tab_participants WHERE id = ?
    `).get(participantId);
    
    res.json({ 
      success: true,
      participant: {
        id: updatedParticipant.id,
        priceGroupId: updatedParticipant.price_group_id,
        fairShareCents: updatedParticipant.fair_share_cents
      }
    });
  } catch (err) {
    console.error('Error updating participant:', err);
    res.status(500).json({ error: 'Failed to update participant' });
  }
});

// Get expenses for a tab
app.get('/api/grouptabs/:id/expenses', requireAuth, (req, res) => {
  const tabId = parseInt(req.params.id);
  
  try {
    const participant = db.prepare(`
      SELECT * FROM group_tab_participants WHERE group_tab_id = ? AND user_id = ?
    `).get(tabId, req.user.id);
    
    if (!participant) {
      return res.status(403).json({ error: 'Not a participant of this tab' });
    }
    
    const expenses = db.prepare(`
      SELECT 
        e.*,
        p.guest_name,
        u.full_name
      FROM group_tab_expenses e
      LEFT JOIN group_tab_participants p ON e.payer_participant_id = p.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE e.group_tab_id = ?
      ORDER BY e.expense_date DESC, e.created_at DESC
    `).all(tabId);
    
    res.json({ expenses });
  } catch (err) {
    console.error('Error loading expenses:', err);
    res.status(500).json({ error: 'Failed to load expenses' });
  }
});

// Get payments for a tab
app.get('/api/grouptabs/:id/payments', requireAuth, (req, res) => {
  const tabId = parseInt(req.params.id);
  
  try {
    const participant = db.prepare(`
      SELECT * FROM group_tab_participants WHERE group_tab_id = ? AND user_id = ?
    `).get(tabId, req.user.id);
    
    if (!participant) {
      return res.status(403).json({ error: 'Not a participant of this tab' });
    }
    
    const payments = db.prepare(`
      SELECT 
        pay.*,
        pf.guest_name as from_guest_name,
        uf.full_name as from_name,
        pt.guest_name as to_guest_name,
        ut.full_name as to_name
      FROM group_tab_payments pay
      LEFT JOIN group_tab_participants pf ON pay.from_participant_id = pf.id
      LEFT JOIN users uf ON pf.user_id = uf.id
      LEFT JOIN group_tab_participants pt ON pay.to_participant_id = pt.id
      LEFT JOIN users ut ON pt.user_id = ut.id
      WHERE pay.group_tab_id = ?
      ORDER BY pay.created_at DESC
    `).all(tabId);
    
    res.json({ payments });
  } catch (err) {
    console.error('Error loading payments:', err);
    res.status(500).json({ error: 'Failed to load payments' });
  }
});

// Add expense (multi_bill tabs, members only)
app.post('/api/grouptabs/:id/expenses', requireAuth, uploadGrouptabs.single('receipt'), (req, res) => {
  const tabId = parseInt(req.params.id);
  const { amountCents, description, category, expenseDate } = req.body;
  
  try {
    const participant = db.prepare(`
      SELECT * FROM group_tab_participants WHERE group_tab_id = ? AND user_id = ? AND is_member = 1
    `).get(tabId, req.user.id);
    
    if (!participant) {
      return res.status(403).json({ error: 'Only members can add expenses' });
    }
    
    if (!amountCents || !description) {
      return res.status(400).json({ error: 'Amount and description are required' });
    }
    
    const createdAt = new Date().toISOString();
    
    const result = db.prepare(`
      INSERT INTO group_tab_expenses (group_tab_id, payer_participant_id, amount_cents, description, category, expense_date, receipt_file_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tabId,
      participant.id,
      parseInt(amountCents),
      description,
      category || null,
      expenseDate || createdAt.split('T')[0],
      req.file ? req.file.path : null,
      createdAt
    );
    
    // Get tab name and all member participants for activity messages
    const tab = db.prepare(`SELECT name FROM group_tabs WHERE id = ?`).get(tabId);
    const memberParticipants = db.prepare(`
      SELECT user_id FROM group_tab_participants WHERE group_tab_id = ? AND user_id IS NOT NULL AND user_id != ?
    `).all(tabId, req.user.id);
    
    const formattedAmount = (parseInt(amountCents) / 100).toFixed(2);
    
    // Notify all other member participants
    for (const p of memberParticipants) {
      db.prepare(`
        INSERT INTO messages (user_id, tab_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        p.user_id,
        tabId,
        'New Expense Added',
        `${req.user.full_name || 'Someone'} added an expense of €${formattedAmount} for "${description}" in "${tab.name}"`,
        createdAt,
        'GROUPTAB_EXPENSE_ADDED'
      );
    }
    
    res.json({ success: true, expense: { id: result.lastInsertRowid } });
  } catch (err) {
    console.error('Error adding expense:', err);
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

// Add payment (guest or member)
app.post('/api/grouptabs/:id/payments', uploadGrouptabs.single('proof'), (req, res) => {
  const tabId = parseInt(req.params.id);
  const { amountCents, toParticipantId, method, note } = req.body;
  
  try {
    const tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ?`).get(tabId);
    if (!tab) {
      return res.status(404).json({ error: 'Tab not found' });
    }
    
    if (tab.status === 'closed') {
      return res.status(400).json({ error: 'Cannot add payments to a closed tab' });
    }
    
    let fromParticipant = null;
    if (req.user) {
      fromParticipant = db.prepare(`
        SELECT * FROM group_tab_participants WHERE group_tab_id = ? AND user_id = ?
      `).get(tabId, req.user.id);
    } else {
      fromParticipant = getGuestParticipant(req, tabId);
    }
    
    if (!fromParticipant) {
      return res.status(403).json({ error: 'You are not a participant in this tab' });
    }
    
    if (!amountCents || parseInt(amountCents) <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }
    
    if (tab.proof_required === 'required' && !req.file) {
      return res.status(400).json({ error: 'Payment proof is required' });
    }
    
    const createdAt = new Date().toISOString();
    
    const result = db.prepare(`
      INSERT INTO group_tab_payments (group_tab_id, from_participant_id, to_participant_id, amount_cents, method, note, proof_file_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tabId,
      fromParticipant.id,
      toParticipantId ? parseInt(toParticipantId) : null,
      parseInt(amountCents),
      method || null,
      note || null,
      req.file ? req.file.path : null,
      createdAt
    );
    
    // Create activity messages for payment
    const formattedAmount = (parseInt(amountCents) / 100).toFixed(2);
    const payerName = fromParticipant.guest_name || (req.user ? req.user.full_name : 'Someone');
    
    // If paying to a specific participant, notify them
    if (toParticipantId) {
      const toParticipant = db.prepare(`
        SELECT p.*, u.full_name as recipient_name 
        FROM group_tab_participants p 
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.id = ?
      `).get(parseInt(toParticipantId));
      
      if (toParticipant && toParticipant.user_id) {
        db.prepare(`
          INSERT INTO messages (user_id, tab_id, subject, body, created_at, event_type)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          toParticipant.user_id,
          tabId,
          'Payment Received',
          `${payerName} paid you €${formattedAmount} in "${tab.name}"`,
          createdAt,
          'GROUPTAB_PAYMENT_RECEIVED'
        );
      }
    }
    
    // Notify the organizer about payments
    const organizer = db.prepare(`
      SELECT user_id FROM group_tab_participants 
      WHERE group_tab_id = ? AND role = 'organizer' AND user_id != ?
    `).get(tabId, req.user ? req.user.id : -1);
    
    if (organizer) {
      db.prepare(`
        INSERT INTO messages (user_id, tab_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        organizer.user_id,
        tabId,
        'New Payment',
        `${payerName} made a payment of €${formattedAmount} in "${tab.name}"`,
        createdAt,
        'GROUPTAB_PAYMENT_MADE'
      );
    }
    
    res.json({ success: true, payment: { id: result.lastInsertRowid } });
  } catch (err) {
    console.error('Error recording payment:', err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// =============================================
// SIMPLE PAYMENT RECORDING
// =============================================
app.post('/api/grouptabs/:id/simple-payment', (req, res) => {
  const tabId = parseInt(req.params.id);
  const { participantId, amountCents, method, token, priceGroupId } = req.body;
  
  console.log('[SIMPLE-PAYMENT] Recording payment:', { tabId, participantId, amountCents, method, priceGroupId });
  
  try {
    // Validate token access
    let tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ? AND owner_token = ?`).get(tabId, token);
    if (!tab) {
      tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ? AND magic_token = ?`).get(tabId, token);
    }
    if (!tab) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get the participant
    const participant = db.prepare(`SELECT * FROM group_tab_participants WHERE id = ? AND group_tab_id = ?`)
      .get(parseInt(participantId), tabId);
    
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }
    
    // If priceGroupId is provided, update the participant's group and fair share FIRST
    if (priceGroupId) {
        const pg = db.prepare('SELECT amount_cents FROM group_tab_price_groups WHERE id = ?').get(priceGroupId);
        if (pg) {
            const newFairShare = pg.amount_cents;
            const currentTotalPaid = participant.total_paid_cents || 0;
            // Recalculate remaining based on new fair share, BEFORE this new payment
            const remainingBeforePayment = Math.max(0, newFairShare - currentTotalPaid);
            
            db.prepare(`
                UPDATE group_tab_participants 
                SET price_group_id = ?, fair_share_cents = ?, remaining_cents = ?
                WHERE id = ?
            `).run(priceGroupId, newFairShare, remainingBeforePayment, participant.id);
            
            // Update local object to reflect changes
            participant.fair_share_cents = newFairShare;
            participant.remaining_cents = remainingBeforePayment;
            participant.price_group_id = priceGroupId;
        }
    }
    
    const amount = parseInt(amountCents);
    const createdAt = new Date().toISOString();
    
    // Calculate new values (after payment)
    const currentRemaining = participant.remaining_cents ?? participant.fair_share_cents ?? 0;
    const newRemaining = Math.max(0, currentRemaining - amount);
    const newTotalPaid = (participant.total_paid_cents || 0) + amount;
    
    // Update participant with payment results
    db.prepare(`
      UPDATE group_tab_participants 
      SET remaining_cents = ?, total_paid_cents = ?
      WHERE id = ?
    `).run(newRemaining, newTotalPaid, participant.id);
    
    // Update tab's paid_up_cents
    const appliedToTab = Math.min(amount, currentRemaining);
    db.prepare(`
      UPDATE group_tabs 
      SET paid_up_cents = paid_up_cents + ?
      WHERE id = ?
    `).run(appliedToTab, tabId);
    
    // Record the payment
    const paymentResult = db.prepare(`
      INSERT INTO group_tab_payments (
        group_tab_id, from_participant_id, amount_cents, method, status, created_at, payment_type
      ) VALUES (?, ?, ?, ?, 'confirmed', ?, 'normal')
    `).run(tabId, participant.id, amount, method || 'cash', createdAt);
    
    console.log('[SIMPLE-PAYMENT] Success! Payment ID:', paymentResult.lastInsertRowid);
    
    res.json({ 
      success: true, 
      paymentId: paymentResult.lastInsertRowid,
      participant: {
        id: participant.id,
        newRemaining,
        newTotalPaid,
        priceGroupId: participant.price_group_id
      }
    });
    
  } catch (err) {
    console.error('[SIMPLE-PAYMENT ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// GROUPTAB PAYMENT REPORTS (Group Gift Only)
// For tracking reported payments pending confirmation
// =============================================

// Report a payment (for participants in Group Gift tabs)
app.post('/api/grouptabs/:id/payment-reports', uploadGrouptabs.single('proof'), (req, res) => {
  const tabId = parseInt(req.params.id);
  const { reporterName, amountCents, method, paidAt, note, token, additionalNames } = req.body;
  
  try {
    // Validate tab access via magic token OR invite_code (for invited guests)
    let tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ? AND magic_token = ?`).get(tabId, token);
    if (!tab) {
      // Also try invite_code for invited guests
      tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ? AND invite_code = ?`).get(tabId, token);
    }
    if (!tab) {
      return res.status(403).json({ error: 'Access denied or tab not found' });
    }
    
    // Validate required fields
    if (!reporterName || !reporterName.trim()) {
      return res.status(400).json({ error: 'Your name is required' });
    }
    if (!amountCents || parseInt(amountCents) <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }
    if (!method) {
      return res.status(400).json({ error: 'Payment method is required' });
    }
    if (!paidAt) {
      return res.status(400).json({ error: 'Payment date is required' });
    }
    
    // Find or create participant
    let participantId = null;
    let participant = null;
    
    if (req.user) {
      participant = db.prepare(`
        SELECT * FROM group_tab_participants WHERE group_tab_id = ? AND user_id = ?
      `).get(tabId, req.user.id);
    } else {
      participant = getGuestParticipant(req, tabId);
    }
    
    if (participant) {
      participantId = participant.id;
    }
    
    const createdAt = new Date().toISOString();
    // Store path with leading slash for web access
    const proofPath = req.file ? '/' + req.file.path.replace(/\\/g, '/') : null;
    
    // Parse additional names (JSON string from frontend)
    let parsedAdditionalNames = null;
    if (additionalNames) {
      try {
        parsedAdditionalNames = JSON.parse(additionalNames);
        if (!Array.isArray(parsedAdditionalNames)) {
          parsedAdditionalNames = null;
        }
      } catch (e) {
        // Invalid JSON, ignore
      }
    }
    
    // Calculate fair share for new participants
    const peopleCount = tab.people_count || 1;
    const totalAmount = tab.total_amount_cents || 0;
    const fairShareCents = Math.floor(totalAmount / peopleCount);
    
    // Create pending participant entries for additional names IMMEDIATELY
    // They appear as pending until payment is confirmed
    const additionalParticipantIds = [];
    if (parsedAdditionalNames && parsedAdditionalNames.length > 0) {
      for (const name of parsedAdditionalNames) {
        if (name && name.trim()) {
          // Create a new pending participant entry (total_paid_cents = 0, remaining = fairShare)
          const insertResult = db.prepare(`
            INSERT INTO group_tab_participants (
              group_tab_id, guest_name, role, fair_share_cents, total_paid_cents, remaining_cents, joined_at
            ) VALUES (?, ?, 'contributor', ?, 0, ?, ?)
          `).run(
            tabId,
            name.trim(),
            fairShareCents,
            fairShareCents, // They still owe their share until payment is confirmed
            createdAt
          );
          additionalParticipantIds.push(insertResult.lastInsertRowid);
        }
      }
    }
    
    const result = db.prepare(`
      INSERT INTO group_tab_payment_reports (
        group_tab_id, participant_id, reporter_name, amount_cents, method, paid_at, proof_file_path, note, status, created_at, additional_names
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      tabId,
      participantId,
      reporterName.trim(),
      parseInt(amountCents),
      method,
      paidAt,
      proofPath,
      note || null,
      createdAt,
      parsedAdditionalNames ? JSON.stringify(parsedAdditionalNames) : null
    );
    
    // Notify the organizer
    const organizer = db.prepare(`
      SELECT user_id FROM group_tab_participants 
      WHERE group_tab_id = ? AND role = 'organizer'
    `).get(tabId);
    
    if (organizer && organizer.user_id) {
      const formattedAmount = (parseInt(amountCents) / 100).toFixed(2);
      const additionalInfo = parsedAdditionalNames && parsedAdditionalNames.length > 0 
        ? ` (also paying for: ${parsedAdditionalNames.join(', ')})` 
        : '';
      db.prepare(`
        INSERT INTO messages (user_id, tab_id, subject, body, created_at, event_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        organizer.user_id,
        tabId,
        'Payment Reported',
        `${reporterName.trim()} reported a payment of €${formattedAmount}${additionalInfo} for "${tab.name}" - awaiting your confirmation`,
        createdAt,
        'GROUPTAB_PAYMENT_REPORTED'
      );
    }
    
    res.json({ 
      success: true, 
      report: { 
        id: result.lastInsertRowid,
        status: 'pending',
        reporterName: reporterName.trim(),
        amountCents: parseInt(amountCents),
        method,
        paidAt,
        createdAt
      }
    });
    
  } catch (err) {
    console.error('Error reporting payment:', err);
    res.status(500).json({ error: 'Failed to report payment' });
  }
});

// Get payment reports for a tab
app.get('/api/grouptabs/:id/payment-reports', (req, res) => {
  const tabId = parseInt(req.params.id);
  const { token } = req.query;
  
  try {
    // Validate access - creator can see all, participants can see their own
    let tab = null;
    let isCreator = false;
    
    if (token) {
      // Check owner_token first (creator access)
      tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ? AND owner_token = ?`).get(tabId, token);
      if (tab) isCreator = true;
      
      // Also check manage_code (short creator token)
      if (!tab) {
        tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ? AND manage_code = ?`).get(tabId, token);
        if (tab) isCreator = true;
      }
      
      // Check magic_token (viewer access)
      if (!tab) {
        tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ? AND magic_token = ?`).get(tabId, token);
      }
      
      // Also try invite_code for invited guests
      if (!tab) {
        tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ? AND invite_code = ?`).get(tabId, token);
      }
    }
    
    if (!tab && req.user) {
      tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ?`).get(tabId);
      if (tab && tab.creator_user_id === req.user.id) {
        isCreator = true;
      }
    }
    
    if (!tab) {
      return res.status(404).json({ error: 'Tab not found' });
    }
    
    let reports;
    if (isCreator) {
      // Creator sees all reports
      reports = db.prepare(`
        SELECT pr.*, u.full_name as reviewer_name
        FROM group_tab_payment_reports pr
        LEFT JOIN users u ON pr.reviewed_by = u.id
        WHERE pr.group_tab_id = ?
        ORDER BY pr.created_at DESC
      `).all(tabId);
    } else {
      // Participant sees only their reports
      let participantId = null;
      if (req.user) {
        const participant = db.prepare(`
          SELECT id FROM group_tab_participants WHERE group_tab_id = ? AND user_id = ?
        `).get(tabId, req.user.id);
        if (participant) participantId = participant.id;
      } else {
        const guest = getGuestParticipant(req, tabId);
        if (guest) participantId = guest.id;
      }
      
      if (participantId) {
        reports = db.prepare(`
          SELECT * FROM group_tab_payment_reports
          WHERE group_tab_id = ? AND participant_id = ?
          ORDER BY created_at DESC
        `).all(tabId, participantId);
      } else {
        reports = [];
      }
    }
    
    res.json({ success: true, reports, isCreator });
    
  } catch (err) {
    console.error('Error getting payment reports:', err);
    res.status(500).json({ error: 'Failed to get payment reports' });
  }
});

// Confirm a payment report (creator only)
app.patch('/api/grouptabs/:id/payment-reports/:reportId/confirm', (req, res) => {
  const tabId = parseInt(req.params.id);
  const reportId = parseInt(req.params.reportId);
  const { token } = req.body;
  
  try {
    // Validate creator access
    let tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ? AND owner_token = ?`).get(tabId, token);
    let isCreator = !!tab;
    
    if (!tab && req.user) {
      tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ? AND creator_user_id = ?`).get(tabId, req.user.id);
      isCreator = !!tab;
    }
    
    if (!tab || !isCreator) {
      return res.status(403).json({ error: 'Only the tab creator can confirm payments' });
    }
    
    const report = db.prepare(`
      SELECT * FROM group_tab_payment_reports WHERE id = ? AND group_tab_id = ?
    `).get(reportId, tabId);
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    if (report.status !== 'pending') {
      return res.status(400).json({ error: 'Report has already been processed' });
    }
    
    const reviewedAt = new Date().toISOString();
    const reviewerId = req.user ? req.user.id : null;
    
    // Update report status
    db.prepare(`
      UPDATE group_tab_payment_reports 
      SET status = 'confirmed', reviewed_at = ?, reviewed_by = ?
      WHERE id = ?
    `).run(reviewedAt, reviewerId, reportId);
    
    // Calculate fair share for new participants
    const peopleCount = tab.people_count || 1;
    const totalAmount = tab.total_amount_cents || 0;
    const fairShareCents = Math.floor(totalAmount / peopleCount);
    
    // Update participant's payment totals if participant exists
    if (report.participant_id) {
      const participant = db.prepare(`SELECT * FROM group_tab_participants WHERE id = ?`).get(report.participant_id);
      if (participant) {
        const newTotalPaid = (participant.total_paid_cents || 0) + report.amount_cents;
        const fairShare = participant.fair_share_cents || 0;
        const newRemaining = Math.max(0, fairShare - newTotalPaid);
        
        db.prepare(`
          UPDATE group_tab_participants 
          SET total_paid_cents = ?, remaining_cents = ?
          WHERE id = ?
        `).run(newTotalPaid, newRemaining, report.participant_id);
      }
    }
    
    // Update additional participants to mark them as fully paid (they were created as pending when report was submitted)
    if (report.additional_names) {
      try {
        const additionalNames = JSON.parse(report.additional_names);
        if (Array.isArray(additionalNames) && additionalNames.length > 0) {
          for (const name of additionalNames) {
            if (name && name.trim()) {
              // Find the pending participant by name and update to fully paid
              db.prepare(`
                UPDATE group_tab_participants 
                SET total_paid_cents = fair_share_cents, remaining_cents = 0
                WHERE group_tab_id = ? AND guest_name = ? AND total_paid_cents = 0
              `).run(tabId, name.trim());
            }
          }
        }
      } catch (e) {
        console.error('[Payment Confirm] Error processing additional names:', e);
        // Don't fail the confirmation, just log the error
      }
    }
    
    // Update tab's paid_up_cents and total_raised_cents for pot modes
    if (tab.gift_mode === 'gift_pot_target' || tab.gift_mode === 'gift_pot_open') {
      db.prepare(`
        UPDATE group_tabs 
        SET total_raised_cents = COALESCE(total_raised_cents, 0) + ?
        WHERE id = ?
      `).run(report.amount_cents, tabId);
    } else {
      // Debt mode - update paid_up_cents
      db.prepare(`
        UPDATE group_tabs 
        SET paid_up_cents = COALESCE(paid_up_cents, 0) + ?
        WHERE id = ?
      `).run(report.amount_cents, tabId);
    }
    
    // Also record as a proper payment for tracking
    db.prepare(`
      INSERT INTO group_tab_payments (
        group_tab_id, from_participant_id, amount_cents, method, status, created_at, payment_type, note
      ) VALUES (?, ?, ?, ?, 'confirmed', ?, 'reported', ?)
    `).run(tabId, report.participant_id, report.amount_cents, report.method, reviewedAt, `Confirmed from report #${reportId}`);
    
    res.json({ success: true, message: 'Payment confirmed' });
    
  } catch (err) {
    console.error('Error confirming payment:', err);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// Reject a payment report (creator only)
app.patch('/api/grouptabs/:id/payment-reports/:reportId/reject', (req, res) => {
  const tabId = parseInt(req.params.id);
  const reportId = parseInt(req.params.reportId);
  const { token, reason } = req.body;
  
  try {
    // Validate creator access
    let tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ? AND owner_token = ?`).get(tabId, token);
    let isCreator = !!tab;
    
    if (!tab && req.user) {
      tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ? AND creator_user_id = ?`).get(tabId, req.user.id);
      isCreator = !!tab;
    }
    
    if (!tab || !isCreator) {
      return res.status(403).json({ error: 'Only the tab creator can reject payments' });
    }
    
    const report = db.prepare(`
      SELECT * FROM group_tab_payment_reports WHERE id = ? AND group_tab_id = ?
    `).get(reportId, tabId);
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    if (report.status !== 'pending') {
      return res.status(400).json({ error: 'Report has already been processed' });
    }
    
    const reviewedAt = new Date().toISOString();
    const reviewerId = req.user ? req.user.id : null;
    
    db.prepare(`
      UPDATE group_tab_payment_reports 
      SET status = 'rejected', reviewed_at = ?, reviewed_by = ?, note = COALESCE(note, '') || ?
      WHERE id = ?
    `).run(reviewedAt, reviewerId, reason ? ` [Rejected: ${reason}]` : '', reportId);
    
    // Remove pending participants that were created for additional names
    if (report.additional_names) {
      try {
        const additionalNames = JSON.parse(report.additional_names);
        if (Array.isArray(additionalNames) && additionalNames.length > 0) {
          for (const name of additionalNames) {
            if (name && name.trim()) {
              // Delete the pending participant (only if still unpaid)
              db.prepare(`
                DELETE FROM group_tab_participants 
                WHERE group_tab_id = ? AND guest_name = ? AND total_paid_cents = 0
              `).run(tabId, name.trim());
            }
          }
        }
      } catch (e) {
        console.error('[Payment Reject] Error removing additional participants:', e);
      }
    }
    
    res.json({ success: true, message: 'Payment report rejected' });
    
  } catch (err) {
    console.error('Error rejecting payment:', err);
    res.status(500).json({ error: 'Failed to reject payment' });
  }
});

// =============================================
// GROUPTAB PAYMENT LOGIC - PROCESS PAYMENT (COMPLEX)
// Handles normal payments, overpay detection, and redistribution
// =============================================
app.post('/api/grouptabs/:id/process-payment', upload.single('proof'), (req, res) => {
  const tabId = parseInt(req.params.id);
  let paymentRows = [];
  let confirmOverpay = false;
  let token = null;
  let method = null;
  let note = null;

  console.log('[PAYMENT] Processing payment for tab:', tabId);
  console.log('[PAYMENT] Request body:', JSON.stringify(req.body, null, 2));

  // Handle FormData parsing
  try {
    if (req.body.paymentRows) {
      paymentRows = typeof req.body.paymentRows === 'string' ? JSON.parse(req.body.paymentRows) : req.body.paymentRows;
    }
    confirmOverpay = req.body.confirmOverpay === 'true' || req.body.confirmOverpay === true;
    token = req.body.token;
    method = req.body.method;
    note = req.body.note;
    console.log('[PAYMENT] Parsed paymentRows:', JSON.stringify(paymentRows, null, 2));
  } catch (e) {
    console.error('[PAYMENT] Error parsing payment data:', e);
    return res.status(400).json({ error: 'Invalid payment data format' });
  }
  
  if (!paymentRows || !Array.isArray(paymentRows) || paymentRows.length === 0) {
    console.log('[PAYMENT] No payment rows provided');
    return res.status(400).json({ error: 'Payment rows are required' });
  }
  
  try {
    console.log('[PAYMENT] Looking up tab with token...');
    // Get tab with access validation
    let tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ? AND owner_token = ?`).get(tabId, token);
    let isCreator = !!tab;
    
    if (!tab) {
      tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ? AND magic_token = ?`).get(tabId, token);
    }
    
    if (!tab) {
      return res.status(404).json({ error: 'Tab not found or invalid token' });
    }
    
    if (tab.status === 'closed') {
      return res.status(400).json({ error: 'Cannot add payments to a closed tab' });
    }
    
    // Get all participants with current balances
    const participants = db.prepare(`
      SELECT gtp.*, 
        COALESCE(gtp.guest_name, u.full_name) as display_name,
        u.full_name
      FROM group_tab_participants gtp
      LEFT JOIN users u ON gtp.user_id = u.id
      WHERE gtp.group_tab_id = ?
    `).all(tabId);
    
    console.log('[PAYMENT] Found', participants.length, 'participants');
    console.log('[PAYMENT] Participant IDs:', participants.map(p => p.id));
    
    const participantMap = {};
    participants.forEach(p => { participantMap[p.id] = p; });
    
    // Validate payment rows
    let totalPaymentCents = 0;
    const validatedRows = [];
    
    for (const row of paymentRows) {
      const participantId = parseInt(row.participantId);
      const amountCents = parseInt(row.amountCents);
      
      console.log('[PAYMENT] Processing row: participantId=', participantId, 'amountCents=', amountCents);
      
      if (!participantId || !amountCents || amountCents <= 0) {
        console.log('[PAYMENT] Invalid row data');
        return res.status(400).json({ error: 'Each payment row must have valid participantId and amountCents' });
      }
      
      const participant = participantMap[participantId];
      if (!participant) {
        console.log('[PAYMENT] Participant not found:', participantId);
        return res.status(400).json({ error: `Participant ${participantId} not found` });
      }
      
      console.log('[PAYMENT] Found participant:', participant.display_name || participant.guest_name);
      
      validatedRows.push({
        participantId,
        amountCents,
        participant
      });
      
      totalPaymentCents += amountCents;
    }
    
    console.log('[PAYMENT] Total payment:', totalPaymentCents);
    
    // Calculate total outstanding - use fair_share_cents if remaining_cents is null
    const totalOutstanding = participants.reduce((sum, p) => {
      // If remaining_cents is set, use it; otherwise use fair_share_cents as the initial remaining
      const remaining = p.remaining_cents !== null && p.remaining_cents !== undefined 
        ? p.remaining_cents 
        : (p.fair_share_cents || 0);
      return sum + remaining;
    }, 0);
    
    // Validate total amount doesn't exceed outstanding (only if there IS an outstanding balance)
    if (totalOutstanding > 0 && totalPaymentCents > totalOutstanding) {
      return res.status(400).json({ 
        error: 'Payment amount exceeds total outstanding balance',
        totalPaymentCents,
        totalOutstanding
      });
    }
    
    // Check for overpayment scenario
    let totalOverpay = 0;
    const overpayDetails = [];
    
    for (const row of validatedRows) {
      // Use fair_share_cents if remaining_cents is null
      const remaining = row.participant.remaining_cents !== null && row.participant.remaining_cents !== undefined
        ? row.participant.remaining_cents
        : (row.participant.fair_share_cents || 0);
      if (row.amountCents > remaining) {
        const overpay = row.amountCents - remaining;
        totalOverpay += overpay;
        overpayDetails.push({
          participantId: row.participantId,
          participantName: row.participant.display_name || row.participant.guest_name,
          remaining: remaining,
          paymentAmount: row.amountCents,
          overpayAmount: overpay
        });
      }
    }
    
    // If overpay detected and not confirmed, return confirmation request
    if (totalOverpay > 0 && !confirmOverpay) {
      // Calculate redistribution preview
      const payerIds = new Set(validatedRows.map(r => r.participantId));
      const othersWithRemaining = participants.filter(p => 
        !payerIds.has(p.id) && (p.remaining_cents || 0) > 0
      );
      
      const sumOthersRemaining = othersWithRemaining.reduce((sum, p) => sum + (p.remaining_cents || 0), 0);
      
      const redistribution = othersWithRemaining.map(p => {
        const currentRemaining = p.remaining_cents || 0;
        const shareFactor = sumOthersRemaining > 0 ? currentRemaining / sumOthersRemaining : 0;
        const reduction = Math.floor(totalOverpay * shareFactor);
        
        return {
          participantId: p.id,
          participantName: p.display_name || p.guest_name,
          currentRemaining: currentRemaining,
          reduction: Math.min(reduction, currentRemaining),
          newRemaining: Math.max(0, currentRemaining - reduction)
        };
      });
      
      return res.json({
        requiresConfirmation: true,
        overpayDetails: {
          totalAmount: totalPaymentCents,
          totalRemaining: validatedRows.reduce((sum, r) => sum + (r.participant.remaining_cents || 0), 0),
          overpayAmount: totalOverpay,
          participants: overpayDetails,
          redistribution: redistribution
        }
      });
    }
    
    // Process the payment
    const createdAt = new Date().toISOString();
    const participantUpdates = {};
    let totalApplied = 0;
    
    // First pass: settle each beneficiary up to their remaining
    for (const row of validatedRows) {
      const currentRemaining = row.participant.remaining_cents || 0;
      const applied = Math.min(row.amountCents, currentRemaining);
      
      participantUpdates[row.participantId] = {
        remaining_cents: Math.max(0, currentRemaining - row.amountCents),
        total_paid_cents: (row.participant.total_paid_cents || 0) + row.amountCents
      };
      
      totalApplied += applied;
    }
    
    // Second pass: redistribute overpay if confirmed
    let redistributionApplied = [];
    if (totalOverpay > 0 && confirmOverpay) {
      const payerIds = new Set(validatedRows.map(r => r.participantId));
      const othersWithRemaining = participants
        .filter(p => !payerIds.has(p.id))
        .map(p => ({
          ...p,
          remaining_cents: participantUpdates[p.id]?.remaining_cents ?? p.remaining_cents ?? 0
        }))
        .filter(p => p.remaining_cents > 0);
      
      const sumOthersRemaining = othersWithRemaining.reduce((sum, p) => sum + p.remaining_cents, 0);
      
      if (sumOthersRemaining > 0) {
        let remainingOverpay = totalOverpay;
        
        for (const p of othersWithRemaining) {
          const shareFactor = p.remaining_cents / sumOthersRemaining;
          let reduction = Math.floor(totalOverpay * shareFactor);
          reduction = Math.min(reduction, p.remaining_cents, remainingOverpay);
          
          if (reduction > 0) {
            if (!participantUpdates[p.id]) {
              participantUpdates[p.id] = { remaining_cents: p.remaining_cents };
            }
            participantUpdates[p.id].remaining_cents = Math.max(0, (participantUpdates[p.id].remaining_cents ?? p.remaining_cents) - reduction);
            
            redistributionApplied.push({
              participantId: p.id,
              participantName: p.display_name || p.guest_name,
              reduction: reduction
            });
            
            remainingOverpay -= reduction;
          }
        }
        
        // Handle rounding - give remaining to first participant
        if (remainingOverpay > 0 && redistributionApplied.length > 0) {
          const first = redistributionApplied[0];
          const maxAdditional = participantUpdates[first.participantId].remaining_cents;
          const additional = Math.min(remainingOverpay, maxAdditional);
          participantUpdates[first.participantId].remaining_cents -= additional;
          first.reduction += additional;
        }
      }
    }
    
    // Apply all participant updates in a transaction
    const updateParticipant = db.prepare(`
      UPDATE group_tab_participants 
      SET remaining_cents = ?, total_paid_cents = COALESCE(?, total_paid_cents)
      WHERE id = ?
    `);
    
    for (const [participantId, updates] of Object.entries(participantUpdates)) {
      updateParticipant.run(
        updates.remaining_cents,
        updates.total_paid_cents !== undefined ? updates.total_paid_cents : null,
        parseInt(participantId)
      );
    }
    
    // Calculate new tab totals
    const updatedParticipants = db.prepare(`
      SELECT * FROM group_tab_participants WHERE group_tab_id = ?
    `).all(tabId);
    
    let newPaidUpCents = 0;
    for (const p of updatedParticipants) {
      const fairShare = p.fair_share_cents || 0;
      const remaining = p.remaining_cents || 0;
      newPaidUpCents += (fairShare - remaining);
    }
    
    // Reduce host overpaid
    const totalSettled = totalApplied + redistributionApplied.reduce((sum, r) => sum + r.reduction, 0);
    let newHostOverpaid = Math.max(0, (tab.host_overpaid_cents || 0) - totalSettled);
    
    // Update tab state
    db.prepare(`
      UPDATE group_tabs SET paid_up_cents = ?, host_overpaid_cents = ? WHERE id = ?
    `).run(newPaidUpCents, newHostOverpaid, tabId);
    
    // Record the payment
    const beneficiaryIds = validatedRows.map(r => r.participantId);
    const paymentType = totalOverpay > 0 ? 'overpay' : (validatedRows.length > 1 ? 'multi_person' : 'normal');
    
    // For single payer, use the first participant as from_participant_id
    const primaryPayer = validatedRows[0];
    
    // Use provided method/note/proof if available, otherwise defaults
    const paymentMethod = method || 'transfer';
    const paymentNote = note || (totalOverpay > 0 ? 'Payment with overpay redistribution' : null);
    const proofFilePath = req.file ? req.file.path : null;
    
    db.prepare(`
      INSERT INTO group_tab_payments (
        group_tab_id, from_participant_id, to_participant_id, amount_cents, 
        method, note, status, payment_type, applied_cents, overpay_cents, beneficiary_ids, proof_file_path, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tabId,
      primaryPayer.participantId,
      null,
      totalPaymentCents,
      paymentMethod,
      paymentNote,
      'confirmed',
      paymentType,
      totalApplied,
      totalOverpay,
      JSON.stringify(beneficiaryIds),
      proofFilePath,
      createdAt
    );
    
    // Check if fully settled
    const isFullySettled = updatedParticipants.every(p => (p.remaining_cents || 0) <= 0);
    
    // Return success response
    res.json({
      success: true,
      payment: {
        totalAmount: totalPaymentCents,
        totalApplied: totalApplied,
        totalOverpay: totalOverpay,
        redistribution: redistributionApplied
      },
      tabState: {
        paidUpCents: newPaidUpCents,
        hostOverpaidCents: newHostOverpaid,
        isFullySettled: isFullySettled
      },
      participantUpdates: Object.entries(participantUpdates).map(([id, updates]) => ({
        participantId: parseInt(id),
        ...updates
      }))
    });
    
  } catch (err) {
    console.error('[PAYMENT ERROR] Error processing payment:', err);
    console.error('[PAYMENT ERROR] Stack:', err.stack);
    res.status(500).json({ error: 'Failed to process payment', details: err.message });
  }
});

// Get fairness/settlement data (requires participant access)
app.get('/api/grouptabs/:id/fairness', (req, res) => {
  const tabId = parseInt(req.params.id);
  
  try {
    const tab = db.prepare(`SELECT * FROM group_tabs WHERE id = ?`).get(tabId);
    if (!tab) {
      return res.status(404).json({ error: 'Tab not found' });
    }
    
    // Enforce access control: must be authenticated participant or valid guest
    const access = checkTabAccess(req, tabId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Access denied. You must be a participant in this tab.' });
    }
    
    const participants = db.prepare(`
      SELECT gtp.*, 
        COALESCE(gtp.guest_name, u.full_name) as display_name,
        (SELECT COALESCE(SUM(amount_cents), 0) FROM group_tab_expenses WHERE payer_participant_id = gtp.id) as expenses_paid_cents,
        (SELECT COALESCE(SUM(amount_cents), 0) FROM group_tab_payments WHERE from_participant_id = gtp.id) as payments_made_cents,
        (SELECT COALESCE(SUM(amount_cents), 0) FROM group_tab_payments WHERE to_participant_id = gtp.id) as payments_received_cents
      FROM group_tab_participants gtp
      LEFT JOIN users u ON gtp.user_id = u.id
      WHERE gtp.group_tab_id = ?
    `).all(tabId);
    
    // Get price groups if applicable
    const priceGroups = db.prepare('SELECT * FROM group_tab_price_groups WHERE group_tab_id = ?').all(tabId);
    const priceGroupMap = {};
    priceGroups.forEach(pg => priceGroupMap[pg.id] = pg);

    // Calculate total
    let totalAmount = 0;
    if (tab.tab_type === 'one_bill') {
      totalAmount = tab.total_amount_cents || 0;
    } else {
      const expenseSum = db.prepare(`
        SELECT COALESCE(SUM(amount_cents), 0) as total FROM group_tab_expenses WHERE group_tab_id = ?
      `).get(tabId);
      totalAmount = expenseSum.total;
    }
    
    // Calculate fair shares and balances
    let totalWeight = 0;
    for (const p of participants) {
      let weight = p.tier_multiplier || 1;
      if (tab.seat_count && p.seats_claimed) {
        weight = p.seats_claimed;
      }
      p._weight = weight;
      totalWeight += weight;
    }
    
    const payRateMultiplier = tab.tab_type === 'one_bill' ? (tab.expected_pay_rate || 100) / 100 : 1;
    
    const fairnessData = [];
    let totalDeviation = 0;
    
    for (const p of participants) {
      let fairShare = 0;
      
      if (tab.split_mode === 'price_groups') {
        // Price Groups Mode
        if (p.price_group_id && priceGroupMap[p.price_group_id]) {
          fairShare = priceGroupMap[p.price_group_id].amount_cents;
        } else {
          // Default to first group or equal split if no groups
          fairShare = priceGroups.length > 0 
            ? priceGroups[0].amount_cents 
            : Math.round((totalAmount / participants.length) * payRateMultiplier);
        }
      } else {
        // Standard Weighted/Equal Mode
        fairShare = totalWeight > 0 ? Math.round((totalAmount * p._weight / totalWeight) * payRateMultiplier) : 0;
      }
      
      let actualContribution;
      if (tab.tab_type === 'multi_bill') {
        actualContribution = p.expenses_paid_cents + p.payments_made_cents - p.payments_received_cents;
      } else {
        actualContribution = p.payments_made_cents;
      }
      
      const balance = actualContribution - fairShare;
      totalDeviation += Math.abs(balance);
      
      fairnessData.push({
        participantId: p.id,
        displayName: p.display_name || 'Unknown',
        isMember: p.is_member === 1,
        fairShare,
        actualPaid: actualContribution,
        balance,
        percentOfFair: fairShare > 0 ? Math.round((actualContribution / fairShare) * 100) : 0
      });
    }
    
    // Global fairness score
    let globalScore = 100;
    if (totalAmount > 0) {
      globalScore = Math.max(0, Math.min(100, Math.round(100 * (1 - totalDeviation / (2 * totalAmount)))));
    }
    
    // Generate settlement suggestions
    const settlements = [];
    const debtors = fairnessData.filter(b => b.balance < -50).map(b => ({...b})).sort((a, b) => a.balance - b.balance);
    const creditors = fairnessData.filter(b => b.balance > 50).map(b => ({...b})).sort((a, b) => b.balance - a.balance);
    
    while (debtors.length > 0 && creditors.length > 0) {
      const debtor = debtors[0];
      const creditor = creditors[0];
      const amount = Math.min(Math.abs(debtor.balance), creditor.balance);
      
      if (amount >= 50) {
        settlements.push({
          fromId: debtor.participantId,
          fromName: debtor.displayName,
          toId: creditor.participantId,
          toName: creditor.displayName,
          amountCents: Math.round(amount)
        });
      }
      
      debtor.balance += amount;
      creditor.balance -= amount;
      
      if (Math.abs(debtor.balance) < 50) debtors.shift();
      if (creditor.balance < 50) creditors.shift();
    }
    
    // Calculate summary stats
    const totalPayments = participants.reduce((sum, p) => sum + (p.payments_made_cents || 0), 0);
    const projectedTotal = tab.split_mode === 'price_groups' 
      ? fairnessData.reduce((sum, p) => sum + p.fairShare, 0) 
      : totalAmount;

    res.json({
      success: true,
      tabType: tab.tab_type,
      splitMode: tab.split_mode,
      totalAmount,
      expectedPayRate: tab.expected_pay_rate,
      globalScore,
      participants: fairnessData,
      settlements,
      priceGroups,
      summary: {
        tabTotal: totalAmount,
        projectedTotal,
        totalPayments,
        shortfallSurplus: projectedTotal - totalAmount
      }
    });
  } catch (err) {
    console.error('Error calculating fairness:', err);
    res.status(500).json({ error: 'Failed to calculate fairness' });
  }
});

// =============================================
// GROUPTABS PAGE ROUTES
// =============================================

// GroupTabs create page
app.get('/grouptabs/create', (req, res) => {
  if (req.user) {
    res.sendFile(path.join(__dirname, 'public', 'grouptabs-create.html'));
  } else {
    res.redirect('/');
  }
});

// GroupTabs manage page (creator only - via owner_token)
app.get('/grouptabs/manage/:ownerToken', (req, res) => {
  const { ownerToken } = req.params;
  
  const tab = db.prepare(`SELECT id, status FROM group_tabs WHERE owner_token = ?`).get(ownerToken);
  
  if (!tab) {
    return res.status(404).send('<html><body style="font-family:system-ui;background:#0e1116;color:#e6eef6;text-align:center;padding:64px"><h1>Tab not found</h1><a href="/" style="color:#3ddc97">Go to PayFriends</a></body></html>');
  }
  
  res.sendFile(path.join(__dirname, 'public', 'grouptabs-equal-view.html'));
});

// GroupTabs view page (public - via magic_token)  
app.get('/grouptabs/view/:publicToken', (req, res) => {
  const { publicToken } = req.params;
  
  const tab = db.prepare(`SELECT id, status FROM group_tabs WHERE magic_token = ?`).get(publicToken);
  
  if (!tab) {
    return res.status(404).send('<html><body style="font-family:system-ui;background:#0e1116;color:#e6eef6;text-align:center;padding:64px"><h1>Tab not found</h1><a href="/" style="color:#3ddc97">Go to PayFriends</a></body></html>');
  }
  
  if (tab.status === 'closed') {
    return res.send('<html><body style="font-family:system-ui;background:#0e1116;color:#e6eef6;text-align:center;padding:64px"><h1>This tab has been closed</h1><p style="color:#a7b0bd">The organizer has closed this tab.</p><a href="/" style="color:#3ddc97">Go to PayFriends</a></body></html>');
  }
  
  res.sendFile(path.join(__dirname, 'public', 'grouptabs-equal-view.html'));
});

// GroupTabs view page - handle numeric IDs only
app.get('/grouptabs/:id', (req, res, next) => {
  // Skip if ID is not numeric (let other routes handle)
  if (!/^\d+$/.test(req.params.id)) {
    return next();
  }
  
  // Serve the view page for all users (logged in or guests)
  // The page and API will handle access control
    res.sendFile(path.join(__dirname, 'public', 'grouptabs-view.html'));
});

// GroupTabs receipt view - classic receipt-styled page
app.get('/grouptabs/:id/receipt', (req, res, next) => {
  // Skip if ID is not numeric
  if (!/^\d+$/.test(req.params.id)) {
    return next();
  }
  
  if (req.user) {
    res.sendFile(path.join(__dirname, 'public', 'grouptabs-receipt.html'));
  } else {
    res.redirect('/');
  }
});

// Tab page - handles both short codes (12 chars) and legacy long tokens (64 chars)
// /tab/:code is the PRIMARY sharing URL
app.get('/tab/:code', (req, res) => {
  const { code } = req.params;
  
  // Try short invite_code first (primary), then fall back to legacy magic_token
  let tab = db.prepare(`SELECT id, status, magic_token, invite_code FROM group_tabs WHERE invite_code = ?`).get(code);
  
  if (!tab) {
    // Try legacy long magic_token
    tab = db.prepare(`SELECT id, status, magic_token, invite_code FROM group_tabs WHERE magic_token = ?`).get(code);
    
    // If found with long token but has short code, redirect to short URL
    if (tab && tab.invite_code) {
      return res.redirect(`/tab/${tab.invite_code}`);
    }
  }
  
  if (!tab) {
    return res.status(404).send('<html><body style="font-family:system-ui;background:#0e1116;color:#e6eef6;text-align:center;padding:64px"><h1>Tab not found</h1><a href="/" style="color:#3ddc97">Go to PayFriends</a></body></html>');
  }
  
  if (tab.status === 'closed') {
    // For closed tabs, still allow viewing if the user is logged in or has a guest session
    const guestToken = req.cookies.grouptab_guest_session;
    const hasAccess = req.user || (guestToken && db.prepare(`
      SELECT 1 FROM group_tab_participants WHERE group_tab_id = ? AND guest_session_token = ?
    `).get(tab.id, guestToken));
    
    if (!hasAccess) {
      return res.send('<html><body style="font-family:system-ui;background:#0e1116;color:#e6eef6;text-align:center;padding:64px"><h1>This tab has been closed</h1><p style="color:#a7b0bd">Only members can view closed tabs.</p><a href="/" style="color:#3ddc97">Go to PayFriends</a></body></html>');
    }
  }
  
  // Serve the view page - it will detect the code in the URL and use the API
  res.sendFile(path.join(__dirname, 'public', 'grouptabs-view.html'));
});

// Serve GroupTab receipt files
app.get('/api/grouptabs/receipt/:filename', (req, res) => {
  const filename = req.params.filename;
  
  // Security: only allow alphanumeric, dash, underscore, and dots in filename
  if (!/^[a-zA-Z0-9\-_.]+$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  const filePath = path.join(__dirname, 'uploads', 'grouptabs', filename);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Receipt not found' });
  }
  
  // Determine content type
  const ext = path.extname(filename).toLowerCase();
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf'
  };
  
  const contentType = contentTypes[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
  
  res.sendFile(filePath);
});

// Remove GroupTab receipt (organizer only)
app.post('/api/grouptabs/token/:token/remove-receipt', (req, res) => {
  const token = req.params.token;
  
  // Find tab by owner token
  const tab = db.prepare('SELECT * FROM group_tabs WHERE owner_token = ?').get(token);
  
  if (!tab) {
    return res.status(404).json({ error: 'Tab not found or not authorized' });
  }
  
  // Remove the receipt file path from the database
  db.prepare('UPDATE group_tabs SET receipt_file_path = NULL WHERE id = ?').run(tab.id);
  
  // Optionally delete the file (uncomment if desired)
  // if (tab.receipt_file_path) {
  //   const filePath = path.join(__dirname, tab.receipt_file_path);
  //   if (fs.existsSync(filePath)) {
  //     fs.unlinkSync(filePath);
  //   }
  // }
  
  res.json({ success: true });
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

// Global error handler - catches any unhandled errors and returns JSON
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // Check if it's a multer error
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  
  // For API routes, always return JSON
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: 'Internal server error' });
  }
  
  // For non-API routes, let Express handle it
  next(err);
});

// Start server
app.listen(PORT, () => {
  console.log(`PayFriends MVP running at http://localhost:${PORT}`);
});

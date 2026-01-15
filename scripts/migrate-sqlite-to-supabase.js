#!/usr/bin/env node

/**
 * SQLite to Supabase Migration Script
 * 
 * This script migrates all data from the local SQLite database to Supabase Postgres.
 * 
 * Prerequisites:
 * 1. Supabase project created and migrations applied
 * 2. Environment variables set in .env.local
 * 3. SQLite database at ./data/payfriends.db
 * 
 * Usage:
 *   node scripts/migrate-sqlite-to-supabase.js
 * 
 * Options:
 *   --dry-run    Preview migration without making changes
 *   --table=X    Migrate only specific table
 *   --skip-auth  Skip Supabase Auth user creation
 */

require('dotenv').config({ path: '.env.local' });

const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Configuration
const SQLITE_PATH = process.env.SQLITE_PATH || './data/payfriends.db';
const BATCH_SIZE = 100;

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SKIP_AUTH = args.includes('--skip-auth');
const TABLE_FILTER = args.find(a => a.startsWith('--table='))?.split('=')[1];

// Supabase client (service role for full access)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  console.error('Copy .env.example to .env.local and fill in your Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// SQLite connection
let sqlite;
try {
  if (!fs.existsSync(SQLITE_PATH)) {
    console.error(`Error: SQLite database not found at ${SQLITE_PATH}`);
    process.exit(1);
  }
  sqlite = new Database(SQLITE_PATH, { readonly: true });
} catch (err) {
  console.error('Error connecting to SQLite:', err.message);
  process.exit(1);
}

// Statistics tracking
const stats = {
  tables: {},
  errors: [],
  startTime: Date.now(),
};

// Utility functions
function log(message, type = 'info') {
  const prefix = {
    info: '\x1b[36m[INFO]\x1b[0m',
    success: '\x1b[32m[OK]\x1b[0m',
    warn: '\x1b[33m[WARN]\x1b[0m',
    error: '\x1b[31m[ERROR]\x1b[0m',
  };
  console.log(`${prefix[type] || '[LOG]'} ${message}`);
}

function convertTimestamp(sqliteTimestamp) {
  if (!sqliteTimestamp) return null;
  // SQLite timestamps are typically ISO strings or Unix timestamps
  const date = new Date(sqliteTimestamp);
  return isNaN(date.getTime()) ? sqliteTimestamp : date.toISOString();
}

function convertBoolean(value) {
  if (value === null || value === undefined) return null;
  return value === 1 || value === true || value === 'true';
}

async function migrateTable(tableName, selectQuery, transformFn, options = {}) {
  if (TABLE_FILTER && TABLE_FILTER !== tableName) {
    log(`Skipping ${tableName} (filtered)`, 'warn');
    return;
  }

  log(`Migrating ${tableName}...`);
  stats.tables[tableName] = { source: 0, migrated: 0, errors: 0 };

  try {
    // Get data from SQLite
    const rows = sqlite.prepare(selectQuery).all();
    stats.tables[tableName].source = rows.length;

    if (rows.length === 0) {
      log(`  No rows to migrate in ${tableName}`, 'warn');
      return;
    }

    // Transform and insert in batches
    const transformed = rows.map(row => {
      try {
        return transformFn(row);
      } catch (err) {
        stats.tables[tableName].errors++;
        stats.errors.push({ table: tableName, row, error: err.message });
        return null;
      }
    }).filter(Boolean);

    if (DRY_RUN) {
      log(`  [DRY RUN] Would migrate ${transformed.length} rows`, 'info');
      stats.tables[tableName].migrated = transformed.length;
      return;
    }

    // Insert in batches
    for (let i = 0; i < transformed.length; i += BATCH_SIZE) {
      const batch = transformed.slice(i, i + BATCH_SIZE);
      
      const { error } = await supabase
        .from(tableName)
        .upsert(batch, { 
          onConflict: options.conflictColumn || 'id',
          ignoreDuplicates: options.ignoreDuplicates || false,
        });

      if (error) {
        log(`  Error inserting batch: ${error.message}`, 'error');
        stats.tables[tableName].errors += batch.length;
        stats.errors.push({ table: tableName, error: error.message });
      } else {
        stats.tables[tableName].migrated += batch.length;
      }
    }

    log(`  Migrated ${stats.tables[tableName].migrated}/${rows.length} rows`, 'success');
  } catch (err) {
    log(`  Failed to migrate ${tableName}: ${err.message}`, 'error');
    stats.errors.push({ table: tableName, error: err.message });
  }
}

// Table migration definitions
async function migrateUsers() {
  await migrateTable(
    'users',
    'SELECT * FROM users',
    (row) => ({
      id: row.id,
      email: row.email,
      password_hash: row.password_hash,
      full_name: row.full_name,
      phone_number: row.phone_number,
      timezone: row.timezone,
      profile_picture: row.profile_picture,
      public_id: row.public_id,
      is_admin: false,
      created_at: convertTimestamp(row.created_at),
      updated_at: convertTimestamp(row.created_at),
    })
  );
}

async function migrateSessions() {
  await migrateTable(
    'sessions',
    'SELECT * FROM sessions',
    (row) => ({
      id: row.id,
      user_id: row.user_id,
      created_at: convertTimestamp(row.created_at),
      expires_at: convertTimestamp(row.expires_at),
    })
  );
}

async function migrateAgreements() {
  await migrateTable(
    'agreements',
    'SELECT * FROM agreements',
    (row) => ({
      id: row.id,
      lender_user_id: row.lender_user_id,
      lender_name: row.lender_name,
      borrower_user_id: row.borrower_user_id,
      borrower_email: row.borrower_email,
      borrower_phone: row.borrower_phone,
      friend_first_name: row.friend_first_name,
      direction: row.direction || 'lend',
      amount_cents: row.amount_cents,
      description: row.description,
      repayment_type: row.repayment_type || 'one_time',
      installment_count: row.installment_count,
      installment_amount: row.installment_amount,
      payment_frequency: row.payment_frequency,
      due_date: row.due_date,
      first_payment_date: row.first_payment_date,
      final_due_date: row.final_due_date,
      money_sent_date: row.money_sent_date,
      accepted_at: convertTimestamp(row.accepted_at),
      interest_rate: row.interest_rate,
      total_interest: row.total_interest,
      total_repay_amount: row.total_repay_amount,
      payment_preference_method: row.payment_preference_method,
      payment_other_description: row.payment_other_description,
      payment_methods_json: row.payment_methods_json,
      one_time_due_option: row.one_time_due_option,
      plan_length: row.plan_length,
      plan_unit: row.plan_unit,
      reminder_enabled: convertBoolean(row.reminder_enabled),
      reminder_mode: row.reminder_mode,
      reminder_offsets: row.reminder_offsets,
      proof_required: convertBoolean(row.proof_required),
      debt_collection_clause: convertBoolean(row.debt_collection_clause),
      fairness_accepted: convertBoolean(row.fairness_accepted),
      has_repayment_issue: convertBoolean(row.has_repayment_issue),
      status: row.status || 'pending',
      created_at: convertTimestamp(row.created_at),
      updated_at: convertTimestamp(row.created_at),
    })
  );
}

async function migrateAgreementInvites() {
  await migrateTable(
    'agreement_invites',
    'SELECT * FROM agreement_invites',
    (row) => ({
      id: row.id,
      agreement_id: row.agreement_id,
      email: row.email,
      token: row.token,
      created_at: convertTimestamp(row.created_at),
      accepted_at: convertTimestamp(row.accepted_at),
    })
  );
}

async function migratePayments() {
  await migrateTable(
    'payments',
    'SELECT * FROM payments',
    (row) => ({
      id: row.id,
      agreement_id: row.agreement_id,
      recorded_by_user_id: row.recorded_by_user_id,
      amount_cents: row.amount_cents,
      applied_amount_cents: row.applied_amount_cents || 0,
      overpaid_amount_cents: row.overpaid_amount_cents || 0,
      method: row.method,
      note: row.note,
      status: row.status || 'approved',
      proof_file_path: row.proof_file_path,
      proof_original_name: row.proof_original_name,
      proof_mime_type: row.proof_mime_type,
      created_at: convertTimestamp(row.created_at),
    })
  );
}

async function migrateInitialPaymentReports() {
  await migrateTable(
    'initial_payment_reports',
    'SELECT * FROM initial_payment_reports',
    (row) => ({
      id: row.id,
      agreement_id: row.agreement_id,
      reported_by_user_id: row.reported_by_user_id,
      payment_method: row.payment_method,
      is_completed: convertBoolean(row.is_completed),
      proof_file_path: row.proof_file_path,
      proof_original_name: row.proof_original_name,
      proof_mime_type: row.proof_mime_type,
      reported_at: convertTimestamp(row.reported_at),
      created_at: convertTimestamp(row.created_at),
    })
  );
}

async function migrateHardshipRequests() {
  await migrateTable(
    'hardship_requests',
    'SELECT * FROM hardship_requests',
    (row) => ({
      id: row.id,
      agreement_id: row.agreement_id,
      borrower_user_id: row.borrower_user_id,
      reason_category: row.reason_category,
      reason_text: row.reason_text,
      can_pay_now_cents: row.can_pay_now_cents,
      preferred_adjustments: row.preferred_adjustments,
      created_at: convertTimestamp(row.created_at),
      resolved_at: convertTimestamp(row.resolved_at),
    })
  );
}

async function migrateRenegotiationRequests() {
  await migrateTable(
    'renegotiation_requests',
    'SELECT * FROM renegotiation_requests',
    (row) => ({
      id: row.id,
      agreement_id: row.agreement_id,
      status: row.status,
      stage: row.stage,
      initiated_by: row.initiated_by,
      loan_type: row.loan_type,
      selected_type: row.selected_type,
      lender_suggested_type: row.lender_suggested_type,
      agreed_type: row.agreed_type,
      can_pay_now_cents: row.can_pay_now_cents,
      borrower_note: row.borrower_note,
      trouble_reason: row.trouble_reason,
      trouble_reason_other: row.trouble_reason_other,
      borrower_values_proposal: row.borrower_values_proposal,
      lender_values_proposal: row.lender_values_proposal,
      lender_response_note: row.lender_response_note,
      history: row.history,
      created_at: convertTimestamp(row.created_at),
      updated_at: convertTimestamp(row.updated_at),
    })
  );
}

async function migrateMessages() {
  await migrateTable(
    'messages',
    'SELECT * FROM messages',
    (row) => ({
      id: row.id,
      user_id: row.user_id,
      agreement_id: row.agreement_id,
      tab_id: row.tab_id,
      subject: row.subject,
      body: row.body,
      event_type: row.event_type,
      created_at: convertTimestamp(row.created_at),
      read_at: convertTimestamp(row.read_at),
    })
  );
}

async function migrateGroupTabs() {
  await migrateTable(
    'group_tabs',
    'SELECT * FROM group_tabs',
    (row) => ({
      id: row.id,
      creator_user_id: row.creator_user_id,
      name: row.name,
      description: row.description,
      tab_type: row.tab_type,
      template: row.template,
      status: row.status || 'open',
      total_amount_cents: row.total_amount_cents,
      split_mode: row.split_mode,
      expected_pay_rate: row.expected_pay_rate,
      seat_count: row.seat_count,
      people_count: row.people_count,
      receipt_file_path: row.receipt_file_path,
      paid_up_cents: row.paid_up_cents || 0,
      host_overpaid_cents: row.host_overpaid_cents || 0,
      total_raised_cents: row.total_raised_cents || 0,
      proof_required: row.proof_required,
      magic_token: row.magic_token,
      owner_token: row.owner_token,
      invite_code: row.invite_code,
      manage_code: row.manage_code,
      event_date: row.event_date,
      gift_mode: row.gift_mode,
      group_gift_mode: row.group_gift_mode,
      recipient_name: row.recipient_name,
      about_text: row.about_text,
      about_image_path: row.about_image_path,
      about_link: row.about_link,
      is_raising_money_only: convertBoolean(row.is_raising_money_only),
      amount_target: row.amount_target,
      contributor_count: row.contributor_count,
      raising_for_text: row.raising_for_text,
      raising_for_image_path: row.raising_for_image_path,
      raising_for_link: row.raising_for_link,
      is_open_pot: convertBoolean(row.is_open_pot),
      payment_methods_json: row.payment_methods_json,
      organizer_contribution: row.organizer_contribution,
      created_at: convertTimestamp(row.created_at),
      closed_at: convertTimestamp(row.closed_at),
      updated_at: convertTimestamp(row.created_at),
    })
  );
}

async function migrateGroupTabTiers() {
  await migrateTable(
    'group_tab_tiers',
    'SELECT * FROM group_tab_tiers',
    (row) => ({
      id: row.id,
      group_tab_id: row.group_tab_id,
      name: row.name,
      multiplier: row.multiplier,
      sort_order: row.sort_order,
      created_at: convertTimestamp(row.created_at),
    })
  );
}

async function migrateGroupTabPriceGroups() {
  await migrateTable(
    'group_tab_price_groups',
    'SELECT * FROM group_tab_price_groups',
    (row) => ({
      id: row.id,
      group_tab_id: row.group_tab_id,
      name: row.name,
      emoji: row.emoji,
      amount_cents: row.amount_cents,
      created_at: convertTimestamp(row.created_at),
    })
  );
}

async function migrateGroupTabParticipants() {
  await migrateTable(
    'group_tab_participants',
    'SELECT * FROM group_tab_participants',
    (row) => ({
      id: row.id,
      group_tab_id: row.group_tab_id,
      user_id: row.user_id,
      guest_name: row.guest_name,
      guest_session_token: row.guest_session_token,
      role: row.role || 'participant',
      is_member: convertBoolean(row.is_member),
      added_by_creator: convertBoolean(row.added_by_creator),
      hide_name: convertBoolean(row.hide_name),
      seats_claimed: row.seats_claimed,
      assigned_seats: row.assigned_seats,
      tier_name: row.tier_name,
      tier_multiplier: row.tier_multiplier,
      tier_id: row.tier_id,
      price_group_id: row.price_group_id,
      custom_amount_cents: row.custom_amount_cents,
      fair_share_cents: row.fair_share_cents,
      remaining_cents: row.remaining_cents,
      total_paid_cents: row.total_paid_cents || 0,
      joined_at: convertTimestamp(row.joined_at),
    })
  );
}

async function migrateGroupTabExpenses() {
  await migrateTable(
    'group_tab_expenses',
    'SELECT * FROM group_tab_expenses',
    (row) => ({
      id: row.id,
      group_tab_id: row.group_tab_id,
      payer_participant_id: row.payer_participant_id,
      description: row.description,
      amount_cents: row.amount_cents,
      category: row.category,
      expense_date: row.expense_date,
      receipt_file_path: row.receipt_file_path,
      created_at: convertTimestamp(row.created_at),
    })
  );
}

async function migrateGroupTabPayments() {
  await migrateTable(
    'group_tab_payments',
    'SELECT * FROM group_tab_payments',
    (row) => ({
      id: row.id,
      group_tab_id: row.group_tab_id,
      from_participant_id: row.from_participant_id,
      to_participant_id: row.to_participant_id,
      amount_cents: row.amount_cents,
      applied_cents: row.applied_cents,
      overpay_cents: row.overpay_cents,
      method: row.method,
      note: row.note,
      proof_file_path: row.proof_file_path,
      status: row.status || 'confirmed',
      payment_type: row.payment_type,
      beneficiary_ids: row.beneficiary_ids,
      created_at: convertTimestamp(row.created_at),
    })
  );
}

async function migrateGroupTabPaymentReports() {
  await migrateTable(
    'group_tab_payment_reports',
    'SELECT * FROM group_tab_payment_reports',
    (row) => ({
      id: row.id,
      group_tab_id: row.group_tab_id,
      participant_id: row.participant_id,
      reporter_name: row.reporter_name,
      additional_names: row.additional_names,
      amount_cents: row.amount_cents,
      method: row.method,
      paid_at: row.paid_at,
      proof_file_path: row.proof_file_path,
      note: row.note,
      status: row.status || 'pending',
      reviewed_at: convertTimestamp(row.reviewed_at),
      reviewed_by: row.reviewed_by,
      created_at: convertTimestamp(row.created_at),
    })
  );
}

// Main migration function
async function runMigration() {
  console.log('\n========================================');
  console.log('  PayFriends SQLite to Supabase Migration');
  console.log('========================================\n');

  if (DRY_RUN) {
    log('Running in DRY RUN mode - no changes will be made', 'warn');
  }

  log(`SQLite database: ${SQLITE_PATH}`);
  log(`Supabase URL: ${supabaseUrl}`);
  console.log('');

  // Migration order matters due to foreign key constraints
  // Order: users -> agreements (and related) -> group_tabs (and related)
  
  log('Phase 1: Core tables', 'info');
  await migrateUsers();
  await migrateSessions();

  log('\nPhase 2: Agreement tables', 'info');
  await migrateAgreements();
  await migrateAgreementInvites();
  await migratePayments();
  await migrateInitialPaymentReports();
  await migrateHardshipRequests();
  await migrateRenegotiationRequests();
  await migrateMessages();

  log('\nPhase 3: Group tab tables', 'info');
  await migrateGroupTabs();
  await migrateGroupTabTiers();
  await migrateGroupTabPriceGroups();
  await migrateGroupTabParticipants();
  await migrateGroupTabExpenses();
  await migrateGroupTabPayments();
  await migrateGroupTabPaymentReports();

  // Print summary
  console.log('\n========================================');
  console.log('  Migration Summary');
  console.log('========================================\n');

  let totalSource = 0;
  let totalMigrated = 0;
  let totalErrors = 0;

  for (const [table, data] of Object.entries(stats.tables)) {
    totalSource += data.source;
    totalMigrated += data.migrated;
    totalErrors += data.errors;
    
    const status = data.errors > 0 ? '\x1b[33m!\x1b[0m' : '\x1b[32m✓\x1b[0m';
    console.log(`${status} ${table}: ${data.migrated}/${data.source} rows`);
  }

  console.log('');
  console.log(`Total: ${totalMigrated}/${totalSource} rows migrated`);
  console.log(`Errors: ${totalErrors}`);
  console.log(`Duration: ${((Date.now() - stats.startTime) / 1000).toFixed(1)}s`);

  if (stats.errors.length > 0) {
    console.log('\n\x1b[31mErrors:\x1b[0m');
    stats.errors.slice(0, 10).forEach((err, i) => {
      console.log(`  ${i + 1}. [${err.table}] ${err.error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more errors`);
    }
  }

  console.log('');
  
  // Close SQLite connection
  sqlite.close();
}

// Run migration
runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

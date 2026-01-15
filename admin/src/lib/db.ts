/**
 * Database connection layer for Admin CMS
 * Connects to the main PayFriends SQLite database
 */
import Database from 'better-sqlite3';
import path from 'path';

// Connect to the main PayFriends database (in data folder one level up)
const DB_PATH = path.join(process.cwd(), '..', 'data', 'payfriends.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH, { readonly: false });
    db.pragma('journal_mode = WAL');
  }
  return db;
}

// ============================================================================
// USER QUERIES
// ============================================================================

export interface User {
  id: number;
  full_name: string | null;
  email: string;
  phone_number: string | null;
  created_at: string;
  public_id: string | null;
}

export function getUsers(search?: string, limit = 50, offset = 0): User[] {
  const db = getDb();
  let query = `
    SELECT id, full_name, email, phone_number, created_at, public_id
    FROM users
  `;
  const params: any[] = [];
  
  if (search) {
    query += ` WHERE full_name LIKE ? OR email LIKE ? OR phone_number LIKE ? OR CAST(id AS TEXT) = ?`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern, search);
  }
  
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  return db.prepare(query).all(...params) as User[];
}

export function getUserById(id: string | number): User | undefined {
  const db = getDb();
  return db.prepare(`
    SELECT id, full_name, email, phone_number, created_at, public_id
    FROM users WHERE id = ?
  `).get(id) as User | undefined;
}

export function getUserStats(userId: string | number): { loansCreated: number; grouptabsCreated: number } {
  const db = getDb();
  const loansCreated = db.prepare(`
    SELECT COUNT(*) as count FROM agreements WHERE lender_user_id = ?
  `).get(userId) as { count: number };
  
  const grouptabsCreated = db.prepare(`
    SELECT COUNT(*) as count FROM group_tabs WHERE creator_user_id = ?
  `).get(userId) as { count: number };
  
  return {
    loansCreated: loansCreated?.count || 0,
    grouptabsCreated: grouptabsCreated?.count || 0,
  };
}

export function softDisableUser(userId: string | number, adminId: string): void {
  // Note: The users table doesn't have an is_disabled column
  // For now, we just log the action - in production, add the column or use a different approach
  logAdminAction(adminId, 'soft_disable_user', 'user', String(userId), { action: 'disabled' });
}

export function enableUser(userId: string | number, adminId: string): void {
  logAdminAction(adminId, 'enable_user', 'user', String(userId), { action: 'enabled' });
}

export function deleteUser(userId: string | number, adminId: string, anonymize = true): { success: boolean; error?: string } {
  const db = getDb();
  
  // Check if user has financial history
  const hasLoans = db.prepare(`
    SELECT COUNT(*) as count FROM agreements WHERE lender_user_id = ? OR borrower_user_id = ?
  `).get(userId, userId) as { count: number };
  
  const hasGrouptabs = db.prepare(`
    SELECT COUNT(*) as count FROM group_tabs WHERE creator_user_id = ?
  `).get(userId) as { count: number };
  
  const hasFinancialHistory = (hasLoans?.count || 0) > 0 || (hasGrouptabs?.count || 0) > 0;
  
  if (hasFinancialHistory && !anonymize) {
    return { success: false, error: 'User has financial history. Must anonymize instead of hard delete.' };
  }
  
  if (hasFinancialHistory) {
    // Anonymize user data - financial records remain intact
    db.prepare(`
      UPDATE users 
      SET full_name = '[Deleted User]', 
          email = 'deleted_' || id || '@deleted.local',
          phone_number = NULL
      WHERE id = ?
    `).run(userId);
    logAdminAction(adminId, 'anonymize_user', 'user', String(userId), { 
      reason: 'User had financial history',
      loans_count: hasLoans?.count || 0,
      grouptabs_count: hasGrouptabs?.count || 0,
    });
  } else {
    // Hard delete - no financial history
    db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
    logAdminAction(adminId, 'delete_user', 'user', String(userId), { hard_delete: true });
  }
  
  return { success: true };
}

// ============================================================================
// LOAN (AGREEMENT) QUERIES
// ============================================================================

export interface Agreement {
  id: number;
  lender_user_id: number | null;
  lender_name: string;
  borrower_user_id: number | null;
  borrower_email: string;
  friend_first_name: string | null;
  amount_cents: number;
  status: string;
  created_at: string;
  interest_rate: number | null;
  repayment_type: string;
  installment_count: number | null;
  payment_frequency: string | null;
  due_date: string | null;
  description: string | null;
  calc_version: string | null;
  // Computed fields
  borrower_name?: string;
}

export function getAgreements(filters?: {
  status?: string;
  lenderId?: string;
  borrowerId?: string;
  dateFrom?: string;
  dateTo?: string;
}, limit = 50, offset = 0): Agreement[] {
  const db = getDb();
  let query = `
    SELECT a.*,
           COALESCE(a.friend_first_name, b.full_name, a.borrower_email) as borrower_name
    FROM agreements a
    LEFT JOIN users b ON a.borrower_user_id = b.id
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (filters?.status) {
    query += ` AND a.status = ?`;
    params.push(filters.status);
  }
  if (filters?.lenderId) {
    query += ` AND a.lender_user_id = ?`;
    params.push(filters.lenderId);
  }
  if (filters?.borrowerId) {
    query += ` AND a.borrower_user_id = ?`;
    params.push(filters.borrowerId);
  }
  if (filters?.dateFrom) {
    query += ` AND a.created_at >= ?`;
    params.push(filters.dateFrom);
  }
  if (filters?.dateTo) {
    query += ` AND a.created_at <= ?`;
    params.push(filters.dateTo);
  }
  
  query += ` ORDER BY a.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  return db.prepare(query).all(...params) as Agreement[];
}

export function getAgreementById(id: string | number): (Agreement & { lender_display_name?: string }) | undefined {
  const db = getDb();
  const agreement = db.prepare(`
    SELECT a.*,
           l.full_name as lender_display_name,
           COALESCE(a.friend_first_name, b.full_name, a.borrower_email) as borrower_name
    FROM agreements a
    LEFT JOIN users l ON a.lender_user_id = l.id
    LEFT JOIN users b ON a.borrower_user_id = b.id
    WHERE a.id = ?
  `).get(id) as (Agreement & { lender_display_name?: string }) | undefined;
  
  return agreement;
}

export function getAgreementPayments(agreementId: string | number): any[] {
  const db = getDb();
  return db.prepare(`
    SELECT p.*, u.full_name as payer_name
    FROM payments p
    LEFT JOIN users u ON p.recorded_by_user_id = u.id
    WHERE p.agreement_id = ? 
    ORDER BY p.created_at DESC
  `).all(agreementId);
}

// ============================================================================
// GROUPTAB QUERIES
// ============================================================================

export interface GroupTab {
  id: number;
  name: string;
  creator_user_id: number;
  tab_type: string;
  total_amount_cents: number | null;
  status: string;
  created_at: string;
  description: string | null;
  creator_name?: string;
}

export function getGroupTabs(filters?: {
  status?: string;
  type?: string;
  creatorId?: string;
}, limit = 50, offset = 0): GroupTab[] {
  const db = getDb();
  let query = `
    SELECT g.*, u.full_name as creator_name
    FROM group_tabs g
    LEFT JOIN users u ON g.creator_user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (filters?.status) {
    query += ` AND g.status = ?`;
    params.push(filters.status);
  }
  if (filters?.type) {
    query += ` AND g.tab_type = ?`;
    params.push(filters.type);
  }
  if (filters?.creatorId) {
    query += ` AND g.creator_user_id = ?`;
    params.push(filters.creatorId);
  }
  
  query += ` ORDER BY g.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  return db.prepare(query).all(...params) as GroupTab[];
}

export function getGroupTabById(id: string | number): GroupTab | undefined {
  const db = getDb();
  return db.prepare(`
    SELECT g.*, u.full_name as creator_name
    FROM group_tabs g
    LEFT JOIN users u ON g.creator_user_id = u.id
    WHERE g.id = ?
  `).get(id) as GroupTab | undefined;
}

export function getGroupTabParticipants(tabId: string | number): any[] {
  const db = getDb();
  return db.prepare(`
    SELECT gp.*, u.full_name as user_name
    FROM group_tab_participants gp
    LEFT JOIN users u ON gp.user_id = u.id
    WHERE gp.group_tab_id = ?
  `).all(tabId);
}

// ============================================================================
// PAYMENT REPORTS QUERIES
// ============================================================================

export interface PaymentReport {
  id: number;
  entity_type: 'loan' | 'grouptab';
  entity_id: number;
  entity_name: string | null;
  reporter_id: number;
  amount_cents: number;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reporter_name?: string;
}

export function getPaymentReports(filters?: {
  status?: string;
  entityType?: string;
}, limit = 50, offset = 0): PaymentReport[] {
  const db = getDb();
  const params: any[] = [];
  const queries: string[] = [];

  // Include loan payments if not filtered to grouptabs only
  if (!filters?.entityType || filters.entityType === 'loan') {
    let loanQuery = `
      SELECT p.id, 'loan' as entity_type, p.agreement_id as entity_id,
             COALESCE(a.friend_first_name, a.borrower_email, 'Loan #' || p.agreement_id) as entity_name,
             p.recorded_by_user_id as reporter_id, p.amount_cents,
             p.status, p.created_at,
             NULL as reviewed_at, u.full_name as reporter_name
      FROM payments p
      LEFT JOIN users u ON p.recorded_by_user_id = u.id
      LEFT JOIN agreements a ON p.agreement_id = a.id
      WHERE 1=1
    `;
    if (filters?.status) {
      loanQuery += ` AND p.status = ?`;
      params.push(filters.status);
    }
    queries.push(loanQuery);
  }

  // Include grouptab payment reports if not filtered to loans only
  if (!filters?.entityType || filters.entityType === 'grouptab') {
    const gtReportsExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='group_tab_payment_reports'
    `).get();

    if (gtReportsExists) {
      let gtQuery = `
        SELECT gpr.id, 'grouptab' as entity_type, gpr.group_tab_id as entity_id,
               gt.name as entity_name,
               gpr.participant_id as reporter_id, gpr.amount_cents,
               gpr.status, gpr.created_at,
               gpr.reviewed_at, gpr.reporter_name as reporter_name
        FROM group_tab_payment_reports gpr
        LEFT JOIN group_tabs gt ON gpr.group_tab_id = gt.id
        WHERE 1=1
      `;
      if (filters?.status) {
        gtQuery += ` AND gpr.status = ?`;
        params.push(filters.status);
      }
      queries.push(gtQuery);
    }
  }

  if (queries.length === 0) {
    return [];
  }

  const unionQuery = queries.join(' UNION ALL ');
  const fullQuery = `SELECT * FROM (${unionQuery}) ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return db.prepare(fullQuery).all(...params) as PaymentReport[];
}

export function markPaymentReportReviewed(reportId: string | number, adminId: string): void {
  logAdminAction(adminId, 'mark_reviewed', 'payment_report', String(reportId), {});
}

// ============================================================================
// ADMIN NOTES
// ============================================================================

export interface AdminNote {
  id: number;
  entity_type: string;
  entity_id: string;
  note: string;
  admin_id: string;
  created_at: string;
}

export function ensureAdminNotesTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      note TEXT NOT NULL,
      admin_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export function getAdminNotes(entityType: string, entityId: string | number): AdminNote[] {
  ensureAdminNotesTable();
  const db = getDb();
  return db.prepare(`
    SELECT * FROM admin_notes 
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at DESC
  `).all(entityType, String(entityId)) as AdminNote[];
}

export function addAdminNote(entityType: string, entityId: string | number, note: string, adminId: string): void {
  ensureAdminNotesTable();
  const db = getDb();
  db.prepare(`
    INSERT INTO admin_notes (entity_type, entity_id, note, admin_id)
    VALUES (?, ?, ?, ?)
  `).run(entityType, String(entityId), note, adminId);
  logAdminAction(adminId, 'add_note', entityType, String(entityId), { note_preview: note.substring(0, 100) });
}

// ============================================================================
// ADMIN AUDIT LOG
// ============================================================================

export interface AuditLogEntry {
  id: number;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: string;
  created_at: string;
}

export function ensureAuditLogTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export function logAdminAction(adminId: string, action: string, targetType: string, targetId: string, metadata: object): void {
  ensureAuditLogTable();
  const db = getDb();
  db.prepare(`
    INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(adminId, action, targetType, targetId, JSON.stringify(metadata));
}

export function getAuditLog(limit = 100, offset = 0): AuditLogEntry[] {
  ensureAuditLogTable();
  const db = getDb();
  return db.prepare(`
    SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(limit, offset) as AuditLogEntry[];
}

// ============================================================================
// REMOTE CONFIG
// ============================================================================

export interface RemoteConfig {
  key: string;
  value: string;
  type: 'boolean' | 'string' | 'json';
  description: string;
  updated_at: string;
}

export function ensureRemoteConfigTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS remote_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'string',
      description TEXT DEFAULT '',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export function getRemoteConfigs(): RemoteConfig[] {
  ensureRemoteConfigTable();
  const db = getDb();
  return db.prepare(`SELECT * FROM remote_config ORDER BY key`).all() as RemoteConfig[];
}

export function setRemoteConfig(key: string, value: string, type: string, description: string, adminId: string): void {
  ensureRemoteConfigTable();
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO remote_config (key, value, type, description, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(key, value, type, description);
  logAdminAction(adminId, 'update_config', 'remote_config', key, { value, type });
}

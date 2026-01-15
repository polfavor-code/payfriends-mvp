/**
 * Database Adapter - Unified interface for SQLite and Supabase
 * 
 * Automatically uses Supabase if configured, falls back to SQLite otherwise.
 * Provides sync-like API by wrapping async calls where needed.
 */

require('dotenv').config({ path: '.env.local' });

const USE_SUPABASE = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let supabaseDb = null;
let sqliteDb = null;

if (USE_SUPABASE) {
  console.log('[DB] Using Supabase database');
  supabaseDb = require('./supabase/db');
} else {
  console.log('[DB] Using SQLite database (Supabase not configured)');
}

/**
 * Initialize SQLite database (for fallback)
 */
function initSqlite(db) {
  sqliteDb = db;
}

/**
 * Check if using Supabase
 */
function isUsingSupabase() {
  return USE_SUPABASE;
}

// =============================================================================
// ASYNC DATABASE OPERATIONS (for Supabase)
// =============================================================================

const asyncDb = {
  // Users
  getUserById: async (id) => {
    if (USE_SUPABASE) return supabaseDb.getUserById(id);
    return sqliteDb.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },
  
  getUserByEmail: async (email) => {
    if (USE_SUPABASE) return supabaseDb.getUserByEmail(email);
    return sqliteDb.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  },
  
  getUserByPublicId: async (publicId) => {
    if (USE_SUPABASE) return supabaseDb.getUserByPublicId(publicId);
    return sqliteDb.prepare('SELECT * FROM users WHERE public_id = ?').get(publicId);
  },
  
  createUser: async ({ email, passwordHash, fullName, publicId, createdAt }) => {
    if (USE_SUPABASE) {
      return supabaseDb.createUser({ email, passwordHash, fullName, publicId });
    }
    const stmt = sqliteDb.prepare(
      'INSERT INTO users (email, password_hash, full_name, public_id, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    const result = stmt.run(email.toLowerCase(), passwordHash, fullName, publicId, createdAt);
    return { id: result.lastInsertRowid };
  },
  
  updateUser: async (userId, updates) => {
    if (USE_SUPABASE) return supabaseDb.updateUser(userId, updates);
    // Build dynamic update for SQLite
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    sqliteDb.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).run(...values, userId);
  },

  // Sessions
  getSessionById: async (sessionId) => {
    if (USE_SUPABASE) return supabaseDb.getSessionById(sessionId);
    return sqliteDb.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  },
  
  createSession: async ({ id, userId, createdAt, expiresAt }) => {
    if (USE_SUPABASE) return supabaseDb.createSession({ id, userId, expiresAt });
    sqliteDb.prepare(
      'INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
    ).run(id, userId, createdAt, expiresAt);
    return { id };
  },
  
  deleteSession: async (sessionId) => {
    if (USE_SUPABASE) return supabaseDb.deleteSession(sessionId);
    sqliteDb.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  },

  // Agreements
  getAgreementById: async (id) => {
    if (USE_SUPABASE) return supabaseDb.getAgreementById(id);
    return sqliteDb.prepare('SELECT * FROM agreements WHERE id = ?').get(id);
  },
  
  getAgreementsByUserId: async (userId, options = {}) => {
    if (USE_SUPABASE) return supabaseDb.getAgreementsByUserId(userId, options);
    let sql = 'SELECT * FROM agreements WHERE lender_user_id = ? OR borrower_user_id = ?';
    if (options.status) sql += ` AND status = '${options.status}'`;
    sql += ' ORDER BY created_at DESC';
    if (options.limit) sql += ` LIMIT ${options.limit}`;
    return sqliteDb.prepare(sql).all(userId, userId);
  },
  
  createAgreement: async (agreement) => {
    if (USE_SUPABASE) return supabaseDb.createAgreement(agreement);
    const fields = Object.keys(agreement);
    const placeholders = fields.map(() => '?').join(', ');
    const stmt = sqliteDb.prepare(
      `INSERT INTO agreements (${fields.join(', ')}) VALUES (${placeholders})`
    );
    const result = stmt.run(...Object.values(agreement));
    return { id: result.lastInsertRowid, ...agreement };
  },
  
  updateAgreement: async (id, updates) => {
    if (USE_SUPABASE) return supabaseDb.updateAgreement(id, updates);
    const fields = Object.keys(updates);
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    sqliteDb.prepare(`UPDATE agreements SET ${setClause} WHERE id = ?`).run(...Object.values(updates), id);
  },

  // Group Tabs
  getGroupTabById: async (id) => {
    if (USE_SUPABASE) return supabaseDb.getGroupTabById(id);
    return sqliteDb.prepare('SELECT * FROM group_tabs WHERE id = ?').get(id);
  },
  
  getGroupTabByMagicToken: async (token) => {
    if (USE_SUPABASE) return supabaseDb.getGroupTabByMagicToken(token);
    return sqliteDb.prepare('SELECT * FROM group_tabs WHERE magic_token = ?').get(token);
  },
  
  getGroupTabByOwnerToken: async (token) => {
    if (USE_SUPABASE) return supabaseDb.getGroupTabByOwnerToken(token);
    return sqliteDb.prepare('SELECT * FROM group_tabs WHERE owner_token = ?').get(token);
  },
  
  createGroupTab: async (tab) => {
    if (USE_SUPABASE) return supabaseDb.createGroupTab(tab);
    const fields = Object.keys(tab);
    const placeholders = fields.map(() => '?').join(', ');
    const stmt = sqliteDb.prepare(
      `INSERT INTO group_tabs (${fields.join(', ')}) VALUES (${placeholders})`
    );
    const result = stmt.run(...Object.values(tab));
    return { id: result.lastInsertRowid, ...tab };
  },
  
  updateGroupTab: async (id, updates) => {
    if (USE_SUPABASE) return supabaseDb.updateGroupTab(id, updates);
    const fields = Object.keys(updates);
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    sqliteDb.prepare(`UPDATE group_tabs SET ${setClause} WHERE id = ?`).run(...Object.values(updates), id);
  },

  // Participants
  getParticipantsByTabId: async (tabId) => {
    if (USE_SUPABASE) return supabaseDb.getParticipantsByTabId(tabId);
    return sqliteDb.prepare('SELECT * FROM group_tab_participants WHERE group_tab_id = ?').all(tabId);
  },
  
  getParticipantById: async (id) => {
    if (USE_SUPABASE) return supabaseDb.getParticipantById(id);
    return sqliteDb.prepare('SELECT * FROM group_tab_participants WHERE id = ?').get(id);
  },
  
  getParticipantByGuestToken: async (token) => {
    if (USE_SUPABASE) return supabaseDb.getParticipantByGuestToken(token);
    return sqliteDb.prepare('SELECT * FROM group_tab_participants WHERE guest_session_token = ?').get(token);
  },
  
  createParticipant: async (participant) => {
    if (USE_SUPABASE) return supabaseDb.createParticipant(participant);
    const fields = Object.keys(participant);
    const placeholders = fields.map(() => '?').join(', ');
    const stmt = sqliteDb.prepare(
      `INSERT INTO group_tab_participants (${fields.join(', ')}) VALUES (${placeholders})`
    );
    const result = stmt.run(...Object.values(participant));
    return { id: result.lastInsertRowid, ...participant };
  },
  
  updateParticipant: async (id, updates) => {
    if (USE_SUPABASE) return supabaseDb.updateParticipant(id, updates);
    const fields = Object.keys(updates);
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    sqliteDb.prepare(`UPDATE group_tab_participants SET ${setClause} WHERE id = ?`).run(...Object.values(updates), id);
  },

  // Messages
  getMessagesByUserId: async (userId, options = {}) => {
    if (USE_SUPABASE) return supabaseDb.getMessagesByUserId(userId, options);
    let sql = 'SELECT * FROM messages WHERE user_id = ?';
    if (options.unreadOnly) sql += ' AND read_at IS NULL';
    sql += ' ORDER BY created_at DESC';
    if (options.limit) sql += ` LIMIT ${options.limit}`;
    return sqliteDb.prepare(sql).all(userId);
  },
  
  createMessage: async (message) => {
    if (USE_SUPABASE) return supabaseDb.createMessage(message);
    const fields = Object.keys(message);
    const placeholders = fields.map(() => '?').join(', ');
    const stmt = sqliteDb.prepare(
      `INSERT INTO messages (${fields.join(', ')}) VALUES (${placeholders})`
    );
    const result = stmt.run(...Object.values(message));
    return { id: result.lastInsertRowid, ...message };
  },
  
  markMessageAsRead: async (messageId) => {
    if (USE_SUPABASE) return supabaseDb.markMessageAsRead(messageId);
    sqliteDb.prepare('UPDATE messages SET read_at = ? WHERE id = ?').run(new Date().toISOString(), messageId);
  },

  // Payments
  getPaymentsByAgreementId: async (agreementId) => {
    if (USE_SUPABASE) return supabaseDb.getPaymentsByAgreementId(agreementId);
    return sqliteDb.prepare('SELECT * FROM payments WHERE agreement_id = ? ORDER BY created_at DESC').all(agreementId);
  },
  
  createPayment: async (payment) => {
    if (USE_SUPABASE) return supabaseDb.createPayment(payment);
    const fields = Object.keys(payment);
    const placeholders = fields.map(() => '?').join(', ');
    const stmt = sqliteDb.prepare(
      `INSERT INTO payments (${fields.join(', ')}) VALUES (${placeholders})`
    );
    const result = stmt.run(...Object.values(payment));
    return { id: result.lastInsertRowid, ...payment };
  },

  // Invites
  getInviteByToken: async (token) => {
    if (USE_SUPABASE) return supabaseDb.getInviteByToken(token);
    return sqliteDb.prepare('SELECT * FROM agreement_invites WHERE token = ?').get(token);
  },
  
  createInvite: async ({ agreementId, email, token, createdAt }) => {
    if (USE_SUPABASE) return supabaseDb.createInvite({ agreementId, email, token });
    sqliteDb.prepare(
      'INSERT INTO agreement_invites (agreement_id, email, token, created_at) VALUES (?, ?, ?, ?)'
    ).run(agreementId, email.toLowerCase(), token, createdAt);
    return { token };
  },
  
  acceptInvite: async (token) => {
    if (USE_SUPABASE) return supabaseDb.acceptInvite(token);
    sqliteDb.prepare('UPDATE agreement_invites SET accepted_at = ? WHERE token = ?')
      .run(new Date().toISOString(), token);
  },

  // Payment Reports
  getPaymentReportsByTabId: async (tabId) => {
    if (USE_SUPABASE) return supabaseDb.getPaymentReportsByTabId(tabId);
    return sqliteDb.prepare('SELECT * FROM group_tab_payment_reports WHERE group_tab_id = ? ORDER BY created_at DESC').all(tabId);
  },
  
  createPaymentReport: async (report) => {
    if (USE_SUPABASE) return supabaseDb.createPaymentReport(report);
    const fields = Object.keys(report);
    const placeholders = fields.map(() => '?').join(', ');
    const stmt = sqliteDb.prepare(
      `INSERT INTO group_tab_payment_reports (${fields.join(', ')}) VALUES (${placeholders})`
    );
    const result = stmt.run(...Object.values(report));
    return { id: result.lastInsertRowid, ...report };
  },
  
  updatePaymentReport: async (id, updates) => {
    if (USE_SUPABASE) return supabaseDb.updatePaymentReport(id, updates);
    const fields = Object.keys(updates);
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    sqliteDb.prepare(`UPDATE group_tab_payment_reports SET ${setClause} WHERE id = ?`).run(...Object.values(updates), id);
  },

  // Remote Config
  getRemoteConfig: async () => {
    if (USE_SUPABASE) return supabaseDb.getRemoteConfig();
    return sqliteDb.prepare('SELECT * FROM remote_config ORDER BY key').all();
  },
  
  getRemoteConfigByKey: async (key) => {
    if (USE_SUPABASE) return supabaseDb.getRemoteConfigByKey(key);
    return sqliteDb.prepare('SELECT * FROM remote_config WHERE key = ?').get(key);
  },
};

module.exports = {
  USE_SUPABASE,
  isUsingSupabase,
  initSqlite,
  asyncDb,
};

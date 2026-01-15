/**
 * Database Abstraction Layer for Supabase
 * 
 * This module provides database access functions that mirror the existing
 * SQLite-based queries but use Supabase Postgres instead.
 * 
 * Usage:
 *   const db = require('./lib/supabase/db');
 *   const user = await db.getUserById(1);
 */

const { supabase, supabaseAdmin, isSupabaseConfigured } = require('./client');

// =============================================================================
// USER QUERIES
// =============================================================================

/**
 * Get user by ID
 */
async function getUserById(userId) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getUserById error:', error);
  }
  return data;
}

/**
 * Get user by email
 */
async function getUserByEmail(email) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getUserByEmail error:', error);
  }
  return data;
}

/**
 * Get user by public ID
 */
async function getUserByPublicId(publicId) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('public_id', publicId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getUserByPublicId error:', error);
  }
  return data;
}

/**
 * Create a new user
 */
async function createUser({ email, passwordHash, fullName, publicId }) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .insert({
      email: email.toLowerCase(),
      password_hash: passwordHash,
      full_name: fullName,
      public_id: publicId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    console.error('[DB] createUser error:', error);
    throw error;
  }
  return data;
}

/**
 * Update user
 */
async function updateUser(userId, updates) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();
  
  if (error) {
    console.error('[DB] updateUser error:', error);
    throw error;
  }
  return data;
}

// =============================================================================
// SESSION QUERIES (Legacy - will be replaced by Supabase Auth)
// =============================================================================

/**
 * Get session by ID
 */
async function getSessionById(sessionId) {
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getSessionById error:', error);
  }
  return data;
}

/**
 * Create session
 */
async function createSession({ id, userId, expiresAt }) {
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .insert({
      id,
      user_id: userId,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
    })
    .select()
    .single();
  
  if (error) {
    console.error('[DB] createSession error:', error);
    throw error;
  }
  return data;
}

/**
 * Delete session
 */
async function deleteSession(sessionId) {
  const { error } = await supabaseAdmin
    .from('sessions')
    .delete()
    .eq('id', sessionId);
  
  if (error) {
    console.error('[DB] deleteSession error:', error);
  }
}

/**
 * Delete expired sessions
 */
async function deleteExpiredSessions() {
  const { error } = await supabaseAdmin
    .from('sessions')
    .delete()
    .lt('expires_at', new Date().toISOString());
  
  if (error) {
    console.error('[DB] deleteExpiredSessions error:', error);
  }
}

// =============================================================================
// AGREEMENT (LOAN) QUERIES
// =============================================================================

/**
 * Get agreement by ID
 */
async function getAgreementById(agreementId) {
  const { data, error } = await supabaseAdmin
    .from('agreements')
    .select(`
      *,
      lender:users!agreements_lender_user_id_fkey(id, full_name, email),
      borrower:users!agreements_borrower_user_id_fkey(id, full_name, email)
    `)
    .eq('id', agreementId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getAgreementById error:', error);
  }
  return data;
}

/**
 * Get agreements by user ID (as lender or borrower)
 */
async function getAgreementsByUserId(userId, options = {}) {
  let query = supabaseAdmin
    .from('agreements')
    .select(`
      *,
      lender:users!agreements_lender_user_id_fkey(id, full_name, email),
      borrower:users!agreements_borrower_user_id_fkey(id, full_name, email)
    `)
    .or(`lender_user_id.eq.${userId},borrower_user_id.eq.${userId}`);
  
  if (options.status) {
    query = query.eq('status', options.status);
  }
  
  query = query.order('created_at', { ascending: false });
  
  if (options.limit) {
    query = query.limit(options.limit);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('[DB] getAgreementsByUserId error:', error);
    return [];
  }
  return data || [];
}

/**
 * Create agreement
 */
async function createAgreement(agreement) {
  const { data, error } = await supabaseAdmin
    .from('agreements')
    .insert({
      ...agreement,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    console.error('[DB] createAgreement error:', error);
    throw error;
  }
  return data;
}

/**
 * Update agreement
 */
async function updateAgreement(agreementId, updates) {
  const { data, error } = await supabaseAdmin
    .from('agreements')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agreementId)
    .select()
    .single();
  
  if (error) {
    console.error('[DB] updateAgreement error:', error);
    throw error;
  }
  return data;
}

// =============================================================================
// AGREEMENT INVITE QUERIES
// =============================================================================

/**
 * Get invite by token
 */
async function getInviteByToken(token) {
  const { data, error } = await supabaseAdmin
    .from('agreement_invites')
    .select('*, agreement:agreements(*)')
    .eq('token', token)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getInviteByToken error:', error);
  }
  return data;
}

/**
 * Create invite
 */
async function createInvite({ agreementId, email, token }) {
  const { data, error } = await supabaseAdmin
    .from('agreement_invites')
    .insert({
      agreement_id: agreementId,
      email: email.toLowerCase(),
      token,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    console.error('[DB] createInvite error:', error);
    throw error;
  }
  return data;
}

/**
 * Mark invite as accepted
 */
async function acceptInvite(token) {
  const { data, error } = await supabaseAdmin
    .from('agreement_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('token', token)
    .select()
    .single();
  
  if (error) {
    console.error('[DB] acceptInvite error:', error);
    throw error;
  }
  return data;
}

// =============================================================================
// PAYMENT QUERIES
// =============================================================================

/**
 * Get payments by agreement ID
 */
async function getPaymentsByAgreementId(agreementId) {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('*, recorded_by:users!payments_recorded_by_user_id_fkey(id, full_name, email)')
    .eq('agreement_id', agreementId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[DB] getPaymentsByAgreementId error:', error);
    return [];
  }
  return data || [];
}

/**
 * Create payment
 */
async function createPayment(payment) {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .insert({
      ...payment,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    console.error('[DB] createPayment error:', error);
    throw error;
  }
  return data;
}

// =============================================================================
// GROUP TAB QUERIES
// =============================================================================

/**
 * Get group tab by ID
 */
async function getGroupTabById(tabId) {
  const { data, error } = await supabaseAdmin
    .from('group_tabs')
    .select('*, creator:users!group_tabs_creator_user_id_fkey(id, full_name, email)')
    .eq('id', tabId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getGroupTabById error:', error);
  }
  return data;
}

/**
 * Get group tab by magic token
 */
async function getGroupTabByMagicToken(magicToken) {
  const { data, error } = await supabaseAdmin
    .from('group_tabs')
    .select('*, creator:users!group_tabs_creator_user_id_fkey(id, full_name, email)')
    .eq('magic_token', magicToken)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getGroupTabByMagicToken error:', error);
  }
  return data;
}

/**
 * Get group tab by owner token
 */
async function getGroupTabByOwnerToken(ownerToken) {
  const { data, error } = await supabaseAdmin
    .from('group_tabs')
    .select('*, creator:users!group_tabs_creator_user_id_fkey(id, full_name, email)')
    .eq('owner_token', ownerToken)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getGroupTabByOwnerToken error:', error);
  }
  return data;
}

/**
 * Get group tabs by user ID
 */
async function getGroupTabsByUserId(userId) {
  // Get tabs where user is creator or participant
  const { data: createdTabs, error: createdError } = await supabaseAdmin
    .from('group_tabs')
    .select('*')
    .eq('creator_user_id', userId)
    .order('created_at', { ascending: false });
  
  const { data: participantData, error: participantError } = await supabaseAdmin
    .from('group_tab_participants')
    .select('group_tab_id')
    .eq('user_id', userId);
  
  if (createdError || participantError) {
    console.error('[DB] getGroupTabsByUserId error:', createdError || participantError);
    return [];
  }
  
  const participantTabIds = (participantData || []).map(p => p.group_tab_id);
  
  if (participantTabIds.length > 0) {
    const { data: participatedTabs } = await supabaseAdmin
      .from('group_tabs')
      .select('*')
      .in('id', participantTabIds)
      .not('creator_user_id', 'eq', userId);
    
    return [...(createdTabs || []), ...(participatedTabs || [])];
  }
  
  return createdTabs || [];
}

/**
 * Create group tab
 */
async function createGroupTab(tab) {
  const { data, error } = await supabaseAdmin
    .from('group_tabs')
    .insert({
      ...tab,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    console.error('[DB] createGroupTab error:', error);
    throw error;
  }
  return data;
}

/**
 * Update group tab
 */
async function updateGroupTab(tabId, updates) {
  const { data, error } = await supabaseAdmin
    .from('group_tabs')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tabId)
    .select()
    .single();
  
  if (error) {
    console.error('[DB] updateGroupTab error:', error);
    throw error;
  }
  return data;
}

// =============================================================================
// GROUP TAB PARTICIPANT QUERIES
// =============================================================================

/**
 * Get participants by tab ID
 */
async function getParticipantsByTabId(tabId) {
  const { data, error } = await supabaseAdmin
    .from('group_tab_participants')
    .select('*, user:users(id, full_name, email)')
    .eq('group_tab_id', tabId)
    .order('joined_at', { ascending: true });
  
  if (error) {
    console.error('[DB] getParticipantsByTabId error:', error);
    return [];
  }
  return data || [];
}

/**
 * Get participant by ID
 */
async function getParticipantById(participantId) {
  const { data, error } = await supabaseAdmin
    .from('group_tab_participants')
    .select('*, user:users(id, full_name, email)')
    .eq('id', participantId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getParticipantById error:', error);
  }
  return data;
}

/**
 * Get participant by guest session token
 */
async function getParticipantByGuestToken(guestToken) {
  const { data, error } = await supabaseAdmin
    .from('group_tab_participants')
    .select('*, group_tab:group_tabs(*)')
    .eq('guest_session_token', guestToken)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getParticipantByGuestToken error:', error);
  }
  return data;
}

/**
 * Create participant
 */
async function createParticipant(participant) {
  const { data, error } = await supabaseAdmin
    .from('group_tab_participants')
    .insert({
      ...participant,
      joined_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    console.error('[DB] createParticipant error:', error);
    throw error;
  }
  return data;
}

/**
 * Update participant
 */
async function updateParticipant(participantId, updates) {
  const { data, error } = await supabaseAdmin
    .from('group_tab_participants')
    .update(updates)
    .eq('id', participantId)
    .select()
    .single();
  
  if (error) {
    console.error('[DB] updateParticipant error:', error);
    throw error;
  }
  return data;
}

// =============================================================================
// GROUP TAB PAYMENT REPORTS
// =============================================================================

/**
 * Get payment reports by tab ID
 */
async function getPaymentReportsByTabId(tabId) {
  const { data, error } = await supabaseAdmin
    .from('group_tab_payment_reports')
    .select('*, participant:group_tab_participants(id, guest_name, user:users(id, full_name))')
    .eq('group_tab_id', tabId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[DB] getPaymentReportsByTabId error:', error);
    return [];
  }
  return data || [];
}

/**
 * Create payment report
 */
async function createPaymentReport(report) {
  const { data, error } = await supabaseAdmin
    .from('group_tab_payment_reports')
    .insert({
      ...report,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    console.error('[DB] createPaymentReport error:', error);
    throw error;
  }
  return data;
}

/**
 * Update payment report
 */
async function updatePaymentReport(reportId, updates) {
  const { data, error } = await supabaseAdmin
    .from('group_tab_payment_reports')
    .update(updates)
    .eq('id', reportId)
    .select()
    .single();
  
  if (error) {
    console.error('[DB] updatePaymentReport error:', error);
    throw error;
  }
  return data;
}

// =============================================================================
// MESSAGES
// =============================================================================

/**
 * Get messages by user ID
 */
async function getMessagesByUserId(userId, options = {}) {
  let query = supabaseAdmin
    .from('messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (options.unreadOnly) {
    query = query.is('read_at', null);
  }
  
  if (options.limit) {
    query = query.limit(options.limit);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('[DB] getMessagesByUserId error:', error);
    return [];
  }
  return data || [];
}

/**
 * Create message
 */
async function createMessage(message) {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .insert({
      ...message,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    console.error('[DB] createMessage error:', error);
    throw error;
  }
  return data;
}

/**
 * Mark message as read
 */
async function markMessageAsRead(messageId) {
  const { error } = await supabaseAdmin
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', messageId);
  
  if (error) {
    console.error('[DB] markMessageAsRead error:', error);
  }
}

// =============================================================================
// REMOTE CONFIG
// =============================================================================

/**
 * Get all remote config
 */
async function getRemoteConfig() {
  const { data, error } = await supabaseAdmin
    .from('remote_config')
    .select('*')
    .order('key');
  
  if (error) {
    console.error('[DB] getRemoteConfig error:', error);
    return [];
  }
  return data || [];
}

/**
 * Get remote config by key
 */
async function getRemoteConfigByKey(key) {
  const { data, error } = await supabaseAdmin
    .from('remote_config')
    .select('*')
    .eq('key', key)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getRemoteConfigByKey error:', error);
  }
  return data;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Status
  isSupabaseConfigured,
  
  // Users
  getUserById,
  getUserByEmail,
  getUserByPublicId,
  createUser,
  updateUser,
  
  // Sessions
  getSessionById,
  createSession,
  deleteSession,
  deleteExpiredSessions,
  
  // Agreements
  getAgreementById,
  getAgreementsByUserId,
  createAgreement,
  updateAgreement,
  
  // Invites
  getInviteByToken,
  createInvite,
  acceptInvite,
  
  // Payments
  getPaymentsByAgreementId,
  createPayment,
  
  // Group Tabs
  getGroupTabById,
  getGroupTabByMagicToken,
  getGroupTabByOwnerToken,
  getGroupTabsByUserId,
  createGroupTab,
  updateGroupTab,
  
  // Participants
  getParticipantsByTabId,
  getParticipantById,
  getParticipantByGuestToken,
  createParticipant,
  updateParticipant,
  
  // Payment Reports
  getPaymentReportsByTabId,
  createPaymentReport,
  updatePaymentReport,
  
  // Messages
  getMessagesByUserId,
  createMessage,
  markMessageAsRead,
  
  // Remote Config
  getRemoteConfig,
  getRemoteConfigByKey,
};

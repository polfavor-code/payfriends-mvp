/**
 * Database Abstraction Layer for Supabase
 * 
 * This module provides database access functions using Supabase Postgres.
 * All functions use the admin client to bypass RLS for server-side operations.
 */

import { getSupabaseAdmin, isSupabaseConfigured } from './client';

// Re-export configuration check
export { isSupabaseConfigured };

// =============================================================================
// TYPES
// =============================================================================

export interface User {
  id: number;
  email: string;
  password_hash: string;
  full_name: string | null;
  public_id: string | null;
  phone_number: string | null;
  profile_picture: string | null;
  timezone: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: number;
  created_at: string;
  expires_at: string;
}

export interface Agreement {
  id: number;
  lender_user_id: number | null;
  lender_name: string;
  borrower_user_id: number | null;
  borrower_email: string;
  friend_first_name: string | null;
  direction: 'lend' | 'borrow';
  repayment_type: 'one_time' | 'installments';
  amount_cents: number;
  interest_rate: number | null;
  installment_count: number | null;
  payment_frequency: string | null;
  due_date: string;
  status: 'pending' | 'active' | 'settled' | 'cancelled';
  description: string | null;
  has_repayment_issue: boolean;
  calc_version: string | null;
  created_at: string;
  updated_at: string;
  lender?: Pick<User, 'id' | 'full_name' | 'email'>;
  borrower?: Pick<User, 'id' | 'full_name' | 'email'>;
}

export interface AgreementInvite {
  id: number;
  agreement_id: number;
  email: string;
  token: string;
  created_at: string;
  accepted_at: string | null;
  agreement?: Agreement;
}

export interface Payment {
  id: number;
  agreement_id: number;
  recorded_by_user_id: number;
  amount_cents: number;
  method: string | null;
  note: string | null;
  status: string;
  proof_file_path: string | null;
  created_at: string;
  recorded_by?: Pick<User, 'id' | 'full_name' | 'email'>;
}

export interface GroupTab {
  id: number;
  creator_user_id: number;
  name: string;
  description: string | null;
  tab_type: 'one_bill' | 'multi_bill';
  template: string | null;
  status: 'open' | 'closed' | 'settled';
  total_amount_cents: number | null;
  split_mode: string;
  expected_pay_rate: number;
  seat_count: number | null;
  people_count: number;
  receipt_file_path: string | null;
  paid_up_cents: number;
  host_overpaid_cents: number;
  total_raised_cents: number;
  proof_required: string;
  magic_token: string;
  owner_token: string | null;
  invite_code: string | null;
  manage_code: string | null;
  event_date: string | null;
  // Gift-specific fields
  gift_mode: string | null;
  group_gift_mode: string | null;
  recipient_name: string | null;
  about_text: string | null;
  about_image_path: string | null;
  about_link: string | null;
  is_raising_money_only: boolean;
  amount_target: number | null;
  contributor_count: number | null;
  raising_for_text: string | null;
  raising_for_image_path: string | null;
  raising_for_link: string | null;
  is_open_pot: boolean;
  payment_methods_json: string | null;
  organizer_contribution: number | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  last_payment_at?: string | null;
  creator?: Pick<User, 'id' | 'full_name' | 'email'>;
}

export interface GroupTabParticipant {
  id: number;
  group_tab_id: number;
  user_id: number | null;
  guest_name: string | null;
  guest_session_token: string | null;
  role: string;
  is_member: boolean;
  hide_name: boolean;
  seats_claimed: number;
  tier_name: string | null;
  tier_multiplier: number;
  tier_id: number | null;
  price_group_id: number | null;
  custom_amount_cents: number | null;
  fair_share_cents: number | null;
  remaining_cents: number | null;
  total_paid_cents: number;
  joined_at: string;
  user?: Pick<User, 'id' | 'full_name' | 'email'>;
  group_tab?: GroupTab;
}

export interface GroupTabPaymentReport {
  id: number;
  group_tab_id: number;
  participant_id: number;
  amount_cents: number;
  method: string | null;
  proof_file_path: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  participant?: GroupTabParticipant;
}

export interface Message {
  id: number;
  user_id: number;
  agreement_id: number | null;
  tab_id: number | null;
  subject: string;
  body: string;
  event_type: string | null;
  created_at: string;
  read_at: string | null;
}

export interface RemoteConfig {
  key: string;
  value: string;
  type: 'boolean' | 'string' | 'json' | 'number';
  description: string;
  updated_at: string;
}

// =============================================================================
// USER QUERIES
// =============================================================================

export async function getUserById(userId: number): Promise<User | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getUserById error:', error);
  }
  return data;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getUserByEmail error:', error);
  }
  return data;
}

export async function getUserByPublicId(publicId: string): Promise<User | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('public_id', publicId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getUserByPublicId error:', error);
  }
  return data;
}

export async function createUser(user: {
  email: string;
  passwordHash: string;
  fullName?: string;
  publicId?: string;
}): Promise<User> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .insert({
      email: user.email.toLowerCase(),
      password_hash: user.passwordHash,
      full_name: user.fullName || null,
      public_id: user.publicId || null,
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

export async function updateUser(userId: number, updates: Partial<Omit<User, 'id' | 'created_at'>>): Promise<User> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
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
// SESSION QUERIES
// =============================================================================

export async function getSessionById(sessionId: string): Promise<Session | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getSessionById error:', error);
  }
  return data;
}

export async function createSession(session: {
  id: string;
  userId: number;
  expiresAt: string;
}): Promise<Session> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      id: session.id,
      user_id: session.userId,
      created_at: new Date().toISOString(),
      expires_at: session.expiresAt,
    })
    .select()
    .single();
  
  if (error) {
    console.error('[DB] createSession error:', error);
    throw error;
  }
  return data;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId);
  
  if (error) {
    console.error('[DB] deleteSession error:', error);
  }
}

export async function deleteExpiredSessions(): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('sessions')
    .delete()
    .lt('expires_at', new Date().toISOString());
  
  if (error) {
    console.error('[DB] deleteExpiredSessions error:', error);
  }
}

// =============================================================================
// AGREEMENT QUERIES
// =============================================================================

export async function getAgreementById(agreementId: number): Promise<Agreement | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
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

export async function getAgreementsByUserId(
  userId: number,
  options: { status?: string; limit?: number } = {}
): Promise<Agreement[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
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

export async function createAgreement(agreement: Omit<Agreement, 'id' | 'created_at' | 'updated_at' | 'lender' | 'borrower'>): Promise<Agreement> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
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

export async function updateAgreement(
  agreementId: number,
  updates: Partial<Omit<Agreement, 'id' | 'created_at' | 'lender' | 'borrower'>>
): Promise<Agreement> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
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

export async function getInviteByToken(token: string): Promise<AgreementInvite | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('agreement_invites')
    .select('*, agreement:agreements(*)')
    .eq('token', token)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getInviteByToken error:', error);
  }
  return data;
}

export async function createInvite(invite: {
  agreementId: number;
  email: string;
  token: string;
}): Promise<AgreementInvite> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('agreement_invites')
    .insert({
      agreement_id: invite.agreementId,
      email: invite.email.toLowerCase(),
      token: invite.token,
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

export async function acceptInvite(token: string): Promise<AgreementInvite> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
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

export async function getPaymentsByAgreementId(agreementId: number): Promise<Payment[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
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

export async function createPayment(payment: Omit<Payment, 'id' | 'created_at' | 'recorded_by'>): Promise<Payment> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
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

export async function getGroupTabById(tabId: number): Promise<GroupTab | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('group_tabs')
    .select('*, creator:users!group_tabs_creator_user_id_fkey(id, full_name, email)')
    .eq('id', tabId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getGroupTabById error:', error);
  }
  return data;
}

export async function getGroupTabByMagicToken(magicToken: string): Promise<GroupTab | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('group_tabs')
    .select('*, creator:users!group_tabs_creator_user_id_fkey(id, full_name, email)')
    .eq('magic_token', magicToken)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getGroupTabByMagicToken error:', error);
  }
  return data;
}

export async function getGroupTabByOwnerToken(ownerToken: string): Promise<GroupTab | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('group_tabs')
    .select('*, creator:users!group_tabs_creator_user_id_fkey(id, full_name, email)')
    .eq('owner_token', ownerToken)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getGroupTabByOwnerToken error:', error);
  }
  return data;
}

export async function getGroupTabsByUserId(userId: number): Promise<GroupTab[]> {
  const supabase = getSupabaseAdmin();
  
  // Get tabs where user is creator
  const { data: createdTabs, error: createdError } = await supabase
    .from('group_tabs')
    .select('*')
    .eq('creator_user_id', userId)
    .order('created_at', { ascending: false });
  
  // Get tabs where user is participant
  const { data: participantData, error: participantError } = await supabase
    .from('group_tab_participants')
    .select('group_tab_id')
    .eq('user_id', userId);
  
  if (createdError || participantError) {
    console.error('[DB] getGroupTabsByUserId error:', createdError || participantError);
    return [];
  }
  
  const participantTabIds = (participantData || []).map(p => p.group_tab_id);
  
  if (participantTabIds.length > 0) {
    const { data: participatedTabs } = await supabase
      .from('group_tabs')
      .select('*')
      .in('id', participantTabIds)
      .not('creator_user_id', 'eq', userId);
    
    return [...(createdTabs || []), ...(participatedTabs || [])];
  }
  
  return createdTabs || [];
}

export async function createGroupTab(tab: Omit<GroupTab, 'id' | 'created_at' | 'updated_at' | 'creator'>): Promise<GroupTab> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
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

export async function updateGroupTab(
  tabId: number,
  updates: Partial<Omit<GroupTab, 'id' | 'created_at' | 'creator'>>
): Promise<GroupTab> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
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

export async function getParticipantsByTabId(tabId: number): Promise<GroupTabParticipant[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
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

export async function getParticipantById(participantId: number): Promise<GroupTabParticipant | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('group_tab_participants')
    .select('*, user:users(id, full_name, email)')
    .eq('id', participantId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getParticipantById error:', error);
  }
  return data;
}

export async function getParticipantByGuestToken(guestToken: string): Promise<GroupTabParticipant | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('group_tab_participants')
    .select('*, group_tab:group_tabs(*)')
    .eq('guest_session_token', guestToken)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getParticipantByGuestToken error:', error);
  }
  return data;
}

export async function createParticipant(participant: Omit<GroupTabParticipant, 'id' | 'joined_at' | 'user' | 'group_tab'>): Promise<GroupTabParticipant> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
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

export async function updateParticipant(
  participantId: number,
  updates: Partial<Omit<GroupTabParticipant, 'id' | 'joined_at' | 'user' | 'group_tab'>>
): Promise<GroupTabParticipant> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
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

export async function getPaymentReportsByTabId(tabId: number): Promise<GroupTabPaymentReport[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
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

export async function createPaymentReport(report: Omit<GroupTabPaymentReport, 'id' | 'created_at' | 'participant'>): Promise<GroupTabPaymentReport> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
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

export async function updatePaymentReport(
  reportId: number,
  updates: Partial<Omit<GroupTabPaymentReport, 'id' | 'created_at' | 'participant'>>
): Promise<GroupTabPaymentReport> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
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

export async function getMessagesByUserId(
  userId: number,
  options: { unreadOnly?: boolean; limit?: number } = {}
): Promise<Message[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
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

export async function createMessage(message: Omit<Message, 'id' | 'created_at'>): Promise<Message> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
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

export async function markMessageAsRead(messageId: number): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', messageId);
  
  if (error) {
    console.error('[DB] markMessageAsRead error:', error);
  }
}

export async function markAllMessagesAsRead(userId: number): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  
  if (error) {
    console.error('[DB] markAllMessagesAsRead error:', error);
  }
}

// =============================================================================
// REMOTE CONFIG
// =============================================================================

export async function getRemoteConfig(): Promise<RemoteConfig[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('remote_config')
    .select('*')
    .order('key');
  
  if (error) {
    console.error('[DB] getRemoteConfig error:', error);
    return [];
  }
  return data || [];
}

export async function getRemoteConfigByKey(key: string): Promise<RemoteConfig | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('remote_config')
    .select('*')
    .eq('key', key)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getRemoteConfigByKey error:', error);
  }
  return data;
}

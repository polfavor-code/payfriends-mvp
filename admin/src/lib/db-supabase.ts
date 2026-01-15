/**
 * Database Layer for Admin CMS - Supabase Version
 * 
 * This module provides all database queries for the Admin CMS using Supabase.
 * Uses service role key to bypass RLS for full admin access.
 */

import { getSupabaseAdmin, isSupabaseConfigured } from './supabase';

// Re-export configuration check
export { isSupabaseConfigured };

// =============================================================================
// TYPES
// =============================================================================

export interface User {
  id: number;
  full_name: string | null;
  email: string;
  phone_number: string | null;
  created_at: string;
  public_id: string | null;
  is_admin: boolean;
}

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
  borrower_name?: string;
}

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

export interface AdminNote {
  id: number;
  entity_type: string;
  entity_id: string;
  note: string;
  admin_id: string;
  created_at: string;
}

export interface AuditLogEntry {
  id: number;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
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

export async function getUsers(search?: string, limit = 50, offset = 0): Promise<User[]> {
  const supabase = getSupabaseAdmin();
  
  let query = supabase
    .from('users')
    .select('id, full_name, email, phone_number, created_at, public_id, is_admin')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone_number.ilike.%${search}%`);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('[DB] getUsers error:', error);
    return [];
  }
  
  return data || [];
}

export async function getUserById(id: string | number): Promise<User | undefined> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, phone_number, created_at, public_id, is_admin')
    .eq('id', id)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getUserById error:', error);
  }
  
  return data || undefined;
}

export async function getUserStats(userId: string | number): Promise<{ loansCreated: number; grouptabsCreated: number }> {
  const supabase = getSupabaseAdmin();
  
  const [loansResult, tabsResult] = await Promise.all([
    supabase.from('agreements').select('id', { count: 'exact', head: true }).eq('lender_user_id', userId),
    supabase.from('group_tabs').select('id', { count: 'exact', head: true }).eq('creator_user_id', userId),
  ]);
  
  return {
    loansCreated: loansResult.count || 0,
    grouptabsCreated: tabsResult.count || 0,
  };
}

export async function deleteUser(
  userId: string | number,
  adminId: string,
  anonymize = true
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();
  
  // Check financial history
  const [loansResult, tabsResult] = await Promise.all([
    supabase.from('agreements').select('id', { count: 'exact', head: true })
      .or(`lender_user_id.eq.${userId},borrower_user_id.eq.${userId}`),
    supabase.from('group_tabs').select('id', { count: 'exact', head: true })
      .eq('creator_user_id', userId),
  ]);
  
  const hasFinancialHistory = (loansResult.count || 0) > 0 || (tabsResult.count || 0) > 0;
  
  if (hasFinancialHistory && !anonymize) {
    return { success: false, error: 'User has financial history. Must anonymize instead of hard delete.' };
  }
  
  if (hasFinancialHistory) {
    // Anonymize user
    const { error } = await supabase
      .from('users')
      .update({
        full_name: '[Deleted User]',
        email: `deleted_${userId}@deleted.local`,
        phone_number: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    await logAdminAction(adminId, 'anonymize_user', 'user', String(userId), {
      reason: 'User had financial history',
      loans_count: loansResult.count || 0,
      grouptabs_count: tabsResult.count || 0,
    });
  } else {
    // Hard delete
    const { error } = await supabase.from('users').delete().eq('id', userId);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    await logAdminAction(adminId, 'delete_user', 'user', String(userId), { hard_delete: true });
  }
  
  return { success: true };
}

// =============================================================================
// AGREEMENT (LOAN) QUERIES
// =============================================================================

export async function getAgreements(
  filters?: {
    status?: string;
    lenderId?: string;
    borrowerId?: string;
    dateFrom?: string;
    dateTo?: string;
  },
  limit = 50,
  offset = 0
): Promise<Agreement[]> {
  const supabase = getSupabaseAdmin();
  
  let query = supabase
    .from('agreements')
    .select(`
      *,
      borrower:users!agreements_borrower_user_id_fkey(full_name)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.lenderId) {
    query = query.eq('lender_user_id', filters.lenderId);
  }
  if (filters?.borrowerId) {
    query = query.eq('borrower_user_id', filters.borrowerId);
  }
  if (filters?.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('[DB] getAgreements error:', error);
    return [];
  }
  
  // Transform to expected format
  return (data || []).map(a => ({
    ...a,
    borrower_name: a.borrower?.full_name || a.friend_first_name || a.borrower_email,
  }));
}

export async function getAgreementById(id: string | number): Promise<(Agreement & { lender_display_name?: string }) | undefined> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('agreements')
    .select(`
      *,
      lender:users!agreements_lender_user_id_fkey(full_name),
      borrower:users!agreements_borrower_user_id_fkey(full_name)
    `)
    .eq('id', id)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getAgreementById error:', error);
  }
  
  if (!data) return undefined;
  
  return {
    ...data,
    lender_display_name: data.lender?.full_name,
    borrower_name: data.borrower?.full_name || data.friend_first_name || data.borrower_email,
  };
}

export async function getAgreementPayments(agreementId: string | number): Promise<any[]> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      payer:users!payments_recorded_by_user_id_fkey(full_name)
    `)
    .eq('agreement_id', agreementId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[DB] getAgreementPayments error:', error);
    return [];
  }
  
  return (data || []).map(p => ({
    ...p,
    payer_name: p.payer?.full_name,
  }));
}

// =============================================================================
// GROUPTAB QUERIES
// =============================================================================

export async function getGroupTabs(
  filters?: {
    status?: string;
    type?: string;
    creatorId?: string;
  },
  limit = 50,
  offset = 0
): Promise<GroupTab[]> {
  const supabase = getSupabaseAdmin();
  
  let query = supabase
    .from('group_tabs')
    .select(`
      *,
      creator:users!group_tabs_creator_user_id_fkey(full_name)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.type) {
    query = query.eq('tab_type', filters.type);
  }
  if (filters?.creatorId) {
    query = query.eq('creator_user_id', filters.creatorId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('[DB] getGroupTabs error:', error);
    return [];
  }
  
  return (data || []).map(t => ({
    ...t,
    creator_name: t.creator?.full_name,
  }));
}

export async function getGroupTabById(id: string | number): Promise<GroupTab | undefined> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('group_tabs')
    .select(`
      *,
      creator:users!group_tabs_creator_user_id_fkey(full_name)
    `)
    .eq('id', id)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] getGroupTabById error:', error);
  }
  
  if (!data) return undefined;
  
  return {
    ...data,
    creator_name: data.creator?.full_name,
  };
}

export async function getGroupTabParticipants(tabId: string | number): Promise<any[]> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('group_tab_participants')
    .select(`
      *,
      user:users(full_name)
    `)
    .eq('group_tab_id', tabId)
    .order('joined_at', { ascending: true });
  
  if (error) {
    console.error('[DB] getGroupTabParticipants error:', error);
    return [];
  }
  
  return (data || []).map(p => ({
    ...p,
    user_name: p.user?.full_name,
  }));
}

// =============================================================================
// PAYMENT REPORTS QUERIES
// =============================================================================

export async function getPaymentReports(
  filters?: {
    status?: string;
    entityType?: string;
  },
  limit = 50,
  offset = 0
): Promise<PaymentReport[]> {
  const supabase = getSupabaseAdmin();
  const reports: PaymentReport[] = [];
  
  // Get loan payments if not filtered to grouptabs only
  if (!filters?.entityType || filters.entityType === 'loan') {
    let loanQuery = supabase
      .from('payments')
      .select(`
        id, agreement_id, recorded_by_user_id, amount_cents, status, created_at,
        agreement:agreements(friend_first_name, borrower_email),
        reporter:users!payments_recorded_by_user_id_fkey(full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (filters?.status) {
      loanQuery = loanQuery.eq('status', filters.status);
    }
    
    const { data: loanData } = await loanQuery;
    
    if (loanData) {
      reports.push(...loanData.map(p => ({
        id: p.id,
        entity_type: 'loan' as const,
        entity_id: p.agreement_id,
        entity_name: p.agreement?.friend_first_name || p.agreement?.borrower_email || `Loan #${p.agreement_id}`,
        reporter_id: p.recorded_by_user_id,
        amount_cents: p.amount_cents,
        status: p.status,
        created_at: p.created_at,
        reviewed_at: null,
        reporter_name: p.reporter?.full_name,
      })));
    }
  }
  
  // Get grouptab payment reports if not filtered to loans only
  if (!filters?.entityType || filters.entityType === 'grouptab') {
    let gtQuery = supabase
      .from('group_tab_payment_reports')
      .select(`
        id, group_tab_id, participant_id, reporter_name, amount_cents, status, created_at, reviewed_at,
        group_tab:group_tabs(name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (filters?.status) {
      gtQuery = gtQuery.eq('status', filters.status);
    }
    
    const { data: gtData } = await gtQuery;
    
    if (gtData) {
      reports.push(...gtData.map(r => ({
        id: r.id,
        entity_type: 'grouptab' as const,
        entity_id: r.group_tab_id,
        entity_name: r.group_tab?.name || `Tab #${r.group_tab_id}`,
        reporter_id: r.participant_id || 0,
        amount_cents: r.amount_cents,
        status: r.status,
        created_at: r.created_at,
        reviewed_at: r.reviewed_at,
        reporter_name: r.reporter_name,
      })));
    }
  }
  
  // Sort by created_at and limit
  return reports
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

export async function markPaymentReportReviewed(reportId: string | number, adminId: string): Promise<void> {
  await logAdminAction(adminId, 'mark_reviewed', 'payment_report', String(reportId), {});
}

// =============================================================================
// ADMIN NOTES
// =============================================================================

export async function getAdminNotes(entityType: string, entityId: string | number): Promise<AdminNote[]> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('admin_notes')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', String(entityId))
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[DB] getAdminNotes error:', error);
    return [];
  }
  
  return data || [];
}

export async function addAdminNote(
  entityType: string,
  entityId: string | number,
  note: string,
  adminId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase.from('admin_notes').insert({
    entity_type: entityType,
    entity_id: String(entityId),
    note,
    admin_id: adminId,
    created_at: new Date().toISOString(),
  });
  
  if (error) {
    console.error('[DB] addAdminNote error:', error);
    throw error;
  }
  
  await logAdminAction(adminId, 'add_note', entityType, String(entityId), {
    note_preview: note.substring(0, 100),
  });
}

// =============================================================================
// ADMIN AUDIT LOG
// =============================================================================

export async function logAdminAction(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase.from('admin_audit_log').insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
    created_at: new Date().toISOString(),
  });
  
  if (error) {
    console.error('[DB] logAdminAction error:', error);
  }
}

export async function getAuditLog(limit = 100, offset = 0): Promise<AuditLogEntry[]> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (error) {
    console.error('[DB] getAuditLog error:', error);
    return [];
  }
  
  return data || [];
}

// =============================================================================
// REMOTE CONFIG
// =============================================================================

export async function getRemoteConfigs(): Promise<RemoteConfig[]> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('remote_config')
    .select('*')
    .order('key');
  
  if (error) {
    console.error('[DB] getRemoteConfigs error:', error);
    return [];
  }
  
  return data || [];
}

export async function setRemoteConfig(
  key: string,
  value: string,
  type: string,
  description: string,
  adminId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('remote_config')
    .upsert({
      key,
      value,
      type,
      description,
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    });
  
  if (error) {
    console.error('[DB] setRemoteConfig error:', error);
    throw error;
  }
  
  await logAdminAction(adminId, 'update_config', 'remote_config', key, { value, type });
}

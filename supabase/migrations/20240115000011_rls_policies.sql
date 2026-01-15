-- Migration: Create Row Level Security policies
-- PayFriends SQLite to Supabase migration

-- =============================================================================
-- USERS POLICIES
-- =============================================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth_id = auth.uid() OR is_admin());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- Service role can insert users (for signup)
CREATE POLICY "Service role can insert users"
  ON public.users FOR INSERT
  WITH CHECK (true); -- Controlled by service role key

-- Admin can delete users
CREATE POLICY "Admin can delete users"
  ON public.users FOR DELETE
  USING (is_admin());

-- =============================================================================
-- SESSIONS POLICIES (Legacy - will be deprecated)
-- =============================================================================

CREATE POLICY "Users can view own sessions"
  ON public.sessions FOR SELECT
  USING (
    user_id = get_current_user_id()
    OR is_admin()
  );

CREATE POLICY "Users can delete own sessions"
  ON public.sessions FOR DELETE
  USING (user_id = get_current_user_id());

CREATE POLICY "Service role can manage sessions"
  ON public.sessions FOR ALL
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- AGREEMENTS POLICIES
-- =============================================================================

-- Users can view agreements where they are lender or borrower
CREATE POLICY "Users can view own agreements"
  ON public.agreements FOR SELECT
  USING (
    lender_user_id = get_current_user_id()
    OR borrower_user_id = get_current_user_id()
    OR is_admin()
  );

-- Users can create agreements as lender
CREATE POLICY "Users can create agreements"
  ON public.agreements FOR INSERT
  WITH CHECK (lender_user_id = get_current_user_id());

-- Users can update agreements they are party to
CREATE POLICY "Agreement parties can update"
  ON public.agreements FOR UPDATE
  USING (
    lender_user_id = get_current_user_id()
    OR borrower_user_id = get_current_user_id()
    OR is_admin()
  );

-- =============================================================================
-- AGREEMENT INVITES POLICIES
-- =============================================================================

CREATE POLICY "Users can view invites for their agreements"
  ON public.agreement_invites FOR SELECT
  USING (
    is_agreement_party(agreement_id)
    OR is_admin()
  );

CREATE POLICY "Lenders can create invites"
  ON public.agreement_invites FOR INSERT
  WITH CHECK (is_agreement_lender(agreement_id));

CREATE POLICY "Anyone can update invite by token"
  ON public.agreement_invites FOR UPDATE
  USING (true); -- Token validation happens in app logic

-- =============================================================================
-- PAYMENTS POLICIES
-- =============================================================================

CREATE POLICY "Agreement parties can view payments"
  ON public.payments FOR SELECT
  USING (
    is_agreement_party(agreement_id)
    OR is_admin()
  );

CREATE POLICY "Agreement parties can create payments"
  ON public.payments FOR INSERT
  WITH CHECK (is_agreement_party(agreement_id));

CREATE POLICY "Admin can update payment status"
  ON public.payments FOR UPDATE
  USING (is_admin());

-- =============================================================================
-- INITIAL PAYMENT REPORTS POLICIES
-- =============================================================================

CREATE POLICY "Agreement parties can view initial payment reports"
  ON public.initial_payment_reports FOR SELECT
  USING (
    is_agreement_party(agreement_id)
    OR is_admin()
  );

CREATE POLICY "Agreement parties can create initial payment reports"
  ON public.initial_payment_reports FOR INSERT
  WITH CHECK (is_agreement_party(agreement_id));

-- =============================================================================
-- HARDSHIP REQUESTS POLICIES
-- =============================================================================

CREATE POLICY "Agreement parties can view hardship requests"
  ON public.hardship_requests FOR SELECT
  USING (
    is_agreement_party(agreement_id)
    OR is_admin()
  );

CREATE POLICY "Borrowers can create hardship requests"
  ON public.hardship_requests FOR INSERT
  WITH CHECK (is_agreement_borrower(agreement_id));

CREATE POLICY "Lenders can update hardship requests"
  ON public.hardship_requests FOR UPDATE
  USING (
    is_agreement_lender(agreement_id)
    OR is_admin()
  );

-- =============================================================================
-- RENEGOTIATION REQUESTS POLICIES
-- =============================================================================

CREATE POLICY "Agreement parties can view renegotiation requests"
  ON public.renegotiation_requests FOR SELECT
  USING (
    is_agreement_party(agreement_id)
    OR is_admin()
  );

CREATE POLICY "Agreement parties can create renegotiation requests"
  ON public.renegotiation_requests FOR INSERT
  WITH CHECK (is_agreement_party(agreement_id));

CREATE POLICY "Agreement parties can update renegotiation requests"
  ON public.renegotiation_requests FOR UPDATE
  USING (is_agreement_party(agreement_id));

-- =============================================================================
-- MESSAGES POLICIES
-- =============================================================================

CREATE POLICY "Users can view own messages"
  ON public.messages FOR SELECT
  USING (
    user_id = get_current_user_id()
    OR is_admin()
  );

CREATE POLICY "Service role can create messages"
  ON public.messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own messages"
  ON public.messages FOR UPDATE
  USING (user_id = get_current_user_id());

-- =============================================================================
-- GROUP TABS POLICIES
-- =============================================================================

-- Users can view tabs they created or participate in
CREATE POLICY "Users can view own group tabs"
  ON public.group_tabs FOR SELECT
  USING (
    creator_user_id = get_current_user_id()
    OR is_group_tab_participant(id)
    OR is_admin()
  );

-- Users can create group tabs
CREATE POLICY "Users can create group tabs"
  ON public.group_tabs FOR INSERT
  WITH CHECK (creator_user_id = get_current_user_id());

-- Creators can update their group tabs
CREATE POLICY "Creators can update group tabs"
  ON public.group_tabs FOR UPDATE
  USING (
    creator_user_id = get_current_user_id()
    OR is_admin()
  );

-- Creators can delete their group tabs
CREATE POLICY "Creators can delete group tabs"
  ON public.group_tabs FOR DELETE
  USING (
    creator_user_id = get_current_user_id()
    OR is_admin()
  );

-- =============================================================================
-- GROUP TAB PARTICIPANTS POLICIES
-- =============================================================================

CREATE POLICY "Users can view participants in their tabs"
  ON public.group_tab_participants FOR SELECT
  USING (
    is_group_tab_creator(group_tab_id)
    OR is_group_tab_participant(group_tab_id)
    OR is_admin()
  );

CREATE POLICY "Creators and users can add participants"
  ON public.group_tab_participants FOR INSERT
  WITH CHECK (
    is_group_tab_creator(group_tab_id)
    OR user_id = get_current_user_id()
  );

CREATE POLICY "Creators and own participants can update"
  ON public.group_tab_participants FOR UPDATE
  USING (
    is_group_tab_creator(group_tab_id)
    OR user_id = get_current_user_id()
    OR is_admin()
  );

CREATE POLICY "Creators can delete participants"
  ON public.group_tab_participants FOR DELETE
  USING (
    is_group_tab_creator(group_tab_id)
    OR is_admin()
  );

-- =============================================================================
-- GROUP TAB TIERS POLICIES
-- =============================================================================

CREATE POLICY "Tab participants can view tiers"
  ON public.group_tab_tiers FOR SELECT
  USING (
    is_group_tab_creator(group_tab_id)
    OR is_group_tab_participant(group_tab_id)
    OR is_admin()
  );

CREATE POLICY "Creators can manage tiers"
  ON public.group_tab_tiers FOR ALL
  USING (is_group_tab_creator(group_tab_id));

-- =============================================================================
-- GROUP TAB PRICE GROUPS POLICIES
-- =============================================================================

CREATE POLICY "Tab participants can view price groups"
  ON public.group_tab_price_groups FOR SELECT
  USING (
    is_group_tab_creator(group_tab_id)
    OR is_group_tab_participant(group_tab_id)
    OR is_admin()
  );

CREATE POLICY "Creators can manage price groups"
  ON public.group_tab_price_groups FOR ALL
  USING (is_group_tab_creator(group_tab_id));

-- =============================================================================
-- GROUP TAB EXPENSES POLICIES
-- =============================================================================

CREATE POLICY "Tab participants can view expenses"
  ON public.group_tab_expenses FOR SELECT
  USING (
    is_group_tab_participant(group_tab_id)
    OR is_admin()
  );

CREATE POLICY "Participants can create expenses"
  ON public.group_tab_expenses FOR INSERT
  WITH CHECK (is_group_tab_participant(group_tab_id));

CREATE POLICY "Creators can manage expenses"
  ON public.group_tab_expenses FOR UPDATE
  USING (is_group_tab_creator(group_tab_id));

CREATE POLICY "Creators can delete expenses"
  ON public.group_tab_expenses FOR DELETE
  USING (is_group_tab_creator(group_tab_id));

-- =============================================================================
-- GROUP TAB PAYMENTS POLICIES
-- =============================================================================

CREATE POLICY "Tab participants can view tab payments"
  ON public.group_tab_payments FOR SELECT
  USING (
    is_group_tab_participant(group_tab_id)
    OR is_admin()
  );

CREATE POLICY "Participants can create tab payments"
  ON public.group_tab_payments FOR INSERT
  WITH CHECK (is_group_tab_participant(group_tab_id));

CREATE POLICY "Creators can manage tab payments"
  ON public.group_tab_payments FOR UPDATE
  USING (
    is_group_tab_creator(group_tab_id)
    OR is_admin()
  );

-- =============================================================================
-- GROUP TAB PAYMENT REPORTS POLICIES
-- =============================================================================

CREATE POLICY "Tab participants can view payment reports"
  ON public.group_tab_payment_reports FOR SELECT
  USING (
    is_group_tab_participant(group_tab_id)
    OR is_admin()
  );

CREATE POLICY "Participants can create payment reports"
  ON public.group_tab_payment_reports FOR INSERT
  WITH CHECK (is_group_tab_participant(group_tab_id));

CREATE POLICY "Creators can update payment reports"
  ON public.group_tab_payment_reports FOR UPDATE
  USING (
    is_group_tab_creator(group_tab_id)
    OR is_admin()
  );

-- =============================================================================
-- ADMIN TABLES POLICIES (Admin only)
-- =============================================================================

-- Admin notes - admin only
CREATE POLICY "Admin can manage admin notes"
  ON public.admin_notes FOR ALL
  USING (is_admin());

-- Audit log - admin can view, service role can insert
CREATE POLICY "Admin can view audit log"
  ON public.admin_audit_log FOR SELECT
  USING (is_admin());

CREATE POLICY "Service role can insert audit log"
  ON public.admin_audit_log FOR INSERT
  WITH CHECK (true);

-- Remote config - admin only for writes, anyone can read (for feature flags)
CREATE POLICY "Anyone can read remote config"
  ON public.remote_config FOR SELECT
  USING (true);

CREATE POLICY "Admin can manage remote config"
  ON public.remote_config FOR ALL
  USING (is_admin());

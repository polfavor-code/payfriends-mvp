-- Migration: Enable Row Level Security on all tables
-- PayFriends SQLite to Supabase migration

-- =============================================================================
-- ENABLE RLS ON ALL TABLES
-- =============================================================================

-- Core tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Agreement (loan) tables
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.initial_payment_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hardship_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renegotiation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Group tab tables
ALTER TABLE public.group_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_tab_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_tab_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_tab_price_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_tab_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_tab_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_tab_payment_reports ENABLE ROW LEVEL SECURITY;

-- Admin tables
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remote_config ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- HELPER FUNCTIONS FOR RLS POLICIES
-- =============================================================================

-- Check if user is a participant in a specific group tab
CREATE OR REPLACE FUNCTION is_group_tab_participant(tab_id BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_tab_participants gtp
    JOIN public.users u ON u.id = gtp.user_id
    WHERE gtp.group_tab_id = tab_id
    AND u.auth_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is creator of a group tab
CREATE OR REPLACE FUNCTION is_group_tab_creator(tab_id BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_tabs gt
    JOIN public.users u ON u.id = gt.creator_user_id
    WHERE gt.id = tab_id
    AND u.auth_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is party to an agreement (lender or borrower)
CREATE OR REPLACE FUNCTION is_agreement_party(agreement_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id BIGINT;
BEGIN
  SELECT id INTO current_user_id FROM public.users WHERE auth_id = auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM public.agreements a
    WHERE a.id = agreement_id
    AND (a.lender_user_id = current_user_id OR a.borrower_user_id = current_user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is the lender of an agreement
CREATE OR REPLACE FUNCTION is_agreement_lender(agreement_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id BIGINT;
BEGIN
  SELECT id INTO current_user_id FROM public.users WHERE auth_id = auth.uid();
  
  RETURN EXISTS (
    SELECT 1 FROM public.agreements a
    WHERE a.id = agreement_id
    AND a.lender_user_id = current_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is the borrower of an agreement
CREATE OR REPLACE FUNCTION is_agreement_borrower(agreement_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id BIGINT;
BEGIN
  SELECT id INTO current_user_id FROM public.users WHERE auth_id = auth.uid();
  
  RETURN EXISTS (
    SELECT 1 FROM public.agreements a
    WHERE a.id = agreement_id
    AND a.borrower_user_id = current_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

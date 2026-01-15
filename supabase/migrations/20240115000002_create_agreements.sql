-- Migration: Create agreements (loans) and related tables
-- PayFriends SQLite to Supabase migration

-- =============================================================================
-- AGREEMENTS TABLE (Loans)
-- =============================================================================
-- Loan agreements between lenders and borrowers

CREATE TABLE IF NOT EXISTS public.agreements (
  id BIGSERIAL PRIMARY KEY,
  
  -- Parties
  lender_user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  lender_name TEXT NOT NULL,
  borrower_user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  borrower_email TEXT NOT NULL,
  borrower_phone TEXT,
  friend_first_name TEXT,
  
  -- Loan details
  direction TEXT NOT NULL DEFAULT 'lend', -- 'lend' or 'borrow'
  amount_cents INTEGER NOT NULL,
  description TEXT,
  
  -- Repayment configuration
  repayment_type TEXT NOT NULL DEFAULT 'one_time', -- 'one_time', 'installments'
  installment_count INTEGER,
  installment_amount NUMERIC(12, 2),
  payment_frequency TEXT DEFAULT 'monthly',
  
  -- Dates
  due_date TEXT NOT NULL, -- Keep as TEXT for legacy compatibility
  first_payment_date TEXT,
  final_due_date TEXT,
  money_sent_date TEXT,
  accepted_at TIMESTAMPTZ,
  
  -- Interest
  interest_rate NUMERIC(5, 2) DEFAULT 0,
  total_interest NUMERIC(12, 2) DEFAULT 0,
  total_repay_amount NUMERIC(12, 2),
  
  -- Payment preferences
  payment_preference_method TEXT,
  payment_other_description TEXT,
  payment_methods_json TEXT, -- JSON string of payment methods
  
  -- Options
  one_time_due_option TEXT,
  plan_length INTEGER,
  plan_unit TEXT,
  
  -- Reminders
  reminder_enabled BOOLEAN DEFAULT TRUE,
  reminder_mode TEXT DEFAULT 'auto',
  reminder_offsets TEXT, -- JSON string
  
  -- Flags
  proof_required BOOLEAN DEFAULT FALSE,
  debt_collection_clause BOOLEAN DEFAULT FALSE,
  fairness_accepted BOOLEAN DEFAULT FALSE,
  has_repayment_issue BOOLEAN DEFAULT FALSE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agreements_lender_user_id ON public.agreements(lender_user_id);
CREATE INDEX IF NOT EXISTS idx_agreements_borrower_user_id ON public.agreements(borrower_user_id);
CREATE INDEX IF NOT EXISTS idx_agreements_borrower_email ON public.agreements(borrower_email);
CREATE INDEX IF NOT EXISTS idx_agreements_status ON public.agreements(status);
CREATE INDEX IF NOT EXISTS idx_agreements_created_at ON public.agreements(created_at DESC);

-- Update trigger
CREATE TRIGGER update_agreements_updated_at
  BEFORE UPDATE ON public.agreements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- AGREEMENT INVITES TABLE
-- =============================================================================
-- Invite tokens for borrowers to accept loan agreements

CREATE TABLE IF NOT EXISTS public.agreement_invites (
  id BIGSERIAL PRIMARY KEY,
  agreement_id BIGINT NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agreement_invites_agreement_id ON public.agreement_invites(agreement_id);
CREATE INDEX IF NOT EXISTS idx_agreement_invites_token ON public.agreement_invites(token);
CREATE INDEX IF NOT EXISTS idx_agreement_invites_email ON public.agreement_invites(email);

-- =============================================================================
-- PAYMENTS TABLE (Loan Payments)
-- =============================================================================
-- Payment records for loan agreements

CREATE TABLE IF NOT EXISTS public.payments (
  id BIGSERIAL PRIMARY KEY,
  agreement_id BIGINT NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
  recorded_by_user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Amount
  amount_cents INTEGER NOT NULL,
  applied_amount_cents INTEGER NOT NULL DEFAULT 0,
  overpaid_amount_cents INTEGER NOT NULL DEFAULT 0,
  
  -- Details
  method TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'approved',
  
  -- Proof of payment
  proof_file_path TEXT,
  proof_original_name TEXT,
  proof_mime_type TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_agreement_id ON public.payments(agreement_id);
CREATE INDEX IF NOT EXISTS idx_payments_recorded_by_user_id ON public.payments(recorded_by_user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);

-- =============================================================================
-- INITIAL PAYMENT REPORTS TABLE
-- =============================================================================
-- Reports of initial money transfer from lender

CREATE TABLE IF NOT EXISTS public.initial_payment_reports (
  id BIGSERIAL PRIMARY KEY,
  agreement_id BIGINT NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
  reported_by_user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Details
  payment_method TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  
  -- Proof
  proof_file_path TEXT,
  proof_original_name TEXT,
  proof_mime_type TEXT,
  
  -- Timestamps
  reported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_initial_payment_reports_agreement_id ON public.initial_payment_reports(agreement_id);

-- =============================================================================
-- HARDSHIP REQUESTS TABLE
-- =============================================================================
-- Borrower hardship/payment difficulty requests

CREATE TABLE IF NOT EXISTS public.hardship_requests (
  id BIGSERIAL PRIMARY KEY,
  agreement_id BIGINT NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
  borrower_user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Request details
  reason_category TEXT NOT NULL,
  reason_text TEXT,
  can_pay_now_cents INTEGER,
  preferred_adjustments TEXT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hardship_requests_agreement_id ON public.hardship_requests(agreement_id);

-- =============================================================================
-- RENEGOTIATION REQUESTS TABLE
-- =============================================================================
-- Loan renegotiation workflow

CREATE TABLE IF NOT EXISTS public.renegotiation_requests (
  id BIGSERIAL PRIMARY KEY,
  agreement_id BIGINT NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'open',
  stage TEXT NOT NULL,
  initiated_by TEXT NOT NULL DEFAULT 'borrower',
  
  -- Type selection
  loan_type TEXT NOT NULL,
  selected_type TEXT NOT NULL,
  lender_suggested_type TEXT,
  agreed_type TEXT,
  
  -- Details
  can_pay_now_cents INTEGER,
  borrower_note TEXT,
  trouble_reason TEXT,
  trouble_reason_other TEXT,
  borrower_values_proposal TEXT,
  lender_values_proposal TEXT,
  lender_response_note TEXT,
  
  -- History (JSON)
  history TEXT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_renegotiation_requests_agreement_id ON public.renegotiation_requests(agreement_id);
CREATE INDEX IF NOT EXISTS idx_renegotiation_requests_status ON public.renegotiation_requests(status);

CREATE TRIGGER update_renegotiation_requests_updated_at
  BEFORE UPDATE ON public.renegotiation_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- MESSAGES TABLE
-- =============================================================================
-- In-app notifications and messages

CREATE TABLE IF NOT EXISTS public.messages (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agreement_id BIGINT REFERENCES public.agreements(id) ON DELETE CASCADE,
  tab_id BIGINT, -- Will reference group_tabs after that table is created
  
  -- Content
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  event_type TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_agreement_id ON public.messages(agreement_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_read_at ON public.messages(read_at) WHERE read_at IS NULL;

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE public.agreements IS 'Loan agreements between users';
COMMENT ON TABLE public.payments IS 'Payment records for loan agreements';
COMMENT ON TABLE public.agreement_invites IS 'Invite tokens for borrowers';
COMMENT ON TABLE public.hardship_requests IS 'Borrower hardship/payment difficulty requests';
COMMENT ON TABLE public.renegotiation_requests IS 'Loan renegotiation workflow';
COMMENT ON TABLE public.messages IS 'In-app notifications and messages';

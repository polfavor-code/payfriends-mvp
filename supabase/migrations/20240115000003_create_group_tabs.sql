-- Migration: Create group tabs and related tables
-- PayFriends SQLite to Supabase migration

-- =============================================================================
-- GROUP TABS TABLE
-- =============================================================================
-- Group expense tabs for splitting bills and collecting money

CREATE TABLE IF NOT EXISTS public.group_tabs (
  id BIGSERIAL PRIMARY KEY,
  creator_user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  tab_type TEXT NOT NULL, -- 'one_bill', 'multi_bill', 'gift', etc.
  template TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  
  -- One-bill specific fields
  total_amount_cents INTEGER,
  split_mode TEXT DEFAULT 'equal', -- 'equal', 'custom', 'tiered'
  expected_pay_rate INTEGER DEFAULT 100,
  seat_count INTEGER,
  people_count INTEGER DEFAULT 2,
  receipt_file_path TEXT,
  
  -- Payment tracking
  paid_up_cents INTEGER DEFAULT 0,
  host_overpaid_cents INTEGER DEFAULT 0,
  total_raised_cents INTEGER DEFAULT 0,
  
  -- Common fields
  proof_required TEXT DEFAULT 'optional', -- 'required', 'optional', 'none'
  
  -- Access tokens
  magic_token TEXT UNIQUE NOT NULL, -- Public join link token
  owner_token TEXT UNIQUE, -- Owner management token
  invite_code TEXT, -- Short invite code
  manage_code TEXT, -- Short management code
  
  -- Event details
  event_date TEXT,
  
  -- Gift mode fields
  gift_mode TEXT,
  group_gift_mode TEXT DEFAULT 'gift',
  recipient_name TEXT,
  
  -- About section
  about_text TEXT,
  about_image_path TEXT,
  about_link TEXT,
  
  -- Fundraising mode
  is_raising_money_only BOOLEAN DEFAULT FALSE,
  amount_target INTEGER,
  contributor_count INTEGER,
  raising_for_text TEXT,
  raising_for_image_path TEXT,
  raising_for_link TEXT,
  
  -- Open pot mode
  is_open_pot BOOLEAN DEFAULT FALSE,
  
  -- Payment methods (JSON)
  payment_methods_json TEXT,
  
  -- Organizer contribution
  organizer_contribution INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_group_tabs_creator_user_id ON public.group_tabs(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_group_tabs_status ON public.group_tabs(status);
CREATE INDEX IF NOT EXISTS idx_group_tabs_magic_token ON public.group_tabs(magic_token);
CREATE INDEX IF NOT EXISTS idx_group_tabs_owner_token ON public.group_tabs(owner_token);
CREATE INDEX IF NOT EXISTS idx_group_tabs_invite_code ON public.group_tabs(invite_code);
CREATE INDEX IF NOT EXISTS idx_group_tabs_created_at ON public.group_tabs(created_at DESC);

CREATE TRIGGER update_group_tabs_updated_at
  BEFORE UPDATE ON public.group_tabs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- GROUP TAB PARTICIPANTS TABLE
-- =============================================================================
-- Participants in a group tab (registered users or guests)

CREATE TABLE IF NOT EXISTS public.group_tab_participants (
  id BIGSERIAL PRIMARY KEY,
  group_tab_id BIGINT NOT NULL REFERENCES public.group_tabs(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Guest info (if not a registered user)
  guest_name TEXT,
  guest_session_token TEXT UNIQUE,
  
  -- Role and membership
  role TEXT NOT NULL DEFAULT 'participant', -- 'host', 'participant'
  is_member BOOLEAN NOT NULL DEFAULT FALSE,
  added_by_creator BOOLEAN DEFAULT FALSE,
  hide_name BOOLEAN DEFAULT FALSE,
  
  -- Seat/tier allocation
  seats_claimed INTEGER DEFAULT 1,
  assigned_seats TEXT, -- JSON array of seat numbers
  tier_name TEXT,
  tier_multiplier NUMERIC(5, 2) DEFAULT 1.0,
  tier_id BIGINT, -- References group_tab_tiers(id)
  price_group_id BIGINT, -- References group_tab_price_groups(id)
  
  -- Amount tracking
  custom_amount_cents INTEGER,
  fair_share_cents INTEGER,
  remaining_cents INTEGER,
  total_paid_cents INTEGER DEFAULT 0,
  
  -- Timestamps
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_group_tab_participants_group_tab_id ON public.group_tab_participants(group_tab_id);
CREATE INDEX IF NOT EXISTS idx_group_tab_participants_user_id ON public.group_tab_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_group_tab_participants_guest_session_token ON public.group_tab_participants(guest_session_token);

-- =============================================================================
-- GROUP TAB TIERS TABLE
-- =============================================================================
-- Tiered pricing for group tabs (e.g., "Adult", "Child", "Senior")

CREATE TABLE IF NOT EXISTS public.group_tab_tiers (
  id BIGSERIAL PRIMARY KEY,
  group_tab_id BIGINT NOT NULL REFERENCES public.group_tabs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  multiplier NUMERIC(5, 2) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_tab_tiers_group_tab_id ON public.group_tab_tiers(group_tab_id);

-- =============================================================================
-- GROUP TAB PRICE GROUPS TABLE
-- =============================================================================
-- Fixed price groups (e.g., "Main Course", "Starter")

CREATE TABLE IF NOT EXISTS public.group_tab_price_groups (
  id BIGSERIAL PRIMARY KEY,
  group_tab_id BIGINT NOT NULL REFERENCES public.group_tabs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT,
  amount_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_tab_price_groups_group_tab_id ON public.group_tab_price_groups(group_tab_id);

-- =============================================================================
-- GROUP TAB EXPENSES TABLE
-- =============================================================================
-- Expenses in multi-bill tabs

CREATE TABLE IF NOT EXISTS public.group_tab_expenses (
  id BIGSERIAL PRIMARY KEY,
  group_tab_id BIGINT NOT NULL REFERENCES public.group_tabs(id) ON DELETE CASCADE,
  payer_participant_id BIGINT NOT NULL REFERENCES public.group_tab_participants(id) ON DELETE CASCADE,
  
  -- Expense details
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  category TEXT,
  expense_date TEXT NOT NULL,
  receipt_file_path TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_tab_expenses_group_tab_id ON public.group_tab_expenses(group_tab_id);
CREATE INDEX IF NOT EXISTS idx_group_tab_expenses_payer_participant_id ON public.group_tab_expenses(payer_participant_id);

-- =============================================================================
-- GROUP TAB PAYMENTS TABLE
-- =============================================================================
-- Payments between participants within a group tab

CREATE TABLE IF NOT EXISTS public.group_tab_payments (
  id BIGSERIAL PRIMARY KEY,
  group_tab_id BIGINT NOT NULL REFERENCES public.group_tabs(id) ON DELETE CASCADE,
  from_participant_id BIGINT NOT NULL REFERENCES public.group_tab_participants(id) ON DELETE CASCADE,
  to_participant_id BIGINT REFERENCES public.group_tab_participants(id) ON DELETE SET NULL,
  
  -- Amount
  amount_cents INTEGER NOT NULL,
  applied_cents INTEGER,
  overpay_cents INTEGER DEFAULT 0,
  
  -- Details
  method TEXT,
  note TEXT,
  proof_file_path TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  payment_type TEXT DEFAULT 'normal', -- 'normal', 'overpay', etc.
  
  -- Beneficiaries (JSON array of participant IDs)
  beneficiary_ids TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_tab_payments_group_tab_id ON public.group_tab_payments(group_tab_id);
CREATE INDEX IF NOT EXISTS idx_group_tab_payments_from_participant_id ON public.group_tab_payments(from_participant_id);
CREATE INDEX IF NOT EXISTS idx_group_tab_payments_to_participant_id ON public.group_tab_payments(to_participant_id);
CREATE INDEX IF NOT EXISTS idx_group_tab_payments_status ON public.group_tab_payments(status);

-- =============================================================================
-- GROUP TAB PAYMENT REPORTS TABLE
-- =============================================================================
-- Reported payments that need review

CREATE TABLE IF NOT EXISTS public.group_tab_payment_reports (
  id BIGSERIAL PRIMARY KEY,
  group_tab_id BIGINT NOT NULL REFERENCES public.group_tabs(id) ON DELETE CASCADE,
  participant_id BIGINT REFERENCES public.group_tab_participants(id) ON DELETE SET NULL,
  
  -- Reporter info
  reporter_name TEXT NOT NULL,
  additional_names TEXT, -- JSON array of additional payer names
  
  -- Payment details
  amount_cents INTEGER NOT NULL,
  method TEXT NOT NULL,
  paid_at TEXT NOT NULL,
  proof_file_path TEXT,
  note TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  
  -- Review info
  reviewed_at TIMESTAMPTZ,
  reviewed_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_tab_payment_reports_group_tab_id ON public.group_tab_payment_reports(group_tab_id);
CREATE INDEX IF NOT EXISTS idx_group_tab_payment_reports_participant_id ON public.group_tab_payment_reports(participant_id);
CREATE INDEX IF NOT EXISTS idx_group_tab_payment_reports_status ON public.group_tab_payment_reports(status);
CREATE INDEX IF NOT EXISTS idx_group_tab_payment_reports_created_at ON public.group_tab_payment_reports(created_at DESC);

-- =============================================================================
-- ADD FOREIGN KEY FOR MESSAGES
-- =============================================================================
-- Now that group_tabs exists, add the FK constraint to messages
ALTER TABLE public.messages 
  ADD CONSTRAINT fk_messages_tab_id 
  FOREIGN KEY (tab_id) REFERENCES public.group_tabs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_messages_tab_id ON public.messages(tab_id);

-- =============================================================================
-- ADD FOREIGN KEYS FOR PARTICIPANTS
-- =============================================================================
-- Add FK constraints for tier_id and price_group_id
ALTER TABLE public.group_tab_participants
  ADD CONSTRAINT fk_participants_tier_id
  FOREIGN KEY (tier_id) REFERENCES public.group_tab_tiers(id) ON DELETE SET NULL;

ALTER TABLE public.group_tab_participants
  ADD CONSTRAINT fk_participants_price_group_id
  FOREIGN KEY (price_group_id) REFERENCES public.group_tab_price_groups(id) ON DELETE SET NULL;

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE public.group_tabs IS 'Group expense tabs for bill splitting and collecting money';
COMMENT ON TABLE public.group_tab_participants IS 'Participants in a group tab';
COMMENT ON TABLE public.group_tab_tiers IS 'Tiered pricing options for tabs';
COMMENT ON TABLE public.group_tab_price_groups IS 'Fixed price groups for tabs';
COMMENT ON TABLE public.group_tab_expenses IS 'Expenses in multi-bill tabs';
COMMENT ON TABLE public.group_tab_payments IS 'Payments within a group tab';
COMMENT ON TABLE public.group_tab_payment_reports IS 'Reported payments pending review';

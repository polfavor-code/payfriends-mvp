-- Seed Data for Local Development
-- This file is run after migrations when using `supabase db reset`

-- =============================================================================
-- SAMPLE USERS
-- =============================================================================

INSERT INTO public.users (email, full_name, phone_number, public_id, is_admin, created_at, updated_at) VALUES
  ('admin@payfriends.test', 'Admin User', '+31612345678', 'admin-001', true, NOW(), NOW()),
  ('alice@example.test', 'Alice Johnson', '+31687654321', 'alice-001', false, NOW(), NOW()),
  ('bob@example.test', 'Bob Smith', '+31623456789', 'bob-001', false, NOW(), NOW()),
  ('charlie@example.test', 'Charlie Brown', NULL, 'charlie-001', false, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- =============================================================================
-- SAMPLE AGREEMENTS (LOANS)
-- =============================================================================

INSERT INTO public.agreements (
  lender_user_id, lender_name, borrower_user_id, borrower_email, friend_first_name,
  direction, amount_cents, description, repayment_type, due_date, status, created_at, updated_at
) VALUES
  -- Alice lends to Bob
  (
    (SELECT id FROM public.users WHERE email = 'alice@example.test'),
    'Alice Johnson',
    (SELECT id FROM public.users WHERE email = 'bob@example.test'),
    'bob@example.test',
    'Bob',
    'lend',
    50000, -- 500.00
    'Loan for car repair',
    'installments',
    '2025-06-15',
    'active',
    NOW() - INTERVAL '30 days',
    NOW()
  ),
  -- Bob lends to Charlie (pending)
  (
    (SELECT id FROM public.users WHERE email = 'bob@example.test'),
    'Bob Smith',
    (SELECT id FROM public.users WHERE email = 'charlie@example.test'),
    'charlie@example.test',
    'Charlie',
    'lend',
    10000, -- 100.00
    'Quick cash loan',
    'one_time',
    '2025-03-01',
    'pending',
    NOW() - INTERVAL '5 days',
    NOW()
  )
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SAMPLE GROUP TABS
-- =============================================================================

INSERT INTO public.group_tabs (
  creator_user_id, name, description, tab_type, total_amount_cents, split_mode,
  status, magic_token, owner_token, created_at, updated_at
) VALUES
  -- Alice creates a dinner tab
  (
    (SELECT id FROM public.users WHERE email = 'alice@example.test'),
    'Team Dinner',
    'Friday night team dinner',
    'one_bill',
    12500, -- 125.00
    'equal',
    'open',
    'magic-dinner-001',
    'owner-dinner-001',
    NOW() - INTERVAL '2 days',
    NOW()
  ),
  -- Bob creates a gift collection
  (
    (SELECT id FROM public.users WHERE email = 'bob@example.test'),
    'Birthday Gift for Sarah',
    'Collecting for Sarahs birthday present',
    'gift',
    NULL,
    'custom',
    'open',
    'magic-gift-001',
    'owner-gift-001',
    NOW() - INTERVAL '1 day',
    NOW()
  )
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SAMPLE PARTICIPANTS
-- =============================================================================

-- Add participants to Team Dinner
INSERT INTO public.group_tab_participants (
  group_tab_id, user_id, role, is_member, fair_share_cents, remaining_cents, joined_at
)
SELECT 
  gt.id,
  u.id,
  CASE WHEN u.email = 'alice@example.test' THEN 'host' ELSE 'participant' END,
  true,
  3125, -- 31.25 (125/4)
  CASE WHEN u.email = 'alice@example.test' THEN 0 ELSE 3125 END,
  NOW()
FROM public.group_tabs gt
CROSS JOIN public.users u
WHERE gt.name = 'Team Dinner'
AND u.email IN ('alice@example.test', 'bob@example.test', 'charlie@example.test')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SAMPLE REMOTE CONFIG
-- =============================================================================

INSERT INTO public.remote_config (key, value, type, description, updated_at) VALUES
  ('feature.magic_link_login', 'true', 'boolean', 'Enable magic link login', NOW()),
  ('feature.password_login', 'true', 'boolean', 'Enable password login', NOW()),
  ('app.maintenance_mode', 'false', 'boolean', 'Enable maintenance mode', NOW())
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- =============================================================================
-- LOG SEED COMPLETION
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Seed data loaded successfully';
  RAISE NOTICE 'Users created: %', (SELECT COUNT(*) FROM public.users);
  RAISE NOTICE 'Agreements created: %', (SELECT COUNT(*) FROM public.agreements);
  RAISE NOTICE 'Group tabs created: %', (SELECT COUNT(*) FROM public.group_tabs);
END $$;

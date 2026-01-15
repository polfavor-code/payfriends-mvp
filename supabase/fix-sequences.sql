-- Fix sequences after data migration
-- Run this in the Supabase Dashboard SQL Editor

-- Reset group_tabs sequence
SELECT setval('group_tabs_id_seq', COALESCE((SELECT MAX(id) FROM group_tabs), 0) + 1, false);

-- Reset group_tab_participants sequence
SELECT setval('group_tab_participants_id_seq', COALESCE((SELECT MAX(id) FROM group_tab_participants), 0) + 1, false);

-- Reset group_tab_payments sequence  
SELECT setval('group_tab_payments_id_seq', COALESCE((SELECT MAX(id) FROM group_tab_payments), 0) + 1, false);

-- Reset group_tab_tiers sequence
SELECT setval('group_tab_tiers_id_seq', COALESCE((SELECT MAX(id) FROM group_tab_tiers), 0) + 1, false);

-- Reset group_tab_price_groups sequence
SELECT setval('group_tab_price_groups_id_seq', COALESCE((SELECT MAX(id) FROM group_tab_price_groups), 0) + 1, false);

-- Reset group_tab_expenses sequence
SELECT setval('group_tab_expenses_id_seq', COALESCE((SELECT MAX(id) FROM group_tab_expenses), 0) + 1, false);

-- Reset group_tab_payment_reports sequence
SELECT setval('group_tab_payment_reports_id_seq', COALESCE((SELECT MAX(id) FROM group_tab_payment_reports), 0) + 1, false);

-- Reset users sequence
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 0) + 1, false);

-- Reset agreements sequence
SELECT setval('agreements_id_seq', COALESCE((SELECT MAX(id) FROM agreements), 0) + 1, false);

-- Reset payments sequence
SELECT setval('payments_id_seq', COALESCE((SELECT MAX(id) FROM payments), 0) + 1, false);

-- Reset messages sequence
SELECT setval('messages_id_seq', COALESCE((SELECT MAX(id) FROM messages), 0) + 1, false);

-- Reset agreement_invites sequence
SELECT setval('agreement_invites_id_seq', COALESCE((SELECT MAX(id) FROM agreement_invites), 0) + 1, false);

-- Reset hardship_requests sequence
SELECT setval('hardship_requests_id_seq', COALESCE((SELECT MAX(id) FROM hardship_requests), 0) + 1, false);

-- Reset renegotiation_requests sequence
SELECT setval('renegotiation_requests_id_seq', COALESCE((SELECT MAX(id) FROM renegotiation_requests), 0) + 1, false);

-- Reset initial_payment_reports sequence
SELECT setval('initial_payment_reports_id_seq', COALESCE((SELECT MAX(id) FROM initial_payment_reports), 0) + 1, false);

-- Reset admin_notes sequence
SELECT setval('admin_notes_id_seq', COALESCE((SELECT MAX(id) FROM admin_notes), 0) + 1, false);

-- Reset admin_audit_log sequence
SELECT setval('admin_audit_log_id_seq', COALESCE((SELECT MAX(id) FROM admin_audit_log), 0) + 1, false);

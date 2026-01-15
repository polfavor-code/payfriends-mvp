-- Migration: Create admin tables
-- PayFriends SQLite to Supabase migration

-- =============================================================================
-- ADMIN NOTES TABLE
-- =============================================================================
-- Internal admin notes attached to any entity (append-only)

CREATE TABLE IF NOT EXISTS public.admin_notes (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL, -- 'user', 'agreement', 'group_tab', 'payment', etc.
  entity_id TEXT NOT NULL, -- ID of the referenced entity
  note TEXT NOT NULL,
  admin_id TEXT NOT NULL, -- Admin user identifier
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_notes_entity ON public.admin_notes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_notes_admin_id ON public.admin_notes(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_notes_created_at ON public.admin_notes(created_at DESC);

-- =============================================================================
-- ADMIN AUDIT LOG TABLE
-- =============================================================================
-- Complete audit trail of all admin actions (immutable)

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  admin_id TEXT NOT NULL, -- Admin user identifier
  action TEXT NOT NULL, -- Action type (e.g., 'delete_user', 'update_config')
  target_type TEXT NOT NULL, -- Entity type affected
  target_id TEXT NOT NULL, -- ID of the affected entity
  metadata JSONB DEFAULT '{}', -- Additional action data
  ip_address INET, -- IP address of the admin
  user_agent TEXT, -- Browser/client info
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON public.admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON public.admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON public.admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);

-- =============================================================================
-- REMOTE CONFIG TABLE
-- =============================================================================
-- Feature flags and configuration values

CREATE TABLE IF NOT EXISTS public.remote_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'string', -- 'boolean', 'string', 'json', 'number'
  description TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT -- Admin who last updated this config
);

-- Default config values
INSERT INTO public.remote_config (key, value, type, description) VALUES
  ('feature.magic_link_login', 'true', 'boolean', 'Enable magic link (passwordless) login'),
  ('feature.password_login', 'true', 'boolean', 'Enable password-based login'),
  ('feature.group_tabs', 'true', 'boolean', 'Enable group tabs feature'),
  ('feature.loans', 'true', 'boolean', 'Enable loans feature'),
  ('maintenance_mode', 'false', 'boolean', 'Put app in maintenance mode'),
  ('app.name', 'PayFriends', 'string', 'Application name'),
  ('app.support_email', 'support@payfriends.app', 'string', 'Support email address')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE public.admin_notes IS 'Internal admin notes on entities (append-only)';
COMMENT ON TABLE public.admin_audit_log IS 'Audit trail of all admin actions (immutable)';
COMMENT ON TABLE public.remote_config IS 'Feature flags and configuration values';

COMMENT ON COLUMN public.admin_audit_log.metadata IS 'JSON object with additional action context';
COMMENT ON COLUMN public.remote_config.type IS 'Data type: boolean, string, json, or number';

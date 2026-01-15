-- Migration: Create users and sessions tables
-- PayFriends SQLite to Supabase migration

-- =============================================================================
-- USERS TABLE
-- =============================================================================
-- Core user accounts with profile information
-- Note: This table is separate from auth.users - they are linked by id

CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  
  -- Auth link (will be set when user signs up via Supabase Auth)
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Core fields
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT, -- Legacy: will be removed after full auth migration
  
  -- Profile
  full_name TEXT,
  phone_number TEXT,
  timezone TEXT DEFAULT 'UTC',
  profile_picture TEXT,
  public_id TEXT UNIQUE, -- Public-facing user ID (e.g., for profile URLs)
  
  -- Admin flag
  is_admin BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_public_id ON public.users(public_id);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at DESC);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SESSIONS TABLE (Legacy - will be deprecated)
-- =============================================================================
-- Custom session management - will be replaced by Supabase Auth sessions

CREATE TABLE IF NOT EXISTS public.sessions (
  id TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions(expires_at);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to get current user's ID from auth context
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS BIGINT AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.users WHERE auth_id = auth.uid()),
    FALSE
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE public.users IS 'User accounts and profiles';
COMMENT ON COLUMN public.users.auth_id IS 'Links to Supabase auth.users table';
COMMENT ON COLUMN public.users.password_hash IS 'Legacy password hash - will be removed after auth migration';
COMMENT ON COLUMN public.users.public_id IS 'Public-facing user identifier for URLs';
COMMENT ON COLUMN public.users.is_admin IS 'Admin flag for CMS access';

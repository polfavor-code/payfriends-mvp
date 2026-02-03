-- Migration: Add is_disabled column to users table
-- Allows admins to disable user accounts

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for querying disabled users
CREATE INDEX IF NOT EXISTS idx_users_is_disabled ON public.users(is_disabled);

-- Comment
COMMENT ON COLUMN public.users.is_disabled IS 'Flag to soft-disable user accounts';

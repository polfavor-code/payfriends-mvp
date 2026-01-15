# Supabase Setup Guide

This guide covers setting up Supabase for PayFriends development and production.

## Prerequisites

- Node.js 18+
- Docker (for local Supabase)
- Supabase CLI (`npm install -g supabase`)

## 1. Create Supabase Project (Production)

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Fill in:
   - Project name: `payfriends` (or your preferred name)
   - Database password: Generate a strong password and save it
   - Region: Choose closest to your users
4. Wait for project to provision (2-3 minutes)

## 2. Get API Keys

From your project dashboard, go to **Project Settings > API**:

- **Project URL**: `https://[project-id].supabase.co`
- **anon public**: Safe to use in browser (protected by RLS)
- **service_role**: Server-side only, bypasses RLS

## 3. Local Development Setup

### Initialize Supabase

```bash
# From project root
supabase init
```

### Start Local Supabase

```bash
supabase start
```

This starts:
- PostgreSQL on port 54322
- Supabase Studio on http://localhost:54323
- API on http://localhost:54321

### Apply Migrations

```bash
supabase db reset
```

### Stop Supabase

```bash
supabase stop
```

## 4. Environment Configuration

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

### Local Development Values

For local development, use these values from `supabase start` output:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon key from supabase start]
SUPABASE_SERVICE_ROLE_KEY=[service_role key from supabase start]
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

### Production Values

For production, use the values from your Supabase dashboard.

## 5. Database Migrations

Migrations are stored in `supabase/migrations/`.

### Create a New Migration

```bash
supabase migration new my_migration_name
```

### Apply Migrations to Production

```bash
supabase db push
```

### Generate TypeScript Types

```bash
supabase gen types typescript --local > lib/supabase/types.ts
```

## 6. Auth Configuration

PayFriends uses Supabase Auth with:
- Email/Password authentication
- Magic link (passwordless) login

### Configure Auth Providers

In Supabase Dashboard > Authentication > Providers:

1. **Email**: Enable, configure:
   - Enable email confirmations (recommended for production)
   - Minimum password length: 8
   
2. **Magic Link**: Already enabled with Email provider

### Auth Settings

In Supabase Dashboard > Authentication > Settings:

- Site URL: `http://localhost:3000` (dev) or your production URL
- Redirect URLs: Add all valid callback URLs

## 7. Row Level Security (RLS)

All tables have RLS enabled. Key policies:

- Users can only see/edit their own data
- Loan parties (lender/borrower) can see their agreements
- Group tab participants can see their tabs
- Admins can see everything

### Testing RLS

Use Supabase Studio (http://localhost:54323) to:
1. Log in as different users
2. Verify data visibility
3. Test policy enforcement

## 8. Admin Access

Admins are identified by:
1. `is_admin` flag in `users` table
2. Email in `PAYFRIENDS_ADMIN_EMAILS` env var

To make a user admin:

```sql
UPDATE users SET is_admin = true WHERE email = 'admin@example.com';
```

## 9. Troubleshooting

### Connection Issues

```bash
# Check Supabase status
supabase status

# View logs
supabase logs
```

### Migration Errors

```bash
# Reset and reapply all migrations
supabase db reset

# Check migration status
supabase migration list
```

### Auth Issues

- Check redirect URLs in dashboard
- Verify Site URL setting
- Check browser console for errors

## 10. Production Checklist

Before going live:

- [ ] Enable email confirmations
- [ ] Set strong database password
- [ ] Configure custom SMTP (optional but recommended)
- [ ] Set up monitoring/alerting in Supabase dashboard
- [ ] Enable Point-in-Time Recovery (PITR) for database
- [ ] Review and test all RLS policies
- [ ] Set up database backups

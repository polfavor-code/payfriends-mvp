# PayFriends Deployment Guide

This guide covers deploying PayFriends with Supabase to production.

## Architecture Overview

```
Production Setup:
- Main App (Express.js) -> Railway / Render / Fly.io
- Admin CMS (Next.js)   -> Vercel
- Database             -> Supabase Postgres
- Auth                 -> Supabase Auth
- File Storage         -> Supabase Storage (optional)
```

## Prerequisites

1. Supabase project created (see `docs/supabase-setup.md`)
2. All migrations applied to production database
3. Data migrated from SQLite (if applicable)
4. Environment variables ready

## 1. Supabase Production Setup

### Apply Migrations

```bash
# Link to your production project
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations to production
supabase db push
```

### Configure Auth

In Supabase Dashboard > Authentication > URL Configuration:

1. **Site URL**: Set to your production URL (e.g., `https://app.payfriends.com`)
2. **Redirect URLs**: Add all valid OAuth/magic link callback URLs:
   - `https://app.payfriends.com/auth/callback`
   - `https://admin.payfriends.com/auth/callback`

### Configure Email Templates

In Supabase Dashboard > Authentication > Email Templates:
- Customize templates for your brand
- Ensure "From" email is configured (requires custom SMTP for production)

### Set Up Custom SMTP (Recommended)

In Supabase Dashboard > Project Settings > Auth:
- Enable custom SMTP
- Configure with your email provider (SendGrid, Postmark, etc.)

## 2. Deploy Main App (Express.js)

### Option A: Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

Set environment variables in Railway dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYFRIENDS_ADMIN_EMAILS`
- `NODE_ENV=production`
- `PORT=3000`

### Option B: Render

1. Create new Web Service in Render dashboard
2. Connect your GitHub repo
3. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add environment variables

### Option C: Fly.io

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch (creates fly.toml)
fly launch

# Deploy
fly deploy
```

Create `fly.toml`:
```toml
app = "payfriends"
primary_region = "ams"

[build]
  builder = "heroku/buildpacks:20"

[env]
  PORT = "8080"
  NODE_ENV = "production"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
```

Set secrets:
```bash
fly secrets set NEXT_PUBLIC_SUPABASE_URL=xxx
fly secrets set NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
fly secrets set SUPABASE_SERVICE_ROLE_KEY=xxx
fly secrets set PAYFRIENDS_ADMIN_EMAILS=xxx
```

## 3. Deploy Admin CMS (Vercel)

### Via Vercel Dashboard

1. Import project from GitHub
2. Set root directory to `admin`
3. Configure:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

### Via Vercel CLI

```bash
cd admin
npx vercel
```

### Environment Variables

Add in Vercel dashboard or via CLI:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add PAYFRIENDS_ADMIN_EMAILS
```

## 4. Environment Variables Reference

### Required for All Deployments

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key | `eyJhbGci...` |
| `PAYFRIENDS_ADMIN_EMAILS` | Admin email allowlist | `admin@example.com` |

### Main App Specific

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `production` |

## 5. Post-Deployment Verification

### Checklist

- [ ] Health check endpoint returns 200
- [ ] User can sign up
- [ ] User can log in (password)
- [ ] User can log in (magic link)
- [ ] User can create a loan
- [ ] User can view their loans
- [ ] User can create a group tab
- [ ] Group tab magic link works
- [ ] Payments can be recorded
- [ ] Admin CMS loads
- [ ] Admin can view all data
- [ ] Admin can add notes
- [ ] Audit log records actions

### Verification Commands

```bash
# Health check
curl https://app.payfriends.com/health

# Test signup (if API endpoint exists)
curl -X POST https://app.payfriends.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "testpassword"}'

# Test login
curl -X POST https://app.payfriends.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "testpassword"}'
```

## 6. Monitoring and Alerts

### Supabase Dashboard

- Monitor database usage
- Check API request counts
- Review auth logs
- Set up alerts for errors

### Application Monitoring

Recommended tools:
- **Error tracking**: Sentry
- **Uptime monitoring**: UptimeRobot, Better Uptime
- **APM**: New Relic, Datadog (optional)

### Setting Up Sentry

```bash
npm install @sentry/node
```

Add to `server.js`:
```javascript
const Sentry = require("@sentry/node");
Sentry.init({ dsn: process.env.SENTRY_DSN });
```

## 7. Database Backups

### Supabase Automatic Backups

- Free tier: Daily backups, 7-day retention
- Pro tier: Daily backups, 30-day retention + PITR

### Manual Backup

```bash
# Using Supabase CLI
supabase db dump -f backup.sql

# Using pg_dump directly
pg_dump $DATABASE_URL > backup.sql
```

## 8. Scaling Considerations

### Database

- Monitor connection pool usage
- Consider connection pooling (PgBouncer)
- Add read replicas for heavy read workloads

### Application

- Enable horizontal scaling on your platform
- Use Redis for session storage (if needed)
- Implement caching for frequently accessed data

## 9. Rollback Procedures

### Database Rollback

```bash
# Restore from Supabase backup (via dashboard)
# Or apply reverse migration
supabase migration repair --status reverted MIGRATION_ID
```

### Application Rollback

```bash
# Railway
railway rollback

# Render
# Use dashboard to deploy previous version

# Fly.io
fly releases
fly deploy --image registry.fly.io/payfriends:v123
```

## 10. Troubleshooting

### Common Issues

**Auth not working**
- Check Site URL in Supabase Auth settings
- Verify redirect URLs are correct
- Check browser console for CORS errors

**Database connection errors**
- Verify DATABASE_URL is correct
- Check if IP allowlist is configured
- Monitor connection pool usage

**RLS blocking queries**
- Check if service role key is being used for admin operations
- Verify RLS policies are correct
- Test policies in Supabase SQL editor

### Getting Help

- Supabase Discord: https://discord.supabase.com
- Supabase Docs: https://supabase.com/docs
- GitHub Issues: [Your repo issues URL]

# Server.js Migration Guide

This guide explains how to migrate the Express server from SQLite to Supabase.

## Overview

The migration is done in phases to minimize risk:

1. **Phase 1**: Add Supabase client alongside SQLite (current)
2. **Phase 2**: Migrate read operations to Supabase
3. **Phase 3**: Migrate write operations to Supabase
4. **Phase 4**: Remove SQLite dependency

## Quick Start

### 1. Install Dependencies

```bash
npm install @supabase/supabase-js dotenv
```

### 2. Configure Environment

Copy `.env.example` to `.env.local` and fill in your Supabase credentials.

### 3. Update server.js

Add at the top of `server.js`:

```javascript
// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Supabase client
const { supabaseAdmin, isSupabaseConfigured } = require('./lib/supabase/client');
const db = require('./lib/supabase/db');

// Check if Supabase is configured
const USE_SUPABASE = isSupabaseConfigured();
if (USE_SUPABASE) {
  console.log('[Server] Supabase configured - using Postgres');
} else {
  console.log('[Server] Supabase not configured - using SQLite fallback');
}
```

## Migration Patterns

### Pattern 1: Dual-Write (Safe Migration)

Write to both databases during transition:

```javascript
// Before (SQLite only)
const stmt = sqlite.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
const result = stmt.run(email, passwordHash);

// After (Dual-write)
const stmt = sqlite.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
const result = stmt.run(email, passwordHash);

if (USE_SUPABASE) {
  await db.createUser({ email, passwordHash });
}
```

### Pattern 2: Read from Supabase, Fallback to SQLite

```javascript
// Before
const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(userId);

// After
let user;
if (USE_SUPABASE) {
  user = await db.getUserById(userId);
}
if (!user) {
  user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}
```

### Pattern 3: Full Supabase (After Validation)

```javascript
// After migration is validated
const user = await db.getUserById(userId);
if (!user) {
  return res.status(404).json({ error: 'User not found' });
}
```

## Key Code Changes

### Authentication Middleware

```javascript
// Before
app.use(async (req, res, next) => {
  const sessionId = req.cookies.session;
  if (sessionId) {
    const session = sqlite.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    if (session && new Date(session.expires_at) > new Date()) {
      req.user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
    }
  }
  next();
});

// After
app.use(async (req, res, next) => {
  const sessionId = req.cookies.session;
  if (sessionId) {
    let session = USE_SUPABASE ? await db.getSessionById(sessionId) : null;
    if (!session) {
      session = sqlite.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    }
    
    if (session && new Date(session.expires_at) > new Date()) {
      let user = USE_SUPABASE ? await db.getUserById(session.user_id) : null;
      if (!user) {
        user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
      }
      req.user = user;
    }
  }
  next();
});
```

### API Route Example

```javascript
// Before
app.get('/api/agreements', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const agreements = sqlite.prepare(`
    SELECT * FROM agreements 
    WHERE lender_user_id = ? OR borrower_user_id = ?
  `).all(req.user.id, req.user.id);
  
  res.json(agreements);
});

// After
app.get('/api/agreements', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  let agreements;
  if (USE_SUPABASE) {
    agreements = await db.getAgreementsByUserId(req.user.id);
  } else {
    agreements = sqlite.prepare(`
      SELECT * FROM agreements 
      WHERE lender_user_id = ? OR borrower_user_id = ?
    `).all(req.user.id, req.user.id);
  }
  
  res.json(agreements);
});
```

## Testing the Migration

### 1. Run Data Migration

```bash
# Dry run first
npm run db:migrate:dry

# If looks good, run actual migration
npm run db:migrate
```

### 2. Verify Data

Use Supabase Studio (http://localhost:54323) to verify data was migrated correctly.

### 3. Test API Endpoints

```bash
# Test user endpoints
curl http://localhost:3000/api/user/profile

# Test agreement endpoints
curl http://localhost:3000/api/agreements

# Test group tab endpoints
curl http://localhost:3000/api/tabs
```

## Rollback Plan

If issues are found:

1. Set `USE_SUPABASE = false` in server.js
2. Restart server - falls back to SQLite
3. Fix issues
4. Re-enable Supabase

## Async Considerations

SQLite operations in the current code are synchronous. Supabase operations are async.

### Converting Sync to Async

```javascript
// Before (sync)
app.get('/api/user', (req, res) => {
  const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// After (async)
app.get('/api/user', async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Error Handling

Always wrap Supabase calls in try-catch:

```javascript
try {
  const result = await db.createAgreement(agreementData);
  res.json(result);
} catch (error) {
  console.error('Database error:', error);
  res.status(500).json({ error: 'Failed to create agreement' });
}
```

## Performance Considerations

- Supabase queries go over the network (vs local SQLite)
- Use connection pooling (built into Supabase)
- Batch operations when possible
- Consider caching for frequently accessed data

## Next Steps

1. Complete the migration for all endpoints
2. Test thoroughly in staging
3. Remove SQLite fallback code
4. Remove `better-sqlite3` dependency
5. Delete SQLite database file (keep backup!)

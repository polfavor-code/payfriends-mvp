# CLAUDE.md - AI Assistant Guide for PayFriends MVP

This document provides comprehensive guidance for AI assistants (like Claude) working on the PayFriends codebase. Last updated: 2025-11-25.

## Table of Contents
- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Directory Structure](#directory-structure)
- [Database Schema](#database-schema)
- [API Architecture](#api-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Code Conventions](#code-conventions)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Common Patterns](#common-patterns)
- [Important Rules](#important-rules)

## Project Overview

PayFriends is a peer-to-peer lending platform for friends and family. It enables users to create, manage, and track loan agreements with flexible repayment schedules, interest calculations, and payment tracking.

**Key Features:**
- User authentication with email/password (bcrypt hashing)
- Loan agreement creation and management
- Flexible repayment schedules (one-time or installments)
- Multiple payment frequencies (weekly, biweekly, monthly, quarterly, yearly, custom)
- Interest calculation with compound and simple interest support
- Loan invitation system for borrowers
- Payment method management
- Hardship requests and renegotiation
- Profile management with image uploads

## Tech Stack

**Backend:**
- **Runtime:** Node.js (CommonJS modules)
- **Framework:** Express.js 5.x
- **Database:** SQLite3 with better-sqlite3 driver (WAL mode)
- **Authentication:** Cookie-based sessions with bcrypt password hashing
- **File Uploads:** Multer for profile pictures and payment receipts

**Frontend:**
- **Vanilla JavaScript** (ES6+, no framework)
- **Web Components** for reusable UI elements
- **Client-side routing** with custom router implementations
- **HTML templates** with server-side rendering

**Development:**
- No build step (pure ES6 modules on frontend)
- No TypeScript or transpilation
- Simple `npm start` to run development server

## Directory Structure

```
payfriends-mvp/
├── server.js                 # Main Express server (all backend logic)
├── package.json              # Dependencies and scripts
├── .gitignore               # Git ignore rules (excludes node_modules, data/*.db)
│
├── data/                    # SQLite database files (gitignored)
│   └── payfriends.db        # Main database
│
├── uploads/                 # User-uploaded files (gitignored)
│   ├── profiles/           # Profile pictures
│   └── payments/           # Payment receipt images
│
├── lib/                     # Shared business logic (Node.js modules)
│   ├── formatters.js       # Currency formatting utilities
│   └── repayments/         # Repayment calculation logic
│       ├── repaymentSchedule.js    # Schedule generation (SSoT)
│       └── loanStartLabels.js      # Loan start date label logic
│
├── public/                  # Static files served by Express
│   ├── index.html          # Landing page
│   ├── login.html          # Login/signup page
│   ├── app.html            # Main app (dashboard)
│   ├── friends.html        # Friends list
│   ├── friend-profile.html # Individual friend profile
│   ├── calculate.html      # New loan wizard (Step 1-5)
│   ├── calculator.html     # Standalone calculator
│   ├── review.html         # Loan review page (borrower side)
│   ├── review-details.html # Detailed review page
│   ├── review-invalid.html # Invalid invite page
│   │
│   ├── components/         # Web Components and reusable UI
│   │   ├── header.html                           # App header (included via fetch)
│   │   ├── page-topbar.js                        # Top bar web component
│   │   ├── summary-block.js                      # Loan summary display
│   │   ├── agreements-table.js                   # Agreements list table
│   │   ├── fairness-icon.js                      # Fairness indicator
│   │   ├── payment-methods-display.js            # Payment methods component
│   │   ├── payfriends-*.js                       # Animated background components
│   │   └── PayFriends*.js                        # More background components
│   │
│   ├── partials/           # HTML fragments for inclusion
│   │   └── loan-calculator-form.html  # Calculator form (Step 2)
│   │
│   ├── js/                 # Frontend JavaScript modules
│   │   ├── header.js                    # Header logic and navigation
│   │   ├── loanCalculatorEngine.js      # Loan calculation engine
│   │   ├── schedule.js                  # Payment schedule generation
│   │   ├── derived-fields.js            # Derived field calculations
│   │   ├── formatters.js                # Frontend currency formatting
│   │   ├── status-labels.js             # Status label utilities
│   │   ├── phone-input.js               # Phone number input handling
│   │   ├── profile-router.js            # Profile page routing
│   │   ├── profile-pages.js             # Profile page logic
│   │   ├── legal-router.js              # Legal pages routing
│   │   ├── legal-pages.js               # Legal page templates
│   │   └── renegotiation.js             # Renegotiation flow logic
│   │
│   ├── css/                # Stylesheets
│   │   ├── app.css                     # Main application styles
│   │   ├── shared-controls.css         # Shared form controls
│   │   └── renegotiation.css           # Renegotiation styles
│   │
│   └── images/             # Static images and assets
│       ├── background/    # Background images
│       └── planes/        # Paper plane animation assets
│
├── test/                   # Unit tests (Node.js assert-based)
│   ├── repaymentSchedule.test.js      # Schedule generation tests
│   ├── schedule.test.js               # Payment schedule tests
│   ├── next-payment-info.test.js      # Next payment calculation tests
│   └── worst-case-threshold.test.js   # Worst-case analysis tests
│
├── scripts/                # Utility scripts
│   └── setup-branch-protection.sh     # GitHub branch protection setup
│
└── docs/                   # Documentation
    └── contributing.md     # Contribution guidelines
```

## Database Schema

The database uses SQLite3 with WAL (Write-Ahead Logging) mode for better concurrency. Schema is defined in `server.js` (lines 40-300).

### Key Tables

**users**
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `email` (TEXT UNIQUE NOT NULL)
- `password_hash` (TEXT NOT NULL) - bcrypt hashed
- `full_name` (TEXT)
- `public_id` (TEXT UNIQUE) - for public-facing URLs
- `created_at` (TEXT NOT NULL) - ISO timestamp

**sessions**
- `id` (TEXT PRIMARY KEY) - crypto random token
- `user_id` (INTEGER FK → users.id)
- `created_at` (TEXT)
- `expires_at` (TEXT) - 30 days from creation

**agreements**
- `id` (INTEGER PRIMARY KEY)
- `lender_user_id` (INTEGER FK → users.id)
- `lender_name` (TEXT NOT NULL)
- `borrower_email` (TEXT NOT NULL)
- `borrower_user_id` (INTEGER FK → users.id)
- `friend_first_name` (TEXT)
- `direction` (TEXT DEFAULT 'lend') - 'lend' or 'borrow'
- `repayment_type` (TEXT DEFAULT 'one_time') - 'one_time' or 'installments'
- `amount_cents` (INTEGER NOT NULL) - principal in cents
- `due_date` (TEXT NOT NULL)
- `status` (TEXT DEFAULT 'pending') - 'pending', 'active', 'settled', 'cancelled'
- `description` (TEXT)
- `has_repayment_issue` (INTEGER DEFAULT 0) - boolean flag

**agreement_invites**
- `id` (INTEGER PRIMARY KEY)
- `agreement_id` (INTEGER FK → agreements.id)
- `email` (TEXT NOT NULL)
- `token` (TEXT UNIQUE NOT NULL) - invite token
- `created_at` (TEXT)
- `accepted_at` (TEXT)

**messages**
- `id` (INTEGER PRIMARY KEY)
- `user_id` (INTEGER FK → users.id)
- `agreement_id` (INTEGER FK → agreements.id)
- `subject` (TEXT NOT NULL)
- `body` (TEXT NOT NULL)
- `created_at` (TEXT)
- `read_at` (TEXT)
- `event_type` (TEXT) - notification type

**hardship_requests**
- Tracks requests for loan renegotiation
- Links to agreements and users
- Stores proposed new terms

**payment_methods**
- Stores payment methods for agreements
- Types: 'bank_transfer', 'cash', 'paypal', 'venmo', etc.
- Includes approval/decline workflow

**payments**
- Tracks individual payment records
- Links to agreements
- Stores amounts, dates, and proof (image uploads)

### Important Database Patterns

1. **All monetary values stored in cents** (INTEGER) to avoid floating-point errors
2. **All dates stored as ISO 8601 TEXT** (e.g., '2025-01-15')
3. **Foreign keys enforced** but cascade deletes not used
4. **No ORMs** - raw SQL with better-sqlite3 prepared statements

## API Architecture

All API routes defined in `server.js` with Express. Authentication via `requireAuth` middleware.

### Authentication Endpoints

```
POST /auth/signup          - Create new account (email, password)
POST /auth/login           - Login with email/password, sets session cookie
POST /auth/logout          - Clears session
```

### User/Profile Endpoints

```
GET    /api/user                      - Get current user info
PATCH  /api/settings/timezone         - Update timezone
POST   /api/profile                   - Update profile (name, phone, etc.)
POST   /api/profile/picture           - Upload profile picture (multipart)
DELETE /api/profile/picture           - Remove profile picture
GET    /api/profile/picture/:userId   - Get profile picture
```

### Agreement Endpoints

```
GET    /api/agreements                - List all agreements for current user
POST   /api/agreements                - Create new agreement (Step 5 submit)
GET    /api/agreements/:id            - Get single agreement details
PATCH  /api/agreements/:id/status     - Update agreement status
POST   /api/agreements/:id/accept     - Borrower accepts agreement
POST   /api/agreements/:id/decline    - Borrower declines agreement
POST   /api/agreements/:id/cancel     - Lender cancels agreement
POST   /api/agreements/:id/review-later - Mark for later review
GET    /api/agreements/:id/invite     - Get invite details by token
```

### Payment Method Endpoints

```
POST   /api/agreements/:id/payment-methods                    - Add payment method
PATCH  /api/agreements/:id/payment-methods/:method            - Update payment method
DELETE /api/agreements/:id/payment-methods/:method            - Request removal
POST   /api/agreements/:id/payment-methods/:method/approve-removal  - Approve removal
POST   /api/agreements/:id/payment-methods/:method/decline-removal  - Decline removal
```

### Friends Endpoints

```
GET /api/friends               - List all friends (aggregated from agreements)
GET /api/friends/:friendPublicId - Get friend details and agreements
```

### Message/Activity Endpoints

```
GET  /api/messages               - Get all messages/notifications
POST /api/activity/mark-all-read - Mark all messages as read
POST /api/activity/:id/mark-read - Mark single message as read
```

### Hardship/Renegotiation Endpoints

```
POST /api/agreements/:id/hardship-request - Submit hardship request
```

### Request/Response Patterns

- **Success:** `res.json({ success: true, data: {...} })`
- **Error:** `res.status(4xx|5xx).json({ error: 'message' })`
- **Auth Required:** Returns 401 if no valid session
- **Validation:** Returns 400 for bad input with descriptive error message

## Frontend Architecture

### No Build System

The frontend uses **no bundler, no transpilation**. JavaScript files are served as ES6 modules directly to the browser.

### Page Structure

Each HTML page is a complete document with:
1. Standard HTML5 structure
2. Inline `<style>` blocks for page-specific CSS
3. External CSS links for shared styles
4. Inline `<script type="module">` blocks for page logic
5. Web component includes

### Web Components

Components defined as custom elements:
```javascript
class PayFriendsComponent extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `...template...`;
  }
}
customElements.define('payfriends-component', PayFriendsComponent);
```

Key components: `page-topbar`, `summary-block`, `agreements-table`, `fairness-icon`, `payment-methods-display`

### Client-Side Routing

No SPA framework. Simple hash routing or query params:
- `profile-router.js` - Handles profile page navigation
- `legal-router.js` - Handles legal page navigation

### State Management

No global state management. State stored in:
1. **DOM elements** (data attributes, values)
2. **LocalStorage** for persistence
3. **Server API** as source of truth

### Form Handling Pattern

Standard pattern for forms:
```javascript
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(form);
  const response = await fetch('/api/endpoint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(formData))
  });
  const result = await response.json();
  if (result.success) {
    // Handle success
  } else {
    // Show error
  }
});
```

## Code Conventions

### JavaScript Style

1. **No semicolons** at end of statements (ASI relied upon in some files)
2. **camelCase** for variables and functions
3. **PascalCase** for classes and constructors
4. **UPPER_SNAKE_CASE** for constants
5. **2-space indentation** (consistent across files)

### Naming Conventions

- **Files:** kebab-case (e.g., `loan-calculator-engine.js`)
- **Components:** kebab-case with `payfriends-` prefix (e.g., `payfriends-matrix-rain.js`)
- **Database fields:** snake_case (e.g., `user_id`, `created_at`)
- **API responses:** camelCase (e.g., `userId`, `createdAt`)

### Comments and Documentation

**JSDoc for complex functions:**
```javascript
/**
 * Generate repayment schedule
 * @param {RepaymentScheduleConfig} config - Schedule configuration
 * @returns {RepaymentScheduleResult} Generated schedule with rows
 */
function generateRepaymentSchedule(config) { ... }
```

**Inline comments for complex logic:**
```javascript
// Handle "upon acceptance" mode: show relative labels until loan starts
if (config.loanStartMode === 'upon_acceptance' && !config.context.hasRealStartDate) {
  // Use relative date labels
}
```

### Security Practices

1. **XSS Prevention:** Always escape HTML when inserting user content
   ```javascript
   function escapeHTML(str) {
     return String(str)
       .replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       // ...more replacements
   }
   ```

2. **SQL Injection Prevention:** Use prepared statements
   ```javascript
   const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
   const user = stmt.get(userId);
   ```

3. **Password Security:** bcrypt with 10 rounds
   ```javascript
   const hash = await bcrypt.hash(password, SALT_ROUNDS);
   ```

4. **Session Security:** Crypto random tokens, 30-day expiry

### Currency Handling

**CRITICAL:** All monetary values are stored and calculated in **cents** (integers).

```javascript
// CORRECT
const amountCents = 100000;  // €1,000.00

// INCORRECT
const amount = 1000.00;  // Floating point - NO!
```

**Formatting:**
- Backend: `formatCurrency0(cents)`, `formatCurrency2(cents)` from `lib/formatters.js`
- Frontend: `formatCurrency0(cents)`, `formatCurrency2(cents)` from `public/js/formatters.js`
- Default currency: EUR (€)

### Date Handling

**Always use ISO 8601 format:** `YYYY-MM-DD` for dates

```javascript
// Store in DB
const createdAt = new Date().toISOString();  // "2025-11-25T10:30:00.000Z"

// Store just date
const dueDate = "2025-12-31";

// Parse
const date = new Date(dateString);
```

## Development Workflow

### Branch Protection

The `main` branch is protected (see `docs/contributing.md`):
- Pull requests required with 1 approval
- All conversations must be resolved
- Linear history enforced (squash or rebase)
- No direct pushes to main

### Commit Message Format

Use conventional commit prefixes:
- `Add:` for new features
- `Fix:` for bug fixes
- `Update:` for improvements to existing features
- `Refactor:` for code restructuring
- `Docs:` for documentation changes
- `Test:` for test additions/changes

Example: `Fix: calculator validation for edge cases (#123)`

### Development Steps

1. **Create feature branch from main:**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/description
   ```

2. **Make changes and test locally:**
   ```bash
   npm install        # If dependencies changed
   npm start          # Run dev server on port 3000
   node test/*.js     # Run specific tests
   ```

3. **Commit and push:**
   ```bash
   git add .
   git commit -m "Add: feature description"
   git push -u origin feature/description
   ```

4. **Open PR, get review, merge**

### Local Development

```bash
# Install dependencies
npm install

# Start development server (port 3000)
npm start

# Server runs with:
# - Morgan HTTP logging
# - Auto-restart not included (use nodemon if needed)
# - Database auto-created in ./data/
```

## Testing

### Test Framework

**Node.js built-in `assert` module** - no Jest, Mocha, or other framework.

### Running Tests

```bash
# Run individual test file
node test/repaymentSchedule.test.js

# Run all tests (if test runner added)
npm test  # Currently returns "Error: no test specified"
```

### Test Structure

```javascript
const assert = require('assert');
const { functionToTest } = require('../lib/module.js');

console.log('Test 1: Description');
{
  const input = { ... };
  const result = functionToTest(input);

  assert.strictEqual(result.value, expected, 'Should match expected');
  assert.ok(result.valid, 'Should be valid');

  console.log('✓ Test passed');
}
```

### Test Files

- `test/repaymentSchedule.test.js` - Schedule generation edge cases
- `test/schedule.test.js` - Payment date calculations
- `test/next-payment-info.test.js` - Next payment logic
- `test/worst-case-threshold.test.js` - Worst-case analysis

### Testing Approach

- **Unit tests** for business logic in `lib/`
- **Manual testing** for frontend (no browser automation)
- **No CI/CD** currently (status checks placeholder in contributing.md)

## Common Patterns

### 1. Repayment Schedule Generation

**Single Source of Truth:** `lib/repayments/repaymentSchedule.js`

```javascript
const { generateRepaymentSchedule } = require('./lib/repayments/repaymentSchedule.js');

const config = {
  principal: 100000,           // €1,000.00 in cents
  annualInterestRate: 5,       // 5%
  repaymentType: 'installments',
  numInstallments: 12,
  paymentFrequency: 'monthly',
  loanStartMode: 'fixed_date',
  loanStartDate: '2025-01-01',
  firstPaymentOffsetDays: 30,
  context: {
    preview: false,
    agreementStatus: 'active',
    hasRealStartDate: true
  }
};

const schedule = generateRepaymentSchedule(config);
// schedule.rows = [{ index, date, dateLabel, principal, interest, totalPayment, remainingBalance }, ...]
// schedule.totalInterest
// schedule.totalToRepay
```

### 2. Authentication Check

Frontend pattern to check if user is logged in:

```javascript
async function checkAuth() {
  const response = await fetch('/api/user');
  if (!response.ok) {
    window.location.href = '/login.html';
    return null;
  }
  return await response.json();
}
```

### 3. Error Display

Common pattern for showing errors to users:

```javascript
function showError(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}
```

### 4. Form Validation

Server-side validation pattern:

```javascript
app.post('/api/endpoint', requireAuth, (req, res) => {
  const { field1, field2 } = req.body;

  if (!field1 || !field2) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (typeof field1 !== 'string') {
    return res.status(400).json({ error: 'field1 must be a string' });
  }

  // Process request
  res.json({ success: true, data: {...} });
});
```

### 5. Database Transactions

For operations requiring multiple inserts/updates:

```javascript
const insertAgreement = db.prepare('INSERT INTO agreements (...) VALUES (...)');
const insertInvite = db.prepare('INSERT INTO agreement_invites (...) VALUES (...)');

// Run in transaction
const transaction = db.transaction(() => {
  const result = insertAgreement.run(...);
  const agreementId = result.lastInsertRowid;
  insertInvite.run(agreementId, ...);
  return agreementId;
});

const agreementId = transaction();
```

## Important Rules

### When Working on This Codebase

1. **NEVER introduce a build step** - Keep the zero-build architecture
2. **NEVER use TypeScript** - This is a pure JavaScript project
3. **NEVER use a frontend framework** - No React, Vue, Angular, etc.
4. **ALWAYS store money in cents** - Never use floating point for currency
5. **ALWAYS use prepared statements** - Never concatenate SQL
6. **ALWAYS escape HTML** - XSS prevention is critical
7. **ALWAYS validate input server-side** - Client validation is not enough
8. **NEVER commit database files** - Already in .gitignore
9. **NEVER commit uploads/** - Already in .gitignore
10. **ALWAYS follow the PR workflow** - No direct pushes to main

### File Modification Guidelines

**When editing existing files:**
- Preserve existing code style (even if inconsistent)
- Match indentation and spacing of surrounding code
- Don't refactor unless explicitly asked
- Keep function signatures compatible

**When creating new files:**
- Follow the conventions of similar existing files
- Use JSDoc comments for exported functions
- Add XSS escaping for any user content display
- Place in appropriate directory (lib/, public/js/, public/components/)

### API Design Guidelines

**When adding new endpoints:**
- Use RESTful conventions (GET for read, POST for create, PATCH for update, DELETE for delete)
- Always use `requireAuth` middleware unless public endpoint
- Return `{ success: true, data: {...} }` for success
- Return `{ error: 'message' }` with appropriate status code for errors
- Validate all inputs before processing
- Use prepared statements for all database queries

### Frontend Guidelines

**When adding new pages:**
- Copy structure from existing pages (e.g., `app.html`, `calculate.html`)
- Include header with `fetch()` from `components/header.html`
- Add auth check at page load
- Use inline styles for page-specific CSS
- Link shared CSS files (`css/app.css`, `css/shared-controls.css`)

**When adding new components:**
- Define as Web Component with `customElements.define()`
- Use `payfriends-` prefix for custom element name
- Escape all user content with `escapeHTML()`
- Document component API in file header comment

### Database Guidelines

**When adding new tables:**
- Define schema in `server.js` database setup section
- Use `CREATE TABLE IF NOT EXISTS`
- Always include `created_at TEXT` field
- Use `INTEGER` for all IDs and amounts (cents)
- Use `TEXT` for dates (ISO 8601 format)
- Add appropriate foreign keys

**When modifying schema:**
- Add migration logic in `server.js` (simple `ALTER TABLE` statements)
- Never break existing data
- Document schema changes in commit message

### Testing Guidelines

**When adding tests:**
- Use Node.js `assert` module
- Create test file in `test/` directory with `.test.js` suffix
- Use `console.log()` for test descriptions
- Use code blocks `{ }` to scope each test
- Print ✓ for passing tests
- Make tests runnable with `node test/filename.test.js`

## Debugging Tips

### Common Issues

**1. "Cannot find module" errors**
- Check that file paths use correct relative paths
- Remember: `lib/` uses CommonJS (`require()`), `public/js/` uses ES6 modules (`import`)

**2. "Database is locked" errors**
- WAL mode should prevent this
- Check that transactions are properly committed
- Ensure no long-running queries holding locks

**3. Session not persisting**
- Check that cookies are being sent (same-origin, not blocked)
- Verify session hasn't expired (30-day expiry)
- Check `sessions` table for valid entry

**4. XSS vulnerabilities**
- Always use `escapeHTML()` before inserting user content into DOM
- Never use `innerHTML` with unescaped user content
- Use `textContent` when possible

**5. Currency calculation errors**
- Verify all values are in cents (integers)
- Check for division creating decimals (round appropriately)
- Use `Math.round()` after percentage calculations

### Logging

Server uses Morgan HTTP logging (dev format):
```
GET /api/user 200 15.234 ms - 145
```

Add custom logging for debugging:
```javascript
console.log('Debug:', { variable1, variable2 });
console.error('Error occurred:', error.message);
```

## Resources

- **Contributing Guide:** `docs/contributing.md`
- **Branch Protection Script:** `scripts/setup-branch-protection.sh`
- **README:** `README.md`
- **Frequency Refinements:** `FREQUENCY-REFINEMENTS-SUMMARY.md`

## Questions?

When in doubt:
1. Check existing similar code for patterns
2. Read the tests to understand expected behavior
3. Refer to this CLAUDE.md file
4. Ask the user for clarification on requirements

---

**Remember:** Simplicity is a feature. This codebase intentionally avoids modern build tools and frameworks to remain accessible and maintainable. Respect that architectural decision.

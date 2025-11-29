# Development Testing Guide

This guide explains how to use the dev testing infrastructure for PayFriends MVP.

## Quick Start

```bash
# 1. Install dependencies (including Playwright)
npm install

# 2. Install Playwright browsers (first time only)
npx playwright install chromium

# 3. Seed demo data
npm run seed:demo

# 4. Run E2E tests
npm run test:e2e
```

---

## Demo Data Setup

### Seed Demo Data

```bash
npm run seed:demo
```

**What it creates:**

- **Test Users:**
  - Lender: `lender@test.dev` / `password123`
  - Borrower: `borrower@test.dev` / `password123`

- **Active Agreement:**
  - Principal: €1,000
  - Interest rate: 5% annual
  - Term: 90 days
  - Status: Active (fully accepted and ready for payments)

**Note:** The seed script is idempotent - you can run it multiple times to reset the demo data.

---

## E2E Testing

### Prerequisites

```bash
# Install all dependencies
npm install

# Install Playwright browsers (first time only)
npx playwright install chromium
```

### Running Tests

```bash
# Run all E2E tests (headless mode)
npm run test:e2e

# Run with Playwright UI (interactive debugging)
npm run test:e2e:ui

# Run in headed mode (see the browser)
npm run test:e2e:headed
```

### Test Coverage

Current E2E tests cover:

- ✅ **Report a Payment - Happy Path**
  - Login as borrower
  - Navigate from dashboard → report payment page
  - Fill form and submit
  - Verify success

- ✅ **Agreement Context Display**
  - Verify lender/borrower names shown
  - Verify loan amount displayed

- ✅ **Autofill Functionality**
  - Verify "Use amount due today" link works
  - Verify amount is correctly calculated

### Test Files

- **Configuration:** `playwright.config.js`
- **Tests:** `e2e/report-payment.spec.js`

---

## Manual Testing Workflow

### 1. Set Up Demo Data

```bash
npm run seed:demo
```

### 2. Start Dev Server

```bash
npm run dev
```

Server will start at `http://localhost:3000`

### 3. Manual Test Steps

1. Open `http://localhost:3000/login.html`
2. Log in as `borrower@test.dev` / `password123`
3. Click "Report a payment" button on dashboard
4. Fill out payment form:
   - Amount: Any value (e.g., €500)
   - Payment method: Select from dropdown
   - Note: Optional
   - Proof: Optional file upload
5. Click submit
6. Verify success message and redirect to dashboard

### 4. Test as Lender

1. Log out
2. Log in as `lender@test.dev` / `password123`
3. View the agreement to see reported payments
4. Test lender-specific features

---

## Troubleshooting

### Tests Fail with "Port 3000 already in use"

The dev server is already running. Either:
- Stop the existing dev server
- Or let Playwright reuse it (configured by default)

### Database Issues

Reset the database by deleting it and re-seeding:

```bash
rm data/payfriends.db
npm run seed:demo
```

### Playwright Browser Not Installed

```bash
npx playwright install chromium
```

---

## Adding More Tests

To add new E2E tests:

1. Create a new `.spec.js` file in the `e2e/` directory
2. Follow the existing test patterns in `e2e/report-payment.spec.js`
3. Run tests with `npm run test:e2e`

Example test structure:

```javascript
const { test, expect } = require('@playwright/test');

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    // Your test code
  });
});
```

---

## Related Commands

```bash
# Unit tests (for lib/ functions)
node test/loan-utils.test.js

# Start dev server
npm run dev

# Start production server
npm start
```

---

## Notes

- All seeded data is local-only (stored in `data/payfriends.db`)
- Tests use real database and server (not mocked)
- Playwright auto-starts the dev server before tests
- Test artifacts saved to `test-results/` and `playwright-report/`

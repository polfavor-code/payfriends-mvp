# Unified Calculations Fix

## Summary

This PR implements a unified calculation approach to ensure consistency across all pages in PayFriends MVP. All loan calculations (interest, totals, countdowns, next payments) now use a single source of truth.

## Changes Made

### 1. Created Unified Calculation Helper (`public/js/loan-utils.js`)

**NEW FILE**: Provides single source of truth for:
- `computeLoanTotals(agreement)` - Calculate total interest and total to repay
- `getDaysLeft(dueDate, today)` - Consistent countdown calculation
- `getNextPayment(agreement)` - Next payment amount (full total for one-time loans)
- `getOutstandingAndTotal(agreement)` - Outstanding vs Total for display
- `getLoanStartLabel(agreement)` - Loan start date formatting

All functions use `buildRepaymentSchedule` from `schedule.js` as the underlying calculation engine.

### 2. Fixed Countdown Days Mismatch (`public/components/agreements-table.js`)

**FIXED**: Line 66
- Changed `Math.floor` to `Math.round` for day calculation
- Added midnight normalization (`.setHours(0, 0, 0, 0)`) to both dates
- Ensures 365 vs 366 discrepancies are eliminated

**Before:**
```javascript
const diffDays = Math.floor((dueTimestamp - now) / (1000 * 60 * 60 * 24));
```

**After:**
```javascript
dueTimestamp.setHours(0, 0, 0, 0);
now.setHours(0, 0, 0, 0);
const diffDays = Math.round((dueTimestamp - now) / (1000 * 60 * 60 * 24));
```

### 3. Fixed Return to Agreements Button

**FIXED**: `public/review-details.html` line 844
**FIXED**: `public/review.html` line 145

- Changed link from `/app` to `/agreements`
- Added `font-size:16px` for better readability

**Before:**
```html
<a href="/app" style="...">Return to My agreements</a>
```

**After:**
```html
<a href="/agreements" style="...; font-size:16px">Return to My agreements</a>
```

### 4. Fixed Loan Start Date Display (`public/review-details.html`)

**FIXED**: Lines 2066-2075
- Replaced hardcoded "To be confirmed" with proper logic
- Shows "When agreement is accepted" for upon-acceptance mode
- Shows formatted date for explicit dates

**Before:**
```javascript
document.getElementById('money-sent-display').textContent = agreement.loan_start_date_display || 'To be confirmed';
```

**After:**
```javascript
const moneySentDate = agreement.money_sent_date || agreement.money_transfer_date;
let loanStartLabel;
if (!moneySentDate || moneySentDate === 'on-acceptance' || moneySentDate === 'upon agreement acceptance') {
  loanStartLabel = 'When agreement is accepted';
} else {
  loanStartLabel = formatFinancialDate(moneySentDate);
}
document.getElementById('money-sent-display').textContent = loanStartLabel;
```

## Known Issues / Next Steps

The following issues require additional work and should be addressed in follow-up PRs:

### 1. Interest Calculation Mismatch (€6300.82 → €6300.00)

**Root Cause**: The wizard may be using a different calculation method than the manage page.

**Solution Required**:
- Update wizard (in `app.html` or `calculate.html`) to use `buildRepaymentSchedule` from `schedule.js`
- Ensure `totalInterest` and `totalRepayAmount` sent to server match the schedule calculation
- Server should recalculate and validate these values on receipt

**Files to Update**:
- `public/app.html` (wizard code around lines 4001-4002 and 4418-4419)
- `server.js` (POST /api/agreements endpoint around line 1439-1440)

### 2. Outstanding / Total Format

**Current**: Uses server-calculated `planned_total_cents`
**Desired**: Should consistently show `€{principalRemaining} / €{totalToRepay}`

**Solution Required**:
- Update `agreements-table.js` to use `computeLoanTotals()` from `loan-utils.js`
- Ensure server calculates `planned_total_cents` using the same `buildRepaymentSchedule` logic

### 3. Next Payment Amount

**Current**: May show incorrect amount for one-time loans
**Desired**: Should show full `totalToRepay` for one-time loans, not just principal

**Solution Required**:
- Update dashboard and agreements list to use `getNextPayment()` from `loan-utils.js`
- Ensure server's `getNextPaymentInfo()` uses the same calculation

## Testing Checklist

- [ ] Countdown shows same value across all pages (Dashboard, Agreements, Manage)
- [ ] Return button links to `/agreements` on both Manage and Review pages
- [ ] Return button has readable font-size (16px)
- [ ] Loan start date shows correct value (not "To be confirmed")
- [ ] Loan start date shows "When agreement is accepted" for upon-acceptance mode

## Files Modified

1. `public/js/loan-utils.js` (NEW)
2. `public/components/agreements-table.js`
3. `public/review-details.html`
4. `public/review.html`
5. `UNIFIED-CALCULATIONS-FIX.md` (NEW)

## How to Use `loan-utils.js`

```javascript
// Load the file in your HTML
<script src="/js/loan-utils.js"></script>

// Use the functions
const totals = computeLoanTotals(agreement);
console.log(totals.totalInterestCents); // e.g., 30000 (€300.00)
console.log(totals.totalToRepayCents);  // e.g., 630000 (€6300.00)

const daysLeft = getDaysLeft(agreement.due_date);
console.log(daysLeft); // e.g., 365

const nextPmt = getNextPayment(agreement);
console.log(nextPmt.amountCents); // e.g., 630000 for one-time
console.log(nextPmt.daysLeft);    // e.g., 365
```

## Dependencies

The new `loan-utils.js` requires:
- `buildRepaymentSchedule()` from `/js/schedule.js`
- `generatePaymentDates()` from `/js/schedule.js`
- `formatFinancialDate()` from `/js/formatters.js`

Ensure these are loaded before `loan-utils.js`.

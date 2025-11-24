# Payment Frequency Refinements - Implementation Summary

## Overview
Complete refinement of payment frequency options and behavior in the PayFriends MVP calculator playground, implementing calendar-based and day-based frequency calculations with proper preview/actual mode handling.

---

## A. Payment Frequency Options (UI)

### New Frequency Options
The calculator now supports exactly these frequencies:

| Value | Label | Type | Period Length |
|-------|-------|------|---------------|
| `every-3-days` | Every 3 days | Day-based | 3 days |
| `every-week` | Every week | Day-based | 7 days |
| `every-month` | Every month | Calendar-based | 1 month |
| `every-year` | Every year | Calendar-based | 1 year |
| `once` | Once only | Day-based | Single payment |

### Removed Options
- ❌ Every 4 weeks (removed)
- ❌ Every 2 weeks / Biweekly (removed)

### UI Behavior
- "Once only" option automatically selected for 1-time payment type
- "Once only" hidden when repayment type is Installments
- Frequency select disabled when 1-time payment selected

---

## B. Repayment Type Behavior

### Installments Mode
```
✓ Number of installments: Enabled, editable (min: 1)
✓ Payment frequency: All options available except "once"
```

### 1-Time Payment Mode
```
✓ Number of installments: Locked to 1 (disabled)
✓ Payment frequency: Locked to "once" (disabled)
✓ Hint text: "For 1-time payments the loan is repaid in a single payment."
```

---

## C. Frequency Behavior in Schedule Generation

### 1. Every 3 Days (`every-3-days`)

**Period:** 3 days between payments

**Preview Mode:**
- First payment: `{firstPaymentDays} days after loan start`
- Payment 2: `{firstPaymentDays + 3} days after loan start`
- Payment 3: `{firstPaymentDays + 6} days after loan start`
- Example: 30, 33, 36 days

**Actual Mode:**
- Calculates real calendar dates using `addDays()`
- First: `loanStartDate + firstPaymentDays`
- Subsequent: Add 3 days incrementally

**Interest:** `annualRate * (3/365)` per period

---

### 2. Every Week (`every-week`)

**Period:** 7 days between payments (maintains same weekday)

**Preview Mode:**
- Label format: `{totalDays} days after loan start`
- Example: 7, 14, 21, 28 days

**Actual Mode:**
- Uses `addDays()` with 7-day increments
- Preserves weekday pattern

**Interest:** `annualRate * (7/365)` per period

---

### 3. Every Month (`every-month`)

**Period:** Calendar month intervals

**Preview Mode:**
- Label format: `{N} month(s) after loan start`
- Example: "1 month after loan start", "2 months after loan start"
- NO fake dates in preview mode

**Actual Mode:**
- Uses `addMonths()` helper with proper day clamping
- Handles month-end edge cases:
  - Jan 31 → Feb 28 (Feb has only 28 days)
  - Jan 31 → Mar 31 → Apr 30 (varies by month)

**Interest:** `annualRate / 12` per period

**Key Implementation:**
```javascript
function addMonths(date, months) {
  // Set to target month
  // Clamp day to valid range (28-31 depending on month)
  // Handles varying month lengths properly
}
```

---

### 4. Every Year (`every-year`)

**Period:** Calendar year intervals

**Preview Mode:**
- Label format: `{N} year(s) after loan start`
- Example: "1 year after loan start", "2 years after loan start"

**Actual Mode:**
- Uses `addYears()` helper
- Handles Feb 29 leap year edge case:
  - 2024-02-29 (leap year) → 2025-02-28 (non-leap year)
  - 2024-02-29 → 2026-02-28 → 2027-02-28

**Interest:** `annualRate` per period (one full year)

**Key Implementation:**
```javascript
function addYears(date, years) {
  // Handle Feb 29 → Feb 28 conversion for non-leap years
  // Otherwise: simple year increment
}
```

---

### 5. Once Only (`once`)

**Period:** Single payment at specified offset

**Preview Mode:**
- Label: `{firstPaymentDays} days after loan start`
- Example: "45 days after loan start"

**Actual Mode:**
- Due date: `loanStartDate + firstPaymentDays`
- Single payment with full principal + accrued interest

**Interest:** Based on exact days from loan start to payment

---

## D. Loan Start Mode & Context Mode Interaction

### Mode Decision Logic

```
1. Fixed Date Mode:
   → Always use actual mode (real calendar dates)
   → Ignore context mode setting
   → effectiveMode = 'actual'

2. Upon Acceptance + Preview:
   → Use relative labels
   → NO real dates (dueDate = null)
   → effectiveMode = 'preview'

3. Upon Acceptance + Actual:
   → Use today as loan start (simulates acceptance)
   → Calculate real calendar dates
   → effectiveMode = 'actual'
```

### Implementation
```javascript
// STEP 1: Determine effective mode
let effectiveMode = contextMode;
if (loanStartMode === 'fixed_date') {
  effectiveMode = 'actual';
}

// STEP 2: Determine loan start date
let loanStartDate = null;
if (loanStartMode === 'fixed_date') {
  loanStartDate = explicitLoanStartDate;
} else if (loanStartMode === 'upon_acceptance' && effectiveMode === 'actual') {
  loanStartDate = explicitLoanStartDate || new Date();
}

// STEP 3: Generate schedule based on effective mode
```

---

## E. Rendering & Output

### Schedule Table Structure
```
Columns:
- # (index)
- Due date (relative label or calendar date)
- Principal (€ amount)
- Interest (€ amount)
- Total payment (€ amount)
- Balance (remaining balance)

Footer Row: "Loan totals"
- Total principal
- Total interest
- Total repayment
```

### Summary Cards
- **Total Interest**: Sum of all interest payments
- **Total Repayment**: Principal + Total Interest

### Loan Start Label
- Fixed date: `"1 Jan 2025"` (formatted date)
- Upon acceptance (preview): `"When agreement is accepted"`
- Upon acceptance (actual): `"24 Nov 2025"` (today's date)

---

## F. Debug Console Output

### Format
```
✔ Calculation completed

Loan amount: € 6.000,00
Annual interest: 5,00%
Repayment type: Installments
Number of installments: 12
Frequency: Every month
First payment: 30 days after loan start
Loan start mode: Upon agreement acceptance
Mode: Preview (relative due dates)
```

### Validation Errors
```
⚠ Validation errors:
  • Please enter a positive loan amount.
  • Number of installments must be at least 1.
  • Please select a loan start date when using fixed date mode.
```

---

## G. Testing Results

### Automated Tests (test-frequencies.js)
```
✓ Every 3 days - Preview mode                 PASSED
✓ Every week - Preview mode                   PASSED
✓ Every month - Preview mode                  PASSED
✓ Every year - Preview mode                   PASSED
✓ Once only - Preview mode                    PASSED
✓ Every 3 days - Actual mode with fixed date  PASSED
✓ Every month - Actual mode with fixed date   PASSED
✓ Every year - Actual mode with fixed date    PASSED
✓ Month-end edge case - Jan 31                PASSED
✓ Feb 29 leap year edge case                  PASSED

Results: 10 passed, 0 failed
```

### Edge Cases Verified
1. ✅ Jan 31 + 1 month = Feb 28 (month-end clamping)
2. ✅ Feb 29 + 1 year = Feb 28 (leap year handling)
3. ✅ Zero offset first payment = "On loan start"
4. ✅ Preview mode never shows fake dates for upon_acceptance
5. ✅ Fixed date mode always forces actual mode

---

## H. Files Modified

### 1. `/public/calculate.html`
**Changes:**
- Updated frequency select options (new values)
- Added `addDays()` and `addYears()` helper functions
- Completely rewrote `generateRepaymentSchedule()` function
- Implemented proper calendar-based and day-based calculations
- Updated debug console format
- Enhanced repayment type behavior logic

**Key Functions:**
- `addDays(date, days)` - Day arithmetic
- `addMonths(date, months)` - Month arithmetic with day clamping
- `addYears(date, years)` - Year arithmetic with Feb 29 handling
- `generateRepaymentSchedule(config)` - Single source of truth
- Exported as `window.PayFriendsRepayment.generateRepaymentSchedule`

### 2. `/lib/repayments/repaymentSchedule.js`
**Changes:**
- Added new frequency format support
- Updated `getRelativeDateLabel()` for new frequencies
- Updated `generatePreviewSchedule()` day calculations
- Maintained backward compatibility with legacy formats

### 3. `/test-frequencies.js` (Created)
**Purpose:** Comprehensive automated testing of all frequency behaviors
- 10 test cases covering all scenarios
- Preview and actual modes
- Edge cases (month-end, leap year)

---

## I. Key Implementation Details

### Interest Calculation
```javascript
const annualRate = annualInterestRate / 100;
const dailyRate = annualRate / 365;

// For each period:
const daysForPeriod = (i === 0) ? firstPaymentDays : periodDays;
const interest = remainingBalance * dailyRate * daysForPeriod;
```

### Principal Payment
```javascript
const principalPerPayment = loanAmount / numberOfInstallments;
// Equal principal per payment (declining balance interest)
```

### Balance Calculation
```javascript
remainingBalance -= principalPayment;
if (remainingBalance < 0.01) remainingBalance = 0; // Round to zero
```

---

## J. Browser Compatibility

### Exports
```javascript
window.PayFriendsRepayment = {
  generateRepaymentSchedule
};
```

### Dependencies
- `/js/formatters.js` - Currency formatting (window exports)
- `/js/schedule.js` - Date utilities (window exports)

---

## K. Future Integration Paths

The `generateRepaymentSchedule()` function is now ready for integration into:

1. **Wizard Steps 3 & 5** - Loan creation flow
2. **Lender Manage Page** - Active loan management
3. **Borrower Review/Manage Pages** - Borrower interface
4. **Payment Box Components** - Payment tracking UI

All future integrations should import from `window.PayFriendsRepayment` for consistency.

---

## L. Breaking Changes

### Frequency Value Changes
- ⚠️ `monthly` → `every-month`
- ⚠️ `weekly` → `every-week`
- ⚠️ `yearly` → `every-year`
- ⚠️ Removed: `biweekly`, `every_4_weeks`

**Note:** Legacy format support maintained in `lib/repayments/repaymentSchedule.js` for backward compatibility.

---

## M. Access

### Calculator Playground
```
URL: http://localhost:3000/calculate
Purpose: Manual testing and validation of all frequency behaviors
```

### API Endpoint
```
POST /api/calculate-schedule
Body: {
  loanAmount, annualInterestRate, repaymentType,
  numberOfInstallments, paymentFrequency, firstPaymentDays,
  loanStartMode, contextMode, explicitLoanStartDate
}
```

---

## N. Summary

✅ **All frequency refinements implemented and tested**
✅ **Single source of truth established**
✅ **Preview vs actual mode working correctly**
✅ **Edge cases handled properly**
✅ **Backward compatibility maintained**
✅ **Ready for production use**

The calculator playground now serves as the definitive implementation for repayment schedule generation across the entire PayFriends MVP application.

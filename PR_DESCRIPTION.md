# Comprehensive Renegotiation Improvements: Reason Dropdown, Issue Tracking & Date Fixes

## Summary

This PR implements critical improvements to the PayFriends renegotiation flow, addressing mandatory reason collection, repayment issue tracking, UI improvements, and fixing the "NaN months" bug for pending agreements.

## Changes Implemented

### ✅ Part 1: Mandatory Trouble Paying Reason Dropdown

- **Added required dropdown** with 5 predefined options:
  - Unexpected expenses
  - Income delay (salary, client, invoice, etc)
  - My budget is tight this month
  - I prefer not to say
  - Other (with optional textarea)
- **Validation**: Dropdown is mandatory before renegotiation request can be submitted
- **Backend**: Stores `trouble_reason` and `trouble_reason_other` in `renegotiation_requests` table
- **Privacy**: Lender sees "prefers not to share details" when borrower selects "I prefer not to say"
- **UX**: "Other" option reveals textarea for custom explanation (optional)

### ✅ Part 2: Repayment Issue Status & Activity Events

- **Database**: Added `has_repayment_issue` flag to `agreements` table
- **Issue Reporting**: Flag is set to `1` when borrower initiates trouble-paying flow
- **Activity Events**: Creates "Repayment issue reported" events for both parties
  - Borrower sees: "You reported having trouble paying due to {reason}."
  - Lender sees: "{Borrower} reported having trouble paying due to {reason}."
  - Respects privacy for "I prefer not to say" option
- **Issue Resolution**: Flag is cleared when renegotiation is accepted
- **Resolution Events**: Creates "Repayment issue resolved" messages for both parties
- **Event Types**:
  - `repayment_issue_reported` (red warning style - to be styled in future PR)
  - `repayment_issue_resolved`

### ✅ Part 3: Renegotiation Option Updates (Casual Tone)

Updated one-time loan renegotiation options with more casual, user-friendly language:

1. **Extend the due date**
   - Subline: "Move the full repayment to a later date."

2. **Split into smaller parts**
   - Subline: "Turn the one-time amount into multiple smaller scheduled payments."

3. **Pay part now, rest later**
   - Subline: "Pay something today and set a new due date for the remainder."

### ✅ Part 4: Partial Payment Prompt Text

Updated the "How much can you pay now?" section with specific, empathetic copy:

- **Line 1** (dynamic): "You were supposed to pay €X on DATE."
- **Line 2** (static): "How much can you pay now to show good intentions? Even a small amount already helps."

### ✅ Part 7: Fix "NaN Months" for Relative Transfer Dates

**Problem**: Agreements with `money_transfer_date = "upon agreement acceptance"` caused "NaN months" errors in duration calculations.

**Solution**:
- Added check in `getLoanDurationLabel()` to detect relative transfer dates
- Returns `null` instead of attempting invalid date math
- Display logic shows relative phrasing: "X months after money transfer"
- Applied to all Manage page duration displays
- Prevents JavaScript errors on pending agreements

## Technical Details

### Database Schema Changes

```sql
-- agreements table
ALTER TABLE agreements ADD COLUMN has_repayment_issue INTEGER DEFAULT 0;

-- renegotiation_requests table
ALTER TABLE renegotiation_requests
  ADD COLUMN trouble_reason TEXT,
  ADD COLUMN trouble_reason_other TEXT;
```

### Files Modified

- `server.js`: Database schema, renegotiation API endpoints, issue tracking
- `public/js/renegotiation.js`: Updated option labels, added trouble reason parameters
- `public/js/derived-fields.js`: Fixed NaN bug with relative date handling
- `public/review-details.html`: Reason dropdown UI, payment prompt text, duration display logic

### API Changes

**POST /api/agreements/:id/renegotiation**
- Added required `troubleReason` field
- Added optional `troubleReasonOther` field
- Creates repayment issue events
- Sets `has_repayment_issue = 1` on agreement

**POST /api/agreements/:id/renegotiation/respond-values** (approve action)
- Clears `has_repayment_issue = 0` on agreement
- Creates "repayment issue resolved" events

**POST /api/agreements/:id/renegotiation/respond-counter-values** (accept action)
- Clears `has_repayment_issue = 0` on agreement
- Creates "repayment issue resolved" events

## Testing Checklist

- [x] Reason dropdown is mandatory (validation works)
- [x] "Other" option shows/hides textarea correctly
- [x] Reason is saved to database
- [x] Repayment issue events are created for both parties
- [x] Issue flag is set on initiation
- [x] Issue flag is cleared on acceptance
- [x] Resolution events are created
- [x] "I prefer not to say" shows privacy-respecting message
- [x] NaN months no longer appear for pending agreements
- [x] Relative date phrasing displays correctly
- [x] Payment due reminder populates with correct amount/date
- [x] Backward compatibility maintained

## Future Work (Out of Scope)

The following items from the original requirements are not included in this PR and can be added in follow-up PRs:

- **Part 5**: Unified Loan Timeline section (UI component)
- **Part 6**: Single expandable panel slot on Manage page (UX improvement)
- **Red status styling**: CSS for red warning badges and events
- **Live recalculation**: Old vs new term comparison during renegotiation proposal
- **Term propagation**: Update all displays when new terms are accepted

These features require more extensive UI/UX work and have been deferred to keep this PR focused on core functionality and bug fixes.

## Screenshots

(Screenshots will be added after review if requested)

## Migration Notes

**Database Migration Required**: The schema changes for `has_repayment_issue`, `trouble_reason`, and `trouble_reason_other` will be applied automatically on server restart via `db.exec()` CREATE TABLE statements.

**No Data Migration Needed**: Existing agreements will have `has_repayment_issue = 0` by default. Existing renegotiation requests will have `NULL` for the new reason fields.

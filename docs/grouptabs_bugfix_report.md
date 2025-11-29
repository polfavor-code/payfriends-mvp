# GroupTabs Bugfix Report

## Summary
This document details the fixes made to ensure the GroupTabs and Status Events system works end-to-end.

---

## Fix 0: Header Giant Logo in GroupTabs Wizard Pages

### What was broken
The `grouptabs-create.html` and `grouptabs-view.html` pages displayed a giant PayFriends logo that took up the entire top half of the viewport, pushing all other content down.

### Steps to reproduce
1. Navigate to `/grouptabs/create`
2. Observe the large coin logo dominating the page

### Root cause
The pages were missing the CSS style `.logo-coin{height:54px; width:auto}` that constrains the header logo size. The `header.js` component injects the logo image, but without this CSS constraint, the PNG is rendered at its native resolution (very large).

The working page `grouptabs.html` had this style, but `grouptabs-create.html` and `grouptabs-view.html` were missing it.

### What changed
Added the missing header CSS styles to both files:

**`grouptabs-create.html`:**
```css
.top-header{display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; padding-bottom:16px; border-bottom:1px solid rgba(255,255,255,0.08)}
.top-header-left{display:flex; align-items:center; gap:12px}
.top-header-right{display:flex; gap:12px; align-items:center}
.logo-coin{height:54px; width:auto}
.top-header-text{display:flex; flex-direction:column; gap:2px}
.app-name{font-size:24px; font-weight:600; line-height:1.2; margin:0}
.app-slogan{color:var(--muted); font-size:14px; line-height:1.2; margin-top:2px}
```

**`grouptabs-view.html`:** Same CSS added.

### Behavior after fix
Header displays correctly with 54px logo, Activity button, and user avatar properly positioned.

---

## Fix 1: View Page Field Name Mismatch

### What was broken
The `grouptabs-view.html` page was showing incorrect data:
- Tab type showed "MULTI-BILL" instead of "ONE-BILL" for one-bill tabs
- Magic link showed `http://localhost:3000/tab/undefined` (missing token)
- Number of people showed 1 instead of the configured value

### Steps to reproduce
1. Create a new Restaurant bill tab with 8 people
2. Navigate to the view page
3. Observe incorrect badge, magic link, and people count

### Root cause
The frontend was using `tabData.type` and `tabData.magic_link_token` but the backend API returns `tabData.tab_type` and `tabData.magic_token`.

### What changed
Updated `grouptabs-view.html`:
- Changed `tabData.type` → `tabData.tab_type`
- Changed `tabData.magic_link_token` → `tabData.magic_token`

### Behavior after fix
- Tab type badge correctly shows "ONE-BILL" or "MULTI-BILL"
- Magic link displays the correct token URL
- All tab data displays correctly

---

## Fix 2: GroupTab Activity Messages Not Clickable

### What was broken
When GroupTab-related activity messages appeared in the Activity section on `/app`, they were:
- Not clickable (no link)
- Did not navigate to the GroupTab detail page

### Steps to reproduce
1. Create a new GroupTab
2. Go to `/app` and click Activity
3. See "GroupTab Created" message
4. Try to click it - nothing happens

### Root cause
The activity rendering code in `app.html` only handled `agreement_id` to generate links. It did not check for `tab_id` or handle GroupTab-related event types.

### What changed
Updated `app.html`:

1. Added handling for `tab_id` in link URL generation:
```javascript
if (msg.tab_id) {
  linkUrl = `/grouptabs/${msg.tab_id}`;
} else if (msg.agreement_id) {
  // existing agreement link logic
}
```

2. Added activity text handling for GroupTab event types:
```javascript
} else if (msg.event_type === 'GROUPTAB_CREATED') {
  activityText = msg.body || 'You created a new GroupTab';
} else if (msg.event_type === 'GROUPTAB_CLOSED') {
  activityText = msg.body || 'A GroupTab was closed';
} else if (msg.event_type === 'GROUPTAB_EXPENSE_ADDED') {
  activityText = msg.body || 'An expense was added to a GroupTab';
} else if (msg.event_type === 'GROUPTAB_PAYMENT_ADDED') {
  activityText = msg.body || 'A payment was recorded in a GroupTab';
} else if (msg.event_type === 'GROUPTAB_PARTICIPANT_JOINED') {
  activityText = msg.body || 'Someone joined a GroupTab';
}
```

### Behavior after fix
- GroupTab activity messages are now clickable
- Clicking marks the message as read
- Clicking navigates to `/grouptabs/{tab_id}`
- UI updates to show the message is read

---

## Fix 3: Real-Time Calculations for Restaurant Preset

### What was broken
The Restaurant preset in the GroupTabs creation wizard did not calculate amounts in real-time. Users had to complete the form without seeing the per-person amounts.

### Root cause
The wizard form had input fields but no JavaScript to perform calculations on input changes.

### What changed
Updated `grouptabs-create.html`:

1. Added `recalculateAll()` function that calculates:
   - `fairShare = total / peopleCount`
   - `adjustedShare = total / (peopleCount * payRateFactor)`
   - Tier amounts based on multiplier

2. Attached event listeners to all relevant inputs

3. Added display elements showing:
   - "Each person pays: €X" for equal split
   - "Base per seat: €X" for seats/shares
   - Tier amounts in euros alongside percentages

### Behavior after fix
- Changing Total Amount immediately updates per-person calculations
- Changing Number of People recalculates all amounts
- Changing Expected Payment Rate adjusts suggested shares
- Tier prices show calculated euro amounts

---

## Tests Completed

### One-Bill Tab (Restaurant)
- ✅ Wizard completes successfully
- ✅ Tab saves with correct data
- ✅ Detail page loads without errors
- ✅ Total, people count, per-person amount display correctly
- ✅ Split mode configuration works
- ✅ Expected Payment Rate saves correctly
- ✅ Magic link shows correct token

### Multi-Bill Tab (Trip)
- ✅ Wizard completes successfully
- ✅ Tab saves with correct data
- ✅ Detail page loads without errors
- ✅ Add Expense button opens modal
- ✅ Expense submission works (verified in server logs)

### Status Events
- ✅ Activity count shows correctly in header ("Activity (1)")
- ✅ GroupTab messages appear in activity list
- ✅ GroupTab messages are clickable
- ✅ Clicking marks as read and navigates to tab

---

## Known Issues / Future Improvements

1. **Add People functionality** - Need to verify POST endpoint works
2. **Magic Link guest flow** - Need end-to-end testing
3. **Settings modal save** - Need to verify PATCH updates persist

---

## Fix 4: Database Schema Out of Sync

### What was broken
Creating a GroupTab failed with a 500 error. The error occurred when the backend tried to INSERT into `group_tabs`.

### Root cause
The database file (`data/payfriends.db`) was created before recent schema updates. It was missing:
- `description TEXT` column
- `people_count INTEGER` column
- `tab_id INTEGER` column in `messages` table

The server.js schema uses `CREATE TABLE IF NOT EXISTS`, so existing tables don't get updated with new columns.

### What changed
Ran ALTER TABLE commands to add missing columns:

```sql
ALTER TABLE messages ADD COLUMN tab_id INTEGER REFERENCES group_tabs(id);
ALTER TABLE group_tabs ADD COLUMN description TEXT;
ALTER TABLE group_tabs ADD COLUMN people_count INTEGER DEFAULT 2;
```

### Behavior after fix
GroupTab creation works successfully, and activity messages properly link to tabs.

---

## Fix 5: Messages API Not Returning tab_id

### What was broken
The `/api/messages` endpoint wasn't returning the `tab_id` field, so the frontend couldn't generate correct links to GroupTab detail pages.

### Root cause
The SQL SELECT query in the messages endpoint only joined with the `agreements` table and didn't include `tab_id` in the returned fields.

### What changed
Updated `server.js` `/api/messages` endpoint:

```javascript
const rows = db.prepare(`
  SELECT m.*,
    m.tab_id,  // Added
    a.status as agreement_status,
    // ... existing fields ...
    gt.name as tab_name,  // Added
    gt.tab_type as tab_type  // Added
  FROM messages m
  LEFT JOIN agreements a ON m.agreement_id = a.id
  LEFT JOIN users u_borrower ON a.borrower_user_id = u_borrower.id
  LEFT JOIN group_tabs gt ON m.tab_id = gt.id  // Added
  WHERE m.user_id = ?
  ORDER BY m.created_at DESC
`).all(req.user.id);
```

### Behavior after fix
Activity messages for GroupTabs now return the proper `tab_id` and can be clicked to navigate to the tab.

---

## Files Modified

1. `public/grouptabs-view.html` - Field name fixes, added header CSS
2. `public/grouptabs-create.html` - Real-time calculations, added header CSS
3. `public/app.html` - GroupTab activity message handling
4. `server.js` - Backend API improvements (messages endpoint, tab_id)
5. `data/payfriends.db` - Schema migrations (tab_id, description, people_count)


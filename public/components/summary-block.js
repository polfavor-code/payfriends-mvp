/**
 * Summary Block Component
 * Provides deterministic rendering of agreement summary fields in Step 5
 * with exact field ordering for installment vs one-time loans
 */

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for HTML insertion
 */
function escapeHTML(str) {
  if (str == null || str === '') return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Summary item types:
 * - field: A label-value pair
 * - spacer: A blank line for visual spacing
 * - dropdown: Reference to an expandable section
 */

/**
 * Exact field order for INSTALLMENT loans
 */
const SUMMARY_ORDER_INSTALLMENTS = [
  // Section 1: Basic info
  { kind: "field", label: "Loan description", key: "description" },
  { kind: "field", label: "Lender name", key: "lenderName" },
  { kind: "field", label: "Borrower name", key: "borrowerName" },
  { kind: "field", label: "Borrower email", key: "borrowerEmail" },
  { kind: "field", label: "Borrower phone", key: "borrowerPhone" },

  { kind: "spacer" },

  // Section 2: Loan terms
  { kind: "field", label: "Money transfer date (Loan start)", key: "moneyTransferDate" },
  { kind: "field", label: "Amount", key: "amount" },
  { kind: "field", label: "Loan duration", key: "loanDuration" },
  { kind: "field", label: "Interest rate", key: "interestRate" },
  { kind: "field", label: "Total interest", key: "totalInterest" },
  { kind: "field", label: "Total to repay", key: "totalToRepay" },

  { kind: "spacer" },

  // Section 3: Installment details
  { kind: "field", label: "Repayment type", key: "repaymentType" },
  { kind: "field", label: "Number of payment installments", key: "numberOfInstallments" },
  { kind: "field", label: "Payment frequency", key: "paymentFrequency" },
  { kind: "field", label: "First repayment date", key: "firstRepaymentDate" },
  { kind: "field", label: "Final due date", key: "finalDueDate" },

  { kind: "spacer" },

  // Dropdowns
  { kind: "dropdown", from: "interest", title: "Repayment schedule & interest calculation" },
  { kind: "dropdown", from: "payments", title: "Repayment details & reminders" },
  { kind: "dropdown", from: "share", title: "Sharing details" }
];

/**
 * Exact field order for ONE-TIME loans
 */
const SUMMARY_ORDER_ONETIME = [
  // Section 1: Basic info
  { kind: "field", label: "Loan description", key: "description" },
  { kind: "field", label: "Lender name", key: "lenderName" },
  { kind: "field", label: "Borrower name", key: "borrowerName" },
  { kind: "field", label: "Borrower email", key: "borrowerEmail" },
  { kind: "field", label: "Borrower phone", key: "borrowerPhone" },

  { kind: "spacer" },

  // Section 2: Loan terms (one-time specific)
  { kind: "field", label: "Money transfer date (Loan start)", key: "moneyTransferDate" },
  { kind: "field", label: "Amount", key: "amount" },
  // Duration is hidden for one-time loans
  { kind: "field", label: "Interest rate", key: "interestRate" },
  { kind: "field", label: "Total interest", key: "totalInterest" },
  { kind: "field", label: "Total to repay", key: "totalToRepay" },

  { kind: "spacer" },

  { kind: "field", label: "Repayment type", key: "repaymentType" },
  { kind: "field", label: "Full repayment due date", key: "fullRepaymentDueDate" },

  { kind: "spacer" },

  // Dropdowns
  { kind: "dropdown", from: "interest", title: "Repayment schedule & interest calculation" },
  { kind: "dropdown", from: "payments", title: "Repayment details & reminders" },
  { kind: "dropdown", from: "share", title: "Sharing details" }
];

/**
 * Get full repayment due date display text
 * Handles both concrete dates and relative descriptions based on loan start type
 * @param {Object} wizardData - The wizard data object
 * @returns {string} Formatted due date or relative description
 */
function getFullRepaymentDueDateDisplay(wizardData) {
  // Check if loan start is "Upon agreement acceptance"
  const isLoanStartUponAcceptance = wizardData.moneySentDate === 'on-acceptance' || wizardData.moneySentOption === 'on-acceptance';

  // Check if due date option is a relative period (not "pick_date")
  const isRelativeDueDate = wizardData.oneTimeDueOption && wizardData.oneTimeDueOption !== 'pick_date';

  // If loan start is "upon acceptance" AND due date is relative, show relative text
  if (isLoanStartUponAcceptance && isRelativeDueDate) {
    return getRelativeDueDateText(wizardData.oneTimeDueOption);
  }

  // Otherwise, show concrete date with countdown
  return wizardData.dueDate ? formatDateWithCountdown(wizardData.dueDate) : '';
}

/**
 * Build data map from wizard data
 * @param {Object} wizardData - The wizard data object
 * @param {Object} currentUser - The current user object
 * @returns {Object} Map of keys to formatted values
 */
function buildSummaryDataMap(wizardData, currentUser) {
  const lenderName = currentUser?.full_name || currentUser?.email || 'You';

  // USE CALCULATED VALUES FROM STEP 2
  const summary = wizardData.calculatedSummary || {};
  const schedule = wizardData.calculatedSchedule || {};

  // Format money transfer date
  let moneyTransferDate;
  if (wizardData.moneySentOption === 'on-acceptance' || wizardData.moneySentOption === 'upon_acceptance') {
    moneyTransferDate = 'When agreement is accepted';
  } else if (wizardData.moneySentOption === 'today') {
    moneyTransferDate = 'Today';
  } else if (wizardData.moneySentOption === 'tomorrow') {
    moneyTransferDate = 'Tomorrow';
  } else if (wizardData.moneySentOption === 'in-1-week') {
    moneyTransferDate = 'In 1 week';
  } else if (wizardData.moneySentOption === 'in-1-month') {
    moneyTransferDate = 'In 1 month';
  } else if (wizardData.moneySentDate && wizardData.moneySentDate !== 'on-acceptance') {
    const date = new Date(wizardData.moneySentDate);
    if (!isNaN(date.getTime())) {
      moneyTransferDate = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } else {
      moneyTransferDate = 'When agreement is accepted';
    }
  } else {
    moneyTransferDate = 'When agreement is accepted';
  }

  // Format loan duration - use calculated value from Step 2
  let durationText;
  if (summary.loanDuration) {
    durationText = summary.loanDuration; // Already formatted string from calculator
  } else if (wizardData.loanDurationLabel) {
    durationText = wizardData.loanDurationLabel;
  } else if (wizardData.repaymentType === 'one_time') {
    durationText = 'One-time repayment';
  } else if (wizardData.planUnit === 'days') {
    durationText = `${wizardData.planLength} ${wizardData.planLength === 1 ? 'day' : 'days'}`;
  } else if (wizardData.planUnit === 'weeks') {
    durationText = `${wizardData.planLength} ${wizardData.planLength === 1 ? 'week' : 'weeks'}`;
  } else if (wizardData.planUnit === 'months') {
    durationText = `${wizardData.planLength} ${wizardData.planLength === 1 ? 'month' : 'months'}`;
  } else if (wizardData.planUnit === 'years') {
    durationText = `${wizardData.planLength} ${wizardData.planLength === 1 ? 'year' : 'years'}`;
  } else {
    durationText = 'One-time repayment';
  }

  // Format payment frequency - Note: uses inline logic for wizard data
  // (Cannot use formatRepaymentFrequency helper since it expects "every_4_weeks" but wizard has "every_X_days")
  let paymentFrequency = '';
  if (wizardData.paymentFrequency) {
    const freq = wizardData.paymentFrequency;
    if (freq === 'weekly') paymentFrequency = 'Weekly';
    else if (freq === 'biweekly') paymentFrequency = 'Every 2 weeks';
    else if (freq === 'every_4_weeks') paymentFrequency = 'Every 4 weeks';
    else if (freq === 'monthly') paymentFrequency = 'Monthly';
    else if (freq === 'quarterly') paymentFrequency = 'Every 3 months';
    else if (freq === 'yearly') paymentFrequency = 'Yearly';
    else if (freq.startsWith('every_') && freq.endsWith('_weeks')) {
      const weeks = freq.replace('every_', '').replace('_weeks', '');
      paymentFrequency = `Every ${weeks} weeks`;
    } else if (freq.startsWith('every_') && freq.endsWith('_days')) {
      const days = freq.replace('every_', '').replace('_days', '');
      paymentFrequency = `Every ${days} days`;
    } else {
      paymentFrequency = freq;
    }
  }

  // Format payment methods
  const methods = wizardData.paymentMethods || [];
  const methodLabels = methods.map(m => {
    if (m === 'bank') return 'Bank transfer';
    if (m === 'cash') return 'Cash';
    if (m === 'paypal') return 'PayPal';
    if (m === 'crypto') return 'Crypto';
    if (m === 'any') return 'Any method';
    if (m === 'other') return `Other${wizardData.paymentOtherDescription ? ': ' + wizardData.paymentOtherDescription : ''}`;
    return m;
  });
  const methodsText = methodLabels.length > 0 ? methodLabels.join(', ') : 'Not specified';

  // Format reminders
  let remindersText = '';
  if (wizardData.reminderMode === 'auto') {
    remindersText = 'Auto reminders (7 days before, 1 day before, on due date; if unpaid: 1 day after, then every 3 days)';
  } else if (wizardData.reminderOffsets && wizardData.reminderOffsets.length > 0) {
    const reminderList = wizardData.reminderOffsets.sort((a, b) => a - b).map(offset => {
      if (offset < 0) return `${Math.abs(offset)} days before`;
      if (offset === 0) return 'On due date';
      if (offset === 3) return 'Every 3 days after';
      if (offset === 7) return 'Every 7 days after';
      return `${offset} day${offset > 1 ? 's' : ''} after`;
    });
    remindersText = 'Custom: ' + reminderList.join(', ');
  } else {
    remindersText = 'Not configured';
  }

  // Format phone number
  const phoneNumber = wizardData.phoneNumber || '';

  // USE CALCULATED VALUES FROM STEP 2
  // All amounts in summary are already in cents, dates are already formatted strings
  const interestRate = summary.annualInterestRate || 0;
  const totalInterestCents = summary.totalInterest || 0;
  const totalRepaymentCents = summary.totalRepayment || (summary.loanAmount || Math.round(wizardData.amount * 100));
  const loanAmountCents = summary.loanAmount || Math.round(wizardData.amount * 100);

  // firstDueDate and lastDueDate are already formatted strings like "1 year after loan start"
  const firstDueDateStr = summary.firstDueDate || '';
  const lastDueDateStr = summary.lastDueDate || '';

  return {
    description: wizardData.description,
    lenderName: lenderName,
    borrowerName: wizardData.friendFirstName,
    borrowerEmail: wizardData.friendEmail,
    borrowerPhone: phoneNumber,
    moneyTransferDate: moneyTransferDate,
    amount: formatCurrency2(loanAmountCents),
    repaymentType: wizardData.repaymentType === 'one_time' ? 'One-time payment' : 'Installments',
    loanDuration: durationText,
    interestRate: interestRate > 0 ? `${interestRate}% per year` : '0% (interest-free)',
    totalInterest: formatCurrency2(totalInterestCents),
    totalToRepay: formatCurrency2(totalRepaymentCents),
    numberOfInstallments: wizardData.installmentCount || wizardData.numRepayments || '',
    paymentFrequency: paymentFrequency,
    firstRepaymentDate: firstDueDateStr || '—',
    finalDueDate: lastDueDateStr || '—',
    fullRepaymentDueDate: getFullRepaymentDueDateDisplay(wizardData),
    repaymentMethods: methodsText,
    requireProof: wizardData.proofRequired ? 'Yes — Borrower must upload proof (photo, screenshot, or PDF) with each payment' : null,
    reminders: remindersText,
    worstCase: wizardData.debtCollectionClause ? 'Enabled — If borrower does not repay or propose a new plan, case may be handed to independent debt collector' : null
  };
}

/**
 * Render summary fields in exact order
 * @param {Object} wizardData - The wizard data object
 * @param {Object} currentUser - The current user object
 * @returns {string} HTML string for summary fields
 */
function renderSummaryFields(wizardData, currentUser) {
  const dataMap = buildSummaryDataMap(wizardData, currentUser);
  const order = wizardData.repaymentType === 'one_time' ? SUMMARY_ORDER_ONETIME : SUMMARY_ORDER_INSTALLMENTS;

  let html = '<div class="summary-grid">';
  let isFirstField = true;

  for (const item of order) {
    if (item.kind === 'field') {
      const value = dataMap[item.key];

      // Skip if hideIfEmpty and value is null/empty
      if (item.hideIfEmpty && (!value || value === null)) {
        continue;
      }

      // Add border to all but first field
      const borderStyle = isFirstField ? '' : 'border-top:1px solid rgba(255,255,255,0.05);';
      isFirstField = false;

      html += `<div class="summary-grid-row" style="${borderStyle}">
        <span class="summary-grid-label">${escapeHTML(item.label)}</span>
        <span class="summary-grid-value">${value ? escapeHTML(value) : '—'}</span>
      </div>`;
    } else if (item.kind === 'spacer') {
      // Render blank line as vertical spacing
      html += '<div style="height:16px"></div>';
      isFirstField = true; // Reset border for next section
    }
  }

  html += '</div>';
  return html;
}

/**
 * Get dropdown configurations from order
 * @param {string} repaymentType - 'installments' or 'one_time'
 * @returns {Array} Array of dropdown configs
 */
function getSummaryDropdowns(repaymentType) {
  const order = repaymentType === 'one_time' ? SUMMARY_ORDER_ONETIME : SUMMARY_ORDER_INSTALLMENTS;
  return order.filter(item => item.kind === 'dropdown');
}

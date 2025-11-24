/**
 * Shared repayment schedule calculation utilities
 * Used across Step 3, Step 5, Review/Invite, and Manage pages
 */

// Note: Currency formatters (formatCurrency0, formatCurrency2) are loaded from /js/formatters.js

/**
 * Convert an ISO date string or Date object to a human-readable date in "dd MMM yyyy" format.
 * @param {string|Date} dateInput - ISO date string or Date object; falsy values return '—'.
 * @returns {string} Formatted date (e.g., "5 Apr 2025") or '—' when input is falsy.
 */
function formatScheduleDate(dateInput) {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const day = date.getDate();
  const month = date.toLocaleDateString('en-GB', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Helper to add months while preserving day-of-month (or clamping to valid day).
 * @param {Date} date - Starting date
 * @param {number} months - Number of months to add
 * @returns {Date} New date with months added
 */
function addMonthsKeepingDay(date, months) {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  const targetYear = result.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  // Preserve day-of-month, clamping to valid day in target month
  const originalDay = result.getDate();
  result.setFullYear(targetYear, normalizedMonth, 1);
  const daysInTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const clampedDay = Math.min(originalDay, daysInTargetMonth);
  result.setDate(clampedDay);

  return result;
}

/**
 * Add exactly one period to a date based on frequency.
 * @param {Date|string} dateInput - Starting date (Date object or ISO string)
 * @param {string} frequency - One of: "weekly", "biweekly", "every_4_weeks", "monthly", "quarterly", "yearly"
 * @returns {Date} New date with one period added
 */
function addOnePeriod(dateInput, frequency) {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput);
  date.setHours(0, 0, 0, 0);

  switch (frequency) {
    case 'weekly':
      return new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'biweekly':
      return new Date(date.getTime() + 14 * 24 * 60 * 60 * 1000);
    case 'every_4_weeks':
      return new Date(date.getTime() + 28 * 24 * 60 * 60 * 1000);
    case 'monthly':
      return addMonthsKeepingDay(date, 1);
    case 'quarterly':
      return addMonthsKeepingDay(date, 3);
    case 'yearly':
      return addMonthsKeepingDay(date, 12);
    default:
      // Fallback to monthly if frequency unknown
      console.warn(`Unknown frequency "${frequency}", defaulting to monthly`);
      return addMonthsKeepingDay(date, 1);
  }
}

/**
 * Normalize first due date to ensure it's at least 1 period after transfer date.
 * Business rule: Never allow zero-length first period (which would yield zero interest).
 *
 * @param {Date|string} transferDate - Money transfer date (start of interest accrual)
 * @param {Date|string} firstDueDate - User-selected first due date
 * @param {string} frequency - Payment frequency
 * @returns {Date} Normalized first due date (guaranteed > transferDate by at least 1 period)
 */
function normalizeFirstDueDate(transferDate, firstDueDate, frequency) {
  const transfer = typeof transferDate === 'string' ? new Date(transferDate) : new Date(transferDate);
  const firstDue = typeof firstDueDate === 'string' ? new Date(firstDueDate) : new Date(firstDueDate);

  transfer.setHours(0, 0, 0, 0);
  firstDue.setHours(0, 0, 0, 0);

  // If first due date is on or before transfer date, shift forward by exactly 1 period
  if (firstDue <= transfer) {
    return addOnePeriod(transfer, frequency);
  }

  return firstDue;
}

/**
 * Generate payment dates based on frequency, count, first due date, and transfer date.
 * Ensures first due date is normalized (at least 1 period after transfer).
 *
 * @param {Object} params - Date generation parameters
 * @param {Date|string} params.transferDate - Money transfer date (start of interest accrual)
 * @param {Date|string} params.firstDueDate - User-selected first due date (will be normalized)
 * @param {string} params.frequency - Payment frequency
 * @param {number} params.count - Number of payments
 * @returns {Object} Object with { paymentDates: Date[], normalizedFirstDueDate: Date }
 */
function generatePaymentDates(params) {
  const { transferDate, firstDueDate, frequency, count } = params;

  // Normalize first due date to ensure minimum 1-period accrual
  const normalizedFirst = normalizeFirstDueDate(transferDate, firstDueDate, frequency);

  const paymentDates = [];
  let currentDate = new Date(normalizedFirst);

  for (let i = 0; i < count; i++) {
    paymentDates.push(new Date(currentDate));
    if (i < count - 1) {
      currentDate = addOnePeriod(currentDate, frequency);
    }
  }

  return {
    paymentDates,
    normalizedFirstDueDate: normalizedFirst
  };
}

/**
 * Constructs an equal-principal repayment schedule and computes daily interest using the actual days between payments.
 *
 * @param {Object} input - Schedule parameters.
 * @param {number} input.principalCents - Loan amount in cents.
 * @param {number} input.aprPercent - Annual interest rate as a percentage (e.g., 5 for 5%).
 * @param {number} input.count - Number of repayments.
 * @param {Array<Date|string>} input.paymentDates - Payment dates as Date objects or ISO strings, one per repayment.
 * @param {Date|string} input.startDate - Start date for interest calculation (money sent date) as a Date or ISO string.
 * @returns {Object} An object containing the repayment rows and totals in cents:
 *   - rows: Array of objects with fields `dateISO` (ISO string), `paymentCents`, `principalCents`, `interestCents`, `remainingCents`.
 *   - totalInterestCents: Total interest across all payments in cents.
 *   - totalToRepayCents: Sum of principal and total interest in cents.
 */
function buildRepaymentSchedule(input) {
  const {
    principalCents,
    aprPercent,
    count,
    paymentDates,
    startDate
  } = input;

  // Convert to working values
  const principal = principalCents / 100; // Convert cents to euros
  const annualRate = aprPercent / 100; // Convert percentage to decimal
  const dailyRate = annualRate / 365; // Daily interest rate
  const principalPerPayment = principal / count;

  let totalInterest = 0;
  const schedule = [];

  // Parse start date
  let previousDate = typeof startDate === 'string' ? new Date(startDate) : new Date(startDate);
  previousDate.setHours(0, 0, 0, 0);

  // Build schedule row by row
  for (let i = 1; i <= count; i++) {
    const outstandingBefore = principal - principalPerPayment * (i - 1);

    // Get payment date
    const paymentDate = paymentDates[i - 1];
    const currentPaymentDate = typeof paymentDate === 'string' ? new Date(paymentDate) : new Date(paymentDate);
    currentPaymentDate.setHours(0, 0, 0, 0);

    // Calculate days between payments for daily interest
    const daysBetweenPayments = Math.round((currentPaymentDate - previousDate) / (1000 * 60 * 60 * 24));

    // Calculate interest for this period based on actual days
    const interestForPeriod = outstandingBefore * dailyRate * daysBetweenPayments;
    const payment = principalPerPayment + interestForPeriod;
    const remainingAfter = outstandingBefore - principalPerPayment;

    totalInterest += interestForPeriod;

    schedule.push({
      dateISO: currentPaymentDate.toISOString(),
      paymentCents: Math.round(payment * 100), // Store as cents
      principalCents: Math.round(principalPerPayment * 100),
      interestCents: Math.round(interestForPeriod * 100),
      remainingCents: remainingAfter > 0.01 ? Math.round(remainingAfter * 100) : 0
    });

    previousDate = currentPaymentDate;
  }

  const totalInterestCents = Math.round(totalInterest * 100);
  const totalToRepayCents = principalCents + totalInterestCents;

  return {
    rows: schedule,
    totalInterestCents,
    totalToRepayCents
  };
}

/**
 * Produce an HTML grid rendering of a repayment schedule.
 * @param {Array<Object>} rows - Schedule rows as produced by buildRepaymentSchedule. Each row should contain `dateISO` (ISO date string), `paymentCents`, `principalCents`, `interestCents`, and `remainingCents` (all amounts in cents).
 * @returns {string} An HTML string containing a styled grid representing the provided schedule rows.
 */
function generateScheduleTableHTML(rows, includeOutstanding = true) {
  // Container with max-height and scroll
  let html = '<div style="margin:16px 0; max-height:400px; overflow-y:auto; border:1px solid rgba(55,65,81,0.5); border-radius:8px; background:rgba(12,16,21,1)">';

  // Grid container - adjust columns based on whether Outstanding is included
  const gridColumns = includeOutstanding
    ? 'minmax(120px,1fr) minmax(120px,1fr) minmax(100px,1fr) minmax(120px,1fr) minmax(140px,1fr)'
    : 'minmax(120px,1fr) minmax(120px,1fr) minmax(100px,1fr) minmax(120px,1fr)';
  html += `<div style="display:grid; grid-template-columns:${gridColumns}; font-size:13px">`;

  // Header row (sticky)
  html += '<div style="display:contents; position:sticky; top:0; z-index:10">';
  html += '<div style="position:sticky; top:0; background:rgba(31,41,55,0.98); backdrop-filter:blur(8px); padding:10px 12px; font-weight:600; font-size:12px; text-transform:uppercase; color:rgba(156,163,175,1); border-bottom:1px solid rgba(55,65,81,0.5)">Due date</div>';
  html += '<div style="position:sticky; top:0; background:rgba(31,41,55,0.98); backdrop-filter:blur(8px); padding:10px 12px; font-weight:600; font-size:12px; text-transform:uppercase; color:rgba(156,163,175,1); border-bottom:1px solid rgba(55,65,81,0.5); text-align:right">Repayment (excl. interest)</div>';
  html += '<div style="position:sticky; top:0; background:rgba(31,41,55,0.98); backdrop-filter:blur(8px); padding:10px 12px; font-weight:600; font-size:12px; text-transform:uppercase; color:rgba(156,163,175,1); border-bottom:1px solid rgba(55,65,81,0.5); text-align:right">Interest</div>';
  html += '<div style="position:sticky; top:0; background:rgba(31,41,55,0.98); backdrop-filter:blur(8px); padding:10px 12px; font-weight:600; font-size:12px; text-transform:uppercase; color:rgba(156,163,175,1); border-bottom:1px solid rgba(55,65,81,0.5); text-align:right">Payment total</div>';
  if (includeOutstanding) {
    html += '<div style="position:sticky; top:0; background:rgba(31,41,55,0.98); backdrop-filter:blur(8px); padding:10px 12px; font-weight:600; font-size:12px; text-transform:uppercase; color:rgba(156,163,175,1); border-bottom:1px solid rgba(55,65,81,0.5); text-align:right">Balance</div>';
  }
  html += '</div>';

  // Data rows
  rows.forEach((row, index) => {
    const rowBg = index % 2 === 0 ? 'rgba(12,16,21,1)' : 'rgba(10,13,17,1)';

    // Row wrapper
    html += '<div style="display:contents">';
    html += `<div style="padding:10px 12px; background:${rowBg}; border-bottom:1px solid rgba(255,255,255,0.04); white-space:nowrap; color:rgba(156,163,175,1)">${formatScheduleDate(row.dateISO)}</div>`;
    html += `<div style="padding:10px 12px; background:${rowBg}; border-bottom:1px solid rgba(255,255,255,0.04); text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap">${formatCurrency2(row.principalCents)}</div>`;
    html += `<div style="padding:10px 12px; background:${rowBg}; border-bottom:1px solid rgba(255,255,255,0.04); text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap">${formatCurrency2(row.interestCents)}</div>`;
    html += `<div style="padding:10px 12px; background:${rowBg}; border-bottom:1px solid rgba(255,255,255,0.04); text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; font-weight:600">${formatCurrency2(row.paymentCents)}</div>`;
    if (includeOutstanding) {
      html += `<div style="padding:10px 12px; background:${rowBg}; border-bottom:1px solid rgba(255,255,255,0.04); text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap">${formatCurrency2(row.remainingCents)}</div>`;
    }
    html += '</div>';
  });

  html += '</div>'; // Close grid container
  html += '</div>'; // Close scroll container

  return html;
}

/**
 * Produce HTML for a repayment schedule accordion including a lead-in summary and the schedule table.
 * @param {Object} params - Parameters for schedule generation.
 * @param {number} params.principalCents - Loan amount in cents.
 * @param {number} params.aprPercent - Annual interest rate as a percent (e.g., 5 for 5%).
 * @param {number} params.count - Number of repayments.
 * @param {Array<Date|string>} params.paymentDates - Array of payment dates (Date objects or ISO strings).
 * @param {Date|string} params.startDate - Start date for interest calculation (Date or ISO string).
 * @param {boolean} [params.includeOutstanding=true] - Whether to include the Outstanding/Balance column in the table.
 * @returns {string} HTML string containing the lead-in summary sentence and the schedule table.
 */
function generateScheduleAccordionHTML(params) {
  const { principalCents, aprPercent, count, paymentDates, startDate, includeOutstanding = true } = params;

  // Build schedule
  const schedule = buildRepaymentSchedule({
    principalCents,
    aprPercent,
    count,
    paymentDates,
    startDate
  });

  // Format totals for display (no decimals for summary, nl-NL locale)
  const totalInterestDisplay = formatCurrency0(schedule.totalInterestCents);
  const totalToRepayDisplay = formatCurrency0(schedule.totalToRepayCents);

  // Build lead-in sentence
  const countText = count === 1 ? '1 repayment' : `${count} repayments`;
  const leadInSentence = `At ${aprPercent}% interest per year over ${countText}, total interest is about ${totalInterestDisplay} and total to repay is ${totalToRepayDisplay}.`;

  // Build complete HTML
  let html = `<p style="margin:0 0 16px 0; font-size:14px; color:#a7b0bd; line-height:1.5">${leadInSentence}</p>`;
  html += generateScheduleTableHTML(schedule.rows, includeOutstanding);

  return html;
}

// Export functions for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatScheduleDate,
    addMonthsKeepingDay,
    addOnePeriod,
    normalizeFirstDueDate,
    generatePaymentDates,
    buildRepaymentSchedule,
    generateScheduleTableHTML,
    generateScheduleAccordionHTML
  };
}

// Export for browser use (attach to window)
if (typeof window !== 'undefined') {
  window.formatScheduleDate = formatScheduleDate;
  window.addMonthsKeepingDay = addMonthsKeepingDay;
  window.addOnePeriod = addOnePeriod;
  window.normalizeFirstDueDate = normalizeFirstDueDate;
  window.generatePaymentDates = generatePaymentDates;
  window.buildRepaymentSchedule = buildRepaymentSchedule;
  window.generateScheduleTableHTML = generateScheduleTableHTML;
  window.generateScheduleAccordionHTML = generateScheduleAccordionHTML;
}
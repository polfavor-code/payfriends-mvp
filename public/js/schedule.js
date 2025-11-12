/**
 * Shared repayment schedule calculation utilities
 * Used across Step 3, Step 5, Review/Invite, and Manage pages
 */

/**
 * Formats a numeric amount as EUR currency using the nl-NL locale with exactly two fraction digits.
 * @param {number} amount - Amount in euros; if `null` or `undefined`, it is treated as 0.
 * @returns {string} The formatted currency string (EUR, nl-NL) with two decimal places.
 */
function formatCurrency2(amount) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount ?? 0);
}

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
 * Produce an HTML table rendering of a repayment schedule.
 * @param {Array<Object>} rows - Schedule rows as produced by buildRepaymentSchedule. Each row should contain `dateISO` (ISO date string), `paymentCents`, `principalCents`, `interestCents`, and `remainingCents` (all amounts in cents).
 * @returns {string} An HTML string containing a styled table representing the provided schedule rows.
 */
function generateScheduleTableHTML(rows) {
  let html = '<div style="overflow-x:auto; border:1px solid rgba(55,65,81,1); border-radius:8px">';
  html += '<table style="width:100%; font-size:13px; border-collapse:collapse">';

  // Table header
  html += '<thead>';
  html += '<tr style="background:rgba(31,41,55,1); color:rgba(156,163,175,1)">';
  html += '<th style="text-align:left; padding:10px 8px; font-weight:600; border-bottom:1px solid rgba(55,65,81,0.5)">Due date</th>';
  html += '<th style="text-align:right; padding:10px 8px; font-weight:600; border-bottom:1px solid rgba(55,65,81,0.5)">Payment total</th>';
  html += '<th style="text-align:right; padding:10px 8px; font-weight:600; border-bottom:1px solid rgba(55,65,81,0.5)">Loan repayment</th>';
  html += '<th style="text-align:right; padding:10px 8px; font-weight:600; border-bottom:1px solid rgba(55,65,81,0.5)">Interest</th>';
  html += '<th style="text-align:right; padding:10px 8px; font-weight:600; border-bottom:1px solid rgba(55,65,81,0.5)">Outstanding</th>';
  html += '</tr>';
  html += '</thead>';

  // Table body
  html += '<tbody>';
  rows.forEach((row, index) => {
    const rowStyle = index % 2 === 0 ? 'background:rgba(12,16,21,1)' : 'background:rgba(10,13,17,1)';
    html += `<tr style="${rowStyle}">`;
    html += `<td style="padding:10px 8px; border-bottom:1px solid rgba(255,255,255,0.04)">${formatScheduleDate(row.dateISO)}</td>`;
    html += `<td style="text-align:right; padding:10px 8px; font-weight:600; border-bottom:1px solid rgba(255,255,255,0.04)">${formatCurrency2(row.paymentCents / 100)}</td>`;
    html += `<td style="text-align:right; padding:10px 8px; border-bottom:1px solid rgba(255,255,255,0.04)">${formatCurrency2(row.principalCents / 100)}</td>`;
    html += `<td style="text-align:right; padding:10px 8px; border-bottom:1px solid rgba(255,255,255,0.04)">${formatCurrency2(row.interestCents / 100)}</td>`;
    html += `<td style="text-align:right; padding:10px 8px; border-bottom:1px solid rgba(255,255,255,0.04)">${formatCurrency2(row.remainingCents / 100)}</td>`;
    html += '</tr>';
  });
  html += '</tbody>';

  html += '</table>';
  html += '</div>';

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
 * @returns {string} HTML string containing the lead-in summary sentence and the schedule table.
 */
function generateScheduleAccordionHTML(params) {
  const { principalCents, aprPercent, count, paymentDates, startDate } = params;

  // Build schedule
  const schedule = buildRepaymentSchedule({
    principalCents,
    aprPercent,
    count,
    paymentDates,
    startDate
  });

  // Format totals for display (no decimals for summary)
  const totalInterestDisplay = new Intl.NumberFormat('de-DE').format(Math.round(schedule.totalInterestCents / 100));
  const totalToRepayDisplay = new Intl.NumberFormat('de-DE').format(Math.round(schedule.totalToRepayCents / 100));

  // Build lead-in sentence
  const countText = count === 1 ? '1 repayment' : `${count} repayments`;
  const leadInSentence = `At ${aprPercent}% interest per year over ${countText}, total interest is about €${totalInterestDisplay} and total to repay is €${totalToRepayDisplay}.`;

  // Build complete HTML
  let html = `<p style="margin:0 0 16px 0; font-size:14px; color:#a7b0bd; line-height:1.5">${leadInSentence}</p>`;
  html += generateScheduleTableHTML(schedule.rows);

  return html;
}

// Export functions for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatCurrency2,
    formatScheduleDate,
    buildRepaymentSchedule,
    generateScheduleTableHTML,
    generateScheduleAccordionHTML
  };
}
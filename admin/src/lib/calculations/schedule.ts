/**
 * Shared repayment schedule calculation utilities
 * Used across Step 3, Step 5, Review/Invite, and Manage pages
 * 
 * COPIED FROM: public/js/schedule.js
 * This is the SOURCE OF TRUTH for loan calculations
 */

/**
 * Convert an ISO date string or Date object to a human-readable date in "dd MMM yyyy" format.
 * @param dateInput - ISO date string or Date object; falsy values return '—'.
 * @returns Formatted date (e.g., "5 Apr 2025") or '—' when input is falsy.
 */
export function formatScheduleDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const day = date.getDate();
  const month = date.toLocaleDateString('en-GB', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Helper to add months while preserving day-of-month (or clamping to valid day).
 * @param date - Starting date
 * @param months - Number of months to add
 * @returns New date with months added
 */
export function addMonthsKeepingDay(date: Date, months: number): Date {
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
 * @param dateInput - Starting date (Date object or ISO string)
 * @param frequency - One of: "weekly", "biweekly", "every_4_weeks", "monthly", "quarterly", "yearly"
 * @returns New date with one period added
 */
export function addOnePeriod(dateInput: Date | string, frequency: string): Date {
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
    case 'every-month':  // Support both formats (same day of month)
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
 * @param transferDate - Money transfer date (start of interest accrual)
 * @param firstDueDate - User-selected first due date
 * @param frequency - Payment frequency
 * @returns Normalized first due date (guaranteed > transferDate by at least 1 period)
 */
export function normalizeFirstDueDate(
  transferDate: Date | string,
  firstDueDate: Date | string,
  frequency: string
): Date {
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

export interface GeneratePaymentDatesParams {
  transferDate: Date | string;
  firstDueDate: Date | string;
  frequency: string;
  count: number;
}

export interface GeneratePaymentDatesResult {
  paymentDates: Date[];
  normalizedFirstDueDate: Date;
}

/**
 * Generate payment dates based on frequency, count, first due date, and transfer date.
 * Ensures first due date is normalized (at least 1 period after transfer).
 */
export function generatePaymentDates(params: GeneratePaymentDatesParams): GeneratePaymentDatesResult {
  const { transferDate, firstDueDate, frequency, count } = params;

  // Normalize first due date to ensure minimum 1-period accrual
  const normalizedFirst = normalizeFirstDueDate(transferDate, firstDueDate, frequency);

  const paymentDates: Date[] = [];
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

export interface BuildRepaymentScheduleInput {
  principalCents: number;
  aprPercent: number;
  count: number;
  paymentDates: (Date | string)[];
  startDate: Date | string;
}

export interface RepaymentScheduleRow {
  dateISO: string;
  paymentCents: number;
  principalCents: number;
  interestCents: number;
  remainingCents: number;
}

export interface BuildRepaymentScheduleResult {
  rows: RepaymentScheduleRow[];
  totalInterestCents: number;
  totalToRepayCents: number;
}

/**
 * Constructs an equal-principal repayment schedule and computes daily interest using the actual days between payments.
 */
export function buildRepaymentSchedule(input: BuildRepaymentScheduleInput): BuildRepaymentScheduleResult {
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
  const schedule: RepaymentScheduleRow[] = [];

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
    const daysBetweenPayments = Math.round((currentPaymentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24));

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

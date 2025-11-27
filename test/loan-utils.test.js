/**
 * Unit tests for loan-utils.js - unified loan calculation utilities
 * Run with: node test/loan-utils.test.js
 */

const assert = require('assert');

// Mock schedule.js functions that loan-utils depends on
const mockSchedule = {
  buildRepaymentSchedule: ({ principalCents, aprPercent, count, paymentDates, startDate }) => {
    // Simple mock for testing - calculates simple interest
    // For a one-time payment, just calculate total interest based on days
    if (count === 1 && paymentDates.length === 1) {
      const dueDate = paymentDates[0];
      const daysDiff = Math.round((dueDate - startDate) / (1000 * 60 * 60 * 24));
      const yearFraction = daysDiff / 365;
      const totalInterestCents = Math.round(principalCents * (aprPercent / 100) * yearFraction);
      const totalToRepayCents = principalCents + totalInterestCents;

      return {
        totalInterestCents,
        totalToRepayCents,
        rows: [{
          index: 1,
          dateISO: dueDate.toISOString().split('T')[0],
          principalCents: principalCents,
          interestCents: totalInterestCents,
          paymentCents: totalToRepayCents,
          remainingBalanceCents: 0
        }]
      };
    }

    // For other cases, return basic structure
    return {
      totalInterestCents: 0,
      totalToRepayCents: principalCents,
      rows: []
    };
  },

  generatePaymentDates: ({ transferDate, firstDueDate, frequency, count }) => {
    return { paymentDates: [firstDueDate] };
  }
};

// Inject mocks into global scope
global.buildRepaymentSchedule = mockSchedule.buildRepaymentSchedule;
global.generatePaymentDates = mockSchedule.generatePaymentDates;

// Mock currency formatters for Node.js environment
global.formatCurrency0 = (cents) => {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100);
};

global.formatCurrency2 = (cents) => {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
};

global.formatFinancialDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Now require loan-utils
const {
  computeLoanTotals,
  getDaysLeft,
  getNextPayment,
  getOutstandingAndTotal
} = require('../public/js/loan-utils.js');

console.log('Running loan-utils.js unit tests...\n');

// Test 1: computeLoanTotals for 6000 EUR at 5% over 1 year (one-time payment)
console.log('Test 1: computeLoanTotals for 6000 EUR at 5% over 1 year');
{
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const oneYearFromNow = new Date(today);
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  const agreement = {
    amount_cents: 600000, // €6000
    interest_rate: 5,
    repayment_type: 'one_time',
    due_date: oneYearFromNow.toISOString().split('T')[0],
    money_sent_date: today.toISOString().split('T')[0]
  };

  const totals = computeLoanTotals(agreement);

  // Expected: 5% of 6000 = 300, so total = 6300
  // Allow for small rounding differences (within 1 euro = 100 cents)
  const expectedInterest = 30000; // €300
  const expectedTotal = 630000; // €6300

  const interestDiff = Math.abs(totals.totalInterestCents - expectedInterest);
  const totalDiff = Math.abs(totals.totalToRepayCents - expectedTotal);

  assert.ok(interestDiff <= 100, `Total interest should be ~€300, got ${formatCurrency2(totals.totalInterestCents)}`);
  assert.ok(totalDiff <= 100, `Total to repay should be ~€6300, got ${formatCurrency2(totals.totalToRepayCents)}`);

  console.log('✓ Total interest:', formatCurrency2(totals.totalInterestCents));
  console.log('✓ Total to repay:', formatCurrency2(totals.totalToRepayCents));
}

// Test 2: getDaysLeft calculation
console.log('\nTest 2: getDaysLeft calculation');
{
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const in365Days = new Date(today);
  in365Days.setDate(in365Days.getDate() + 365);

  assert.strictEqual(getDaysLeft(today, today), 0, 'Today should be 0 days left');
  assert.strictEqual(getDaysLeft(tomorrow, today), 1, 'Tomorrow should be 1 day left');
  assert.strictEqual(getDaysLeft(yesterday, today), -1, 'Yesterday should be -1 days (overdue)');
  assert.strictEqual(getDaysLeft(in365Days, today), 365, '365 days from now should be 365 days left');

  console.log('✓ getDaysLeft works correctly');
}

// Test 3: getOutstandingAndTotal
console.log('\nTest 3: getOutstandingAndTotal');
{
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const oneYearFromNow = new Date(today);
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  const agreement = {
    amount_cents: 600000, // €6000 principal
    interest_rate: 5,
    repayment_type: 'one_time',
    due_date: oneYearFromNow.toISOString().split('T')[0],
    money_sent_date: today.toISOString().split('T')[0],
    total_paid_cents: 0
  };

  const result = getOutstandingAndTotal(agreement);

  // Outstanding should be the principal (6000)
  assert.strictEqual(result.outstandingCents, 600000, 'Outstanding should equal principal when nothing paid');

  // Total to repay should be principal + interest (~6300)
  const totalDiff = Math.abs(result.totalToRepayCents - 630000);
  assert.ok(totalDiff <= 100, `Total to repay should be ~€6300, got ${formatCurrency2(result.totalToRepayCents)}`);

  console.log('✓ Outstanding:', formatCurrency0(result.outstandingCents));
  console.log('✓ Total to repay:', formatCurrency0(result.totalToRepayCents));
}

// Test 4: getNextPayment for one-time active loan
console.log('\nTest 4: getNextPayment for one-time active loan');
{
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const oneYearFromNow = new Date(today);
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  const agreement = {
    amount_cents: 600000,
    interest_rate: 5,
    repayment_type: 'one_time',
    due_date: oneYearFromNow.toISOString().split('T')[0],
    money_sent_date: today.toISOString().split('T')[0],
    status: 'active',
    total_paid_cents: 0
  };

  const nextPayment = getNextPayment(agreement);

  assert.ok(nextPayment !== null, 'Should return next payment info');
  assert.ok(nextPayment.amountCents > 0, 'Amount should be positive');
  assert.strictEqual(nextPayment.dueDate, oneYearFromNow.toISOString().split('T')[0], 'Due date should match');

  // Days left should be ~365 (allowing for leap years and calculation differences)
  assert.ok(Math.abs(nextPayment.daysLeft - 365) <= 1, `Days left should be ~365, got ${nextPayment.daysLeft}`);

  console.log('✓ Next payment amount:', formatCurrency0(nextPayment.amountCents));
  console.log('✓ Due date:', nextPayment.dueDate);
  console.log('✓ Days left:', nextPayment.daysLeft);
}

// Test 5: No interest case
console.log('\nTest 5: Zero interest loan');
{
  const agreement = {
    amount_cents: 600000,
    interest_rate: 0,
    repayment_type: 'one_time'
  };

  const totals = computeLoanTotals(agreement);

  assert.strictEqual(totals.totalInterestCents, 0, 'Interest should be 0');
  assert.strictEqual(totals.totalToRepayCents, 600000, 'Total should equal principal');

  console.log('✓ Zero interest works correctly');
}

console.log('\n✅ All loan-utils tests passed!');

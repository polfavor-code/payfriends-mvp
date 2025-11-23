/**
 * Unit tests for getNextInstallmentStatus() - validates installment status logic
 * Run with: node test/installment-status.test.js
 */

const assert = require('assert');

// Mock the required functions from schedule.js
const {
  generatePaymentDates,
  buildRepaymentSchedule
} = require('../public/js/schedule.js');

// Make them globally available for derived-fields.js
global.generatePaymentDates = generatePaymentDates;
global.buildRepaymentSchedule = buildRepaymentSchedule;

// Mock currency formatters for Node.js environment
global.formatCurrency0 = (cents) => {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100);
};
global.formatCurrency2 = (cents) => {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
};

// Load the function to test
const { getNextInstallmentStatus } = require('../public/js/derived-fields.js');

console.log('Running getNextInstallmentStatus() unit tests...\n');

// Test 1: Upcoming installment - due in 10 days
console.log('Test 1: Upcoming installment - due in 10 days');
{
  const now = new Date('2025-01-21T12:00:00Z');
  const dueDate = new Date('2025-01-31T00:00:00Z');

  const agreement = {
    status: 'active',
    repayment_type: 'installments',
    amount_cents: 400000,           // Principal: €4,000.00
    total_paid_cents: 0,
    interest_rate: 5,
    installment_count: 6,
    money_sent_date: '2025-01-01',
    first_payment_date: '2025-01-31',
    payment_frequency: 'monthly'
  };

  const result = getNextInstallmentStatus({ agreement, now });

  assert.strictEqual(result.status, 'upcoming', 'Status should be upcoming');
  assert.ok(result.amountDue > 0, 'Amount due should be > 0');
  assert.strictEqual(result.dueDate, '2025-01-31', 'Due date should be 2025-01-31');
  assert.strictEqual(result.daysUntilDue, 10, 'Should be 10 days until due');
  assert.strictEqual(result.daysOverdue, undefined, 'daysOverdue should not be set');

  console.log(`✓ Status: ${result.status}, Amount: ${formatCurrency2(result.amountDue)}, Due in: ${result.daysUntilDue} days`);
}

// Test 2: Partial payment before due date
console.log('\nTest 2: Partial payment before due date');
{
  const now = new Date('2025-01-21T12:00:00Z');

  const agreement = {
    status: 'active',
    repayment_type: 'installments',
    amount_cents: 400000,
    total_paid_cents: 10000,        // Paid €100.00 (partial, not enough for first installment)
    interest_rate: 5,
    installment_count: 6,
    money_sent_date: '2025-01-01',
    first_payment_date: '2025-01-31',
    payment_frequency: 'monthly'
  };

  const result = getNextInstallmentStatus({ agreement, now });

  assert.strictEqual(result.status, 'upcoming', 'Status should still be upcoming');
  assert.ok(result.amountDue > 0, 'Amount due should still show full installment amount');
  // The amount should still be the first installment since partial payment hasn't covered it
  assert.ok(result.amountDue > 50000, 'Amount should still be around first installment (~€692)');
  assert.strictEqual(result.daysUntilDue, 10, 'Should still be 10 days until due');

  console.log(`✓ Status: ${result.status}, Amount: ${formatCurrency2(result.amountDue)} (partial payment doesn't advance schedule)`);
}

// Test 3: Overdue installment - 3 days overdue
console.log('\nTest 3: Overdue installment - 3 days overdue');
{
  const now = new Date('2025-02-03T12:00:00Z');

  const agreement = {
    status: 'active',
    repayment_type: 'installments',
    amount_cents: 400000,
    total_paid_cents: 0,            // No payments yet
    interest_rate: 5,
    installment_count: 6,
    money_sent_date: '2025-01-01',
    first_payment_date: '2025-01-31',
    payment_frequency: 'monthly'
  };

  const result = getNextInstallmentStatus({ agreement, now });

  assert.strictEqual(result.status, 'overdue', 'Status should be overdue');
  assert.ok(result.amountDue > 0, 'Amount due should be > 0');
  assert.strictEqual(result.dueDate, '2025-01-31', 'Due date should still be 2025-01-31');
  assert.strictEqual(result.daysOverdue, 3, 'Should be 3 days overdue');
  assert.strictEqual(result.daysUntilDue, undefined, 'daysUntilDue should not be set');

  console.log(`✓ Status: ${result.status}, Amount: ${formatCurrency2(result.amountDue)}, Overdue by: ${result.daysOverdue} days`);
}

// Test 4: Overpayment with recalculation
console.log('\nTest 4: Overpayment - schedule should advance to next installment');
{
  const now = new Date('2025-02-15T12:00:00Z');

  // Borrower paid more than first installment (overpayment scenario)
  // This tests that the fairness engine correctly moves to the next installment
  const agreement = {
    status: 'active',
    repayment_type: 'installments',
    amount_cents: 400000,
    total_paid_cents: 100000,       // Paid €1,000.00 (more than first installment of ~€692)
    interest_rate: 5,
    installment_count: 6,
    money_sent_date: '2025-01-01',
    first_payment_date: '2025-01-31',
    payment_frequency: 'monthly'
  };

  const result = getNextInstallmentStatus({ agreement, now });

  assert.strictEqual(result.status, 'upcoming', 'Status should be upcoming');
  assert.ok(result.amountDue > 0, 'Amount due should be > 0');
  // After overpayment, should show second installment (due Feb 28, since Jan 31 + 1 month = Feb 28)
  assert.strictEqual(result.dueDate, '2025-02-28', 'Due date should advance to second installment');
  assert.ok(result.nextPaymentInfo.row_index > 0, 'Should be on second or later installment');

  console.log(`✓ Status: ${result.status}, Amount: ${formatCurrency2(result.amountDue)}, New due date: ${result.dueDate} (schedule advanced)`);
}

// Test 5: Fully repaid loan
console.log('\nTest 5: Fully repaid loan');
{
  const now = new Date('2025-08-01T12:00:00Z');

  const agreement = {
    status: 'active',
    repayment_type: 'installments',
    amount_cents: 400000,
    total_paid_cents: 450000,       // Paid more than total (overpaid)
    interest_rate: 5,
    installment_count: 6,
    money_sent_date: '2025-01-01',
    first_payment_date: '2025-01-31',
    payment_frequency: 'monthly'
  };

  const result = getNextInstallmentStatus({ agreement, now });

  assert.strictEqual(result.status, 'paidOff', 'Status should be paidOff');
  assert.strictEqual(result.amountDue, null, 'Amount due should be null');
  assert.strictEqual(result.dueDate, null, 'Due date should be null');

  console.log(`✓ Status: ${result.status} (loan fully repaid)`);
}

// Test 6: Due today (0 days until due)
console.log('\nTest 6: Due today - 0 days until due');
{
  const now = new Date('2025-01-31T12:00:00Z');

  const agreement = {
    status: 'active',
    repayment_type: 'installments',
    amount_cents: 400000,
    total_paid_cents: 0,
    interest_rate: 5,
    installment_count: 6,
    money_sent_date: '2025-01-01',
    first_payment_date: '2025-01-31',
    payment_frequency: 'monthly'
  };

  const result = getNextInstallmentStatus({ agreement, now });

  assert.strictEqual(result.status, 'upcoming', 'Status should be upcoming (not overdue yet)');
  assert.strictEqual(result.daysUntilDue, 0, 'Should be 0 days until due (today)');

  console.log(`✓ Status: ${result.status}, Due: today (${result.daysUntilDue} days)`);
}

// Test 7: One-time loan should return 'none'
console.log('\nTest 7: One-time loan returns status "none"');
{
  const now = new Date('2025-01-15T12:00:00Z');

  const agreement = {
    status: 'active',
    repayment_type: 'one_time',
    amount_cents: 300000,
    total_paid_cents: 0,
    due_date: '2025-12-31'
  };

  const result = getNextInstallmentStatus({ agreement, now });

  assert.strictEqual(result.status, 'none', 'Status should be none for one-time loans');
  assert.strictEqual(result.amountDue, null, 'Amount due should be null');
  assert.strictEqual(result.dueDate, null, 'Due date should be null');

  console.log(`✓ Status: ${result.status} (one-time loans not supported by this helper)`);
}

// Test 8: Inactive agreement should return 'none'
console.log('\nTest 8: Inactive agreement returns status "none"');
{
  const now = new Date('2025-01-15T12:00:00Z');

  const agreement = {
    status: 'settled',
    repayment_type: 'installments',
    amount_cents: 400000,
    total_paid_cents: 400000,
    interest_rate: 5,
    installment_count: 6,
    money_sent_date: '2025-01-01',
    first_payment_date: '2025-01-31',
    payment_frequency: 'monthly'
  };

  const result = getNextInstallmentStatus({ agreement, now });

  assert.strictEqual(result.status, 'none', 'Status should be none for inactive agreements');

  console.log(`✓ Status: ${result.status} (agreement not active)`);
}

// Test 9: Null agreement should return 'none'
console.log('\nTest 9: Null agreement returns status "none"');
{
  const result = getNextInstallmentStatus({ agreement: null });

  assert.strictEqual(result.status, 'none', 'Status should be none for null agreement');

  console.log(`✓ Status: ${result.status} (null agreement)`);
}

// Test 10: Multiple payments covering multiple installments
console.log('\nTest 10: Multiple payments - currently on 3rd installment');
{
  const now = new Date('2025-03-15T12:00:00Z'); // Set to March 15, before 3rd installment is due

  const agreement = {
    status: 'active',
    repayment_type: 'installments',
    amount_cents: 400000,
    total_paid_cents: 140000,       // Paid ~€1,400 (about 2 installments worth)
    interest_rate: 5,
    installment_count: 6,
    money_sent_date: '2025-01-01',
    first_payment_date: '2025-01-31',
    payment_frequency: 'monthly'
  };

  const result = getNextInstallmentStatus({ agreement, now });

  assert.strictEqual(result.status, 'upcoming', 'Status should be upcoming');
  assert.ok(result.nextPaymentInfo.row_index >= 2, 'Should be on 3rd or later installment');
  // Third installment: Feb 28 + 1 month = Mar 28 (preserves day of month)
  assert.strictEqual(result.dueDate, '2025-03-28', 'Due date should be March 28');

  console.log(`✓ Status: ${result.status}, Installment #${result.nextPaymentInfo.row_index + 1}, Due: ${result.dueDate}`);
}

console.log('\n✓ All tests passed!\n');
console.log('Summary:');
console.log('- Upcoming installments: ✓ Correctly calculates days until due');
console.log('- Overdue installments: ✓ Correctly calculates days overdue');
console.log('- Partial payments: ✓ Keeps showing same installment until fully paid');
console.log('- Overpayments: ✓ Advances schedule to next installment');
console.log('- Fully repaid: ✓ Returns paidOff status');
console.log('- Edge cases: ✓ Handles one-time loans, inactive agreements, and null\n');

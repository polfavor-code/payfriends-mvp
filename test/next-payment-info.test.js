/**
 * Unit tests for getNextPaymentInfo() - validates one-time vs installment payment calculations
 * Run with: node test/next-payment-info.test.js
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
const { getNextPaymentInfo } = require('../public/js/derived-fields.js');

console.log('Running getNextPaymentInfo() unit tests...\n');

// Test 1: One-time repayment - amount should include interest
console.log('Test 1: One-time repayment - amount includes interest');
{
  const agreement = {
    status: 'active',
    repayment_type: 'one_time',
    amount_cents: 300000,           // Principal: €3,000.00
    total_repay_amount: 3210.00,    // Total with interest: €3,210.00
    total_paid_cents: 0,            // No payments yet
    due_date: '2025-12-31',
    interest_rate: 7
  };

  const result = getNextPaymentInfo(agreement);

  assert.ok(result !== null, 'Should return payment info');
  assert.strictEqual(result.amount_cents, 321000, 'Amount should be €3,210.00 (principal + interest)');
  assert.strictEqual(result.due_date, '2025-12-31', 'Due date should match agreement due_date');
  assert.strictEqual(result.schedule_row, null, 'One-time should not have schedule_row');

  console.log(`✓ One-time payment amount: ${formatCurrency2(result.amount_cents)} (includes interest)`);
}

// Test 2: One-time repayment - without interest (total_repay_amount not set)
console.log('\nTest 2: One-time repayment - no interest');
{
  const agreement = {
    status: 'active',
    repayment_type: 'one_time',
    amount_cents: 300000,           // Principal: €3,000.00
    total_repay_amount: null,       // No interest
    total_paid_cents: 0,
    due_date: '2025-12-31',
    interest_rate: 0
  };

  const result = getNextPaymentInfo(agreement);

  assert.ok(result !== null, 'Should return payment info');
  assert.strictEqual(result.amount_cents, 300000, 'Amount should be €3,000.00 (principal only)');
  assert.strictEqual(result.due_date, '2025-12-31', 'Due date should match agreement due_date');

  console.log(`✓ One-time payment (no interest): ${formatCurrency2(result.amount_cents)}`);
}

// Test 3: One-time repayment - partial payment made
console.log('\nTest 3: One-time repayment - partial payment');
{
  const agreement = {
    status: 'active',
    repayment_type: 'one_time',
    amount_cents: 300000,           // Principal: €3,000.00
    total_repay_amount: 3210.00,    // Total with interest: €3,210.00
    total_paid_cents: 100000,       // Paid €1,000.00
    due_date: '2025-12-31',
    interest_rate: 7
  };

  const result = getNextPaymentInfo(agreement);

  assert.ok(result !== null, 'Should return payment info');
  assert.strictEqual(result.amount_cents, 221000, 'Amount should be €2,210.00 (remaining with interest)');

  console.log(`✓ One-time payment (partial): ${formatCurrency2(result.amount_cents)} remaining`);
}

// Test 4: One-time repayment - fully paid
console.log('\nTest 4: One-time repayment - fully paid');
{
  const agreement = {
    status: 'active',
    repayment_type: 'one_time',
    amount_cents: 300000,
    total_repay_amount: 3210.00,
    total_paid_cents: 321000,       // Fully paid
    due_date: '2025-12-31',
    interest_rate: 7
  };

  const result = getNextPaymentInfo(agreement);

  assert.strictEqual(result, null, 'Should return null when fully paid');

  console.log('✓ One-time payment (fully paid): returns null');
}

// Test 5: Installment repayment - should use amortization schedule
console.log('\nTest 5: Installment repayment - uses schedule');
{
  const agreement = {
    status: 'active',
    repayment_type: 'installments',
    amount_cents: 400000,           // Principal: €4,000.00
    total_paid_cents: 0,
    interest_rate: 5,
    installment_count: 6,
    money_sent_date: '2025-01-01',
    first_payment_date: '2025-02-01',
    payment_frequency: 'monthly'
  };

  const result = getNextPaymentInfo(agreement);

  assert.ok(result !== null, 'Should return payment info');
  assert.ok(result.amount_cents > 0, 'Amount should be > 0');
  assert.ok(result.schedule_row !== null, 'Installment should have schedule_row');
  assert.strictEqual(result.row_index, 0, 'First payment should have row_index 0');

  // For 6 monthly installments of €4,000 at 5%, each payment should be around €692
  const expectedRange = { min: 680 * 100, max: 710 * 100 }; // €680 - €710
  assert.ok(
    result.amount_cents >= expectedRange.min && result.amount_cents <= expectedRange.max,
    `Installment amount should be in range €680-€710, got ${formatCurrency2(result.amount_cents)}`
  );

  console.log(`✓ Installment payment (first): ${formatCurrency2(result.amount_cents)}`);
}

// Test 6: Installment repayment - after first payment
console.log('\nTest 6: Installment repayment - second payment');
{
  const agreement = {
    status: 'active',
    repayment_type: 'installments',
    amount_cents: 400000,
    total_paid_cents: 69200,        // Paid first installment (~€692)
    interest_rate: 5,
    installment_count: 6,
    money_sent_date: '2025-01-01',
    first_payment_date: '2025-02-01',
    payment_frequency: 'monthly'
  };

  const result = getNextPaymentInfo(agreement);

  assert.ok(result !== null, 'Should return payment info');
  assert.strictEqual(result.row_index, 1, 'Should be second payment (row_index 1)');

  console.log(`✓ Installment payment (second): ${formatCurrency2(result.amount_cents)}`);
}

// Test 7: Inactive agreement should return null
console.log('\nTest 7: Inactive agreement returns null');
{
  const agreement = {
    status: 'completed',
    repayment_type: 'one_time',
    amount_cents: 300000,
    total_repay_amount: 3210.00,
    total_paid_cents: 0,
    due_date: '2025-12-31'
  };

  const result = getNextPaymentInfo(agreement);

  assert.strictEqual(result, null, 'Should return null for inactive agreement');

  console.log('✓ Inactive agreement: returns null');
}

// Test 8: Null agreement should return null
console.log('\nTest 8: Null agreement returns null');
{
  const result = getNextPaymentInfo(null);

  assert.strictEqual(result, null, 'Should return null for null agreement');

  console.log('✓ Null agreement: returns null');
}

console.log('\n✓ All tests passed!\n');
console.log('Summary:');
console.log('- One-time repayment: ✓ Correctly uses total_repay_amount (principal + interest)');
console.log('- Installment repayment: ✓ Correctly uses amortization schedule');
console.log('- Edge cases: ✓ Handles partial payments, fully paid, inactive, and null\n');

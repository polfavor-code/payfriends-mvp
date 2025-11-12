/**
 * Unit tests for schedule.js - repayment schedule calculation utilities
 * Run with: node test/schedule.test.js
 */

const assert = require('assert');
const {
  addMonthsKeepingDay,
  addOnePeriod,
  normalizeFirstDueDate,
  generatePaymentDates,
  buildRepaymentSchedule
} = require('../public/js/schedule.js');

// Mock currency formatters for Node.js environment
global.formatCurrency0 = (cents) => {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100);
};
global.formatCurrency2 = (cents) => {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
};

console.log('Running schedule.js unit tests...\n');

// Test 1: normalizeFirstDueDate - same date should shift forward by 1 period
console.log('Test 1: normalizeFirstDueDate - same date should shift forward');
{
  const transferDate = new Date('2025-01-15');
  const firstDueDate = new Date('2025-01-15');
  const normalized = normalizeFirstDueDate(transferDate, firstDueDate, 'monthly');

  // Should be Feb 15, 2025
  assert.strictEqual(normalized.toISOString().split('T')[0], '2025-02-15', 'Monthly shift failed');
  console.log('✓ Monthly normalization works');
}

{
  const transferDate = new Date('2025-01-15');
  const firstDueDate = new Date('2025-01-15');
  const normalized = normalizeFirstDueDate(transferDate, firstDueDate, 'every_4_weeks');

  // Should be 28 days later: Feb 12, 2025
  assert.strictEqual(normalized.toISOString().split('T')[0], '2025-02-12', 'Every 4 weeks shift failed');
  console.log('✓ Every-4-weeks normalization works');
}

// Test 2: normalizeFirstDueDate - first due before transfer should also shift
console.log('\nTest 2: normalizeFirstDueDate - first due before transfer date');
{
  const transferDate = new Date('2025-01-20');
  const firstDueDate = new Date('2025-01-15'); // Before transfer
  const normalized = normalizeFirstDueDate(transferDate, firstDueDate, 'monthly');

  // Should be Feb 20, 2025
  assert.strictEqual(normalized.toISOString().split('T')[0], '2025-02-20', 'Should shift from transfer date');
  console.log('✓ Normalization from transfer date works');
}

// Test 3: generatePaymentDates - monthly frequency
console.log('\nTest 3: generatePaymentDates - monthly frequency');
{
  const result = generatePaymentDates({
    transferDate: new Date('2025-01-01'),
    firstDueDate: new Date('2025-02-01'),
    frequency: 'monthly',
    count: 6
  });

  assert.strictEqual(result.paymentDates.length, 6, 'Should generate 6 dates');
  assert.strictEqual(result.paymentDates[0].toISOString().split('T')[0], '2025-02-01', 'First date');
  assert.strictEqual(result.paymentDates[1].toISOString().split('T')[0], '2025-03-01', 'Second date');
  assert.strictEqual(result.paymentDates[5].toISOString().split('T')[0], '2025-07-01', 'Sixth date');
  console.log('✓ Monthly payment dates generated correctly');
}

// Test 4: generatePaymentDates - every_4_weeks frequency
console.log('\nTest 4: generatePaymentDates - every_4_weeks frequency');
{
  const result = generatePaymentDates({
    transferDate: new Date('2025-01-01'),
    firstDueDate: new Date('2025-02-01'),
    frequency: 'every_4_weeks',
    count: 3
  });

  assert.strictEqual(result.paymentDates.length, 3, 'Should generate 3 dates');
  assert.strictEqual(result.paymentDates[0].toISOString().split('T')[0], '2025-02-01', 'First date');
  assert.strictEqual(result.paymentDates[1].toISOString().split('T')[0], '2025-03-01', 'Second date (28 days later)');
  assert.strictEqual(result.paymentDates[2].toISOString().split('T')[0], '2025-03-29', 'Third date (56 days later)');
  console.log('✓ Every-4-weeks payment dates generated correctly');
}

// Test 5: buildRepaymentSchedule - first row should have interest > 0
console.log('\nTest 5: buildRepaymentSchedule - first row interest > 0');
{
  const transferDate = new Date('2025-01-01');
  const firstDueDate = new Date('2025-02-01'); // 31 days later

  const schedule = buildRepaymentSchedule({
    principalCents: 400000, // €4,000
    aprPercent: 5,
    count: 6,
    paymentDates: [
      new Date('2025-02-01'),
      new Date('2025-03-01'),
      new Date('2025-04-01'),
      new Date('2025-05-01'),
      new Date('2025-06-01'),
      new Date('2025-07-01')
    ],
    startDate: transferDate
  });

  assert.strictEqual(schedule.rows.length, 6, 'Should have 6 rows');
  assert.ok(schedule.rows[0].interestCents > 0, 'First row interest should be > 0');

  // For €4,000 at 5% APR over 31 days: 4000 * (0.05/365) * 31 ≈ €16.99
  const expectedFirstInterest = Math.round(4000 * (0.05/365) * 31 * 100); // in cents
  const actualFirstInterest = schedule.rows[0].interestCents;

  // Allow small rounding difference (within 1 cent)
  assert.ok(Math.abs(actualFirstInterest - expectedFirstInterest) <= 1,
    `First interest should be ≈ ${expectedFirstInterest} cents, got ${actualFirstInterest}`);

  console.log(`✓ First row interest = €${(actualFirstInterest/100).toFixed(2)} (expected ≈ €${(expectedFirstInterest/100).toFixed(2)})`);
}

// Test 6: buildRepaymentSchedule - totals should match
console.log('\nTest 6: buildRepaymentSchedule - totals validation');
{
  const schedule = buildRepaymentSchedule({
    principalCents: 400000, // €4,000
    aprPercent: 5,
    count: 6,
    paymentDates: [
      new Date('2025-02-01'),
      new Date('2025-03-01'),
      new Date('2025-04-01'),
      new Date('2025-05-01'),
      new Date('2025-06-01'),
      new Date('2025-07-01')
    ],
    startDate: new Date('2025-01-01')
  });

  // Sum all principal payments (allow 2 cents rounding tolerance)
  const totalPrincipal = schedule.rows.reduce((sum, row) => sum + row.principalCents, 0);
  assert.ok(Math.abs(totalPrincipal - 400000) <= 2, 'Total principal should equal loan amount (within 2 cents)');
  console.log('✓ Total principal matches loan amount');

  // Sum all interest payments should match totalInterestCents
  const totalInterest = schedule.rows.reduce((sum, row) => sum + row.interestCents, 0);
  assert.strictEqual(totalInterest, schedule.totalInterestCents, 'Sum of interest should match total');
  console.log('✓ Sum of interest matches total');

  // Last row remaining should be 0
  assert.strictEqual(schedule.rows[5].remainingCents, 0, 'Last row remaining should be 0');
  console.log('✓ Last row remaining = 0');

  // Total to repay = principal + interest
  assert.strictEqual(schedule.totalToRepayCents, 400000 + totalInterest, 'Total to repay = principal + interest');
  console.log('✓ Total to repay = principal + interest');
}

// Test 7: Edge case - first due date equals transfer date (should be normalized)
console.log('\nTest 7: Edge case - first due date equals transfer date');
{
  const transferDate = new Date('2025-01-15');
  const firstDueDate = new Date('2025-01-15'); // SAME DATE

  const result = generatePaymentDates({
    transferDate,
    firstDueDate,
    frequency: 'monthly',
    count: 3
  });

  // Should normalize to Feb 15
  assert.strictEqual(result.normalizedFirstDueDate.toISOString().split('T')[0], '2025-02-15',
    'First due date should be normalized to next month');

  // Build schedule with normalized dates
  const schedule = buildRepaymentSchedule({
    principalCents: 100000,
    aprPercent: 5,
    count: 3,
    paymentDates: result.paymentDates,
    startDate: transferDate
  });

  // First row should have ~31 days of interest
  assert.ok(schedule.rows[0].interestCents > 0, 'First row must have interest');
  console.log(`✓ Normalized first due date; first interest = €${(schedule.rows[0].interestCents/100).toFixed(2)}`);
}

// Test 8: Monthly vs every_4_weeks - different date series but similar totals
console.log('\nTest 8: Monthly vs every_4_weeks - compare totals');
{
  const transferDate = new Date('2025-01-01');
  const count = 6;

  // Monthly
  const monthlyDates = generatePaymentDates({
    transferDate,
    firstDueDate: new Date('2025-02-01'),
    frequency: 'monthly',
    count
  });

  const monthlySchedule = buildRepaymentSchedule({
    principalCents: 400000,
    aprPercent: 5,
    count,
    paymentDates: monthlyDates.paymentDates,
    startDate: transferDate
  });

  // Every 4 weeks
  const every4WeeksDates = generatePaymentDates({
    transferDate,
    firstDueDate: new Date('2025-01-29'),
    frequency: 'every_4_weeks',
    count
  });

  const every4WeeksSchedule = buildRepaymentSchedule({
    principalCents: 400000,
    aprPercent: 5,
    count,
    paymentDates: every4WeeksDates.paymentDates,
    startDate: transferDate
  });

  // Dates should be different
  assert.notStrictEqual(
    monthlyDates.paymentDates[1].toISOString(),
    every4WeeksDates.paymentDates[1].toISOString(),
    'Date series should differ'
  );

  // Totals will differ because the payment periods are different
  // Monthly typically has longer periods (30-31 days) vs every-4-weeks (28 days)
  const monthlyTotal = monthlySchedule.totalInterestCents;
  const every4WeeksTotal = every4WeeksSchedule.totalInterestCents;

  // Just verify both have reasonable totals (not zero, not absurdly high)
  assert.ok(monthlyTotal > 0, 'Monthly total should be > 0');
  assert.ok(every4WeeksTotal > 0, 'Every-4-weeks total should be > 0');
  assert.ok(monthlyTotal < 50000, 'Monthly total should be reasonable'); // Less than €500 for €4k loan
  assert.ok(every4WeeksTotal < 50000, 'Every-4-weeks total should be reasonable');

  console.log(`✓ Monthly total: €${(monthlyTotal/100).toFixed(2)}, Every-4-weeks: €${(every4WeeksTotal/100).toFixed(2)}`);
}

console.log('\n✓ All tests passed!\n');

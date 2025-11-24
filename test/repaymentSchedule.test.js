/**
 * Unit tests for new repayment schedule generator
 * Run with: node test/repaymentSchedule.test.js
 */

const assert = require('assert');
const { generateRepaymentSchedule } = require('../lib/repayments/repaymentSchedule.js');
const { getLoanStartLabel } = require('../lib/repayments/loanStartLabels.js');

// Mock currency formatters for Node.js environment
global.formatCurrency0 = (cents) => {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100);
};
global.formatCurrency2 = (cents) => {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
};

console.log('Running repaymentSchedule.js unit tests...\n');

// Test 1: One-time loan with fixed start date
console.log('Test 1: One-time loan with fixed start date');
{
  const config = {
    principal: 1000000, // €10,000
    annualInterestRate: 7,
    repaymentType: 'one_time',
    numInstallments: 1,
    paymentFrequency: 'monthly',
    loanStartMode: 'fixed_date',
    loanStartDate: '2025-01-01',
    firstPaymentOffsetDays: 365, // 1 year later
    context: {
      preview: false,
      agreementStatus: 'active',
      hasRealStartDate: true
    }
  };

  const result = generateRepaymentSchedule(config);

  assert.strictEqual(result.rows.length, 1, 'Should have 1 row');
  assert.ok(result.rows[0].date !== null, 'Should have real date');
  assert.ok(result.totalInterest > 0, 'Should have interest');
  assert.strictEqual(result.totalToRepay, config.principal + result.totalInterest, 'Total should match');

  console.log(`✓ One-time loan: €${(result.totalInterest / 100).toFixed(2)} interest, total €${(result.totalToRepay / 100).toFixed(2)}`);
}

// Test 2: Installments with fixed start date, monthly frequency
console.log('\nTest 2: Installments with fixed start date, monthly frequency');
{
  const config = {
    principal: 600000, // €6,000
    annualInterestRate: 5,
    repaymentType: 'installments',
    numInstallments: 12,
    paymentFrequency: 'monthly',
    loanStartMode: 'fixed_date',
    loanStartDate: '2025-01-01',
    firstPaymentOffsetDays: 31, // ~1 month
    context: {
      preview: false,
      agreementStatus: 'active',
      hasRealStartDate: true
    }
  };

  const result = generateRepaymentSchedule(config);

  assert.strictEqual(result.rows.length, 12, 'Should have 12 rows');
  assert.ok(result.rows[0].date !== null, 'First row should have real date');
  assert.ok(result.rows[11].date !== null, 'Last row should have real date');
  assert.ok(result.totalInterest > 0, 'Should have interest');
  assert.strictEqual(result.rows[11].remainingBalance, 0, 'Last balance should be 0');

  // Verify the total interest is reasonable for €6k at 5% over 12 months
  // Should be around €161.99 based on existing calculator
  const expectedInterestApprox = 16199; // cents
  const tolerance = 500; // 5 euro tolerance
  assert.ok(
    Math.abs(result.totalInterest - expectedInterestApprox) < tolerance,
    `Total interest should be ≈ €161.99, got €${(result.totalInterest / 100).toFixed(2)}`
  );

  console.log(`✓ 12 monthly installments: €${(result.totalInterest / 100).toFixed(2)} interest, total €${(result.totalToRepay / 100).toFixed(2)}`);
}

// Test 3: Installments with "upon_acceptance" in preview mode (no real date)
console.log('\nTest 3: Installments with "upon_acceptance" in preview mode');
{
  const config = {
    principal: 600000, // €6,000
    annualInterestRate: 5,
    repaymentType: 'installments',
    numInstallments: 12,
    paymentFrequency: 'monthly',
    loanStartMode: 'upon_acceptance',
    loanStartDate: null,
    firstPaymentOffsetDays: 30, // 1 month
    context: {
      preview: true,
      agreementStatus: 'pending',
      hasRealStartDate: false
    }
  };

  const result = generateRepaymentSchedule(config);

  assert.strictEqual(result.rows.length, 12, 'Should have 12 rows');
  assert.strictEqual(result.rows[0].date, null, 'First row should have null date');
  assert.strictEqual(result.rows[11].date, null, 'Last row should have null date');
  assert.ok(result.rows[0].dateLabel.includes('after loan start'), 'Should have relative label');
  assert.ok(result.totalInterest > 0, 'Should have estimated interest');

  console.log(`✓ Preview mode: First payment = "${result.rows[0].dateLabel}"`);
  console.log(`  Interest estimate: €${(result.totalInterest / 100).toFixed(2)}`);
}

// Test 4: "upon_acceptance" with actual acceptance date (now has real dates)
console.log('\nTest 4: "upon_acceptance" after agreement accepted');
{
  const config = {
    principal: 600000, // €6,000
    annualInterestRate: 5,
    repaymentType: 'installments',
    numInstallments: 12,
    paymentFrequency: 'monthly',
    loanStartMode: 'upon_acceptance',
    loanStartDate: '2025-02-15', // Agreement was accepted on this date
    firstPaymentOffsetDays: 30,
    context: {
      preview: false,
      agreementStatus: 'active',
      hasRealStartDate: true
    }
  };

  const result = generateRepaymentSchedule(config);

  assert.strictEqual(result.rows.length, 12, 'Should have 12 rows');
  assert.ok(result.rows[0].date !== null, 'First row should have real date now');
  assert.ok(result.rows[0].dateLabel.includes('Mar') || result.rows[0].dateLabel.includes('2025'), 'Should have formatted date');

  console.log(`✓ After acceptance: First payment = "${result.rows[0].dateLabel}"`);
}

// Test 5: Every 4 weeks frequency
console.log('\nTest 5: Every 4 weeks frequency with fixed date');
{
  const config = {
    principal: 400000, // €4,000
    annualInterestRate: 5,
    repaymentType: 'installments',
    numInstallments: 6,
    paymentFrequency: 'every_4_weeks',
    loanStartMode: 'fixed_date',
    loanStartDate: '2025-01-01',
    firstPaymentOffsetDays: 28,
    context: {
      preview: false,
      agreementStatus: 'active',
      hasRealStartDate: true
    }
  };

  const result = generateRepaymentSchedule(config);

  assert.strictEqual(result.rows.length, 6, 'Should have 6 rows');
  assert.ok(result.totalInterest > 0, 'Should have interest');

  console.log(`✓ Every 4 weeks: €${(result.totalInterest / 100).toFixed(2)} interest`);
}

// Test 6: First payment on loan start (0 offset)
console.log('\nTest 6: First payment on loan start (0 offset) in preview mode');
{
  const config = {
    principal: 500000, // €5,000
    annualInterestRate: 5,
    repaymentType: 'installments',
    numInstallments: 6,
    paymentFrequency: 'monthly',
    loanStartMode: 'upon_acceptance',
    loanStartDate: null,
    firstPaymentOffsetDays: 0, // Immediately on loan start
    context: {
      preview: true,
      agreementStatus: 'pending',
      hasRealStartDate: false
    }
  };

  const result = generateRepaymentSchedule(config);

  assert.strictEqual(result.rows[0].dateLabel, 'On loan start', 'Should show "On loan start"');

  console.log(`✓ Zero offset: First payment = "${result.rows[0].dateLabel}"`);
}

// Test 7: Loan start label helper
console.log('\nTest 7: Loan start label helper');
{
  // Fixed date with date provided
  const label1 = getLoanStartLabel('fixed_date', '2025-12-24');
  assert.ok(label1.includes('Dec') || label1.includes('24'), 'Should format date');
  console.log(`✓ Fixed date: "${label1}"`);

  // Upon acceptance
  const label2 = getLoanStartLabel('upon_acceptance', null);
  assert.strictEqual(label2, 'When agreement is accepted', 'Should show standard message');
  console.log(`✓ Upon acceptance: "${label2}"`);

  // Edge case: fixed date but no date provided
  const label3 = getLoanStartLabel('fixed_date', null);
  assert.strictEqual(label3, 'To be confirmed', 'Should fallback');
  console.log(`✓ Edge case fallback: "${label3}"`);
}

// Test 8: Compare new generator with existing logic for same inputs
console.log('\nTest 8: Verify numbers match existing implementation');
{
  // Use the same test case as existing schedule.test.js
  const { buildRepaymentSchedule, generatePaymentDates } = require('../public/js/schedule.js');

  const transferDate = new Date('2025-01-01');
  const firstDueDate = new Date('2025-02-01');
  const count = 6;
  const principalCents = 400000; // €4,000
  const aprPercent = 5;

  // Old way
  const oldDates = generatePaymentDates({
    transferDate,
    firstDueDate,
    frequency: 'monthly',
    count
  });

  const oldSchedule = buildRepaymentSchedule({
    principalCents,
    aprPercent,
    count,
    paymentDates: oldDates.paymentDates,
    startDate: transferDate
  });

  // New way
  const newConfig = {
    principal: principalCents,
    annualInterestRate: aprPercent,
    repaymentType: 'installments',
    numInstallments: count,
    paymentFrequency: 'monthly',
    loanStartMode: 'fixed_date',
    loanStartDate: transferDate,
    firstPaymentOffsetDays: 31, // 1 month
    context: {
      preview: false,
      agreementStatus: 'active',
      hasRealStartDate: true
    }
  };

  const newSchedule = generateRepaymentSchedule(newConfig);

  // Compare totals
  assert.strictEqual(newSchedule.totalInterest, oldSchedule.totalInterestCents, 'Total interest should match');
  assert.strictEqual(newSchedule.totalToRepay, oldSchedule.totalToRepayCents, 'Total to repay should match');
  assert.strictEqual(newSchedule.rows.length, oldSchedule.rows.length, 'Row count should match');

  console.log(`✓ New generator matches existing: €${(newSchedule.totalInterest / 100).toFixed(2)} interest`);
}

console.log('\n✓ All tests passed!\n');

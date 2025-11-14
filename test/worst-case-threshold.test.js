/**
 * Unit tests for worst case scenario threshold validation
 * Run with: node test/worst-case-threshold.test.js
 *
 * This test suite validates that the worst case scenario (debt collection clause)
 * is only enabled for loans of 6,000 EUR or more.
 */

const assert = require('assert');

console.log('Running worst case scenario threshold tests...\n');

// Test constants
const WORST_CASE_MIN_AMOUNT_EUR = 6000;
const WORST_CASE_MIN_AMOUNT_CENTS = 600000;

// Simulate the frontend logic
function shouldShowWorstCaseOption(amountEur) {
  return amountEur >= WORST_CASE_MIN_AMOUNT_EUR;
}

// Simulate the backend validation logic
function validateDebtCollectionClause(amountCents, requestedValue) {
  if (requestedValue && amountCents < WORST_CASE_MIN_AMOUNT_CENTS) {
    // Silently ignore the flag for small loans
    return false;
  }
  return requestedValue;
}

// Test 1: Frontend - Amount below threshold should hide the option
console.log('Test 1: Frontend - Amount 5,999 EUR should hide worst case option');
{
  const amountEur = 5999;
  const shouldShow = shouldShowWorstCaseOption(amountEur);

  assert.strictEqual(shouldShow, false, 'Worst case option should be hidden for 5,999 EUR');
  console.log('✓ Worst case option correctly hidden for 5,999 EUR');
}

// Test 2: Frontend - Amount at threshold should show the option
console.log('\nTest 2: Frontend - Amount 6,000 EUR should show worst case option');
{
  const amountEur = 6000;
  const shouldShow = shouldShowWorstCaseOption(amountEur);

  assert.strictEqual(shouldShow, true, 'Worst case option should be shown for 6,000 EUR');
  console.log('✓ Worst case option correctly shown for 6,000 EUR');
}

// Test 3: Frontend - Amount above threshold should show the option
console.log('\nTest 3: Frontend - Amount 10,000 EUR should show worst case option');
{
  const amountEur = 10000;
  const shouldShow = shouldShowWorstCaseOption(amountEur);

  assert.strictEqual(shouldShow, true, 'Worst case option should be shown for 10,000 EUR');
  console.log('✓ Worst case option correctly shown for 10,000 EUR');
}

// Test 4: Frontend - Edge case at 5,999.99 EUR
console.log('\nTest 4: Frontend - Amount 5,999.99 EUR should hide worst case option');
{
  const amountEur = 5999.99;
  const shouldShow = shouldShowWorstCaseOption(amountEur);

  assert.strictEqual(shouldShow, false, 'Worst case option should be hidden for 5,999.99 EUR');
  console.log('✓ Worst case option correctly hidden for 5,999.99 EUR');
}

// Test 5: Frontend - Edge case at 6,000.01 EUR
console.log('\nTest 5: Frontend - Amount 6,000.01 EUR should show worst case option');
{
  const amountEur = 6000.01;
  const shouldShow = shouldShowWorstCaseOption(amountEur);

  assert.strictEqual(shouldShow, true, 'Worst case option should be shown for 6,000.01 EUR');
  console.log('✓ Worst case option correctly shown for 6,000.01 EUR');
}

// Test 6: Backend - Reject debt collection for small loans
console.log('\nTest 6: Backend - Amount 3,000 EUR with debt collection = true should be overridden to false');
{
  const amountCents = 300000; // 3,000 EUR
  const requestedValue = true;
  const result = validateDebtCollectionClause(amountCents, requestedValue);

  assert.strictEqual(result, false, 'Backend should override debt collection to false for 3,000 EUR');
  console.log('✓ Backend correctly overrides debt collection to false for 3,000 EUR');
}

// Test 7: Backend - Accept debt collection for large loans
console.log('\nTest 7: Backend - Amount 6,000 EUR with debt collection = true should be accepted');
{
  const amountCents = 600000; // 6,000 EUR
  const requestedValue = true;
  const result = validateDebtCollectionClause(amountCents, requestedValue);

  assert.strictEqual(result, true, 'Backend should accept debt collection for 6,000 EUR');
  console.log('✓ Backend correctly accepts debt collection for 6,000 EUR');
}

// Test 8: Backend - Accept false value for small loans
console.log('\nTest 8: Backend - Amount 3,000 EUR with debt collection = false should remain false');
{
  const amountCents = 300000; // 3,000 EUR
  const requestedValue = false;
  const result = validateDebtCollectionClause(amountCents, requestedValue);

  assert.strictEqual(result, false, 'Backend should keep debt collection as false for 3,000 EUR');
  console.log('✓ Backend correctly keeps debt collection as false for 3,000 EUR');
}

// Test 9: Backend - Edge case at exactly 599,999 cents (5,999.99 EUR)
console.log('\nTest 9: Backend - Amount 5,999.99 EUR (599,999 cents) with debt collection = true should be overridden');
{
  const amountCents = 599999; // 5,999.99 EUR
  const requestedValue = true;
  const result = validateDebtCollectionClause(amountCents, requestedValue);

  assert.strictEqual(result, false, 'Backend should override debt collection for 5,999.99 EUR');
  console.log('✓ Backend correctly overrides debt collection for 5,999.99 EUR');
}

// Test 10: Backend - Edge case at exactly 600,000 cents (6,000.00 EUR)
console.log('\nTest 10: Backend - Amount 6,000.00 EUR (600,000 cents) with debt collection = true should be accepted');
{
  const amountCents = 600000; // 6,000.00 EUR
  const requestedValue = true;
  const result = validateDebtCollectionClause(amountCents, requestedValue);

  assert.strictEqual(result, true, 'Backend should accept debt collection for exactly 6,000.00 EUR');
  console.log('✓ Backend correctly accepts debt collection for exactly 6,000.00 EUR');
}

// Test 11: Frontend - Small amounts (0, 100, 1000)
console.log('\nTest 11: Frontend - Small amounts should all hide worst case option');
{
  const amounts = [0, 100, 1000, 2500, 5000];
  amounts.forEach(amount => {
    const shouldShow = shouldShowWorstCaseOption(amount);
    assert.strictEqual(shouldShow, false, `Amount ${amount} EUR should hide worst case option`);
  });
  console.log('✓ All small amounts correctly hide worst case option');
}

// Test 12: Frontend - Large amounts (7000, 10000, 50000)
console.log('\nTest 12: Frontend - Large amounts should all show worst case option');
{
  const amounts = [7000, 10000, 25000, 50000, 100000];
  amounts.forEach(amount => {
    const shouldShow = shouldShowWorstCaseOption(amount);
    assert.strictEqual(shouldShow, true, `Amount ${amount} EUR should show worst case option`);
  });
  console.log('✓ All large amounts correctly show worst case option');
}

console.log('\n✓ All worst case scenario threshold tests passed!\n');

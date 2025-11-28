/**
 * Unit tests for phone validation logic
 * Tests country-specific phone number validation using libphonenumber-js
 * Run with: node test/phone-validation.test.js
 *
 * This tests the same validation logic used by:
 * - Profile page phone input
 * - Wizard Step 1 borrower phone input
 */

const assert = require('assert');
const libphonenumber = require('libphonenumber-js');

console.log('Running phone validation unit tests...\n');

/**
 * Validates a phone number for a specific country
 * This mirrors the logic in phone-input.js isValidNumber()
 */
function isValidPhoneNumber(phoneNumber, countryCode) {
  if (!phoneNumber || phoneNumber.length < 2) {
    return false;
  }

  try {
    const parsed = libphonenumber.parsePhoneNumberFromString(phoneNumber, countryCode);
    if (parsed) {
      return parsed.isValid();
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Gets validation error message for a phone number
 * This mirrors the logic in phone-input.js getValidationError()
 */
function getValidationError(phoneNumber, countryCode, countryName) {
  if (!phoneNumber || phoneNumber.length < 2) {
    return `Please enter a phone number for ${countryName}.`;
  }

  try {
    const parsed = libphonenumber.parsePhoneNumberFromString(phoneNumber, countryCode);

    if (!parsed) {
      return `Please enter a valid phone number for ${countryName}.`;
    }

    if (!parsed.isValid()) {
      if (!parsed.isPossible()) {
        return `Please enter a valid phone number for ${countryName}. Check the number of digits.`;
      }
      return `Please enter a valid phone number for ${countryName}.`;
    }

    return null; // Valid
  } catch (e) {
    return `Please enter a valid phone number for ${countryName}.`;
  }
}

// Test 1: Netherlands (NL) phone numbers
console.log('Test 1: Netherlands phone validation');
{
  // Valid Dutch mobile number: 10 digits starting with 06
  const validMobile = '+31612345678';
  assert.strictEqual(isValidPhoneNumber(validMobile, 'NL'), true, 'Valid NL mobile should pass');
  console.log('✓ Valid NL mobile (+31612345678) passes');

  // Valid Dutch landline
  const validLandline = '+31201234567';
  assert.strictEqual(isValidPhoneNumber(validLandline, 'NL'), true, 'Valid NL landline should pass');
  console.log('✓ Valid NL landline (+31201234567) passes');

  // Too short
  const tooShort = '+3161234';
  assert.strictEqual(isValidPhoneNumber(tooShort, 'NL'), false, 'Too short NL number should fail');
  console.log('✓ Too short NL number (+3161234) fails');

  // Too long
  const tooLong = '+316123456789012';
  assert.strictEqual(isValidPhoneNumber(tooLong, 'NL'), false, 'Too long NL number should fail');
  console.log('✓ Too long NL number (+316123456789012) fails');
}

// Test 2: Andorra (AD) phone numbers
console.log('\nTest 2: Andorra phone validation');
{
  // Valid Andorran number (6 digits)
  const valid = '+376312345';
  assert.strictEqual(isValidPhoneNumber(valid, 'AD'), true, 'Valid AD number should pass');
  console.log('✓ Valid AD number (+376312345) passes');

  // Valid Andorran mobile (starts with 3, 4, 5, 6)
  const validMobile = '+376612345';
  assert.strictEqual(isValidPhoneNumber(validMobile, 'AD'), true, 'Valid AD mobile should pass');
  console.log('✓ Valid AD mobile (+376612345) passes');

  // Too short (5 digits)
  const tooShort = '+37631234';
  assert.strictEqual(isValidPhoneNumber(tooShort, 'AD'), false, 'Too short AD number should fail');
  console.log('✓ Too short AD number (+37631234) fails');

  // Too long (15 digits as shown in screenshot)
  const tooLong = '+3763600025555555';
  assert.strictEqual(isValidPhoneNumber(tooLong, 'AD'), false, 'Too long AD number should fail');
  console.log('✓ Too long AD number (+3763600025555555) fails');
}

// Test 3: United States (US) phone numbers
console.log('\nTest 3: United States phone validation');
{
  // Valid US number
  const valid = '+12025551234';
  assert.strictEqual(isValidPhoneNumber(valid, 'US'), true, 'Valid US number should pass');
  console.log('✓ Valid US number (+12025551234) passes');

  // Too short
  const tooShort = '+120255512';
  assert.strictEqual(isValidPhoneNumber(tooShort, 'US'), false, 'Too short US number should fail');
  console.log('✓ Too short US number (+120255512) fails');

  // Too long
  const tooLong = '+120255512345678';
  assert.strictEqual(isValidPhoneNumber(tooLong, 'US'), false, 'Too long US number should fail');
  console.log('✓ Too long US number (+120255512345678) fails');
}

// Test 4: Germany (DE) phone numbers
// Note: German numbers have variable lengths (area codes and subscriber numbers vary)
console.log('\nTest 4: Germany phone validation');
{
  // Valid German mobile
  const validMobile = '+491721234567';
  assert.strictEqual(isValidPhoneNumber(validMobile, 'DE'), true, 'Valid DE mobile should pass');
  console.log('✓ Valid DE mobile (+491721234567) passes');

  // Valid German landline (Berlin)
  const validLandline = '+493012345678';
  assert.strictEqual(isValidPhoneNumber(validLandline, 'DE'), true, 'Valid DE landline should pass');
  console.log('✓ Valid DE landline (+493012345678) passes');

  // Too short (less than minimum for any German number)
  const tooShort = '+4912';
  assert.strictEqual(isValidPhoneNumber(tooShort, 'DE'), false, 'Too short DE number should fail');
  console.log('✓ Too short DE number (+4912) fails');

  // Too long
  const tooLong = '+4917212345678901234';
  assert.strictEqual(isValidPhoneNumber(tooLong, 'DE'), false, 'Too long DE number should fail');
  console.log('✓ Too long DE number fails');
}

// Test 5: Error message generation
console.log('\nTest 5: Dynamic error message generation');
{
  const errorNL = getValidationError('+3161234', 'NL', 'Netherlands');
  assert.ok(errorNL.includes('Netherlands'), 'Error should mention country name');
  console.log('✓ Error message includes country name: "' + errorNL + '"');

  const errorAD = getValidationError('+37631234', 'AD', 'Andorra');
  assert.ok(errorAD.includes('Andorra'), 'Error should mention country name');
  console.log('✓ Error message includes country name: "' + errorAD + '"');

  const emptyError = getValidationError('', 'NL', 'Netherlands');
  assert.ok(emptyError.includes('Netherlands'), 'Empty error should mention country');
  console.log('✓ Empty number error includes country name');

  // Valid number should return null
  const noError = getValidationError('+31612345678', 'NL', 'Netherlands');
  assert.strictEqual(noError, null, 'Valid number should return null error');
  console.log('✓ Valid number returns null error');
}

// Test 6: Switching countries - same digits may be valid/invalid
console.log('\nTest 6: Country switching validation');
{
  // 6 digits: valid for Andorra, invalid for Netherlands
  const sixDigits = '+376312345'; // With Andorra prefix
  assert.strictEqual(isValidPhoneNumber(sixDigits, 'AD'), true, '6 digits valid for AD');
  console.log('✓ 6-digit number valid for Andorra');

  // Same digits with NL prefix would be invalid
  const sixDigitsNL = '+31312345';
  assert.strictEqual(isValidPhoneNumber(sixDigitsNL, 'NL'), false, '6 digits invalid for NL');
  console.log('✓ 6-digit number invalid for Netherlands');
}

// Test 7: Edge cases
console.log('\nTest 7: Edge cases');
{
  // Empty string
  assert.strictEqual(isValidPhoneNumber('', 'NL'), false, 'Empty string should fail');
  console.log('✓ Empty string fails validation');

  // Just dial code
  assert.strictEqual(isValidPhoneNumber('+31', 'NL'), false, 'Just dial code should fail');
  console.log('✓ Just dial code (+31) fails validation');

  // With spaces/dashes (should be stripped before validation)
  const withSpaces = '+31 6 1234 5678';
  assert.strictEqual(isValidPhoneNumber(withSpaces, 'NL'), true, 'Number with spaces should pass');
  console.log('✓ Number with spaces passes after stripping');
}

console.log('\n========================================');
console.log('All phone validation tests passed! ✓');
console.log('========================================\n');

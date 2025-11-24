/**
 * Test script for verifying all payment frequency behaviors
 */

// Helper functions (copied from calculate.html for testing)
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date, months) {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  const targetYear = result.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  const originalDay = result.getDate();
  result.setFullYear(targetYear, normalizedMonth, 1);
  const daysInTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const clampedDay = Math.min(originalDay, daysInTargetMonth);
  result.setDate(clampedDay);

  return result;
}

function addYears(date, years) {
  const result = new Date(date);
  const targetYear = result.getFullYear() + years;
  const originalMonth = result.getMonth();
  const originalDay = result.getDate();

  // Handle Feb 29 in leap year -> non-leap year
  if (originalMonth === 1 && originalDay === 29) {
    const isLeapYear = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
    if (!isLeapYear) {
      result.setFullYear(targetYear, 1, 28);
      return result;
    }
  }

  result.setFullYear(targetYear, originalMonth, originalDay);
  return result;
}

function formatDateDisplay(dateInput) {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const day = date.getDate();
  const month = date.toLocaleDateString('en-GB', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

// Test configurations
const testCases = [
  {
    name: '1. Every 3 days - Preview mode',
    config: {
      frequency: 'every-3-days',
      loanStartMode: 'upon_acceptance',
      contextMode: 'preview',
      firstPaymentDays: 30,
      numberOfInstallments: 3
    },
    expectedLabels: ['30 days after loan start', '33 days after loan start', '36 days after loan start']
  },
  {
    name: '2. Every week - Preview mode',
    config: {
      frequency: 'every-week',
      loanStartMode: 'upon_acceptance',
      contextMode: 'preview',
      firstPaymentDays: 7,
      numberOfInstallments: 3
    },
    expectedLabels: ['7 days after loan start', '14 days after loan start', '21 days after loan start']
  },
  {
    name: '3. Every month - Preview mode',
    config: {
      frequency: 'every-month',
      loanStartMode: 'upon_acceptance',
      contextMode: 'preview',
      firstPaymentDays: 30,
      numberOfInstallments: 3
    },
    expectedLabels: ['1 month after loan start', '2 months after loan start', '3 months after loan start']
  },
  {
    name: '4. Every year - Preview mode',
    config: {
      frequency: 'every-year',
      loanStartMode: 'upon_acceptance',
      contextMode: 'preview',
      firstPaymentDays: 365,
      numberOfInstallments: 3
    },
    expectedLabels: ['1 year after loan start', '2 years after loan start', '3 years after loan start']
  },
  {
    name: '5. Once only - Preview mode',
    config: {
      frequency: 'once',
      loanStartMode: 'upon_acceptance',
      contextMode: 'preview',
      firstPaymentDays: 45,
      numberOfInstallments: 1
    },
    expectedLabels: ['45 days after loan start']
  },
  {
    name: '6. Every 3 days - Actual mode with fixed date',
    config: {
      frequency: 'every-3-days',
      loanStartMode: 'fixed_date',
      contextMode: 'actual',
      loanStartDate: new Date('2025-01-01'),
      firstPaymentDays: 30,
      numberOfInstallments: 3
    },
    expectedDates: [
      addDays(new Date('2025-01-01'), 30),
      addDays(new Date('2025-01-01'), 33),
      addDays(new Date('2025-01-01'), 36)
    ]
  },
  {
    name: '7. Every month - Actual mode with fixed date',
    config: {
      frequency: 'every-month',
      loanStartMode: 'fixed_date',
      contextMode: 'actual',
      loanStartDate: new Date('2025-01-01'),
      firstPaymentDays: 30,
      numberOfInstallments: 3
    },
    expectedDates: [
      addMonths(new Date('2025-01-01'), 1),
      addMonths(new Date('2025-01-01'), 2),
      addMonths(new Date('2025-01-01'), 3)
    ]
  },
  {
    name: '8. Every year - Actual mode with fixed date',
    config: {
      frequency: 'every-year',
      loanStartMode: 'fixed_date',
      contextMode: 'actual',
      loanStartDate: new Date('2025-01-01'),
      firstPaymentDays: 365,
      numberOfInstallments: 3
    },
    expectedDates: [
      addYears(new Date('2025-01-01'), 1),
      addYears(new Date('2025-01-01'), 2),
      addYears(new Date('2025-01-01'), 3)
    ]
  },
  {
    name: '9. Month-end edge case - Jan 31',
    config: {
      frequency: 'every-month',
      loanStartMode: 'fixed_date',
      contextMode: 'actual',
      loanStartDate: new Date('2025-01-31'),
      firstPaymentDays: 30,
      numberOfInstallments: 3
    },
    expectedDates: [
      new Date('2025-02-28'), // Feb only has 28 days
      new Date('2025-03-31'), // March has 31 days
      new Date('2025-04-30')  // April has 30 days
    ]
  },
  {
    name: '10. Feb 29 leap year edge case',
    config: {
      frequency: 'every-year',
      loanStartMode: 'fixed_date',
      contextMode: 'actual',
      loanStartDate: new Date('2024-02-29'), // 2024 is leap year
      firstPaymentDays: 365,
      numberOfInstallments: 3
    },
    expectedDates: [
      new Date('2025-02-28'), // 2025 is not leap year
      new Date('2026-02-28'), // 2026 is not leap year
      new Date('2027-02-28')  // 2027 is not leap year
    ]
  }
];

console.log('Testing Payment Frequency Behaviors\n');
console.log('=' .repeat(80));

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  console.log(`\n${testCase.name}`);
  console.log('-'.repeat(80));

  const { config, expectedLabels, expectedDates } = testCase;
  const {
    frequency,
    loanStartMode,
    contextMode,
    loanStartDate,
    firstPaymentDays,
    numberOfInstallments
  } = config;

  // Determine effective mode
  let effectiveMode = contextMode;
  if (loanStartMode === 'fixed_date') {
    effectiveMode = 'actual';
  }

  // Determine period type
  let periodType;
  let periodDays;
  switch (frequency) {
    case 'every-3-days':
      periodType = 'days';
      periodDays = 3;
      break;
    case 'every-week':
      periodType = 'days';
      periodDays = 7;
      break;
    case 'every-month':
      periodType = 'months';
      periodDays = 30;
      break;
    case 'every-year':
      periodType = 'years';
      periodDays = 365;
      break;
    case 'once':
      periodType = 'days';
      periodDays = firstPaymentDays;
      break;
  }

  // Generate labels/dates
  const results = [];
  for (let i = 0; i < numberOfInstallments; i++) {
    let label, dueDate;

    if (effectiveMode === 'preview') {
      // Preview mode: relative labels
      if (periodType === 'years') {
        const yearsAfterStart = i + 1;
        label = yearsAfterStart === 1 ? '1 year after loan start' : `${yearsAfterStart} years after loan start`;
      } else if (periodType === 'months') {
        const monthsAfterStart = i + 1;
        label = monthsAfterStart === 1 ? '1 month after loan start' : `${monthsAfterStart} months after loan start`;
      } else {
        const totalDays = (i === 0) ? firstPaymentDays : (firstPaymentDays + i * periodDays);
        label = totalDays === 0 ? 'On loan start' : `${totalDays} days after loan start`;
      }
      results.push({ label });
    } else {
      // Actual mode: real dates
      if (periodType === 'years') {
        dueDate = addYears(loanStartDate, i + 1);
      } else if (periodType === 'months') {
        dueDate = addMonths(loanStartDate, i + 1);
      } else {
        const daysToAdd = (i === 0) ? firstPaymentDays : (firstPaymentDays + i * periodDays);
        dueDate = addDays(loanStartDate, daysToAdd);
      }
      label = formatDateDisplay(dueDate);
      results.push({ label, dueDate });
    }
  }

  // Verify results
  let testPassed = true;
  if (expectedLabels) {
    // Check labels
    results.forEach((result, i) => {
      if (result.label === expectedLabels[i]) {
        console.log(`  ✓ Payment ${i + 1}: ${result.label}`);
      } else {
        console.log(`  ✗ Payment ${i + 1}: Expected "${expectedLabels[i]}", got "${result.label}"`);
        testPassed = false;
      }
    });
  } else if (expectedDates) {
    // Check dates
    results.forEach((result, i) => {
      const expectedDate = expectedDates[i];
      const expectedLabel = formatDateDisplay(expectedDate);
      if (result.label === expectedLabel) {
        console.log(`  ✓ Payment ${i + 1}: ${result.label}`);
      } else {
        console.log(`  ✗ Payment ${i + 1}: Expected "${expectedLabel}", got "${result.label}"`);
        testPassed = false;
      }
    });
  }

  if (testPassed) {
    console.log('  ✓ PASSED');
    passed++;
  } else {
    console.log('  ✗ FAILED');
    failed++;
  }
});

console.log('\n' + '='.repeat(80));
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

if (failed === 0) {
  console.log('✓ All tests passed!');
  process.exit(0);
} else {
  console.log('✗ Some tests failed');
  process.exit(1);
}

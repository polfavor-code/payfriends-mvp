/**
 * PayFriends Loan Calculator Engine
 *
 * This module contains all pure calculation logic for loan repayment schedules.
 * It can be reused across the standalone calculator, wizard, and other pages.
 *
 * SINGLE SOURCE OF TRUTH for all loan calculations.
 */

(function(window) {
  'use strict';

  // ============================================================================
  // DATE UTILITIES
  // ============================================================================

  /**
   * Add days to a date
   */
  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Add months to a date, handling month-end edge cases
   */
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

  /**
   * Add years to a date, handling Feb 29 edge case
   */
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

  /**
   * Parse ISO date format (YYYY-MM-DD) from native date input to Date object
   */
  function parseIsoDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') {
      return null;
    }

    const trimmed = dateStr.trim();
    if (!trimmed) {
      return null;
    }

    // Native date input returns YYYY-MM-DD format
    // Add T00:00:00 to ensure we get midnight in local time
    const date = new Date(trimmed + 'T00:00:00');

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  /**
   * Format date for display
   */
  function formatDateDisplay(dateInput) {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const day = date.getDate();
    const month = date.toLocaleDateString('en-GB', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  }

  /**
   * Format due date with optional weekday prefix for weekday-based frequencies
   */
  function formatDueDateWithWeekday(dateInput, includeWeekday) {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;

    if (includeWeekday) {
      // Format as "Tue, 3 Aug 2027" for weekday-based frequencies
      return date.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }).replace(/^(\w+)\s/, '$1, ');
    }

    return formatDateDisplay(date);
  }

  /**
   * Get today at midnight (avoid time-of-day issues)
   */
  function getTodayMidnight() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  // ============================================================================
  // MONEY UTILITIES
  // ============================================================================

  /**
   * Parse money string to number (in cents)
   * Accepts both comma and dot as thousand separators
   * Returns parsed number in cents or 0 if invalid
   */
  function parseMoney(value) {
    if (typeof value !== 'string') {
      value = String(value);
    }
    // Remove all dots and commas (thousand separators)
    const cleaned = value.replace(/[.,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Format number as money with thousand separator
   * Uses comma as default separator
   */
  function formatMoneyInput(value) {
    const num = parseFloat(value);
    if (isNaN(num)) return '';
    // Use comma for thousand separator (e.g., 6,000)
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // ============================================================================
  // LOAN DURATION UTILITIES
  // ============================================================================

  /**
   * Format duration in months to "X years Y months" format
   */
  function formatDurationMonths(totalMonths) {
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    const parts = [];
    if (years > 0) parts.push(`${years} year${years === 1 ? "" : "s"}`);
    if (months > 0) parts.push(`${months} month${months === 1 ? "" : "s"}`);
    return parts.join(" ");
  }

  /**
   * Calculate loan duration from schedule (loan start to last payment)
   */
  function calculateLoanDuration(rows, loanStartDate, effectiveMode) {
    if (!rows || rows.length === 0) {
      return null;
    }

    const lastPayment = rows[rows.length - 1];

    if (effectiveMode === 'actual' && loanStartDate && lastPayment.dueDate) {
      // Actual mode: calculate from loan start to last payment date
      const startDate = new Date(loanStartDate);
      const endDate = new Date(lastPayment.dueDate);

      // Calculate months difference
      const yearsDiff = endDate.getFullYear() - startDate.getFullYear();
      const monthsDiff = endDate.getMonth() - startDate.getMonth();
      const totalMonths = Math.max(0, yearsDiff * 12 + monthsDiff);

      const startStr = formatDateDisplay(startDate);
      const endStr = formatDateDisplay(endDate);

      if (totalMonths === 0) {
        // Less than a month, show days
        const daysDiff = Math.max(0, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)));
        if (daysDiff === 0) {
          return `0 days (${startStr} to ${endStr})`;
        } else if (daysDiff === 1) {
          return `1 day (${startStr} to ${endStr})`;
        } else {
          return `${daysDiff} days (${startStr} to ${endStr})`;
        }
      } else {
        return `${formatDurationMonths(totalMonths)} (${startStr} to ${endStr})`;
      }
    } else {
      // Preview mode: describe duration relative to agreement acceptance
      const lastPaymentLabel = lastPayment.label;

      // Extract months/days from the label (e.g., "12 months after loan start")
      const monthsMatch = lastPaymentLabel.match(/(\d+)\s+months?\s+after/);
      const daysMatch = lastPaymentLabel.match(/(\d+)\s+days?\s+after/);
      const yearsMatch = lastPaymentLabel.match(/(\d+)\s+years?\s+after/);

      if (yearsMatch) {
        const years = parseInt(yearsMatch[1]);
        const totalMonths = years * 12;
        return `${formatDurationMonths(totalMonths)} after agreement is accepted`;
      } else if (monthsMatch) {
        const months = parseInt(monthsMatch[1]);
        return `${formatDurationMonths(months)} after agreement is accepted`;
      } else if (daysMatch) {
        const days = parseInt(daysMatch[1]);
        return days === 1
          ? `1 day after agreement is accepted`
          : `${days} days after agreement is accepted`;
      }

      // Fallback
      return `${rows.length} payments after agreement is accepted`;
    }
  }

  /**
   * Get loan start label with context
   */
  function getLoanStartLabelWithContext(loanStartDate, effectiveMode, loanStartMode) {
    if (!loanStartDate && loanStartMode === 'upon_acceptance') {
      return 'When agreement is accepted';
    }

    if (loanStartDate) {
      const dateStr = formatDateDisplay(loanStartDate);
      return dateStr;
    }

    return 'Unknown';
  }

  // ============================================================================
  // CORE CALCULATION ENGINE
  // ============================================================================

  /**
   * SINGLE SOURCE OF TRUTH: Generate complete repayment schedule
   * This function is reusable across wizard, manage, and review pages
   *
   * @param {Object} config - Configuration object
   * @returns {Object} - Complete schedule data with rows, totals, and labels
   */
  function generateRepaymentSchedule({
    loanAmount,
    annualInterestRate,
    repaymentType,
    numberOfInstallments,
    paymentFrequency,
    firstPaymentDays,
    firstPaymentMonths = 1,
    firstPaymentYears = 0,
    firstPaymentIsMonthBased = false,
    firstPaymentIsYearBased = false,
    firstPaymentExactDate = null,
    loanStartMode,
    contextMode,
    explicitLoanStartDate
  }) {
    const debugMessages = [];

    // STEP 1: Determine effective mode
    // Rule: If loan start has a real date (not upon_acceptance), ALWAYS use actual mode
    let effectiveMode = contextMode;
    if (loanStartMode !== 'upon_acceptance') {
      effectiveMode = 'actual';
      debugMessages.push('Loan start has real date, forcing actual mode');
    }

    // STEP 2: Determine loan start date
    let loanStartDate = explicitLoanStartDate;
    if (!loanStartDate && loanStartMode === 'upon_acceptance' && effectiveMode === 'actual') {
      // Upon acceptance + actual mode: use today
      loanStartDate = new Date();
      loanStartDate.setHours(0, 0, 0, 0);
    }

    // STEP 3: Determine loan start label
    let loanStartLabel;
    if (loanStartDate) {
      loanStartLabel = `Loan start: ${formatDateDisplay(loanStartDate)}`;
    } else {
      // Preview mode with unknown date
      loanStartLabel = 'Loan start: When agreement is accepted';
    }

    // STEP 4: Setup interest calculation
    const annualRate = annualInterestRate / 100;
    const dailyRate = annualRate / 365;

    // Determine period configuration
    let periodDays;
    let periodType; // 'days', 'months', 'weeks', or 'years'
    let periodMultiplier; // for "every 2 months", "every 3 months", etc.
    let periodLabel;

    switch (paymentFrequency) {
      // Day-based frequencies
      case 'every-7-days':
        periodDays = 7;
        periodType = 'days';
        periodMultiplier = 1;
        periodLabel = 'Every 7 days (weekly)';
        break;
      case 'every-14-days':
        periodDays = 14;
        periodType = 'days';
        periodMultiplier = 1;
        periodLabel = 'Every 14 days';
        break;
      case 'every-30-days':
        periodDays = 30;
        periodType = 'days';
        periodMultiplier = 1;
        periodLabel = 'Every 30 days';
        break;
      // Month-based frequencies
      case 'every-month':
        periodDays = 30; // approximate for interest
        periodType = 'months';
        periodMultiplier = 1;
        periodLabel = 'Every month';
        break;
      case 'every-3-months':
        periodDays = 91;
        periodType = 'months';
        periodMultiplier = 3;
        periodLabel = 'Every 3 months';
        break;
      case 'every-6-months':
        periodDays = 182;
        periodType = 'months';
        periodMultiplier = 6;
        periodLabel = 'Every 6 months';
        break;

      // Weekday-based frequencies
      case 'every-week':
        periodDays = 7;
        periodType = 'weeks';
        periodMultiplier = 1;
        periodLabel = 'Every week (same weekday)';
        break;
      case 'every-2-weeks':
        periodDays = 14;
        periodType = 'weeks';
        periodMultiplier = 2;
        periodLabel = 'Every 2 weeks';
        break;
      case 'every-4-weeks':
        periodDays = 28;
        periodType = 'weeks';
        periodMultiplier = 4;
        periodLabel = 'Every 4 weeks';
        break;

      // Year-based frequencies
      case 'every-year':
        periodDays = 365; // approximate for interest
        periodType = 'years';
        periodMultiplier = 1;
        periodLabel = 'Every year';
        break;
      case 'every-2-years':
        periodDays = 730; // approximate for interest (2 years)
        periodType = 'years';
        periodMultiplier = 2;
        periodLabel = 'Every 2 years';
        break;
      case 'every-3-years':
        periodDays = 1095; // approximate for interest (3 years)
        periodType = 'years';
        periodMultiplier = 3;
        periodLabel = 'Every 3 years';
        break;

      default:
        periodDays = 30;
        periodType = 'months';
        periodMultiplier = 1;
        periodLabel = 'Every month';
    }

    debugMessages.push(`Annual interest rate: ${annualInterestRate}%`);
    debugMessages.push(`Repayment type: ${repaymentType === 'one_time' ? 'One-time payment' : 'Installments'}`);
    debugMessages.push(`Number of installments: ${numberOfInstallments}`);
    debugMessages.push(`Payment frequency: ${periodLabel}`);
    debugMessages.push(`First payment timing: ${firstPaymentDays} days after loan start`);
    debugMessages.push(`Loan start mode: ${loanStartMode === 'fixed_date' ? 'Fixed date' : 'Upon agreement acceptance'}`);
    debugMessages.push(`Effective mode: ${effectiveMode === 'actual' ? 'Actual (real dates)' : 'Preview (relative labels)'}`);

    // STEP 5: Generate schedule rows
    const rows = [];
    const principalPerPayment = loanAmount / numberOfInstallments;
    let remainingBalance = loanAmount;
    let totalInterest = 0;

    for (let i = 0; i < numberOfInstallments; i++) {
      const paymentIndex = i + 1;

      // Calculate interest for this period
      let daysForThisPeriod;
      if (i === 0) {
        // First payment: use firstPaymentDays
        daysForThisPeriod = firstPaymentDays;
      } else {
        // Subsequent payments: use period length
        daysForThisPeriod = periodDays;
      }

      const interestForPeriod = remainingBalance * dailyRate * daysForThisPeriod;
      const principalPayment = principalPerPayment;
      const totalPayment = principalPayment + interestForPeriod;

      totalInterest += interestForPeriod;
      remainingBalance -= principalPayment;
      if (remainingBalance < 0.01) remainingBalance = 0;

      // Generate due date label
      let dueDateLabel;
      let dueDate = null;

      if (effectiveMode === 'preview') {
        // PREVIEW MODE: Use relative labels, no real dates

        // EXCEPTION: If user explicitly picked a first payment date, we know the real calendar dates
        // Show them even in preview mode
        if (firstPaymentExactDate) {
          if (i === 0) {
            // First payment: use the exact picked date
            dueDate = new Date(firstPaymentExactDate);
            dueDate.setHours(0, 0, 0, 0);
          } else {
            // Subsequent payments: calculate from first payment date
            const baseDate = new Date(firstPaymentExactDate);
            baseDate.setHours(0, 0, 0, 0);

            if (periodType === 'years') {
              dueDate = addYears(baseDate, i * periodMultiplier);
            } else if (periodType === 'months') {
              dueDate = addMonths(baseDate, i * periodMultiplier);
            } else if (periodType === 'weeks') {
              dueDate = addDays(baseDate, i * periodDays);
            } else {
              // Day-based
              dueDate = addDays(baseDate, i * periodDays);
            }
          }
          dueDateLabel = formatDueDateWithWeekday(dueDate, periodType === 'weeks');
        } else if (i === 0) {
          // FIRST PAYMENT in preview mode: use first payment timing properties
          if (firstPaymentIsYearBased) {
            // Year-based (e.g., "In 1 year", "In 2 years")
            if (firstPaymentYears === 1) {
              dueDateLabel = '1 year after loan start';
            } else {
              dueDateLabel = `${firstPaymentYears} years after loan start`;
            }
          } else if (firstPaymentIsMonthBased) {
            // Month-based (e.g., "In 1 month", "In 6 months")
            if (firstPaymentMonths === 0) {
              dueDateLabel = 'On loan start';
            } else if (firstPaymentMonths === 1) {
              dueDateLabel = '1 month after loan start';
            } else {
              dueDateLabel = `${firstPaymentMonths} months after loan start`;
            }
          } else {
            // Day-based (e.g., "In 1 week" = 7 days)
            if (firstPaymentDays === 0) {
              dueDateLabel = 'On loan start';
            } else if (firstPaymentDays === 7) {
              dueDateLabel = '1 week after loan start';
            } else {
              dueDateLabel = `${firstPaymentDays} days after loan start`;
            }
          }
        } else if (periodType === 'years') {
          // SUBSEQUENT PAYMENTS with yearly frequency
          // Calculate offset from first payment
          const totalYears = firstPaymentYears + (i * periodMultiplier);
          if (totalYears === 1) {
            dueDateLabel = '1 year after loan start';
          } else {
            dueDateLabel = `${totalYears} years after loan start`;
          }
        } else if (periodType === 'months') {
          // SUBSEQUENT PAYMENTS with monthly frequency
          // Calculate offset from first payment
          const totalMonths = firstPaymentMonths + (i * periodMultiplier);
          if (totalMonths === 0) {
            dueDateLabel = 'On loan start';
          } else if (totalMonths === 1) {
            dueDateLabel = '1 month after loan start';
          } else {
            dueDateLabel = `${totalMonths} months after loan start`;
          }
        } else if (periodType === 'weeks') {
          // SUBSEQUENT PAYMENTS with week-based frequency
          // Calculate offset from first payment in days
          const totalDays = firstPaymentDays + (i * periodDays);
          if (totalDays === 0) {
            dueDateLabel = 'On loan start';
          } else if (totalDays === 7) {
            dueDateLabel = '1 week after loan start';
          } else {
            dueDateLabel = `${totalDays} days after loan start`;
          }
        } else {
          // SUBSEQUENT PAYMENTS with day-based frequency
          // Calculate offset from first payment in days
          const totalDays = firstPaymentDays + (i * periodDays);
          if (totalDays === 0) {
            dueDateLabel = 'On loan start';
          } else if (totalDays === 7) {
            dueDateLabel = '1 week after loan start';
          } else {
            dueDateLabel = `${totalDays} days after loan start`;
          }
        }
      } else {
        // ACTUAL MODE: Calculate real calendar dates
        if (loanStartDate) {
          // Calculate first payment date (will be used as base for all subsequent payments)
          let firstDueDate;
          if (firstPaymentExactDate) {
            // User explicitly picked a date - use it directly
            firstDueDate = new Date(firstPaymentExactDate);
            firstDueDate.setHours(0, 0, 0, 0);
          } else if (firstPaymentIsYearBased) {
            // First payment is year-based (e.g., "In 1 year", "In 2 years")
            firstDueDate = addYears(loanStartDate, firstPaymentYears);
          } else if (firstPaymentIsMonthBased) {
            // First payment is month-based (e.g., "In 1 month", "In 6 months")
            firstDueDate = addMonths(loanStartDate, firstPaymentMonths);
          } else {
            // First payment is day-based (e.g., "In 1 week" = 7 days)
            firstDueDate = addDays(loanStartDate, firstPaymentDays);
          }

          // Now calculate the due date for this payment
          if (i === 0) {
            // First payment: use the calculated first due date
            dueDate = firstDueDate;
          } else if (periodType === 'years') {
            // Yearly: calculate from first payment date
            dueDate = addYears(firstDueDate, i * periodMultiplier);
          } else if (periodType === 'months') {
            // Monthly: calculate from first payment date
            dueDate = addMonths(firstDueDate, i * periodMultiplier);
          } else if (periodType === 'weeks') {
            // Week-based: calculate from first payment date (preserves weekday)
            dueDate = addDays(firstDueDate, i * periodDays);
          } else {
            // Day-based: calculate from first payment date
            dueDate = addDays(firstDueDate, i * periodDays);
          }
          dueDateLabel = formatDueDateWithWeekday(dueDate, periodType === 'weeks');
        } else {
          dueDateLabel = 'Date not available';
        }
      }

      rows.push({
        index: paymentIndex,
        label: dueDateLabel,
        dueDate: dueDate,
        principal: Math.round(principalPayment * 100), // cents
        interest: Math.round(interestForPeriod * 100), // cents
        totalPayment: Math.round(totalPayment * 100), // cents
        balance: Math.round(remainingBalance * 100) // cents
      });
    }

    // STEP 6: Calculate totals
    const totals = {
      principal: Math.round(loanAmount * 100), // should equal sum of all principal
      interest: Math.round(totalInterest * 100),
      totalRepayment: Math.round((loanAmount + totalInterest) * 100)
    };

    debugMessages.push(`Generated ${rows.length} payment(s)`);

    return {
      rows,
      totals,
      loanStartLabel,
      effectiveMode,
      debugMessages
    };
  }

  // ============================================================================
  // HELPER FUNCTIONS FOR FORM DATA EXTRACTION
  // ============================================================================

  /**
   * Helper function to calculate loan start date from dropdown
   */
  function calculateLoanStartDate(loanStartMode, explicitLoanStartDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (loanStartMode) {
      case 'upon_acceptance':
        return null; // Unknown date (will be determined by context mode)
      case 'today':
        return today;
      case 'tomorrow':
        return addDays(today, 1);
      case 'in-1-week':
        return addDays(today, 7);
      case 'in-1-month':
        return addMonths(today, 1);
      case 'pick-date':
        // Parse the date from YYYY-MM-DD format (native date input)
        return explicitLoanStartDate ? parseIsoDate(explicitLoanStartDate) : null;
      default:
        return null;
    }
  }

  /**
   * Helper function to calculate first payment timing
   * Returns {days, months, years, isMonthBased, isYearBased, exactDate}
   */
  function calculateFirstPaymentTiming(firstPaymentDue, firstPaymentDate, loanStartDate) {
    switch (firstPaymentDue) {
      case '1-week':
        return { days: 7, months: 0, years: 0, isMonthBased: false, isYearBased: false, exactDate: null };
      case '1-month':
        return { days: 30, months: 1, years: 0, isMonthBased: true, isYearBased: false, exactDate: null };
      case '6-months':
        return { days: 182, months: 6, years: 0, isMonthBased: true, isYearBased: false, exactDate: null };
      case '1-year':
        return { days: 365, months: 12, years: 1, isMonthBased: false, isYearBased: true, exactDate: null };
      case '2-years':
        return { days: 730, months: 24, years: 2, isMonthBased: false, isYearBased: true, exactDate: null };
      case '3-years':
        return { days: 1095, months: 36, years: 3, isMonthBased: false, isYearBased: true, exactDate: null };
      case 'pick-date':
        if (firstPaymentDate) {
          // Parse the date string from YYYY-MM-DD format (native date input)
          const pickedDate = parseIsoDate(firstPaymentDate);

          if (!pickedDate) {
            // Invalid date - return default
            return { days: 30, months: 1, years: 0, isMonthBased: true, isYearBased: false, exactDate: null };
          }

          // Calculate days for interest calculation (if loan start is known)
          let daysDiff = 30; // default
          if (loanStartDate instanceof Date) {
            const start = new Date(loanStartDate);
            start.setHours(0, 0, 0, 0);
            const diffMs = pickedDate - start;
            daysDiff = Math.round(diffMs / (1000 * 60 * 60 * 24));
          }

          // Return with exact date - this will be used directly in schedule
          return {
            days: daysDiff,
            months: 0,
            years: 0,
            isMonthBased: false,
            isYearBased: false,
            exactDate: pickedDate
          };
        }
        // If no date picked, use default
        return { days: 30, months: 1, years: 0, isMonthBased: true, isYearBased: false, exactDate: null };
      default:
        return { days: 30, months: 1, years: 0, isMonthBased: true, isYearBased: false, exactDate: null };
    }
  }

  /**
   * Build loan inputs from a form element (calculator card)
   * This extracts all necessary data for calculation from the DOM
   *
   * @param {HTMLElement} formOrContainer - The form element or container with calculator inputs
   * @returns {Object} - Loan inputs ready for calculation
   */
  function buildLoanInputsFromForm(formOrContainer) {
    // Helper to find element within the container
    function getElement(id) {
      return formOrContainer.querySelector('#' + id) || document.getElementById(id);
    }

    // Extract all input values
    const principalValue = getElement('principal')?.value?.trim() || '';
    const loanAmount = parseMoney(principalValue);

    // Check for interest mode toggle
    let annualInterestRate;
    const interestModeElement = getElement('mode-no-interest') || getElement('mode-none');
    if (interestModeElement) {
      // Check if "No interest" mode is active (has the active styling)
      const isNoInterest = interestModeElement.style.background.includes('6ee7b7') ||
                           interestModeElement.classList.contains('active');
      annualInterestRate = isNoInterest ? 0 : parseFloat(getElement('interest')?.value || getElement('interest-rate')?.value || 0);
    } else {
      annualInterestRate = parseFloat(getElement('interest')?.value || getElement('interest-rate')?.value || 0);
    }

    const repaymentType = getElement('repaymentType')?.value || 'one_time';
    let numberOfInstallments = repaymentType === 'one_time' ? 1 : parseInt(getElement('numInstallments')?.value || 12);

    const paymentFrequency = getElement('frequency')?.value || 'every-month';
    const firstPaymentDueOption = getElement('firstPaymentDue')?.value || '1-year';
    const firstPaymentDate = getElement('firstPaymentDate')?.value || '';
    const loanStartMode = getElement('loanStartMode')?.value || 'upon_acceptance';
    const explicitLoanStartDate = getElement('loanStartDate')?.value || '';

    // Context mode (defaults to 'preview' if not present)
    const contextMode = getElement('contextMode')?.value || 'preview';

    // Calculate actual loan start date
    const calculatedLoanStartDate = calculateLoanStartDate(loanStartMode, explicitLoanStartDate);

    // Calculate first payment timing
    const firstPaymentTiming = calculateFirstPaymentTiming(
      firstPaymentDueOption,
      firstPaymentDate,
      calculatedLoanStartDate
    );

    // Determine effective context mode
    let effectiveContextMode = contextMode;
    if (loanStartMode !== 'upon_acceptance') {
      effectiveContextMode = 'actual';
    } else if (contextMode === 'actual') {
      // upon_acceptance + actual mode = treat as today
      if (!calculatedLoanStartDate) {
        calculatedLoanStartDate = getTodayMidnight();
      }
    }

    return {
      loanAmount,
      annualInterestRate,
      repaymentType,
      numberOfInstallments,
      paymentFrequency,
      firstPaymentDays: firstPaymentTiming.days,
      firstPaymentMonths: firstPaymentTiming.months,
      firstPaymentYears: firstPaymentTiming.years || 0,
      firstPaymentIsMonthBased: firstPaymentTiming.isMonthBased || false,
      firstPaymentIsYearBased: firstPaymentTiming.isYearBased || false,
      firstPaymentExactDate: firstPaymentTiming.exactDate || null,
      loanStartMode,
      contextMode: effectiveContextMode,
      explicitLoanStartDate: calculatedLoanStartDate
    };
  }

  /**
   * Calculate loan schedule from form inputs
   * This is a convenience wrapper around generateRepaymentSchedule
   *
   * @param {Object} loanInputs - Loan inputs from buildLoanInputsFromForm
   * @returns {Object} - Complete schedule with rows, totals, and metadata
   */
  function calculateLoanSchedule(loanInputs) {
    return generateRepaymentSchedule(loanInputs);
  }

  /**
   * Calculate loan summary from inputs
   * Returns a summary object with formatted values ready for display
   *
   * @param {Object} loanInputs - Loan inputs
   * @param {Object} schedule - Schedule from calculateLoanSchedule (optional, will calculate if not provided)
   * @returns {Object} - Summary with all loan details
   */
  function calculateLoanSummary(loanInputs, schedule) {
    // Generate schedule if not provided
    if (!schedule) {
      schedule = calculateLoanSchedule(loanInputs);
    }

    const loanDuration = calculateLoanDuration(
      schedule.rows,
      loanInputs.explicitLoanStartDate,
      schedule.effectiveMode
    );

    return {
      loanAmount: loanInputs.loanAmount * 100, // in cents
      annualInterestRate: loanInputs.annualInterestRate,
      repaymentType: loanInputs.repaymentType,
      numberOfInstallments: loanInputs.numberOfInstallments,
      loanDuration: loanDuration,
      totalInterest: schedule.totals.interest,
      totalRepayment: schedule.totals.totalRepayment,
      firstDueDate: schedule.rows.length > 0 ? schedule.rows[0].label : 'N/A',
      lastDueDate: schedule.rows.length > 0 ? schedule.rows[schedule.rows.length - 1].label : 'N/A',
      loanStartLabel: schedule.loanStartLabel
    };
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  // Export all public functions to window.PayFriendsCalculator
  window.PayFriendsCalculator = {
    // Core calculation
    generateRepaymentSchedule,
    buildLoanInputsFromForm,
    calculateLoanSchedule,
    calculateLoanSummary,

    // Utilities
    calculateLoanDuration,
    getLoanStartLabelWithContext,
    calculateLoanStartDate,
    calculateFirstPaymentTiming,

    // Date utilities
    addDays,
    addMonths,
    addYears,
    parseIsoDate,
    formatDateDisplay,
    formatDueDateWithWeekday,
    getTodayMidnight,

    // Money utilities
    parseMoney,
    formatMoneyInput,
    formatDurationMonths
  };

  // Also keep the legacy export for backward compatibility
  window.PayFriendsRepayment = {
    generateRepaymentSchedule
  };

})(window);

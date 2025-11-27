/**
 * Loan Timing Utilities
 * SINGLE SOURCE OF TRUTH for loan timing configuration and display
 *
 * This module standardizes how loan timing information is stored and displayed
 * across all pages (wizard steps, agreements overview, manage page, review pages).
 */

(function(window) {
  'use strict';

  /**
   * Loan Timing Configuration Structure
   * This is the canonical representation of timing info for a loan
   *
   * @typedef {Object} LoanTimingConfig
   * @property {string} loanStartType - 'WHEN_AGREEMENT_ACCEPTED' | 'ON_SPECIFIC_DATE'
   * @property {string|null} loanStartDate - ISO date string (YYYY-MM-DD) when type is ON_SPECIFIC_DATE
   * @property {string|null} loanStartOption - Original option: 'upon_acceptance' | 'on-acceptance' | 'today' | 'tomorrow' | 'in-1-week' | 'pick-date'
   *
   * @property {string} fullRepaymentType - 'AFTER_LOAN_START' | 'ON_SPECIFIC_DATE'
   * @property {number} fullRepaymentOffsetValue - Number (1, 6, 12, etc) for AFTER_LOAN_START
   * @property {string} fullRepaymentOffsetUnit - 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' for AFTER_LOAN_START
   * @property {string|null} fullRepaymentDate - ISO date string when type is ON_SPECIFIC_DATE
   * @property {string|null} fullRepaymentOption - Original option: 'in_1_week' | 'in_1_month' | 'in_1_year' | 'pick_date'
   */

  /**
   * Build loan timing config from wizard form data
   * @param {Object} formValues - Form values from Step 2
   * @returns {LoanTimingConfig} Standardized timing configuration
   */
  function buildLoanTimingConfigFromForm(formValues) {
    // LOAN START
    const loanStartOption = formValues.moneySentOption || formValues.loanStartOption || 'upon_acceptance';
    let loanStartType, loanStartDate;

    if (loanStartOption === 'upon_acceptance' || loanStartOption === 'on-acceptance') {
      loanStartType = 'WHEN_AGREEMENT_ACCEPTED';
      loanStartDate = null;
    } else if (loanStartOption === 'pick-date' || loanStartOption === 'custom') {
      loanStartType = 'ON_SPECIFIC_DATE';
      loanStartDate = formValues.moneySentDate || formValues.loanStartDate || null;
    } else {
      // today, tomorrow, in-1-week, etc. - these resolve to specific dates
      loanStartType = 'ON_SPECIFIC_DATE';
      loanStartDate = formValues.moneySentDate || formValues.loanStartDate || resolveLoanStartDate(loanStartOption);
    }

    // FULL REPAYMENT DUE
    const fullRepaymentOption = formValues.oneTimeDueOption || formValues.firstPaymentOption || 'in_1_year';
    let fullRepaymentType, fullRepaymentOffsetValue, fullRepaymentOffsetUnit, fullRepaymentDate;

    if (fullRepaymentOption === 'pick_date' || fullRepaymentOption === 'pick-date') {
      fullRepaymentType = 'ON_SPECIFIC_DATE';
      fullRepaymentDate = formValues.dueDate || formValues.fullRepaymentDate || null;
      fullRepaymentOffsetValue = null;
      fullRepaymentOffsetUnit = null;
    } else {
      // Relative offset like 'in_1_week', 'in_1_month', 'in_1_year', etc.
      fullRepaymentType = 'AFTER_LOAN_START';
      fullRepaymentDate = null;

      const offset = parseOffsetOption(fullRepaymentOption);
      fullRepaymentOffsetValue = offset.value;
      fullRepaymentOffsetUnit = offset.unit;
    }

    return {
      loanStartType,
      loanStartDate,
      loanStartOption,

      fullRepaymentType,
      fullRepaymentOffsetValue,
      fullRepaymentOffsetUnit,
      fullRepaymentDate,
      fullRepaymentOption
    };
  }

  /**
   * Build loan timing config from agreement data (from database)
   * @param {Object} agreement - Agreement object from API
   * @returns {LoanTimingConfig} Standardized timing configuration
   */
  function buildLoanTimingConfigFromAgreement(agreement) {
    // LOAN START
    const moneySentDate = agreement.money_sent_date || agreement.money_transfer_date;
    let loanStartType, loanStartDate, loanStartOption;

    if (!moneySentDate || moneySentDate === 'on-acceptance' || moneySentDate === 'upon agreement acceptance') {
      loanStartType = 'WHEN_AGREEMENT_ACCEPTED';
      loanStartDate = null;
      loanStartOption = 'upon_acceptance';
    } else {
      loanStartType = 'ON_SPECIFIC_DATE';
      loanStartDate = moneySentDate;
      loanStartOption = 'custom';
    }

    // FULL REPAYMENT DUE
    const oneTimeDueOption = agreement.one_time_due_option || agreement.full_repayment_option;
    let fullRepaymentType, fullRepaymentOffsetValue, fullRepaymentOffsetUnit, fullRepaymentDate, fullRepaymentOption;

    if (oneTimeDueOption && oneTimeDueOption !== 'pick_date' && oneTimeDueOption !== 'pick-date') {
      // Relative offset option
      fullRepaymentType = 'AFTER_LOAN_START';
      fullRepaymentOption = oneTimeDueOption;

      const offset = parseOffsetOption(oneTimeDueOption);
      fullRepaymentOffsetValue = offset.value;
      fullRepaymentOffsetUnit = offset.unit;
      fullRepaymentDate = null;
    } else {
      // Specific date
      fullRepaymentType = 'ON_SPECIFIC_DATE';
      fullRepaymentDate = agreement.due_date || null;
      fullRepaymentOption = 'pick_date';
      fullRepaymentOffsetValue = null;
      fullRepaymentOffsetUnit = null;
    }

    return {
      loanStartType,
      loanStartDate,
      loanStartOption,

      fullRepaymentType,
      fullRepaymentOffsetValue,
      fullRepaymentOffsetUnit,
      fullRepaymentDate,
      fullRepaymentOption
    };
  }

  /**
   * Get display label for loan start
   * Shows relative text for pending agreements, calendar date for active agreements
   *
   * @param {LoanTimingConfig} config - Timing configuration
   * @param {string} agreementStatus - 'pending' | 'active' | 'settled' | 'cancelled' | 'declined'
   * @param {string|Date|null} acceptedAt - When agreement was accepted (for active agreements)
   * @returns {string} Display label
   */
  function getLoanStartDisplay(config, agreementStatus, acceptedAt) {
    if (config.loanStartType === 'WHEN_AGREEMENT_ACCEPTED') {
      return 'When agreement is accepted';
    }

    if (config.loanStartType === 'ON_SPECIFIC_DATE' && config.loanStartDate) {
      return formatDate(config.loanStartDate);
    }

    // Fallback
    return 'To be confirmed';
  }

  /**
   * Get display label for full repayment due
   * Shows relative text for pending agreements, computed date for active agreements
   *
   * @param {LoanTimingConfig} config - Timing configuration
   * @param {string} agreementStatus - 'pending' | 'active' | 'settled' | 'cancelled' | 'declined'
   * @param {string|Date|null} acceptedAt - When agreement was accepted (for active agreements)
   * @returns {string} Display label
   */
  function getFullRepaymentDueDisplay(config, agreementStatus, acceptedAt) {
    const { fullRepaymentType, fullRepaymentOffsetValue, fullRepaymentOffsetUnit, fullRepaymentDate } = config;

    // For AFTER_LOAN_START type
    if (fullRepaymentType === 'AFTER_LOAN_START' && fullRepaymentOffsetValue && fullRepaymentOffsetUnit) {
      const unitLabel = fullRepaymentOffsetUnit.toLowerCase();
      const unitLabelPlural = fullRepaymentOffsetValue > 1
        ? (unitLabel === 'day' ? 'days' : unitLabel === 'week' ? 'weeks' : unitLabel === 'month' ? 'months' : unitLabel === 'year' ? 'years' : unitLabel + 's')
        : unitLabel;
      const offsetText = `${fullRepaymentOffsetValue} ${unitLabelPlural}`;

      // While agreement is not yet accepted, always show the relative rule
      if (agreementStatus === 'pending' || agreementStatus === 'declined' || agreementStatus === 'cancelled' || !acceptedAt) {
        return `${offsetText} after loan start`;
      }

      // If agreement is active and we have acceptedAt, we may compute a real date
      if ((agreementStatus === 'active' || agreementStatus === 'settled') && acceptedAt) {
        // Check if loan start is WHEN_AGREEMENT_ACCEPTED
        if (config.loanStartType === 'WHEN_AGREEMENT_ACCEPTED') {
          // Calculate date from acceptedAt
          const fullDueDate = addOffset(acceptedAt, fullRepaymentOffsetValue, fullRepaymentOffsetUnit);
          return formatDate(fullDueDate);
        } else if (config.loanStartType === 'ON_SPECIFIC_DATE' && config.loanStartDate) {
          // Calculate date from specific loan start date
          const fullDueDate = addOffset(config.loanStartDate, fullRepaymentOffsetValue, fullRepaymentOffsetUnit);
          return formatDate(fullDueDate);
        }
      }

      // Fallback: show relative text
      return `${offsetText} after loan start`;
    }

    // For ON_SPECIFIC_DATE type
    if (fullRepaymentType === 'ON_SPECIFIC_DATE' && fullRepaymentDate) {
      return formatDate(fullRepaymentDate);
    }

    // Fallback
    return 'To be confirmed';
  }

  /**
   * Get loan duration display
   * Shows relative duration for pending agreements, actual dates for active agreements
   *
   * @param {LoanTimingConfig} config - Timing configuration
   * @param {string} agreementStatus - 'pending' | 'active' | 'settled' | 'cancelled' | 'declined'
   * @param {string|Date|null} acceptedAt - When agreement was accepted
   * @returns {string|null} Duration display text or null
   */
  function getLoanDurationDisplay(config, agreementStatus, acceptedAt) {
    // For pending agreements with AFTER_LOAN_START, show relative duration
    if (agreementStatus === 'pending' && config.fullRepaymentType === 'AFTER_LOAN_START') {
      const { fullRepaymentOffsetValue, fullRepaymentOffsetUnit } = config;
      if (fullRepaymentOffsetValue && fullRepaymentOffsetUnit) {
        const unitLabel = fullRepaymentOffsetUnit.toLowerCase();
        const unitLabelPlural = fullRepaymentOffsetValue > 1
          ? (unitLabel === 'day' ? 'days' : unitLabel === 'week' ? 'weeks' : unitLabel === 'month' ? 'months' : unitLabel === 'year' ? 'years' : unitLabel + 's')
          : unitLabel;
        return `${fullRepaymentOffsetValue} ${unitLabelPlural} after agreement is accepted`;
      }
    }

    // For active/settled agreements, we can calculate actual duration if needed
    // For now, return null and let calling code handle it
    return null;
  }

  // ==========================================================================
  // INTERNAL HELPER FUNCTIONS
  // ==========================================================================

  /**
   * Parse offset option string like 'in_1_year', 'in_6_months' into value and unit
   * @param {string} option - Option string
   * @returns {{value: number, unit: string}} Parsed offset
   */
  function parseOffsetOption(option) {
    // Map of known options to their offsets
    const mapping = {
      // Weeks
      'in_1_week': { value: 1, unit: 'WEEK' },
      '1-week': { value: 1, unit: 'WEEK' },

      // Months
      'in_1_month': { value: 1, unit: 'MONTH' },
      '1-month': { value: 1, unit: 'MONTH' },
      'in_3_months': { value: 3, unit: 'MONTH' },
      '3-months': { value: 3, unit: 'MONTH' },
      'in_6_months': { value: 6, unit: 'MONTH' },
      '6-months': { value: 6, unit: 'MONTH' },

      // Years
      'in_1_year': { value: 1, unit: 'YEAR' },
      '1-year': { value: 1, unit: 'YEAR' },
      'in_1_years': { value: 1, unit: 'YEAR' },
      'in_2_years': { value: 2, unit: 'YEAR' },
      '2-years': { value: 2, unit: 'YEAR' },
      'in_3_years': { value: 3, unit: 'YEAR' },
      '3-years': { value: 3, unit: 'YEAR' }
    };

    if (mapping[option]) {
      return mapping[option];
    }

    // Try to parse generic format like 'in_X_days', 'in_X_months', 'in_X_years'
    const match = option.match(/^in_(\d+)_(day|week|month|year)s?$/);
    if (match) {
      return {
        value: parseInt(match[1]),
        unit: match[2].toUpperCase()
      };
    }

    // Default fallback
    return { value: 1, unit: 'YEAR' };
  }

  /**
   * Resolve loan start date option to actual date
   * @param {string} option - Option like 'today', 'tomorrow', 'in-1-week'
   * @returns {string|null} ISO date string or null
   */
  function resolveLoanStartDate(option) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (option) {
      case 'today':
        return dateToISOString(today);
      case 'tomorrow':
        return dateToISOString(addDays(today, 1));
      case 'in-1-week':
        return dateToISOString(addDays(today, 7));
      case 'in-1-month':
        return dateToISOString(addMonths(today, 1));
      default:
        return null;
    }
  }

  /**
   * Add offset to a date
   * @param {string|Date} date - Base date
   * @param {number} value - Offset value
   * @param {string} unit - 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'
   * @returns {Date} Resulting date
   */
  function addOffset(date, value, unit) {
    const baseDate = typeof date === 'string' ? new Date(date) : new Date(date);

    switch (unit.toUpperCase()) {
      case 'DAY':
        return addDays(baseDate, value);
      case 'WEEK':
        return addDays(baseDate, value * 7);
      case 'MONTH':
        return addMonths(baseDate, value);
      case 'YEAR':
        return addYears(baseDate, value);
      default:
        return baseDate;
    }
  }

  /**
   * Add days to a date
   */
  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Add months to a date
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
   * Add years to a date
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
   * Format date for display
   * @param {string|Date} date - Date to format
   * @returns {string} Formatted date like "15 Jan 2025"
   */
  function formatDate(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'Invalid date';

    const day = d.getDate();
    const month = d.toLocaleDateString('en-GB', { month: 'short' });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  }

  /**
   * Convert Date to ISO string (YYYY-MM-DD)
   * @param {Date} date - Date object
   * @returns {string} ISO date string
   */
  function dateToISOString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // ==========================================================================
  // EXPORTS
  // ==========================================================================

  // Export functions to window
  window.LoanTimingUtils = {
    buildLoanTimingConfigFromForm,
    buildLoanTimingConfigFromAgreement,
    getLoanStartDisplay,
    getFullRepaymentDueDisplay,
    getLoanDurationDisplay
  };

  // Also export individual functions for convenience
  window.buildLoanTimingConfigFromForm = buildLoanTimingConfigFromForm;
  window.buildLoanTimingConfigFromAgreement = buildLoanTimingConfigFromAgreement;
  window.getLoanStartDisplay = getLoanStartDisplay;
  window.getFullRepaymentDueDisplay = getFullRepaymentDueDisplay;
  window.getLoanDurationDisplay = getLoanDurationDisplay;

})(window);

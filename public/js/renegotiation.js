/**
 * Renegotiation Flow Module
 * Handles structured renegotiation between borrower and lender with two-step approval:
 * 1. Agree on solution type
 * 2. Agree on concrete values (amounts, dates)
 */

// Solution type options for different loan types
const SOLUTION_TYPES = {
  installment: [
    {
      value: 'lower_installment',
      label: 'Lower my installment amount',
      sublabel: 'Loan will extend',
      description: 'Reduce the amount per payment period. The loan duration will increase to cover the full amount.'
    },
    {
      value: 'postpone_upcoming',
      label: 'Postpone the upcoming installment',
      sublabel: 'Push the next payment date',
      description: 'Delay your next payment by a few days or weeks. All future payments will shift accordingly.'
    },
    {
      value: 'skip_upcoming',
      label: 'Skip the upcoming installment',
      sublabel: 'Catch up later',
      description: 'Skip your next payment and spread the amount across future installments or add one extra payment at the end.'
    },
    {
      value: 'temporary_pause',
      label: 'Temporary payment pause',
      sublabel: 'Take a break',
      description: 'Pause payments for a short period (1-3 installments). Resume afterwards with adjusted schedule.'
    },
    {
      value: 'pay_part_adjust',
      label: 'Pay part now and adjust my schedule',
      sublabel: 'Partial payment with new plan',
      description: 'Make a partial payment now and adjust the remaining installments to a more manageable amount.'
    }
  ],
  one_time: [
    {
      value: 'extend_due_date',
      label: 'Extend the due date',
      sublabel: 'Get more time',
      description: 'Push the repayment deadline to a later date, giving you more time to gather the full amount.'
    },
    {
      value: 'split_repayment',
      label: 'Split the repayment into smaller parts',
      sublabel: 'Pay in installments',
      description: 'Convert the single payment into 2-3 smaller payments spread over time.'
    },
    {
      value: 'pay_part_rest_later',
      label: 'Pay part now, rest later',
      sublabel: 'Immediate partial + deadline for remainder',
      description: 'Pay what you can afford now and set a new due date for the remaining balance.'
    }
  ]
};

// Get human-readable label for solution type
function getSolutionTypeLabel(type) {
  const allTypes = [...SOLUTION_TYPES.installment, ...SOLUTION_TYPES.one_time];
  const found = allTypes.find(t => t.value === type);
  return found ? found.label : type;
}

// Get solution type description
function getSolutionTypeDescription(type) {
  const allTypes = [...SOLUTION_TYPES.installment, ...SOLUTION_TYPES.one_time];
  const found = allTypes.find(t => t.value === type);
  return found ? found.description : '';
}

// Load active renegotiation for an agreement
async function loadRenegotiation(agreementId) {
  try {
    const response = await fetch(`/api/agreements/${agreementId}/renegotiation`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to load renegotiation');
    }
    const data = await response.json();
    return data; // null if no active renegotiation
  } catch (err) {
    console.error('Error loading renegotiation:', err);
    return null;
  }
}

// Initialize renegotiation (borrower starts)
async function initializeRenegotiation(agreementId, selectedType, canPayNowCents, borrowerNote) {
  try {
    const response = await fetch(`/api/agreements/${agreementId}/renegotiation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedType,
        canPayNowCents: canPayNowCents || null,
        borrowerNote: borrowerNote || null
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create renegotiation');
    }

    return await response.json();
  } catch (err) {
    console.error('Error creating renegotiation:', err);
    throw err;
  }
}

// Lender responds to solution type
async function respondToType(agreementId, action, suggestedType = null, responseNote = null) {
  try {
    const response = await fetch(`/api/agreements/${agreementId}/renegotiation/respond-type`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        suggestedType,
        responseNote
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to respond to type');
    }

    return await response.json();
  } catch (err) {
    console.error('Error responding to type:', err);
    throw err;
  }
}

// Borrower responds to lender's suggested type
async function respondToSuggestedType(agreementId, action) {
  try {
    const response = await fetch(`/api/agreements/${agreementId}/renegotiation/respond-suggested-type`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to respond to suggested type');
    }

    return await response.json();
  } catch (err) {
    console.error('Error responding to suggested type:', err);
    throw err;
  }
}

// Borrower proposes values
async function proposeValues(agreementId, values) {
  try {
    const response = await fetch(`/api/agreements/${agreementId}/renegotiation/propose-values`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to propose values');
    }

    return await response.json();
  } catch (err) {
    console.error('Error proposing values:', err);
    throw err;
  }
}

// Lender responds to values
async function respondToValues(agreementId, action, counterValues = null, responseNote = null) {
  try {
    const response = await fetch(`/api/agreements/${agreementId}/renegotiation/respond-values`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        counterValues,
        responseNote
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to respond to values');
    }

    return await response.json();
  } catch (err) {
    console.error('Error responding to values:', err);
    throw err;
  }
}

// Borrower responds to lender's counter values
async function respondToCounterValues(agreementId, action) {
  try {
    const response = await fetch(`/api/agreements/${agreementId}/renegotiation/respond-counter-values`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to respond to counter values');
    }

    return await response.json();
  } catch (err) {
    console.error('Error responding to counter values:', err);
    throw err;
  }
}

// Format timestamp for display
function formatTimestamp(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Build HTML for history timeline
function buildHistoryTimeline(history) {
  if (!history || history.length === 0) {
    return '<p class="muted">No history yet.</p>';
  }

  let html = '<div class="renegotiation-history">';

  history.forEach((event, index) => {
    const actorLabel = event.actor === 'borrower' ? 'Borrower' : 'Lender';
    html += `
      <div class="history-event">
        <div class="history-dot"></div>
        <div class="history-content">
          <div class="history-message">${event.message}</div>
          <div class="history-meta">
            <span class="history-actor">${actorLabel}</span>
            <span class="history-time">${formatTimestamp(event.timestamp)}</span>
          </div>
        </div>
      </div>
    `;
  });

  html += '</div>';
  return html;
}

// Build HTML for solution type selection (Step 1)
function buildSolutionTypeOptions(loanType, selectedType = null) {
  const options = loanType === 'installment' ? SOLUTION_TYPES.installment : SOLUTION_TYPES.one_time;

  let html = '<div class="solution-types">';

  options.forEach(option => {
    const checked = option.value === selectedType ? 'checked' : '';
    html += `
      <div class="form-radio">
        <input type="radio" name="solution-type" id="solution-${option.value}"
               value="${option.value}" ${checked}>
        <label for="solution-${option.value}">
          <strong>${option.label}</strong>
          ${option.sublabel ? `<span class="sublabel">${option.sublabel}</span>` : ''}
          <div class="description">${option.description}</div>
        </label>
      </div>
    `;
  });

  html += '</div>';
  return html;
}

// Build HTML for values form based on agreed type
function buildValuesForm(agreedType, loanType, initialValues = null) {
  let html = '<div class="values-form">';

  // Common field: How much can you pay now?
  const canPayNow = initialValues?.canPayNowCents ? (initialValues.canPayNowCents / 100).toFixed(2) : '';

  if (loanType === 'installment') {
    if (agreedType === 'lower_installment') {
      html += `
        <div class="form-group">
          <label class="form-label">New installment amount per period</label>
          <div class="input-with-prefix">
            <span class="prefix">€</span>
            <input type="number" id="new-installment-amount" step="0.01" min="0.01"
                   value="${initialValues?.newInstallmentAmount || ''}" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">How much can you pay now? (optional)</label>
          <div class="input-with-prefix">
            <span class="prefix">€</span>
            <input type="number" id="can-pay-now" step="0.01" min="0" value="${canPayNow}">
          </div>
          <small class="helper-text">Any amount helps and will immediately reduce what you owe.</small>
        </div>
      `;
    } else if (agreedType === 'postpone_upcoming') {
      html += `
        <div class="form-group">
          <label class="form-label">New date for upcoming installment</label>
          <input type="date" id="postpone-date" value="${initialValues?.postponeDate || ''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">How much can you pay now? (optional)</label>
          <div class="input-with-prefix">
            <span class="prefix">€</span>
            <input type="number" id="can-pay-now" step="0.01" min="0" value="${canPayNow}">
          </div>
        </div>
      `;
    } else if (agreedType === 'skip_upcoming') {
      html += `
        <div class="form-group">
          <label class="form-label">How to catch up?</label>
          <div class="form-radio">
            <input type="radio" name="skip-method" id="skip-spread" value="spread"
                   ${!initialValues?.skipMethod || initialValues?.skipMethod === 'spread' ? 'checked' : ''}>
            <label for="skip-spread">Add a bit to each future installment</label>
          </div>
          <div class="form-radio">
            <input type="radio" name="skip-method" id="skip-extra" value="extra"
                   ${initialValues?.skipMethod === 'extra' ? 'checked' : ''}>
            <label for="skip-extra">Add one extra installment at the end</label>
          </div>
        </div>
        <div class="form-group" id="skip-spread-amount" style="display: none;">
          <label class="form-label">How much extra per future installment?</label>
          <div class="input-with-prefix">
            <span class="prefix">€</span>
            <input type="number" id="extra-per-installment" step="0.01" min="0.01"
                   value="${initialValues?.extraPerInstallment || ''}">
          </div>
        </div>
        <div class="form-group" id="skip-extra-amount" style="display: none;">
          <label class="form-label">Amount for extra final installment</label>
          <div class="input-with-prefix">
            <span class="prefix">€</span>
            <input type="number" id="extra-final-amount" step="0.01" min="0.01"
                   value="${initialValues?.extraFinalAmount || ''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">How much can you pay now? (optional)</label>
          <div class="input-with-prefix">
            <span class="prefix">€</span>
            <input type="number" id="can-pay-now" step="0.01" min="0" value="${canPayNow}">
          </div>
        </div>
      `;
    } else if (agreedType === 'temporary_pause') {
      html += `
        <div class="form-group">
          <label class="form-label">Pause for how many installments?</label>
          <input type="number" id="pause-count" min="1" max="5" value="${initialValues?.pauseCount || 1}" required>
          <small class="helper-text">Maximum 5 installments</small>
        </div>
        <div class="form-group">
          <label class="form-label">How much can you pay now? (optional)</label>
          <div class="input-with-prefix">
            <span class="prefix">€</span>
            <input type="number" id="can-pay-now" step="0.01" min="0" value="${canPayNow}">
          </div>
        </div>
      `;
    } else if (agreedType === 'pay_part_adjust') {
      html += `
        <div class="form-group">
          <label class="form-label">How much can you pay now?</label>
          <div class="input-with-prefix">
            <span class="prefix">€</span>
            <input type="number" id="can-pay-now" step="0.01" min="0.01" value="${canPayNow}" required>
          </div>
          <small class="helper-text">This amount will immediately reduce what you owe.</small>
        </div>
        <div class="form-group">
          <label class="form-label">New installment amount per period</label>
          <div class="input-with-prefix">
            <span class="prefix">€</span>
            <input type="number" id="new-installment-amount" step="0.01" min="0.01"
                   value="${initialValues?.newInstallmentAmount || ''}" required>
          </div>
        </div>
      `;
    }
  } else { // one_time
    if (agreedType === 'extend_due_date') {
      html += `
        <div class="form-group">
          <label class="form-label">New due date</label>
          <input type="date" id="new-due-date" value="${initialValues?.newDueDate || ''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">How much can you pay now? (optional)</label>
          <div class="input-with-prefix">
            <span class="prefix">€</span>
            <input type="number" id="can-pay-now" step="0.01" min="0" value="${canPayNow}">
          </div>
        </div>
      `;
    } else if (agreedType === 'split_repayment') {
      html += `
        <p class="helper-text" style="margin-bottom: 16px;">Split your payment into 2 parts:</p>
        <div class="form-group">
          <label class="form-label">First payment amount</label>
          <div class="input-with-prefix">
            <span class="prefix">€</span>
            <input type="number" id="first-payment-amount" step="0.01" min="0.01"
                   value="${initialValues?.firstPaymentAmount || ''}" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">First payment date</label>
          <input type="date" id="first-payment-date" value="${initialValues?.firstPaymentDate || ''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Second payment amount</label>
          <div class="input-with-prefix">
            <span class="prefix">€</span>
            <input type="number" id="second-payment-amount" step="0.01" min="0.01"
                   value="${initialValues?.secondPaymentAmount || ''}" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Second payment date</label>
          <input type="date" id="second-payment-date" value="${initialValues?.secondPaymentDate || ''}" required>
        </div>
      `;
    } else if (agreedType === 'pay_part_rest_later') {
      html += `
        <div class="form-group">
          <label class="form-label">Amount you can pay now</label>
          <div class="input-with-prefix">
            <span class="prefix">€</span>
            <input type="number" id="can-pay-now" step="0.01" min="0.01" value="${canPayNow}" required>
          </div>
          <small class="helper-text">This will immediately reduce what you owe.</small>
        </div>
        <div class="form-group">
          <label class="form-label">Due date for remaining amount</label>
          <input type="date" id="remaining-due-date" value="${initialValues?.remainingDueDate || ''}" required>
        </div>
      `;
    }
  }

  html += '</div>';
  return html;
}

// Collect values from the form based on agreed type
function collectValuesFromForm(agreedType, loanType) {
  const values = {};

  // Get canPayNow if present
  const canPayNowInput = document.getElementById('can-pay-now');
  if (canPayNowInput && canPayNowInput.value) {
    values.canPayNowCents = Math.round(parseFloat(canPayNowInput.value) * 100);
  }

  if (loanType === 'installment') {
    if (agreedType === 'lower_installment') {
      values.newInstallmentAmount = parseFloat(document.getElementById('new-installment-amount').value);
    } else if (agreedType === 'postpone_upcoming') {
      values.postponeDate = document.getElementById('postpone-date').value;
    } else if (agreedType === 'skip_upcoming') {
      const skipMethod = document.querySelector('input[name="skip-method"]:checked').value;
      values.skipMethod = skipMethod;
      if (skipMethod === 'spread') {
        values.extraPerInstallment = parseFloat(document.getElementById('extra-per-installment').value);
      } else {
        values.extraFinalAmount = parseFloat(document.getElementById('extra-final-amount').value);
      }
    } else if (agreedType === 'temporary_pause') {
      values.pauseCount = parseInt(document.getElementById('pause-count').value);
    } else if (agreedType === 'pay_part_adjust') {
      values.newInstallmentAmount = parseFloat(document.getElementById('new-installment-amount').value);
    }
  } else { // one_time
    if (agreedType === 'extend_due_date') {
      values.newDueDate = document.getElementById('new-due-date').value;
    } else if (agreedType === 'split_repayment') {
      values.firstPaymentAmount = parseFloat(document.getElementById('first-payment-amount').value);
      values.firstPaymentDate = document.getElementById('first-payment-date').value;
      values.secondPaymentAmount = parseFloat(document.getElementById('second-payment-amount').value);
      values.secondPaymentDate = document.getElementById('second-payment-date').value;
    } else if (agreedType === 'pay_part_rest_later') {
      values.remainingDueDate = document.getElementById('remaining-due-date').value;
    }
  }

  return values;
}

// Build HTML for displaying proposed values
function buildValuesDisplay(agreedType, loanType, values) {
  let html = '<div class="values-display">';

  if (values.canPayNowCents) {
    html += `
      <div class="detail-row">
        <span class="detail-label">Pay now</span>
        <span class="detail-value">${formatEuro0(values.canPayNowCents / 100)}</span>
      </div>
    `;
  }

  if (loanType === 'installment') {
    if (agreedType === 'lower_installment') {
      html += `
        <div class="detail-row">
          <span class="detail-label">New installment</span>
          <span class="detail-value">${formatEuro0(values.newInstallmentAmount)}</span>
        </div>
      `;
    } else if (agreedType === 'postpone_upcoming') {
      html += `
        <div class="detail-row">
          <span class="detail-label">New date</span>
          <span class="detail-value">${new Date(values.postponeDate).toLocaleDateString('nl-NL')}</span>
        </div>
      `;
    } else if (agreedType === 'skip_upcoming') {
      if (values.skipMethod === 'spread') {
        html += `
          <div class="detail-row">
            <span class="detail-label">Method</span>
            <span class="detail-value">Spread across future payments</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Extra per installment</span>
            <span class="detail-value">${formatEuro0(values.extraPerInstallment)}</span>
          </div>
        `;
      } else {
        html += `
          <div class="detail-row">
            <span class="detail-label">Method</span>
            <span class="detail-value">Add extra payment at end</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Extra final amount</span>
            <span class="detail-value">${formatEuro0(values.extraFinalAmount)}</span>
          </div>
        `;
      }
    } else if (agreedType === 'temporary_pause') {
      html += `
        <div class="detail-row">
          <span class="detail-label">Pause duration</span>
          <span class="detail-value">${values.pauseCount} installment${values.pauseCount === 1 ? '' : 's'}</span>
        </div>
      `;
    } else if (agreedType === 'pay_part_adjust') {
      html += `
        <div class="detail-row">
          <span class="detail-label">New installment</span>
          <span class="detail-value">${formatEuro0(values.newInstallmentAmount)}</span>
        </div>
      `;
    }
  } else { // one_time
    if (agreedType === 'extend_due_date') {
      html += `
        <div class="detail-row">
          <span class="detail-label">New due date</span>
          <span class="detail-value">${new Date(values.newDueDate).toLocaleDateString('nl-NL')}</span>
        </div>
      `;
    } else if (agreedType === 'split_repayment') {
      html += `
        <div class="detail-row">
          <span class="detail-label">First payment</span>
          <span class="detail-value">${formatEuro0(values.firstPaymentAmount)} on ${new Date(values.firstPaymentDate).toLocaleDateString('nl-NL')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Second payment</span>
          <span class="detail-value">${formatEuro0(values.secondPaymentAmount)} on ${new Date(values.secondPaymentDate).toLocaleDateString('nl-NL')}</span>
        </div>
      `;
    } else if (agreedType === 'pay_part_rest_later') {
      html += `
        <div class="detail-row">
          <span class="detail-label">Remaining due date</span>
          <span class="detail-value">${new Date(values.remainingDueDate).toLocaleDateString('nl-NL')}</span>
        </div>
      `;
    }
  }

  html += '</div>';
  return html;
}

// Export for use in HTML
if (typeof window !== 'undefined') {
  window.RenegotiationModule = {
    SOLUTION_TYPES,
    getSolutionTypeLabel,
    getSolutionTypeDescription,
    loadRenegotiation,
    initializeRenegotiation,
    respondToType,
    respondToSuggestedType,
    proposeValues,
    respondToValues,
    respondToCounterValues,
    buildHistoryTimeline,
    buildSolutionTypeOptions,
    buildValuesForm,
    buildValuesDisplay,
    collectValuesFromForm,
    formatTimestamp
  };
}

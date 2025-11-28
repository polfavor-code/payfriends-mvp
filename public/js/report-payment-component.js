/**
 * Report Payment Component
 * Reusable component for reporting payments on loan agreements.
 * Extracted from review-details.html to be used across multiple pages.
 * 
 * Features:
 * - Autofill "amount due today"
 * - Live overpayment impact calculations
 * - Proof of payment upload with drag-and-drop
 * - Payment method selection with details display
 * - Full form validation
 * 
 * Dependencies:
 * - formatCurrency2 (from formatters.js)
 * - formatDate (from formatters.js or review-details.html)
 * - escapeHtml helper function
 * - getPaymentMethodInfo helper function
 */

(function () {
  'use strict';

  // Store component state
  let componentState = {
    agreement: null,
    currentUser: null,
    nextPaymentInfo: null,
    config: null
  };

  /**
   * Initialize the report payment form
   * @param {Object} agreement - Agreement data
   * @param {Object} currentUser - Current user data
   * @param {Object} nextPaymentInfo - Next payment info (amount_cents, due_date)
   * @param {Object} config - Configuration object
   *   - containerId: ID of container element
   *   - onSuccess: callback(agreement) when payment reported successfully
   *   - onCancel: callback() when form is cancelled
   *   - showCancelButton: boolean (default true)
   *   - submitButtonText: string (default 'Report repayment')
   */
  window.ReportPaymentComponent = {
    initialize: function (agreement, currentUser, nextPaymentInfo, config) {
      componentState.agreement = agreement;
      componentState.currentUser = currentUser;
      componentState.nextPaymentInfo = nextPaymentInfo;
      componentState.config = config || {};

      const container = document.getElementById(config.containerId);
      if (!container) {
        console.error(`[ReportPaymentComponent] Container ${config.containerId} not found`);
        return;
      }

      // Show the container
      container.classList.remove('hidden');

      // Set up the form
      this.setupForm();
    },

    setupForm: function () {
      const { agreement, currentUser, nextPaymentInfo, config } = componentState;

      // Determine lender name (first name only)
      const lenderFullName = agreement.lender_full_name || agreement.lender_name || agreement.lender_email;
      const lenderName = lenderFullName.split(' ')[0];

      // Set lender name in subtitle
      const subtitleEl = document.getElementById('inline-lender-name');
      if (subtitleEl) {
        subtitleEl.textContent = lenderName;
      }

      // Set submit button text
      const submitBtn = document.getElementById('inline-payment-submit');
      if (submitBtn) {
        const buttonText = config.submitButtonText || `Report repayment to ${lenderName}`;
        submitBtn.textContent = buttonText;
      }

      // Set fairness explanation text based on repayment type
      const fairnessDetail = document.getElementById('fairness-explanation-detail');
      if (fairnessDetail) {
        if (agreement.repayment_type === 'one_time') {
          fairnessDetail.textContent = 'Paying earlier reduces interest, so your total repayment becomes lower.';
        } else {
          fairnessDetail.textContent = 'Paying more than the due amount lowers interest and adjusts future installments. (Try adding a higher amount to see the changes)';
        }
      }

      // Populate payment methods
      this.populatePaymentMethods();

      // Setup proof requirement based on agreement
      this.setupProofRequirement();

      // Setup payment method details toggle
      this.setupPaymentMethodToggle();

      // Setup autofill link
      this.setupAutofillLink();

      // Setup drag and drop for proof
      this.setupProofDropzone();

      // Setup form submission
      this.setupFormSubmission();

      // Setup cancel button visibility
      const container = document.getElementById(config.containerId);
      const cancelBtn = container ? container.querySelector('.secondary') : null;
      if (cancelBtn && config.showCancelButton === false) {
        cancelBtn.style.display = 'none';
      }
    },

    populatePaymentMethods: function () {
      const { agreement } = componentState;
      const paymentMethodSelect = document.getElementById('inline-payment-method');

      if (!paymentMethodSelect) return;

      paymentMethodSelect.innerHTML = '';

      // Get allowed methods from agreement
      const allowedMethods = agreement.payment_preference_method
        ? agreement.payment_preference_method.split(',').map(m => m.trim())
        : [];

      // Map method values to display names
      const methodNames = {
        'bank': 'Bank transfer',
        'cash': 'Cash',
        'revolut': 'Revolut',
        'bizum': 'Bizum',
        'paypal': 'PayPal',
        'crypto': 'Crypto',
        'any': 'Any method',
        'other': 'Other'
      };

      // Populate dropdown with only allowed methods
      if (allowedMethods.length > 0) {
        // If multiple methods, add placeholder
        if (allowedMethods.length > 1) {
          const placeholder = document.createElement('option');
          placeholder.value = '';
          placeholder.textContent = 'Select method...';
          paymentMethodSelect.appendChild(placeholder);
        }

        // Add allowed methods
        allowedMethods.forEach(method => {
          const option = document.createElement('option');
          option.value = method;
          option.textContent = methodNames[method] || method;
          // If only one method, auto-select it
          if (allowedMethods.length === 1) {
            option.selected = true;
          }
          paymentMethodSelect.appendChild(option);
        });
      } else {
        // Fallback: show all methods if none specified
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Select method...';
        paymentMethodSelect.appendChild(placeholder);

        Object.keys(methodNames).forEach(method => {
          const option = document.createElement('option');
          option.value = method;
          option.textContent = methodNames[method];
          paymentMethodSelect.appendChild(option);
        });
      }
    },

    setupProofRequirement: function () {
      const { agreement } = componentState;

      // Get allowed methods
      const allowedMethods = agreement.payment_preference_method
        ? agreement.payment_preference_method.split(',').map(m => m.trim())
        : [];

      // Detect if this is a cash-only agreement
      const isCashOnly = allowedMethods.length === 1 && allowedMethods[0] === 'cash';

      const proofInput = document.getElementById('inline-payment-proof');
      const proofLabel = document.getElementById('inline-payment-proof-label');
      const proofSection = document.getElementById('inline-payment-proof-section');

      if (!proofSection) return;

      if (isCashOnly) {
        // Cash-only agreements: hide proof section entirely
        proofSection.style.display = 'none';
        if (proofInput) proofInput.required = false;
      } else if (agreement.proof_required) {
        proofSection.style.display = 'block';
        if (proofLabel) proofLabel.textContent = 'Proof of repayment*';
        if (proofInput) proofInput.required = true;
      } else {
        proofSection.style.display = 'block';
        if (proofLabel) proofLabel.textContent = 'Proof of repayment (optional)';
        if (proofInput) proofInput.required = false;
      }
    },

    setupAutofillLink: function () {
      const { nextPaymentInfo } = componentState;
      const autofillLink = document.getElementById('autofill-amount-link');
      const amountInput = document.getElementById('inline-payment-amount');

      if (!autofillLink || !amountInput || !nextPaymentInfo) return;

      // Show "Amount due today" label
      const dueTodayLabel = document.getElementById('amount-due-today-label');
      if (dueTodayLabel && typeof formatCurrency2 !== 'undefined') {
        const amountDueTodayFormatted = formatCurrency2(nextPaymentInfo.amount_cents);
        dueTodayLabel.textContent = `Amount due today: ${amountDueTodayFormatted}`;
      }

      // Show early payment tip for one-time loans
      const earlyPaymentTip = document.getElementById('early-payment-tip');
      if (earlyPaymentTip && componentState.agreement) {
        if (componentState.agreement.repayment_type === 'one_time' && componentState.agreement.interest_rate > 0) {
          earlyPaymentTip.textContent = 'Paying earlier lowers interest and future amounts.';
          earlyPaymentTip.style.display = 'block';
        } else {
          earlyPaymentTip.style.display = 'none';
        }
      }

      // Autofill click handler
      autofillLink.onclick = () => {
        const amountInEuros = (nextPaymentInfo.amount_cents / 100).toFixed(2);
        amountInput.value = amountInEuros;
        // Trigger update of helper text and impact box
        this.updatePaymentHelpers();
      };

      // Add input listener to amount field
      amountInput.addEventListener('input', () => this.updatePaymentHelpers());
    },

    updatePaymentHelpers: function () {
      const { agreement, nextPaymentInfo } = componentState;
      const amountInput = document.getElementById('inline-payment-amount');
      const helperText = document.getElementById('amount-helper-text');
      const impactBox = document.getElementById('live-impact-box');

      if (!amountInput || !helperText || !impactBox || !nextPaymentInfo) return;

      const inputAmount = parseFloat(amountInput.value) || 0;
      const inputCents = Math.round(inputAmount * 100);
      const nextDueCents = nextPaymentInfo.amount_cents;
      const nextDueAmount = (nextDueCents / 100).toFixed(2);
      let nextDueDate = '';
      if (typeof formatDate !== 'undefined' && nextPaymentInfo.due_date) {
        nextDueDate = formatDate(nextPaymentInfo.due_date);
      }

      // Get total outstanding amount
      const totalOutstandingCents = agreement.today_total_due_cents
        ? (agreement.today_total_due_cents - (agreement.total_paid_cents || 0))
        : (agreement.outstanding_cents || nextDueCents);

      // Clear helper text and hide impact box initially
      helperText.textContent = '';
      impactBox.classList.add('hidden');

      if (inputCents === 0) {
        return;
      }

      // Check for overpayment vs total outstanding first
      if (inputCents > totalOutstandingCents && totalOutstandingCents > 0) {
        // True overpayment - exceeds total outstanding
        const reportedFormatted = typeof formatCurrency2 !== 'undefined' ? formatCurrency2(inputCents) : `€${(inputCents / 100).toFixed(2)}`;
        const outstandingFormatted = typeof formatCurrency2 !== 'undefined' ? formatCurrency2(totalOutstandingCents) : `€${(totalOutstandingCents / 100).toFixed(2)}`;
        const overpaidCents = inputCents - totalOutstandingCents;
        const overpaidFormatted = typeof formatCurrency2 !== 'undefined' ? formatCurrency2(overpaidCents) : `€${(overpaidCents / 100).toFixed(2)}`;

        helperText.innerHTML = `<strong>Note:</strong> You are reporting ${reportedFormatted} while you only owe ${outstandingFormatted}. The extra ${overpaidFormatted} will be recorded as an overpayment. Your loan will be marked as fully repaid.`;
        helperText.style.color = '#3ddc97';
        return;
      }

      if (inputCents === nextDueCents) {
        // Regular payment
        helperText.innerHTML = `You're reporting your scheduled payment.`;
        helperText.style.color = 'var(--muted)';
      } else if (inputCents < nextDueCents) {
        // Partial payment
        const remaining = ((nextDueCents - inputCents) / 100).toFixed(2);
        helperText.innerHTML = `You're reporting <strong>less</strong> than the next due amount. <strong>€${remaining}</strong> remains due${nextDueDate ? ` on <strong>${nextDueDate}</strong>` : ''}.`;
        helperText.style.color = 'var(--muted)';
      } else {
        // Paying more than next scheduled (but not more than total outstanding)
        helperText.innerHTML = 'Great — paying more than scheduled reduces your total interest.';
        const loanType = agreement.repayment_type;
        if (loanType === 'installments') {
          helperText.innerHTML += ' Your future <strong>repayment</strong> amounts will drop; interest will drop too.';
        }
        helperText.style.color = 'rgba(61,220,151,0.9)';

        // Show live impact box
        this.showLiveImpactBox(inputCents);
      }
    },

    showLiveImpactBox: function (paymentCents) {
      const { agreement } = componentState;
      const impactBox = document.getElementById('live-impact-box');
      const impactContent = document.getElementById('impact-content');

      if (!impactBox || !impactContent) return;

      const loanType = agreement.repayment_type;

      // Calculate impact
      const impact = this.calculatePaymentImpact(paymentCents);

      if (!impact) {
        impactBox.classList.add('hidden');
        return;
      }

      let html = '';

      if (loanType === 'installments') {
        html = `
          <div><strong>Interest saved:</strong> €${impact.interestSaved}</div>
          <div><strong>Remaining balance:</strong> €${impact.balanceBefore} → €${impact.balanceAfter}</div>
          <div><strong>Future repayment (excl. interest):</strong> €${impact.repaymentBefore} → €${impact.repaymentAfter}</div>
          <div><strong>New total due projection:</strong> €${impact.newTotalDue}</div>
        `;
      } else {
        // One-time loan
        html = `
          <div><strong>Remaining balance:</strong> €${impact.balanceBefore} → €${impact.balanceAfter}</div>
          <div><strong>Total if you repay now:</strong> €${impact.totalToday}</div>
          <div><strong>You save:</strong> €${impact.futureInterestSaved} in future interest</div>
        `;
      }

      impactContent.innerHTML = html;
      impactBox.classList.remove('hidden');
    },

    calculatePaymentImpact: function (paymentCents) {
      const { agreement } = componentState;
      const loanType = agreement.repayment_type;
      const principalCents = agreement.amount_cents || 0;
      const totalPaidCents = agreement.total_paid_cents || 0;
      const outstandingCents = principalCents - totalPaidCents;
      const annualRate = agreement.interest_rate || 0;

      if (annualRate === 0 || paymentCents <= 0) {
        return null;
      }

      const balanceBefore = (outstandingCents / 100).toFixed(2);
      const balanceAfter = Math.max(0, (outstandingCents - paymentCents) / 100).toFixed(2);

      if (loanType === 'installments') {
        // Installment loan calculation
        const installmentAmount = agreement.installment_amount || 0;
        const installmentCents = Math.round(installmentAmount * 100);
        const installmentCount = agreement.installment_count || 0;
        const paymentFrequency = agreement.payment_frequency || 'monthly';

        // Calculate periods per year
        const periodsPerYear = {
          'weekly': 52,
          'biweekly': 26,
          'every_4_weeks': 13,
          'monthly': 12,
          'quarterly': 4,
          'yearly': 1
        }[paymentFrequency] || 12;

        // Current schedule (before overpayment)
        const numPaymentsMade = Math.floor(totalPaidCents / installmentCents);
        const remainingPeriods = Math.max(0, installmentCount - numPaymentsMade);

        // Simple interest calculation for current schedule
        const currentTotalInterest = outstandingCents * (annualRate / 100) * (remainingPeriods / periodsPerYear);
        const currentRepaymentPerPeriod = installmentAmount;

        // After overpayment
        const excessPayment = paymentCents - installmentCents;
        const newOutstanding = Math.max(0, outstandingCents - excessPayment);

        // Recalculate interest on reduced principal
        const newTotalInterest = newOutstanding * (annualRate / 100) * (remainingPeriods / periodsPerYear);
        const newRepaymentPerPeriod = remainingPeriods > 0 ? newOutstanding / remainingPeriods / 100 : 0;

        const interestSaved = ((currentTotalInterest - newTotalInterest) / 100).toFixed(2);
        const repaymentBefore = currentRepaymentPerPeriod.toFixed(2);
        const repaymentAfter = newRepaymentPerPeriod.toFixed(2);
        const newTotalDue = ((newOutstanding + newTotalInterest) / 100).toFixed(2);

        return {
          interestSaved,
          balanceBefore,
          balanceAfter,
          repaymentBefore,
          repaymentAfter,
          newTotalDue
        };

      } else {
        // One-time loan
        const dueDate = new Date(agreement.due_date);
        const today = new Date();

        // Calculate accrued interest to today
        const startDate = new Date(agreement.start_date || agreement.created_at);
        const daysElapsed = Math.max(0, Math.floor((today - startDate) / (1000 * 60 * 60 * 24)));
        const accruedInterest = (outstandingCents * (annualRate / 100) * (daysElapsed / 365));

        const totalToday = ((outstandingCents + accruedInterest) / 100).toFixed(2);

        // Calculate remaining interest if paid at due date
        const totalDays = Math.max(0, Math.floor((dueDate - startDate) / (1000 * 60 * 60 * 24)));
        const fullInterest = (outstandingCents * (annualRate / 100) * (totalDays / 365));

        // After this payment
        const newPrincipal = Math.max(0, outstandingCents - paymentCents);
        const remainingDays = Math.max(0, Math.floor((dueDate - today) / (1000 * 60 * 60 * 24)));
        const newInterest = (newPrincipal * (annualRate / 100) * (remainingDays / 365));

        const futureInterestSaved = ((fullInterest - newInterest) / 100).toFixed(2);

        return {
          balanceBefore,
          balanceAfter,
          totalToday,
          futureInterestSaved
        };
      }
    },

    setupPaymentMethodToggle: function () {
      const { agreement } = componentState;
      const paymentMethodSelect = document.getElementById('inline-payment-method');
      const detailsSection = document.getElementById('inline-payment-method-details');

      if (!paymentMethodSelect || !detailsSection) return;

      // Get allowed methods
      const allowedMethods = agreement.payment_preference_method
        ? agreement.payment_preference_method.split(',').map(m => m.trim())
        : [];

      const autoSelected = allowedMethods.length === 1;

      // Render method details
      const renderMethodDetails = (methodValue) => {
        if (!methodValue) {
          detailsSection.classList.add('hidden');
          return;
        }

        const methodInfo = this.getPaymentMethodInfo(methodValue);

        // Try to get details from payment_methods_json
        let methodDetails = null;

        if (agreement.payment_methods_json) {
          try {
            const paymentMethods = JSON.parse(agreement.payment_methods_json);
            const activeMethod = paymentMethods.find(pm => pm.method === methodValue && pm.status === 'active');
            if (activeMethod) {
              methodDetails = activeMethod.details;
            }
          } catch (e) {
            console.error('Error parsing payment methods JSON:', e);
          }
        }

        let html = `<div style="font-size:14px; line-height:1.8; color:var(--text)">`;
        html += `<p style="margin:0 0 12px 0; font-weight:600">${methodInfo.icon} ${methodInfo.label}</p>`;

        if (methodValue === 'cash') {
          html += `<p style="margin:0; color:var(--muted)">Pay in cash directly to the lender.</p>`;
        } else if (methodDetails) {
          html += `<div style="white-space:pre-wrap; font-family:monospace; background:rgba(0,0,0,0.2); padding:12px; border-radius:6px; margin:8px 0">${this.escapeHtml(methodDetails)}</div>`;
        } else {
          // Fallback to legacy fields
          if (methodValue === 'bank' && agreement.payment_bank_details) {
            html += `<div style="white-space:pre-wrap; font-family:monospace; background:rgba(0,0,0,0.2); padding:12px; border-radius:6px; margin:8px 0">${this.escapeHtml(agreement.payment_bank_details)}</div>`;
          } else if (methodValue === 'paypal' && agreement.payment_paypal_email) {
            html += `<p style="margin:0; color:var(--muted)">PayPal email: <strong>${this.escapeHtml(agreement.payment_paypal_email)}</strong></p>`;
          } else if (methodValue === 'crypto' && agreement.payment_crypto_address) {
            html += `<div style="white-space:pre-wrap; font-family:monospace; background:rgba(0,0,0,0.2); padding:12px; border-radius:6px; margin:8px 0">${this.escapeHtml(agreement.payment_crypto_address)}</div>`;
          } else if (methodValue === 'other' && agreement.payment_other_description) {
            html += `<div style="white-space:pre-wrap; background:rgba(0,0,0,0.2); padding:12px; border-radius:6px; margin:8px 0">${this.escapeHtml(agreement.payment_other_description)}</div>`;
          } else {
            html += `<p style="margin:0; color:var(--muted)">No additional details provided.</p>`;
          }
        }

        html += `</div>`;

        detailsSection.innerHTML = html;
        detailsSection.classList.remove('hidden');
      };

      // Update crypto tip visibility
      const updateCryptoTip = () => {
        const cryptoTip = document.getElementById('crypto-tx-tip');
        if (!cryptoTip) return;

        const selectedMethod = paymentMethodSelect.value;
        if (selectedMethod === 'crypto') {
          cryptoTip.classList.remove('hidden');
        } else {
          cryptoTip.classList.add('hidden');
        }
      };

      // Payment method change handler
      paymentMethodSelect.addEventListener('change', () => {
        renderMethodDetails(paymentMethodSelect.value);
        updateCryptoTip();
      });

      // Initial setup if method is auto-selected
      if (autoSelected) {
        renderMethodDetails(paymentMethodSelect.value);
      }

      // Initial crypto tip visibility
      updateCryptoTip();
    },

    getPaymentMethodInfo: function (method) {
      const methodInfoMap = {
        'bank': { icon: '🏦', label: 'Bank transfer' },
        'cash': { icon: '💵', label: 'Cash' },
        'revolut': { icon: '💳', label: 'Revolut' },
        'bizum': { icon: '📱', label: 'Bizum' },
        'paypal': { icon: '💰', label: 'PayPal' },
        'crypto': { icon: '₿', label: 'Crypto' },
        'any': { icon: '✓', label: 'Any method' },
        'other': { icon: '🔧', label: 'Other' }
      };

      return methodInfoMap[method] || { icon: '', label: method };
    },

    setupProofDropzone: function () {
      const dropzone = document.getElementById('inline-payment-proof-dropzone');
      const fileInput = document.getElementById('inline-payment-proof');
      const browseBtn = document.getElementById('inline-payment-proof-browse-btn');
      const filenameDisplay = document.getElementById('inline-payment-proof-filename');
      const textDisplay = document.getElementById('inline-payment-proof-text');

      if (!dropzone || !fileInput || !browseBtn) return;

      // Browse button click
      browseBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInput.click();
      };

      // Click on dropzone to open file picker
      dropzone.onclick = (e) => {
        if (e.target !== browseBtn) {
          fileInput.click();
        }
      };

      // File input change
      fileInput.onchange = () => {
        if (fileInput.files.length > 0) {
          const file = fileInput.files[0];
          if (filenameDisplay && textDisplay) {
            filenameDisplay.textContent = `Selected: ${file.name}`;
            filenameDisplay.style.display = 'block';
            textDisplay.style.display = 'none';
            browseBtn.textContent = 'Change file';
            dropzone.style.borderColor = 'var(--accent)';
            dropzone.style.background = 'rgba(61,220,151,0.05)';
          }
        }
      };

      // Drag and drop events
      dropzone.ondragover = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.style.borderColor = 'var(--accent)';
        dropzone.style.background = 'rgba(61,220,151,0.1)';
      };

      dropzone.ondragleave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.style.borderColor = 'rgba(255,255,255,0.2)';
        dropzone.style.background = 'rgba(255,255,255,0.02)';
      };

      dropzone.ondrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.style.borderColor = 'rgba(255,255,255,0.2)';
        dropzone.style.background = 'rgba(255,255,255,0.02)';

        if (e.dataTransfer.files.length > 0 && filenameDisplay && textDisplay) {
          fileInput.files = e.dataTransfer.files;
          const file = e.dataTransfer.files[0];
          filenameDisplay.textContent = `Selected: ${file.name}`;
          filenameDisplay.style.display = 'block';
          textDisplay.style.display = 'none';
          browseBtn.textContent = 'Change file';
          dropzone.style.borderColor = 'var(--accent)';
          dropzone.style.background = 'rgba(61,220,151,0.05)';
        }
      };
    },

    setupFormSubmission: function () {
      const submitBtn = document.getElementById('inline-payment-submit');
      const cancelBtn = document.querySelector(`#${componentState.config.containerId} .secondary`);

      if (submitBtn) {
        submitBtn.onclick = () => this.submitPayment();
      }

      if (cancelBtn) {
        cancelBtn.onclick = () => this.cancelForm();
      }
    },

    submitPayment: async function () {
      const { agreement, config } = componentState;
      const status = document.getElementById('inline-payment-status');
      const amount = parseFloat(document.getElementById('inline-payment-amount').value);
      const method = document.getElementById('inline-payment-method').value || null;
      const note = document.getElementById('inline-payment-note').value.trim() || null;
      const proofInput = document.getElementById('inline-payment-proof');
      const proofFile = proofInput?.files[0];

      // Validate amount
      if (!amount || amount <= 0) {
        if (status) {
          status.textContent = 'Please enter a valid amount';
          status.className = 'status error';
        }
        return;
      }

      // Validate payment method
      if (!method) {
        if (status) {
          status.textContent = 'Please select a payment method';
          status.className = 'status error';
        }
        return;
      }

      // Validate proof of repayment if required
      const isCashOnlyPayment = method === 'cash' && agreement.payment_preference_method === 'cash';
      if (agreement.proof_required && !proofFile && !isCashOnlyPayment) {
        if (status) {
          status.textContent = 'This agreement requires proof of repayment. Please upload a screenshot, photo, or document.';
          status.className = 'status error';
        }
        return;
      }

      // Validate file size if present
      if (proofFile && proofFile.size > 10 * 1024 * 1024) {
        if (status) {
          status.textContent = 'File size must be less than 10MB';
          status.className = 'status error';
        }
        return;
      }

      if (status) {
        status.textContent = 'Reporting payment...';
        status.className = 'status';
      }

      try {
        // Use FormData to support file upload
        const formData = new FormData();
        formData.append('amount', amount);
        if (method) formData.append('method', method);
        if (note) formData.append('note', note);
        if (proofFile) formData.append('proof', proofFile);

        const res = await fetch(`/api/agreements/${agreement.id}/payments`, {
          method: 'POST',
          body: formData
        });

        const data = await res.json();

        if (!res.ok) {
          if (status) {
            status.textContent = data.error || 'Failed to report payment';
            status.className = 'status error';
          }
          return;
        }

        if (status) {
          status.textContent = 'Payment reported successfully! Redirecting...';
          status.className = 'status success';
        }

        // Call success callback
        setTimeout(() => {
          if (config.onSuccess) {
            config.onSuccess(data.agreement);
          }
        }, 1000);
      } catch (err) {
        if (status) {
          status.textContent = 'Error: ' + err.message;
          status.className = 'status error';
        }
      }
    },

    cancelForm: function () {
      const { config } = componentState;
      const container = document.getElementById(config.containerId);

      // Hide the form
      if (container) {
        container.classList.add('hidden');
      }

      // Clear form
      const amountInput = document.getElementById('inline-payment-amount');
      const methodSelect = document.getElementById('inline-payment-method');
      const noteInput = document.getElementById('inline-payment-note');
      const proofInput = document.getElementById('inline-payment-proof');
      const statusEl = document.getElementById('inline-payment-status');
      const helperText = document.getElementById('amount-helper-text');
      const impactBox = document.getElementById('live-impact-box');

      if (amountInput) amountInput.value = '';
      if (methodSelect) methodSelect.value = '';
      if (noteInput) noteInput.value = '';
      if (proofInput) proofInput.value = '';
      if (statusEl) statusEl.textContent = '';
      if (helperText) helperText.textContent = '';
      if (impactBox) impactBox.classList.add('hidden');

      // Reset dropzone state
      const dropzone = document.getElementById('inline-payment-proof-dropzone');
      const filenameDisplay = document.getElementById('inline-payment-proof-filename');
      const textDisplay = document.getElementById('inline-payment-proof-text');
      const browseBtn = document.getElementById('inline-payment-proof-browse-btn');

      if (dropzone && filenameDisplay && textDisplay && browseBtn) {
        filenameDisplay.style.display = 'none';
        textDisplay.style.display = 'block';
        browseBtn.textContent = 'Browse';
        dropzone.style.borderColor = 'rgba(255,255,255,0.2)';
        dropzone.style.background = 'rgba(255,255,255,0.02)';
      }

      // Hide payment method details
      const methodDetails = document.getElementById('inline-payment-method-details');
      if (methodDetails) {
        methodDetails.classList.add('hidden');
      }

      // Hide crypto tip
      const cryptoTip = document.getElementById('crypto-tx-tip');
      if (cryptoTip) {
        cryptoTip.classList.add('hidden');
      }

      // Call cancel callback
      if (config.onCancel) {
        config.onCancel();
      }
    },

    // Helper: escape HTML to prevent XSS
    escapeHtml: function (unsafe) {
      if (!unsafe) return '';
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
  };
})();

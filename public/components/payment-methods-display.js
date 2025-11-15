/**
 * Payment Methods Display Component
 * Handles showing payment method details to borrowers after agreement acceptance
 */

// Render payment methods section with expandable details
function renderPaymentMethodsSection(agreement, isBorrower) {
  const paymentMethodsJson = agreement.payment_methods_json;

  if (!paymentMethodsJson) {
    // Fallback to old format
    return renderLegacyPaymentMethods(agreement);
  }

  let paymentMethods;
  try {
    paymentMethods = JSON.parse(paymentMethodsJson);
  } catch (e) {
    console.error('Error parsing payment methods JSON:', e);
    return renderLegacyPaymentMethods(agreement);
  }

  // Filter out methods pending removal or only show active methods
  const activeMethods = paymentMethods.filter(pm => pm.status === 'active');

  if (activeMethods.length === 0) {
    return '<p style="color:var(--muted); font-size:14px">No payment methods available</p>';
  }

  let html = '<div style="display:flex; flex-direction:column; gap:12px">';

  activeMethods.forEach(method => {
    const methodInfo = getPaymentMethodInfo(method.method);
    html += `
      <div style="border:1px solid rgba(255,255,255,0.08); border-radius:8px; overflow:hidden">
        <button
          onclick="togglePaymentMethodDetails('${method.method}')"
          style="width:100%; text-align:left; padding:14px 16px; background:rgba(61,220,151,0.15); border:none; color:var(--accent); font-size:14px; font-weight:600; cursor:pointer; display:flex; justify-content:space-between; align-items:center"
        >
          <span>VIEW ${methodInfo.label.toUpperCase()} DETAILS</span>
          <span id="toggle-${method.method}">▼</span>
        </button>
        <div id="details-${method.method}" class="hidden" style="padding:16px; background:rgba(255,255,255,0.02)">
          ${renderPaymentMethodDetails(method)}
        </div>
      </div>
    `;
  });

  html += '</div>';

  return html;
}

// Get payment method display info
function getPaymentMethodInfo(method) {
  const methodMap = {
    'bank': { label: 'Bank Transfer', icon: '🏦' },
    'paypal': { label: 'PayPal', icon: '💳' },
    'crypto': { label: 'Crypto', icon: '₿' },
    'cash': { label: 'Cash', icon: '💵' },
    'other': { label: 'Other Method', icon: '💱' }
  };

  return methodMap[method] || { label: method, icon: '💰' };
}

// Render individual payment method details
function renderPaymentMethodDetails(method) {
  const methodInfo = getPaymentMethodInfo(method.method);

  let html = `<div style="font-size:14px; line-height:1.8; color:var(--text)">`;
  html += `<p style="margin:0 0 12px 0; font-weight:600">${methodInfo.icon} ${methodInfo.label}</p>`;

  if (method.method === 'cash') {
    html += `<p style="margin:0; color:var(--muted)">Pay in cash directly to the lender.</p>`;
  } else if (method.details) {
    html += `<div style="white-space:pre-wrap; font-family:monospace; background:rgba(0,0,0,0.2); padding:12px; border-radius:6px; margin:8px 0">${escapeHtml(method.details)}</div>`;
  } else {
    html += `<p style="margin:0; color:var(--muted)">No additional details provided.</p>`;
  }

  html += `</div>`;

  return html;
}

// Toggle payment method details expansion
function togglePaymentMethodDetails(methodName) {
  const detailsEl = document.getElementById(`details-${methodName}`);
  const toggleIcon = document.getElementById(`toggle-${methodName}`);

  if (detailsEl.classList.contains('hidden')) {
    detailsEl.classList.remove('hidden');
    toggleIcon.textContent = '▲';
  } else {
    detailsEl.classList.add('hidden');
    toggleIcon.textContent = '▼';
  }
}

// Render legacy payment methods (for backward compatibility)
function renderLegacyPaymentMethods(agreement) {
  const methods = agreement.payment_preference_method
    ? agreement.payment_preference_method.split(',').map(m => m.trim())
    : [];

  if (methods.length === 0) {
    return '<p style="color:var(--muted); font-size:14px">No payment methods specified</p>';
  }

  const methodsText = methods.map(m => {
    if (m === 'bank') return 'Bank transfer';
    if (m === 'cash') return 'Cash';
    if (m === 'paypal') return 'PayPal';
    if (m === 'crypto') return 'Crypto';
    if (m === 'other' && agreement.payment_other_description) {
      return `Other: ${agreement.payment_other_description}`;
    }
    if (m === 'any') return 'Any method';
    return m;
  }).join(', ');

  return `<p style="font-size:14px; margin:0">${methodsText}</p>`;
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderPaymentMethodsSection,
    togglePaymentMethodDetails,
    getPaymentMethodInfo
  };
}

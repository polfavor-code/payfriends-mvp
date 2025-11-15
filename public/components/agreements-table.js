/**
 * Shared Agreements Table Component
 * Single-source component for rendering "My Agreements" table across all pages
 */

// Note: Currency formatters are loaded from /js/formatters.js
// formatCurrency0() - for compact displays (no decimals, nl-NL locale)
// formatCurrency2() - for detailed displays (2 decimals, nl-NL locale)

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getColorClass(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = (Math.abs(hash) % 7) + 1;
  return `color-${colorIndex}`;
}

function generateAvatarHTML(user, size = 'small') {
  const name = user.name || user.counterparty_name || '';
  const profilePictureUrl = user.profile_picture_url;
  const userId = user.user_id;

  // If user has profile picture and ID
  if (profilePictureUrl && userId) {
    return `<div class="user-avatar size-${size}"><img src="/api/profile/picture/${userId}" class="user-avatar-image" /></div>`;
  }

  // Generate initials-based avatar
  const initials = getInitials(name);
  const colorClass = getColorClass(name);

  return `<div class="user-avatar size-${size}"><div class="user-avatar-initials ${colorClass}">${initials}</div></div>`;
}

function formatDueDate(agreement, isLender) {
  if (agreement.status === 'settled') {
    return '<span class="due-date-settled">—</span>';
  }

  if (!agreement.due_date && !agreement.final_due_date) {
    return '—';
  }

  // For installments, use final_due_date; otherwise use due_date
  const dueDateStr = agreement.repayment_type === 'installments' && agreement.final_due_date
    ? agreement.final_due_date
    : agreement.due_date;

  if (!dueDateStr) return '—';

  const dueTimestamp = new Date(dueDateStr);
  const now = new Date();
  const diffDays = Math.floor((dueTimestamp - now) / (1000 * 60 * 60 * 24));

  // Format date
  const dateStr = dueTimestamp.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  let className = '';
  let countdownText = '';

  if (diffDays < 0) {
    className = 'due-date-overdue';
    countdownText = `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`;
  } else if (diffDays === 0) {
    className = 'due-date-today';
    countdownText = 'Due today';
  } else if (diffDays <= 7) {
    className = 'due-date-soon';
    countdownText = `${diffDays} day${diffDays !== 1 ? 's' : ''} left`;
  } else {
    className = 'due-date-upcoming';
    countdownText = `${diffDays} days left`;
  }

  // Single-line format: "12 Dec 2026 (394 days left)"
  const displayText = countdownText ? `${dateStr} (${countdownText})` : dateStr;
  return `<div class="${className}" style="white-space:nowrap">${displayText}</div>`;
}

/**
 * Render the status dot with proper tooltip
 */
function renderStatusDot(status) {
  const statusText = status || 'pending';
  const statusMap = {
    'pending': 'Pending',
    'active': 'Active',
    'settled': 'Settled',
    'cancelled': 'Cancelled',
    'declined': 'Declined',
    'overdue': 'Overdue'
  };

  const tooltipText = statusMap[statusText] || statusText.charAt(0).toUpperCase() + statusText.slice(1);

  return `<div class="status-dot-wrapper" data-tooltip="${tooltipText}">
    <span class="status-dot status-dot--${statusText}" role="img" aria-label="${tooltipText}"></span>
  </div>`;
}

/**
 * Render the actions column based on agreement status and user role
 */
function renderActionsColumn(agreement, currentUser, currentAgreementId = null) {
  const statusText = agreement.status || 'pending';
  const isLender = agreement.lender_user_id === currentUser.id;

  // No actions for cancelled agreements
  if (statusText === 'cancelled') {
    return '—';
  }

  // Borrower can review pending agreements
  if (statusText === 'pending' && !isLender) {
    return `<div class="actions-column">
      <button class="btn-review-pending" onclick="reviewAgreement(${agreement.id})">Review</button>
    </div>`;
  }

  // For lenders on any agreement, or borrowers on active/settled
  let mainBtnLabel = (statusText === 'pending' || statusText === 'active' || statusText === 'settled') ? 'Manage' : 'View';
  let buttons = [];

  // If this is the current agreement on the manage page, highlight it
  if (currentAgreementId && agreement.id === parseInt(currentAgreementId)) {
    buttons.push(`<button onclick="scrollToManage()" style="background:var(--accent); color:#0d130f">${mainBtnLabel}</button>`);
  } else {
    buttons.push(`<button onclick="viewAgreement(${agreement.id})">${mainBtnLabel}</button>`);
  }

  // Add conditional action buttons for lenders
  if (isLender) {
    if (agreement.hasPendingPaymentToConfirm) {
      buttons.push(`<button class="btn-confirm-payment" onclick="openConfirmPaymentModal(${agreement.id})">Confirm payment</button>`);
    }
    if (agreement.hasOpenDifficulty) {
      buttons.push(`<button class="btn-payment-issue" onclick="openDifficultyModal(${agreement.id})">Payment issue</button>`);
    }
  }

  return `<div class="actions-column">${buttons.join('')}</div>`;
}

/**
 * Main function to render the agreements table
 * @param {Array} agreements - Array of agreement objects
 * @param {Object} currentUser - Current user object with id
 * @param {String} currentFilter - Current status filter ('all', 'pending', 'active', 'settled')
 * @param {String|null} currentAgreementId - ID of currently viewed agreement (for manage page)
 */
function renderAgreementsTable(agreements, currentUser, currentFilter = 'all', currentAgreementId = null) {
  const tbody = document.querySelector('#list tbody');
  const emptyState = document.getElementById('empty-state');
  const table = document.getElementById('list');
  const counterpartyHeader = document.getElementById('counterparty-header');
  const dueHeader = document.getElementById('due-header');
  const listSection = document.getElementById('list-section');
  const welcomeCard = document.getElementById('welcome-card');

  // Show welcome card if user has zero agreements overall (only on dashboard)
  if (welcomeCard && agreements.length === 0) {
    listSection.style.display = 'none';
    welcomeCard.style.display = 'block';

    // Personalize welcome heading with user's first name
    const welcomeHeading = document.getElementById('welcome-heading');
    if (welcomeHeading && currentUser) {
      const fullName = currentUser.full_name || currentUser.name || '';
      const firstName = fullName.trim().split(/\s+/)[0] || '';

      // Fallback to email prefix if first name is empty
      const email = currentUser.email || '';
      const fallbackName = email.includes('@') ? email.split('@')[0] : email;
      const displayName = firstName || fallbackName || 'there';

      welcomeHeading.textContent = `Welcome, ${displayName}`;
    }

    return;
  }

  // Hide welcome card when there are agreements
  if (welcomeCard) {
    listSection.style.display = 'block';
    welcomeCard.style.display = 'none';
  }

  // Filter agreements
  let filtered = agreements;
  if (currentFilter !== 'all') {
    if (currentFilter === 'pending') {
      // For Pending tab, exclude cancelled agreements
      filtered = agreements.filter(a => a.status === 'pending');
    } else {
      filtered = agreements.filter(a => a.status === currentFilter);
    }
  }

  // Handle empty state
  if (filtered.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    table.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  table.style.display = 'table';
  tbody.innerHTML = '';

  // Determine header labels based on user's role in agreements
  let userRoles = new Set();
  for (const a of filtered) {
    const isLender = a.lender_user_id === currentUser.id;
    userRoles.add(isLender ? 'lender' : 'borrower');
  }

  // Set headers based on predominant role
  if (userRoles.size === 1) {
    if (userRoles.has('lender')) {
      counterpartyHeader.textContent = 'Borrower';
      dueHeader.textContent = 'Next repayment due';
    } else {
      counterpartyHeader.textContent = 'Lender';
      dueHeader.textContent = 'Next payment due';
    }
  } else {
    // Mixed roles, keep generic headers
    counterpartyHeader.textContent = 'Counterparty';
    dueHeader.textContent = 'Due';
  }

  // Render each agreement row
  for (const agreement of filtered) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-id', agreement.id);

    const isLender = agreement.lender_user_id === currentUser.id;

    // Determine counterparty information
    let counterpartyName, counterpartyUserId, counterpartyProfilePicture;
    if (isLender) {
      counterpartyName = agreement.counterparty_name || agreement.borrower_full_name || agreement.friend_first_name || agreement.borrower_email || '—';
      counterpartyUserId = agreement.borrower_user_id;
      counterpartyProfilePicture = agreement.counterparty_profile_picture_url || agreement.borrower_profile_picture;
    } else {
      counterpartyName = agreement.counterparty_name || agreement.lender_full_name || agreement.lender_name || agreement.lender_email || '—';
      counterpartyUserId = agreement.lender_user_id;
      counterpartyProfilePicture = agreement.counterparty_profile_picture_url || agreement.lender_profile_picture;
    }

    // Generate avatar HTML
    const avatarHTML = generateAvatarHTML({
      name: counterpartyName,
      counterparty_name: counterpartyName,
      profile_picture_url: counterpartyProfilePicture,
      user_id: counterpartyUserId
    });

    const counterpartyDisplay = `<div class="counterparty-cell">${avatarHTML}<span>${counterpartyName}</span></div>`;

    // Get description or show fallback
    const description = agreement.description || '<span style="color:var(--muted); font-style:italic">(No description)</span>';

    // Calculate outstanding amount with original amount tooltip
    // Use formatCurrency0 for compact display (no decimals, nl-NL locale: € 3.000)
    const outstandingCents = agreement.outstanding_cents || agreement.amount_cents;
    const outstanding = formatCurrency0(outstandingCents);
    const originalAmount = formatCurrency0(agreement.amount_cents);
    const outstandingDisplay = `<span title="Original: ${originalAmount}">${outstanding} / ${originalAmount}</span>`;

    // Format due date with countdown
    const dueDateDisplay = formatDueDate(agreement, isLender);

    // Build status badge
    const statusBadge = renderStatusDot(agreement.status);

    // Build actions column
    const actionsHtml = renderActionsColumn(agreement, currentUser, currentAgreementId);

    // Build row HTML
    tr.innerHTML = `
      <td>${counterpartyDisplay}</td>
      <td>${description}</td>
      <td>${outstandingDisplay}</td>
      <td>${dueDateDisplay}</td>
      <td>${statusBadge}</td>
      <td>${actionsHtml}</td>
    `;

    tbody.appendChild(tr);
  }
}

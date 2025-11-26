/**
 * Shared Agreements List Module
 * Unified logic for fetching and rendering agreements across all pages
 * Used by: /app (dashboard), /agreements
 */

// Global state for agreements
let allAgreements = [];
let currentUser = null;
let currentFilter = 'all';

/**
 * Initialize the agreements list
 * @param {Object} options - Configuration options
 * @param {string} options.rootSelector - Root element selector (default: "#agreements-card")
 * @param {string} options.tableWrapperSelector - Table wrapper selector (default: "#agreements-table-wrapper")
 * @param {string} options.tableBodySelector - Table body selector (default: "#agreements-table-body")
 * @param {string} options.emptyStateSelector - Empty state selector (default: "#agreements-empty-state")
 * @param {Object} options.user - Current user object (if already loaded)
 */
async function initAgreementsList({
  rootSelector = "#agreements-card",
  tableWrapperSelector = "#agreements-table-wrapper",
  tableBodySelector = "#agreements-table-body",
  emptyStateSelector = "#agreements-empty-state",
  user = null
} = {}) {
  // Get DOM elements
  const root = document.querySelector(rootSelector);
  const tableWrapper = document.querySelector(tableWrapperSelector);
  const tableBody = document.querySelector(tableBodySelector);
  const emptyState = document.querySelector(emptyStateSelector);

  if (!root || !tableWrapper || !tableBody || !emptyState) {
    console.error('Agreements list: Required DOM elements not found', {
      root: !!root,
      tableWrapper: !!tableWrapper,
      tableBody: !!tableBody,
      emptyState: !!emptyState
    });
    return;
  }

  // Set current user
  if (user) {
    currentUser = user;
  } else {
    // Try to get user from header
    if (window.PayFriendsHeader && typeof window.PayFriendsHeader.getCurrentUser === 'function') {
      currentUser = window.PayFriendsHeader.getCurrentUser();
    }
  }

  if (!currentUser) {
    console.error('Agreements list: No user available');
    window.location.href = '/';
    return;
  }

  // Set up tab listeners
  setupTabListeners();

  // Load agreements
  await loadAgreements();

  // Initial render
  renderAgreementsList();
}

/**
 * Set up tab click listeners
 */
function setupTabListeners() {
  const tabs = document.querySelectorAll('.agreements-tab, .tab[data-filter]');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const filter = tab.getAttribute('data-filter');
      if (filter) {
        filterAgreements(filter);
      }
    });
  });
}

/**
 * Filter agreements by status
 * @param {string} status - Filter status ('all', 'pending', 'active', 'settled')
 */
function filterAgreements(status) {
  currentFilter = status;

  // Update active tab
  const tabs = document.querySelectorAll('.agreements-tab, .tab[data-filter]');
  tabs.forEach(tab => {
    tab.classList.remove('active');
    if (tab.getAttribute('data-filter') === status) {
      tab.classList.add('active');
    }
  });

  // Re-render
  renderAgreementsList();
}

/**
 * Load agreements from API
 */
async function loadAgreements() {
  try {
    const response = await fetch('/api/agreements');
    if (!response.ok) {
      throw new Error(`Failed to fetch agreements: ${response.status}`);
    }

    // API returns the array directly, not wrapped in an object
    allAgreements = await response.json();
  } catch (error) {
    console.error('Error loading agreements:', error);
    allAgreements = [];
  }
}

/**
 * Refresh agreements (reload from API and re-render)
 */
async function refreshAgreements() {
  await loadAgreements();
  renderAgreementsList();
}

/**
 * Render the agreements list
 */
function renderAgreementsList() {
  const tableWrapper = document.querySelector('#agreements-table-wrapper');
  const tableBody = document.querySelector('#agreements-table-body');
  const emptyState = document.querySelector('#agreements-empty-state');

  if (!tableWrapper || !tableBody || !emptyState) {
    console.error('Agreements list: Cannot render, DOM elements missing');
    return;
  }

  // Filter agreements
  let filtered = allAgreements;
  if (currentFilter !== 'all') {
    filtered = allAgreements.filter(a => a.status === currentFilter);
  }

  // Show/hide based on whether we have agreements
  if (allAgreements.length === 0) {
    // No agreements at all - show empty state
    tableWrapper.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  // We have agreements, show table
  emptyState.style.display = 'none';
  tableWrapper.style.display = 'block';

  // Check if filtered list is empty
  if (filtered.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--muted)">No agreements found for this filter.</td></tr>';
    return;
  }

  // Render rows
  tableBody.innerHTML = '';
  filtered.forEach(agreement => {
    const row = renderAgreementRow(agreement);
    tableBody.appendChild(row);
  });

  // Update column headers based on user's role
  updateColumnHeaders(filtered);
}

/**
 * Update column headers based on user's role in agreements
 * @param {Array} agreements - Filtered agreements
 */
function updateColumnHeaders(agreements) {
  const counterpartyHeader = document.getElementById('counterparty-header');
  const dueHeader = document.getElementById('due-header');

  if (!counterpartyHeader || !dueHeader) return;

  // Determine user's roles
  let userRoles = new Set();
  for (const a of agreements) {
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
}

/**
 * Render a single agreement row
 * @param {Object} agreement - Agreement object
 * @returns {HTMLElement} Table row element
 */
function renderAgreementRow(agreement) {
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
    profile_picture_url: counterpartyProfilePicture,
    user_id: counterpartyUserId
  });

  const counterpartyDisplay = `<div class="counterparty-cell">${avatarHTML}<span>${escapeHTML(counterpartyName)}</span></div>`;

  // Get description or show fallback
  const description = agreement.description
    ? escapeHTML(agreement.description)
    : '<span style="color:var(--muted); font-style:italic">(No description)</span>';

  // Calculate outstanding and total due
  const outstandingCents = agreement.outstanding_cents || 0;
  const outstanding = formatCurrency0(outstandingCents);

  // For dynamic interest (one-time loans), use planned_total_cents if available
  let totalDueCents;
  if (agreement.planned_total_cents !== undefined) {
    totalDueCents = agreement.planned_total_cents;
  } else if (agreement.total_repay_amount != null) {
    totalDueCents = Math.round(agreement.total_repay_amount * 100);
  } else {
    totalDueCents = agreement.amount_cents;
  }
  const totalDue = formatCurrency0(totalDueCents);

  // Show principal as tooltip when interest is present
  const principalAmount = formatCurrency0(agreement.amount_cents);
  const hasInterest = totalDueCents !== agreement.amount_cents;
  const tooltipText = hasInterest ? `Principal: ${principalAmount}` : `Original: ${principalAmount}`;
  const outstandingDisplay = `<span title="${tooltipText}">${outstanding} / ${totalDue}</span>`;

  // Format due date
  const dueDateDisplay = formatDueDate(agreement, isLender);

  // Build status badge
  const statusBadge = renderStatusDot(agreement.status);

  // Build actions column
  const actionsHtml = renderActionsColumn(agreement, isLender);

  // Build row HTML
  tr.innerHTML = `
    <td>${counterpartyDisplay}</td>
    <td>${description}</td>
    <td>${outstandingDisplay}</td>
    <td>${dueDateDisplay}</td>
    <td>${statusBadge}</td>
    <td>${actionsHtml}</td>
  `;

  return tr;
}

/**
 * Generate avatar HTML
 */
function generateAvatarHTML(user) {
  const name = user.name || user.counterparty_name || '';
  const profilePictureUrl = user.profile_picture_url;
  const userId = user.user_id;

  // If user has profile picture and ID
  if (profilePictureUrl && userId) {
    return `<div class="user-avatar size-small"><img src="/api/profile/picture/${userId}" class="user-avatar-image" /></div>`;
  }

  // Generate initials-based avatar
  const initials = getInitials(name);
  const colorClass = getColorClass(name);

  return `<div class="user-avatar size-small"><div class="user-avatar-initials ${colorClass}">${initials}</div></div>`;
}

/**
 * Get initials from name
 */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Get color class for avatar
 */
function getColorClass(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = (Math.abs(hash) % 7) + 1;
  return `color-${colorIndex}`;
}

/**
 * Format due date with countdown
 */
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

  const displayText = countdownText ? `${dateStr} (${countdownText})` : dateStr;
  return `<div class="${className}" style="white-space:nowrap">${displayText}</div>`;
}

/**
 * Render status dot
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
 * Render actions column
 */
function renderActionsColumn(agreement, isLender) {
  const statusText = agreement.status || 'pending';

  // No actions for cancelled agreements
  if (statusText === 'cancelled') {
    return '—';
  }

  // Borrower can review pending agreements
  if (statusText === 'pending' && !isLender) {
    return `<div class="actions-column">
      <button class="btn-review-pending" onclick="window.viewAgreement(${agreement.id})">Review</button>
    </div>`;
  }

  // For lenders on any agreement, or borrowers on active/settled
  let mainBtnLabel = (statusText === 'pending' || statusText === 'active' || statusText === 'settled') ? 'Manage' : 'View';
  let buttons = [];

  buttons.push(`<button onclick="window.viewAgreement(${agreement.id})">${mainBtnLabel}</button>`);

  // Add conditional action buttons for lenders
  if (isLender) {
    if (agreement.hasPendingPaymentToConfirm) {
      buttons.push(`<button class="btn-confirm-payment" onclick="window.openConfirmPaymentModal(${agreement.id})">Confirm payment</button>`);
    }
    if (agreement.hasOpenDifficulty) {
      buttons.push(`<button class="btn-payment-issue" onclick="window.openDifficultyModal(${agreement.id})">Payment issue</button>`);
    }
  }

  return `<div class="actions-column">${buttons.join('')}</div>`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Export functions for global use
window.AgreementsList = {
  init: initAgreementsList,
  refresh: refreshAgreements,
  filter: filterAgreements
};

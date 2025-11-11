/**
 * PayFriends Shared Header Component
 * Provides unified header functionality across all pages
 */

(function() {
  'use strict';

  let currentUser = null;

  /**
   * Initialize the shared header
   * @param {Object} options - Configuration options
   * @param {boolean} options.hasActivitySection - Whether the page has an activity section (like app.html)
   * @param {Function} options.onActivityClick - Optional custom handler for activity button click
   */
  async function initializeHeader(options = {}) {
    try {
      // Load header HTML
      const response = await fetch('/components/header.html');
      if (!response.ok) {
        throw new Error('Failed to load header component');
      }

      const headerHTML = await response.text();

      // Find the container or insert at the beginning of main/body
      const container = document.querySelector('main.container') || document.querySelector('.container') || document.body;
      container.insertAdjacentHTML('afterbegin', headerHTML);

      // Load user info
      await loadUserInfo();

      // Load activity count
      await loadActivityCount();

      // Set up event listeners
      setupEventListeners(options);

    } catch (error) {
      console.error('Error initializing header:', error);
    }
  }

  /**
   * Load and display user information
   */
  async function loadUserInfo() {
    try {
      const res = await fetch('/api/user');
      if (!res.ok) {
        window.location.href = '/';
        return;
      }

      const data = await res.json();
      currentUser = data.user;

      // Update user info display
      const displayText = currentUser.full_name
        ? `${currentUser.full_name} | ${currentUser.email}`
        : currentUser.email;

      const userInfoEl = document.getElementById('user-info-display');
      if (userInfoEl) {
        userInfoEl.textContent = displayText;
      }
    } catch (err) {
      console.error('Error loading user:', err);
      window.location.href = '/';
    }
  }

  /**
   * Load activity count and update the header
   */
  async function loadActivityCount() {
    try {
      const res = await fetch('/api/messages');
      if (!res.ok) {
        console.error('Failed to load activity count');
        return;
      }

      const data = await res.json();
      const unreadCount = data.unread_count || 0;

      updateActivityButton(unreadCount);
    } catch (err) {
      console.error('Error loading activity count:', err);
    }
  }

  /**
   * Update the activity button with unread count
   * @param {number} unreadCount - Number of unread messages
   */
  function updateActivityButton(unreadCount) {
    const activityButton = document.getElementById('activity-button');
    const activityCountEl = document.getElementById('activity-count');

    if (!activityButton) return;

    if (unreadCount > 0) {
      if (activityCountEl) {
        activityCountEl.textContent = unreadCount;
      }
      activityButton.classList.add('inbox-widget-has-unread');
    } else {
      // Hide the count when zero
      activityButton.innerHTML = 'Activity';
      activityButton.classList.remove('inbox-widget-has-unread');
    }
  }

  /**
   * Set up event listeners for header elements
   * @param {Object} options - Configuration options
   */
  function setupEventListeners(options) {
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }

    // Activity button
    const activityButton = document.getElementById('activity-button');
    if (activityButton) {
      if (options.onActivityClick) {
        // Custom activity click handler (for app.html with activity section)
        activityButton.addEventListener('click', options.onActivityClick);
        activityButton.style.cursor = 'pointer';
      } else {
        // Default behavior: navigate to /app
        activityButton.addEventListener('click', () => {
          window.location.href = '/app';
        });
        activityButton.style.cursor = 'pointer';
      }
    }
  }

  /**
   * Handle logout
   */
  async function handleLogout() {
    try {
      await fetch('/auth/logout', { method: 'POST' });
      window.location.href = '/';
    } catch (err) {
      console.error('Logout error:', err);
      window.location.href = '/';
    }
  }

  /**
   * Get the current user
   * @returns {Object|null} Current user object
   */
  function getCurrentUser() {
    return currentUser;
  }

  /**
   * Refresh activity count (useful after marking messages as read)
   */
  async function refreshActivityCount() {
    await loadActivityCount();
  }

  // Export functions to global scope
  window.PayFriendsHeader = {
    initialize: initializeHeader,
    getCurrentUser: getCurrentUser,
    refreshActivityCount: refreshActivityCount,
    updateActivityButton: updateActivityButton
  };

})();

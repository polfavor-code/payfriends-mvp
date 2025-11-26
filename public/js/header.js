/**
 * PayFriends Shared Header Component
 * Provides unified header functionality across all pages
 */

(function() {
  'use strict';

  let currentUser = null;

  /**
   * Extract first name from user object
   * @param {Object} user - User object
   * @returns {string} First name
   */
  function getFirstNameFromUser(user) {
    if (!user) return '';
    if (user.first_name) return user.first_name;

    const nameSource = user.full_name || user.name || user.email || '';
    const trimmed = nameSource.trim();
    if (!trimmed) return '';

    // Take first word as first name fallback
    return trimmed.split(/\s+/)[0];
  }

  /**
   * Generate avatar initials from user object
   * @param {Object} user - User object
   * @returns {string} Two-letter initials
   */
  function getAvatarInitialsFromUser(user) {
    if (!user) return '';
    if (user.initials) return user.initials;

    const name = (user.full_name || user.name || '').trim();
    if (!name) {
      // fallback: first letter of email before @
      if (user.email) {
        const prefix = user.email.split('@')[0] || '';
        return prefix.slice(0, 2).toUpperCase();
      }
      return '';
    }

    const parts = name.split(/\s+/);
    const first = parts[0] || '';
    const last = parts[parts.length - 1] || '';
    const letters = (first[0] || '') + (last[0] || '');
    return letters.toUpperCase();
  }

  /**
   * Get avatar color class based on user name
   * @param {string} name - User name
   * @returns {string} Color class name
   */
  function getAvatarColor(name) {
    if (!name) return 'color-1';
    const colors = ['color-1', 'color-2', 'color-3', 'color-4', 'color-5', 'color-6', 'color-7'];
    const charCode = name.charCodeAt(0) || 0;
    return colors[charCode % colors.length];
  }

  /**
   * Generate avatar HTML
   * @param {Object} user - User object
   * @param {string} size - Avatar size (small, medium, large)
   * @returns {string} Avatar HTML
   */
  function generateAvatarHTML(user, size = 'small') {
    if (!user) return '';

    const userId = user.id || user.user_id;
    const name = user.full_name || user.name || user.email || '';

    // If user has profile picture, use it
    // Check for profile_picture field (should be a non-empty string path)
    if (user.profile_picture && typeof user.profile_picture === 'string' && user.profile_picture.trim() !== '') {
      return `<div class="user-avatar size-${size}"><img src="/api/profile/picture/${userId}" class="user-avatar-image" alt="${name}" /></div>`;
    }

    // Otherwise, use initials
    const initials = getAvatarInitialsFromUser(user);
    const colorClass = getAvatarColor(name);
    return `<div class="user-avatar size-${size}"><div class="user-avatar-initials ${colorClass}">${initials}</div></div>`;
  }

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

      // Update avatar button with just the avatar (no name)
      const avatarButton = document.getElementById('user-avatar-button');
      if (avatarButton) {
        const avatarHTML = generateAvatarHTML(currentUser, 'small');
        avatarButton.innerHTML = avatarHTML;
      }

      // Update dropdown with full user info
      const fullName = currentUser.full_name || currentUser.name || '';
      const email = currentUser.email || '';

      const nameEl = document.getElementById('user-dropdown-name');
      const emailEl = document.getElementById('user-dropdown-email');

      if (nameEl) nameEl.textContent = fullName;
      if (emailEl) emailEl.textContent = email;
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
    const activityLabel = document.getElementById('activity-label');

    if (!activityButton || !activityLabel) return;

    const count = unreadCount || 0;

    if (count > 0) {
      activityLabel.innerHTML = `Activity <span class="activity-count">(${count})</span>`;
      activityButton.classList.add('inbox-widget-has-unread');
    } else {
      // No parentheses when count is 0
      activityLabel.textContent = 'Activity';
      activityButton.classList.remove('inbox-widget-has-unread');
    }
  }

  /**
   * Set up event listeners for header elements
   * @param {Object} options - Configuration options
   */
  function setupEventListeners(options) {
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

    // Avatar dropdown toggle
    const avatarButton = document.getElementById('user-avatar-button');
    const dropdown = document.getElementById('user-dropdown');

    if (avatarButton && dropdown) {
      // Toggle dropdown on avatar button click
      avatarButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !dropdown.classList.contains('hidden');
        if (isOpen) {
          closeDropdown();
        } else {
          openDropdown();
        }
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!dropdown.classList.contains('hidden') && !dropdown.contains(e.target)) {
          closeDropdown();
        }
      });

      // Close dropdown on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !dropdown.classList.contains('hidden')) {
          closeDropdown();
        }
      });

      // Prevent dropdown from closing when clicking inside it
      dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Dropdown menu item actions
    const friendsItem = document.getElementById('user-menu-friends');
    const profileItem = document.getElementById('user-menu-profile');
    const settingsItem = document.getElementById('user-menu-settings');
    const securityItem = document.getElementById('user-menu-security');
    const legalItem = document.getElementById('user-menu-legal');
    const logoutItem = document.getElementById('user-menu-logout');

    if (friendsItem) {
      friendsItem.addEventListener('click', () => {
        window.location.href = '/friends.html';
      });
    }

    if (profileItem) {
      profileItem.addEventListener('click', () => {
        window.location.href = '/app/profile';
      });
    }

    if (settingsItem) {
      settingsItem.addEventListener('click', () => {
        window.location.href = '/app/settings';
      });
    }

    if (securityItem) {
      securityItem.addEventListener('click', () => {
        window.location.href = '/app/security';
      });
    }

    if (legalItem) {
      legalItem.addEventListener('click', () => {
        window.location.href = '/app/legal';
      });
    }

    if (logoutItem) {
      logoutItem.addEventListener('click', handleLogout);
    }
  }

  /**
   * Open the user dropdown menu
   */
  function openDropdown() {
    const dropdown = document.getElementById('user-dropdown');
    const avatarButton = document.getElementById('user-avatar-button');

    if (dropdown) {
      dropdown.classList.remove('hidden');
    }
    if (avatarButton) {
      avatarButton.setAttribute('aria-expanded', 'true');
    }
  }

  /**
   * Close the user dropdown menu
   */
  function closeDropdown() {
    const dropdown = document.getElementById('user-dropdown');
    const avatarButton = document.getElementById('user-avatar-button');

    if (dropdown) {
      dropdown.classList.add('hidden');
    }
    if (avatarButton) {
      avatarButton.setAttribute('aria-expanded', 'false');
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

  /**
   * Refresh user info (useful after profile updates like avatar upload)
   */
  async function refreshUserInfo() {
    await loadUserInfo();
  }

  // Export functions to global scope
  window.PayFriendsHeader = {
    initialize: initializeHeader,
    getCurrentUser: getCurrentUser,
    refreshActivityCount: refreshActivityCount,
    updateActivityButton: updateActivityButton,
    refreshUserInfo: refreshUserInfo
  };

})();

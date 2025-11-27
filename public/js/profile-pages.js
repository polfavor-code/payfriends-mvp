/**
 * Profile Pages Content
 * Contains HTML templates and render functions for Profile, Settings, and Security pages
 */

(function() {
  'use strict';

  // Helper function to get the profile content container
  function getProfileContainer() {
    return document.getElementById('profile-content');
  }

  // Avatar helper functions
  function getInitials(name) {
    if (!name) return '?';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  }

  function getColorClass(name) {
    if (!name) return 'color-1';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return 'color-' + ((Math.abs(hash) % 7) + 1);
  }

  function generateAvatarHTML(user, size = 'small') {
    const name = user.full_name || user.email || '';
    const initials = getInitials(name);
    const colorClass = getColorClass(name);

    if (user.profile_picture) {
      return `
        <div class="user-avatar size-${size}">
          <img src="/api/profile/picture/${user.id}" class="user-avatar-image" alt="${name}" />
        </div>
      `;
    } else {
      return `
        <div class="user-avatar size-${size}">
          <div class="user-avatar-initials ${colorClass}">${initials}</div>
        </div>
      `;
    }
  }

  // Render Profile Page
  function renderProfile() {
    const container = getProfileContainer();
    if (!container) return;

    container.innerHTML = `
      <style>
        .profile-page-title { font-size: 28px; font-weight: 600; margin: 0 0 24px 0; }
        .profile-card { background: var(--card); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 24px; margin: 16px 0; }
        .profile-section-title { font-size: 18px; font-weight: 600; margin: 0 0 24px 0; color: var(--text); }
        .profile-header { display: flex; flex-direction: column; align-items: center; gap: 12px; margin-top: 24px; margin-bottom: 12px; }
        .profile-info { display: flex; flex-direction: column; gap: 6px; }
        .profile-name { font-size: 20px; font-weight: 600; color: var(--text); }
        .profile-detail { font-size: 14px; color: var(--muted); }
        .avatar-upload-text { color: var(--muted); font-size: 14px; cursor: pointer; text-decoration: underline; margin-top: 4px; }
        .avatar-upload-text:hover { color: var(--text); }
        .user-avatar.size-large { width: 120px; height: 120px; font-size: 40px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
        .user-avatar.size-large:hover { opacity: 0.85; }
        .profile-row { margin: 20px 0; }
        .profile-row label { display: block; margin-bottom: 8px; color: var(--muted); font-size: 14px; font-weight: 500; }
        .profile-row input { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); background: #10151d; color: var(--text); font-size: 15px; }
        .profile-row input:focus { outline: none; border-color: var(--accent); background: #10151d; }
        .profile-row input:hover { background: #10151d; }
        .profile-row input:disabled { opacity: 0.6; cursor: not-allowed; }
        .profile-button { width: 100%; padding: 12px; border-radius: 10px; border: 0; background: var(--accent); color: #0d130f; font-weight: 700; cursor: pointer; font-size: 15px; margin-top: 8px; }
        .profile-button:hover { filter: brightness(1.06); }
        .profile-status { color: var(--muted); margin-top: 12px; min-height: 1.2em; font-size: 14px; text-align: center; }
        .profile-status.error { color: #ff6b6b; }
        .profile-status.success { color: var(--accent); }
        .phone-error { color: #ff6b6b; font-size: 13px; margin-top: 4px; display: none; }
      </style>

      <div class="page-header-row">
        <h1 class="page-title">My Profile</h1>
        <a href="/app" class="back-to-dashboard">&larr; Back to dashboard</a>
      </div>

      <section class="profile-card">
        <h2 class="profile-section-title">Profile Information</h2>

        <!-- Profile Header with Avatar -->
        <div class="profile-header">
          <div id="profile-avatar-container" onclick="document.getElementById('picture-input').click()" oncontextmenu="handleAvatarContextMenu(event)"></div>
          <div class="avatar-upload-text" onclick="document.getElementById('picture-input').click()">Change photo</div>
          <input type="file" id="picture-input" accept="image/jpeg,image/png,image/webp" style="display:none" />
          <p id="picture-status" class="profile-status" style="margin:0"></p>
        </div>

        <form id="profile-form">
          <div class="profile-row">
            <label>Full legal name (as on passport)</label>
            <input id="full-name" type="text" placeholder="Jane Smith" required />
          </div>
          <div class="profile-row">
            <label>Email</label>
            <input id="email" type="email" disabled />
          </div>
          <div class="profile-row">
            <label>Phone number</label>
            <div class="phone-input-wrapper" data-phone-id="phone-number">
              <div class="phone-input-row">
                <button type="button" class="phone-country-button"></button>
                <span class="phone-prefix"></span>
                <input type="tel" class="phone-number-input" placeholder="612345678" />
                <input type="hidden" id="phone-number" name="phone-number" class="phone-number-full" />
              </div>
              <div class="phone-dropdown">
                <input type="text" class="phone-dropdown-search" placeholder="Search country or code…" />
                <div class="phone-country-list"></div>
              </div>
            </div>
            <div id="phone-error" class="phone-error">Please enter a valid phone number.</div>
          </div>
          <button type="submit" class="profile-button">Save Changes</button>
          <p id="profile-status" class="profile-status"></p>
        </form>
      </section>
    `;

    // Initialize profile page after rendering
    initializeProfilePage();
  }

  // Initialize Profile Page functionality
  function initializeProfilePage() {
    let currentUser = null;
    let phoneInput = null;

    // Load user profile
    async function loadProfile() {
      try {
        // Get user from shared header (already loaded)
        currentUser = window.PayFriendsHeader ? window.PayFriendsHeader.getCurrentUser() : null;

        if (!currentUser) {
          // If header hasn't loaded user yet, wait a bit and try again
          setTimeout(loadProfile, 100);
          return;
        }

        // Render large avatar in profile header
        const avatarContainer = document.getElementById('profile-avatar-container');
        if (avatarContainer) {
          avatarContainer.innerHTML = generateAvatarHTML(currentUser, 'large');
        }

        // Populate form fields
        const fullNameInput = document.getElementById('full-name');
        const emailInput = document.getElementById('email');
        if (fullNameInput) fullNameInput.value = currentUser.full_name || '';
        if (emailInput) emailInput.value = currentUser.email;

        // Initialize phone input using PhoneInputManager
        if (window.PhoneInputManager) {
          window.PhoneInputManager.initialize();
          phoneInput = window.PhoneInputManager.getInstance('phone-number');
        }

        // Set phone number - use profile phone if set, otherwise use invite phone fallback
        const phoneToDisplay = currentUser.phone_number || currentUser.invitePhoneFallback || '';
        if (phoneToDisplay && phoneInput) {
          phoneInput.setNumber(phoneToDisplay);
        }
      } catch (err) {
        console.error('Error loading profile:', err);
        window.location.href = '/';
      }
    }

    // Display profile picture - refresh avatar
    function displayProfilePicture() {
      const avatarContainer = document.getElementById('profile-avatar-container');
      if (avatarContainer && currentUser) {
        avatarContainer.innerHTML = generateAvatarHTML(currentUser, 'large');
      }
    }

    // Handle profile picture upload
    const pictureInput = document.getElementById('picture-input');
    if (pictureInput) {
      pictureInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const pictureStatus = document.getElementById('picture-status');
        if (pictureStatus) {
          pictureStatus.textContent = 'Uploading...';
          pictureStatus.className = 'profile-status';
        }

        try {
          const formData = new FormData();
          formData.append('picture', file);

          const res = await fetch('/api/profile/picture', {
            method: 'POST',
            body: formData
          });

          const contentType = res.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Server returned an invalid response. Please try again.');
          }

          const data = await res.json();

          if (!data.success) {
            if (pictureStatus) {
              pictureStatus.textContent = data.error || 'There was a problem uploading your photo. Please try another image.';
              pictureStatus.className = 'profile-status error';
            }
            e.target.value = '';
            return;
          }

          currentUser.profile_picture = data.profilePictureUrl;
          displayProfilePicture();

          // Refresh header to show new avatar
          if (window.PayFriendsHeader && window.PayFriendsHeader.refreshUserInfo) {
            await window.PayFriendsHeader.refreshUserInfo();
          }

          if (pictureStatus) {
            pictureStatus.textContent = '✓ Profile picture updated';
            pictureStatus.className = 'profile-status success';

            setTimeout(() => {
              pictureStatus.textContent = '';
            }, 3000);
          }
        } catch (err) {
          console.error('Profile picture upload error:', err);
          if (pictureStatus) {
            pictureStatus.textContent = 'There was a problem uploading your photo. Please try another image.';
            pictureStatus.className = 'profile-status error';
          }
        }

        e.target.value = '';
      });
    }

    // Handle avatar context menu (right-click)
    window.handleAvatarContextMenu = function(event) {
      if (currentUser && currentUser.profile_picture) {
        event.preventDefault();
        if (confirm('Remove profile picture?')) {
          removeProfilePicture();
        }
      }
    };

    // Remove profile picture
    async function removeProfilePicture() {
      const pictureStatus = document.getElementById('picture-status');
      if (pictureStatus) {
        pictureStatus.textContent = 'Removing...';
        pictureStatus.className = 'profile-status';
      }

      try {
        const res = await fetch('/api/profile/picture', {
          method: 'DELETE'
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to remove picture');
        }

        currentUser.profile_picture = null;
        displayProfilePicture();

        // Refresh header to show initials
        if (window.PayFriendsHeader && window.PayFriendsHeader.refreshUserInfo) {
          await window.PayFriendsHeader.refreshUserInfo();
        }

        if (pictureStatus) {
          pictureStatus.textContent = '✓ Profile picture removed';
          pictureStatus.className = 'profile-status success';

          setTimeout(() => {
            pictureStatus.textContent = '';
          }, 3000);
        }
      } catch (err) {
        if (pictureStatus) {
          pictureStatus.textContent = err.message;
          pictureStatus.className = 'profile-status error';
        }
      }
    }

    // Save profile changes
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullNameInput = document.getElementById('full-name');
        const status = document.getElementById('profile-status');
        const phoneError = document.getElementById('phone-error');

        // Hide phone error initially
        if (phoneError) phoneError.style.display = 'none';

        const fullName = fullNameInput ? fullNameInput.value.trim() : '';

        if (!fullName) {
          if (status) {
            status.textContent = 'Full name is required';
            status.className = 'profile-status error';
          }
          return;
        }

        // Validate phone number
        if (!phoneInput || !phoneInput.isValidNumber()) {
          if (phoneError) phoneError.style.display = 'block';
          if (phoneInput) {
            phoneInput.setInvalid(true);
          }
          if (status) {
            status.textContent = 'Please fix the errors above';
            status.className = 'profile-status error';
          }
          return;
        }
        // Clear invalid state if valid
        phoneInput.setInvalid(false);

        // Get phone number in E.164 format
        const phoneNumber = phoneInput.getNumber();

        if (status) {
          status.textContent = 'Saving...';
          status.className = 'profile-status';
        }

        try {
          const res = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, phoneNumber })
          });
          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || 'Failed to update profile');
          }

          // Update current user data
          currentUser.full_name = fullName;
          currentUser.phone_number = phoneNumber;

          // Refresh avatar (in case name changed, initials might change)
          displayProfilePicture();

          // Refresh header to show new user info
          if (window.PayFriendsHeader && window.PayFriendsHeader.refreshUserInfo) {
            await window.PayFriendsHeader.refreshUserInfo();
          }

          if (status) {
            status.textContent = '✓ Profile updated successfully';
            status.className = 'profile-status success';

            setTimeout(() => {
              status.textContent = '';
            }, 3000);
          }
        } catch (err) {
          if (status) {
            status.textContent = err.message;
            status.className = 'profile-status error';
          }
        }
      });
    }

    // Load profile data
    loadProfile();
  }

  // Render Settings Page
  function renderSettings() {
    const container = getProfileContainer();
    if (!container) return;

    // Common IANA timezones list
    const TIMEZONES = [
      'Europe/Amsterdam',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Europe/Madrid',
      'Europe/Rome',
      'Europe/Brussels',
      'Europe/Vienna',
      'Europe/Stockholm',
      'Europe/Copenhagen',
      'Europe/Oslo',
      'Europe/Helsinki',
      'Europe/Dublin',
      'Europe/Lisbon',
      'Europe/Warsaw',
      'Europe/Prague',
      'Europe/Budapest',
      'Europe/Athens',
      'Europe/Bucharest',
      'Europe/Moscow',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Toronto',
      'America/Vancouver',
      'America/Mexico_City',
      'America/Sao_Paulo',
      'America/Buenos_Aires',
      'America/Lima',
      'America/Bogota',
      'America/Santiago',
      'Asia/Dubai',
      'Asia/Tokyo',
      'Asia/Hong_Kong',
      'Asia/Shanghai',
      'Asia/Singapore',
      'Asia/Seoul',
      'Asia/Bangkok',
      'Asia/Jakarta',
      'Asia/Manila',
      'Asia/Kolkata',
      'Asia/Karachi',
      'Asia/Taipei',
      'Asia/Istanbul',
      'Australia/Sydney',
      'Australia/Melbourne',
      'Australia/Brisbane',
      'Australia/Perth',
      'Pacific/Auckland',
      'Pacific/Fiji',
      'Pacific/Honolulu',
      'Africa/Cairo',
      'Africa/Johannesburg',
      'Africa/Nairobi',
      'Africa/Lagos',
      'UTC'
    ].sort();

    container.innerHTML = `
      <style>
        .settings-page-title { font-size: 28px; font-weight: 600; margin: 0 0 24px 0; }
        .settings-card { background: var(--card); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 24px; margin: 16px 0; }
        .settings-section-title { font-size: 18px; font-weight: 600; margin: 0 0 16px 0; color: var(--text); }
        .settings-section-description { color: var(--muted); font-size: 14px; margin-bottom: 20px; line-height: 1.5; }
        .settings-row { margin: 20px 0; }
        .settings-row label { display: block; margin-bottom: 8px; color: var(--muted); font-size: 14px; font-weight: 500; }
        .settings-row select { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); background: #10151d; color: var(--text); font-size: 15px; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23a7b0bd' d='M6 9L1 4h10z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; }
        .settings-row select:focus { outline: none; border-color: var(--accent); background: #10151d; }
        .settings-row select:hover { background: #10151d; }
        .helper-text { color: var(--muted); font-size: 13px; margin-top: 6px; line-height: 1.4; }
        .settings-button { width: 100%; padding: 12px; border-radius: 10px; border: 0; background: var(--accent); color: #0d130f; font-weight: 700; cursor: pointer; font-size: 15px; margin-top: 8px; }
        .settings-button:hover { filter: brightness(1.06); }
        .settings-status { color: var(--muted); margin-top: 12px; min-height: 1.2em; font-size: 14px; text-align: center; }
        .settings-status.error { color: #ff6b6b; }
        .settings-status.success { color: var(--accent); }
        .link-button { background: none; border: 0; padding: 0; margin-left: 4px; color: var(--accent); cursor: pointer; font: inherit; text-decoration: underline; }
      </style>

      <div class="page-header-row">
        <h1 class="page-title">Settings</h1>
        <a href="/app" class="back-to-dashboard">&larr; Back to dashboard</a>
      </div>

      <!-- App Preferences -->
      <div class="settings-card">
        <h2 class="settings-section-title">App Preferences</h2>
        <p class="settings-section-description">Customize your app experience and display settings</p>

        <div class="settings-row">
          <label for="timezone">Timezone</label>
          <select id="timezone">
            ${TIMEZONES.map(tz => `<option value="${tz}">${tz.replace(/_/g, ' ')}</option>`).join('')}
          </select>
          <div class="helper-text">
            This timezone is used to show history and activity timestamps in your local time.<br>
            Financial dates like due dates are calendar days and do not depend on timezone.
          </div>
          <div class="helper-text" id="timezoneHint"></div>
        </div>

        <button id="savePreferencesBtn" class="settings-button">Save Preferences</button>
        <div class="settings-status" id="preferencesStatus"></div>
      </div>
    `;

    // Initialize settings page after rendering
    initializeSettingsPage(TIMEZONES);
  }

  // Initialize Settings Page functionality
  function initializeSettingsPage(TIMEZONES) {
    let currentUser = null;
    let detectedTimezoneGlobal = null;

    function initializeTimezoneSelect(savedTimezone, detectedTimezone) {
      const timezoneSelect = document.getElementById('timezone');
      const hintEl = document.getElementById('timezoneHint');

      if (!timezoneSelect) return;

      if (hintEl) hintEl.innerHTML = '';

      detectedTimezoneGlobal = detectedTimezone || null;

      const currentTimezone = savedTimezone || detectedTimezone || 'Europe/Amsterdam';

      // Set selected option
      timezoneSelect.value = currentTimezone;

      // Show mismatch hint
      if (savedTimezone && detectedTimezone && savedTimezone !== detectedTimezone && hintEl) {
        hintEl.innerHTML = `
          Your current browser timezone is <strong>${detectedTimezone.replace(/_/g, ' ')}</strong>.
          <button type="button" class="link-button" id="useBrowserTimezoneBtn">Use current timezone</button>
        `;

        const btn = document.getElementById('useBrowserTimezoneBtn');
        if (btn) {
          btn.addEventListener('click', () => {
            if (!detectedTimezoneGlobal) return;
            timezoneSelect.value = detectedTimezoneGlobal;
            savePreferences();
          });
        }
      }
    }

    async function loadCurrentUserTimezone() {
      let detectedTimezone = null;
      try {
        detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch (e) {
        console.warn('Could not detect browser timezone:', e);
      }

      try {
        const res = await fetch('/api/user');
        if (!res.ok) throw new Error('Failed to load user');

        const data = await res.json();
        currentUser = data.user;

        const savedTimezone = currentUser.timezone || null;
        initializeTimezoneSelect(savedTimezone, detectedTimezone);
      } catch (err) {
        console.error(err);
        initializeTimezoneSelect(null, detectedTimezone);
      }
    }

    async function savePreferences() {
      const timezoneSelect = document.getElementById('timezone');
      const timezone = timezoneSelect ? timezoneSelect.value : null;

      if (!timezone) {
        showStatus('preferencesStatus', 'Please select a timezone', 'error');
        return;
      }

      try {
        const payload = {
          timezone: timezone
        };

        // If backend requires fullName and phoneNumber in the same call, include them
        if (currentUser) {
          if (currentUser.full_name) {
            payload.fullName = currentUser.full_name;
          }
          if (currentUser.phone_number) {
            payload.phoneNumber = currentUser.phone_number;
          }
        }

        const res = await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to save preferences');
        }

        // Update local copy so later saves use the new value
        if (!currentUser) currentUser = {};
        currentUser.timezone = timezone;

        showStatus('preferencesStatus', 'Preferences updated successfully', 'success');
      } catch (err) {
        console.error('Error saving preferences:', err);
        showStatus('preferencesStatus', 'Failed to save preferences. Please try again.', 'error');
      }
    }

    function showStatus(elementId, message, type) {
      const el = document.getElementById(elementId);
      if (!el) return;
      el.textContent = message;
      el.className = 'settings-status ' + type;
      if (type === 'success') {
        setTimeout(() => {
          el.textContent = '';
          el.className = 'settings-status';
        }, 3000);
      }
    }

    // Event listeners
    const saveBtn = document.getElementById('savePreferencesBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', savePreferences);
    }

    // Load user timezone on page load
    loadCurrentUserTimezone();
  }

  // Render Security Page
  function renderSecurity() {
    const container = getProfileContainer();
    if (!container) return;

    container.innerHTML = `
      <style>
        .security-page-title { font-size: 28px; font-weight: 600; margin: 0 0 8px 0; color: var(--text); }
        .security-page-subtitle { font-size: 15px; color: var(--muted); margin: 0 0 24px 0; line-height: 1.5; }
        .security-card { background: var(--card); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 24px; margin: 16px 0; }
        .security-section-title { font-size: 18px; font-weight: 600; margin: 0 0 8px 0; color: var(--text); display: flex; align-items: center; gap: 8px; }
        .security-section-description { color: var(--muted); font-size: 14px; margin-bottom: 20px; line-height: 1.5; }
        .security-row { margin: 20px 0; }
        .security-row label { display: block; margin-bottom: 8px; color: var(--muted); font-size: 14px; font-weight: 500; }
        .security-row input { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); background: #10151d; color: var(--text); font-size: 15px; }
        .security-row input:focus { outline: none; border-color: var(--accent); background: #10151d; }
        .security-row input:hover { background: #10151d; }
        .security-row input.error { border-color: #ff6b6b; }
        .helper-text { color: var(--muted); font-size: 13px; margin-top: 6px; line-height: 1.4; }
        .error-text { color: #ff6b6b; font-size: 13px; margin-top: 4px; display: none; }
        .error-text.show { display: block; }
        .security-button-group { display: flex; gap: 12px; margin-top: 24px; align-items: center; }
        .security-button { padding: 12px 24px; border-radius: 10px; border: 0; background: var(--accent); color: #0d130f; font-weight: 700; cursor: pointer; font-size: 15px; }
        .security-button:hover:not(:disabled) { filter: brightness(1.06); }
        .security-button:disabled { opacity: 0.5; cursor: not-allowed; }
        .security-cancel { background: none; border: 0; padding: 0; color: var(--muted); cursor: pointer; font-size: 15px; text-decoration: none; }
        .security-cancel:hover { color: var(--text); text-decoration: underline; }
        .security-status { padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; display: none; }
        .security-status.show { display: block; }
        .security-status.success { background: rgba(97, 218, 175, 0.1); color: var(--accent); border: 1px solid rgba(97, 218, 175, 0.2); }
        .security-status.error { background: rgba(255, 107, 107, 0.1); color: #ff6b6b; border: 1px solid rgba(255, 107, 107, 0.2); }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; background: rgba(255, 193, 7, 0.15); color: #ffc107; }
        .disabled-card { opacity: 0.6; pointer-events: none; position: relative; }
        .disabled-card::after { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.3); border-radius: 16px; pointer-events: none; }
      </style>

      <div class="page-header-row">
        <h1 class="page-title">Security</h1>
        <a href="/app" class="back-to-dashboard">&larr; Back to dashboard</a>
      </div>

      <!-- Change Password Card -->
      <div class="security-card">
        <h2 class="security-section-title">Change password</h2>
        <p class="security-section-description">Update the password you use to log in.</p>

        <div id="password-status" class="security-status"></div>

        <form id="change-password-form">
          <div class="security-row">
            <label for="current-password">Current password</label>
            <input
              type="password"
              id="current-password"
              name="current-password"
              autocomplete="current-password"
              required
            />
            <div id="current-password-error" class="error-text"></div>
          </div>

          <div class="security-row">
            <label for="new-password">New password</label>
            <input
              type="password"
              id="new-password"
              name="new-password"
              autocomplete="new-password"
              required
            />
            <div class="helper-text">Min 8 characters</div>
            <div id="new-password-error" class="error-text"></div>
          </div>

          <div class="security-row">
            <label for="confirm-password">Confirm new password</label>
            <input
              type="password"
              id="confirm-password"
              name="confirm-password"
              autocomplete="new-password"
              required
            />
            <div id="confirm-password-error" class="error-text"></div>
          </div>

          <div class="security-button-group">
            <button type="submit" id="save-password-btn" class="security-button">Save password</button>
            <button type="button" id="cancel-password-btn" class="security-cancel">Cancel</button>
          </div>
        </form>
      </div>

      <!-- Two Step Verification Card (Disabled) -->
      <div class="security-card disabled-card">
        <h2 class="security-section-title">
          Two step verification
          <span class="badge">Coming soon</span>
        </h2>
        <p class="security-section-description">Add an extra layer of security to your account using an authenticator app or SMS.</p>

        <div class="security-row">
          <button type="button" class="security-button" disabled>Set up two step verification</button>
        </div>
      </div>
    `;

    // Initialize security page after rendering
    initializeSecurityPage();
  }

  // Initialize Security Page functionality
  function initializeSecurityPage() {
    const form = document.getElementById('change-password-form');
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const saveBtn = document.getElementById('save-password-btn');
    const cancelBtn = document.getElementById('cancel-password-btn');
    const statusDiv = document.getElementById('password-status');

    // Error message elements
    const currentPasswordError = document.getElementById('current-password-error');
    const newPasswordError = document.getElementById('new-password-error');
    const confirmPasswordError = document.getElementById('confirm-password-error');

    // Clear all errors and status
    function clearErrors() {
      currentPasswordInput.classList.remove('error');
      newPasswordInput.classList.remove('error');
      confirmPasswordInput.classList.remove('error');
      currentPasswordError.classList.remove('show');
      newPasswordError.classList.remove('show');
      confirmPasswordError.classList.remove('show');
      currentPasswordError.textContent = '';
      newPasswordError.textContent = '';
      confirmPasswordError.textContent = '';
    }

    function showError(input, errorElement, message) {
      input.classList.add('error');
      errorElement.textContent = message;
      errorElement.classList.add('show');
    }

    function showStatus(message, type) {
      statusDiv.textContent = message;
      statusDiv.className = 'security-status show ' + type;

      if (type === 'success') {
        setTimeout(() => {
          statusDiv.classList.remove('show');
        }, 5000);
      }
    }

    function hideStatus() {
      statusDiv.classList.remove('show');
    }

    // Clear errors when user starts typing
    currentPasswordInput.addEventListener('input', () => {
      currentPasswordInput.classList.remove('error');
      currentPasswordError.classList.remove('show');
      hideStatus();
    });

    newPasswordInput.addEventListener('input', () => {
      newPasswordInput.classList.remove('error');
      newPasswordError.classList.remove('show');
      hideStatus();
    });

    confirmPasswordInput.addEventListener('input', () => {
      confirmPasswordInput.classList.remove('error');
      confirmPasswordError.classList.remove('show');
      hideStatus();
    });

    // Cancel button - reset form
    cancelBtn.addEventListener('click', () => {
      form.reset();
      clearErrors();
      hideStatus();
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();
      hideStatus();

      const currentPassword = currentPasswordInput.value;
      const newPassword = newPasswordInput.value;
      const confirmPassword = confirmPasswordInput.value;

      // Client-side validation
      let hasError = false;

      if (!currentPassword) {
        showError(currentPasswordInput, currentPasswordError, 'Current password is required');
        hasError = true;
      }

      if (!newPassword) {
        showError(newPasswordInput, newPasswordError, 'New password is required');
        hasError = true;
      } else if (newPassword.length < 8) {
        showError(newPasswordInput, newPasswordError, 'New password must be at least 8 characters');
        hasError = true;
      }

      if (!confirmPassword) {
        showError(confirmPasswordInput, confirmPasswordError, 'Please confirm your new password');
        hasError = true;
      } else if (newPassword !== confirmPassword) {
        showError(confirmPasswordInput, confirmPasswordError, 'Passwords do not match');
        hasError = true;
      }

      if (hasError) {
        // Focus first error field
        if (currentPasswordInput.classList.contains('error')) {
          currentPasswordInput.focus();
        } else if (newPasswordInput.classList.contains('error')) {
          newPasswordInput.focus();
        } else if (confirmPasswordInput.classList.contains('error')) {
          confirmPasswordInput.focus();
        }
        return;
      }

      // Disable button and show loading state
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';

      try {
        const response = await fetch('/api/security/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await response.json();

        if (!response.ok) {
          // Check for specific errors
          if (data.error === 'Current password is incorrect') {
            showError(currentPasswordInput, currentPasswordError, data.error);
            currentPasswordInput.focus();
          } else {
            showStatus(data.error || 'Something went wrong while updating your password. Please try again.', 'error');
          }
          return;
        }

        // Success
        form.reset();
        showStatus('Password updated successfully.', 'success');
      } catch (err) {
        console.error('Error changing password:', err);
        showStatus('Something went wrong while updating your password. Please try again.', 'error');
      } finally {
        // Re-enable button
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save password';
      }
    });
  }

  // Export render functions
  window.ProfilePages = {
    renderProfile,
    renderSettings,
    renderSecurity
  };
})();

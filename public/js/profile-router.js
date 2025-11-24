/**
 * Profile Pages Router
 * Handles client-side routing for /app/profile, /app/settings, /app/security pages within the main app
 */

(function() {
  'use strict';

  const PROFILE_ROUTES = {
    '/app/profile': 'renderProfile',
    '/app/settings': 'renderSettings',
    '/app/security': 'renderSecurity'
  };

  // Check if current path is a profile route
  function isProfileRoute() {
    const path = window.location.pathname;
    return path === '/app/profile' || path === '/app/settings' || path === '/app/security';
  }

  // Navigate to a profile page without full page reload
  function navigateTo(path) {
    window.history.pushState(null, '', path);
    renderCurrentRoute();
  }

  // Render the appropriate profile page based on current route
  function renderCurrentRoute() {
    const path = window.location.pathname;
    const handler = PROFILE_ROUTES[path];

    if (handler && window.ProfilePages && typeof window.ProfilePages[handler] === 'function') {
      window.ProfilePages[handler]();
    } else if (path.startsWith('/app/profile') || path.startsWith('/app/settings') || path.startsWith('/app/security')) {
      // Unknown profile route, redirect to profile
      navigateTo('/app/profile');
    }
  }

  // Initialize profile router
  function initialize() {
    if (!isProfileRoute()) {
      return false; // Not a profile route, don't interfere
    }

    // Hide all app sections (they'll be rendered when not on profile pages)
    const sectionsToHide = [
      'activity-section',
      'list-section',
      'create-section',
      'message-modal',
      'confirm-payment-modal',
      'difficulty-modal',
      'create-info-box'
    ];

    sectionsToHide.forEach(sectionId => {
      const section = document.getElementById(sectionId);
      if (section) {
        section.style.display = 'none';
      }
    });

    // Also hide any sections with class 'card'
    const cards = document.querySelectorAll('main.container > section.card, main.container > .card');
    cards.forEach(card => {
      card.style.display = 'none';
    });

    // Create profile content container if it doesn't exist
    let profileContainer = document.getElementById('profile-content');
    if (!profileContainer) {
      const container = document.querySelector('main.container') || document.querySelector('.container');
      if (container) {
        profileContainer = document.createElement('div');
        profileContainer.id = 'profile-content';
        profileContainer.style.display = 'block';
        container.appendChild(profileContainer);
      }
    }

    // Render the current route
    renderCurrentRoute();

    // Handle browser back/forward buttons
    window.addEventListener('popstate', () => {
      if (isProfileRoute()) {
        renderCurrentRoute();
      } else {
        // Navigated away from profile pages, reload to show main app
        window.location.reload();
      }
    });

    // Intercept clicks on profile links
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="/app/profile"], a[href^="/app/settings"], a[href^="/app/security"]');
      if (link) {
        e.preventDefault();
        const href = link.getAttribute('href');
        navigateTo(href);
      }
    });

    return true; // Profile router is active
  }

  // Export router functions
  window.ProfileRouter = {
    initialize,
    navigateTo,
    isProfileRoute
  };
})();

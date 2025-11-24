/**
 * Legal Pages Router
 * Handles client-side routing for /app/legal/* pages within the main app
 */

(function() {
  'use strict';

  const LEGAL_ROUTES = {
    '/app/legal': 'renderLegalIndex',
    '/app/legal/terms': 'renderTerms',
    '/app/legal/privacy': 'renderPrivacy',
    '/app/legal/cookies': 'renderCookies'
  };

  // Check if current path is a legal route
  function isLegalRoute() {
    const path = window.location.pathname;
    return path.startsWith('/app/legal');
  }

  // Navigate to a legal page without full page reload
  function navigateTo(path) {
    window.history.pushState(null, '', path);
    renderCurrentRoute();
  }

  // Render the appropriate legal page based on current route
  function renderCurrentRoute() {
    const path = window.location.pathname;
    const handler = LEGAL_ROUTES[path];

    if (handler && window.LegalPages && typeof window.LegalPages[handler] === 'function') {
      window.LegalPages[handler]();
    } else if (path.startsWith('/app/legal')) {
      // Unknown legal route, redirect to legal index
      navigateTo('/app/legal');
    }
  }

  // Initialize legal router
  function initialize() {
    if (!isLegalRoute()) {
      return false; // Not a legal route, don't interfere
    }

    // Hide all app sections (they'll be rendered when not on legal pages)
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

    // Create legal content container if it doesn't exist
    let legalContainer = document.getElementById('legal-content');
    if (!legalContainer) {
      const container = document.querySelector('main.container') || document.querySelector('.container');
      if (container) {
        legalContainer = document.createElement('div');
        legalContainer.id = 'legal-content';
        legalContainer.style.display = 'block';
        container.appendChild(legalContainer);
      }
    }

    // Render the current route
    renderCurrentRoute();

    // Handle browser back/forward buttons
    window.addEventListener('popstate', () => {
      if (isLegalRoute()) {
        renderCurrentRoute();
      } else {
        // Navigated away from legal pages, reload to show main app
        window.location.reload();
      }
    });

    // Intercept clicks on legal links
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="/app/legal"]');
      if (link) {
        e.preventDefault();
        const href = link.getAttribute('href');
        navigateTo(href);
      }
    });

    return true; // Legal router is active
  }

  // Export router functions
  window.LegalRouter = {
    initialize,
    navigateTo,
    isLegalRoute
  };
})();

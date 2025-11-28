/**
 * PayFriends Shared Footer Component
 * Provides unified footer functionality across all pages
 */

(function() {
  'use strict';

  /**
   * Initialize the shared footer
   * Loads the footer HTML and appends it to the page
   */
  async function initializeFooter() {
    try {
      // Load footer HTML
      const response = await fetch('/components/footer.html');
      if (!response.ok) {
        throw new Error('Failed to load footer component');
      }

      const footerHTML = await response.text();

      // Always append footer to body for consistent positioning
      // The footer CSS makes body a flex column container, so footer
      // will always appear at the bottom of the viewport
      document.body.insertAdjacentHTML('beforeend', footerHTML);

      // Set the dynamic year
      const yearSpan = document.getElementById('payfriends-footer-year');
      if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
      }

    } catch (error) {
      console.error('Error initializing footer:', error);
    }
  }

  // Export function to global scope
  window.PayFriendsFooter = {
    initialize: initializeFooter
  };

})();

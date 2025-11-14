/**
 * PayFriends Matrix Rain Background Animation
 *
 * A lightweight, canvas-based Matrix-style rain effect using PayFriends-themed symbols.
 *
 * Configuration options:
 * - density: Controls the number of symbol columns (default: 1, range: 0.5 - 2)
 * - speed: Global speed multiplier for falling symbols (default: 1, range: 0.5 - 3)
 * - blur: Toggles glow/blur effect on symbols (default: true)
 * - colorMode: Color palette mode - currently 'mint' only (Option A)
 *   - 'mint': Full green palette with PayFriends mint/teal colors
 *   - 'multi': Reserved for future Option B with orange/purple accents
 *
 * Symbol set:
 * - Currency: €, $, £, ¥, ₿, CHF, R$, ₹, ₺, ₩
 * - Social/emotion: 🙂, 😄, 🤝, ❤️, ⭐
 * - PayFriends: "PF", "+1", "✓", "fair", "💸"
 * - Fairness placeholder: ⚖ (to be replaced with PayFriends SVG icon later)
 *
 * Future enhancement:
 * To replace ⚖ with the real PayFriends fairness icon:
 * 1. Import or inline the SVG icon
 * 2. Draw it to a temporary canvas and convert to emoji-sized image
 * 3. Replace ⚖ in the SYMBOLS array with the rendered icon
 */

(function() {
  'use strict';

  // PayFriends-themed symbol set
  const SYMBOLS = [
    // Currency symbols
    '€', '$', '£', '¥', '₿', 'CHF', 'R$', '₹', '₺', '₩',
    // Social/emotion
    '🙂', '😄', '🤝', '❤️', '⭐',
    // PayFriends semantics
    'PF', '+1', '✓', 'fair', '💸',
    // Fairness (placeholder for custom SVG icon)
    '⚖'
  ];

  // Special words that occasionally drop as single symbols
  const SPECIAL_WORDS = ['fair', 'trust', 'PF', 'friends'];

  // PayFriends color palette (Option A: full green)
  const COLORS = {
    // Near-black teal background
    background: '#0a0f12',
    // Main bright mint/teal (PayFriends accent color)
    primary: '#3ddc97',
    // Slightly dimmed version for depth
    secondary: '#2db079',
    // Very dim for trailing effect
    tertiary: '#1e7a55'
  };

  class PayFriendsMatrixRain {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });

      // Configuration
      this.config = {
        density: options.density ?? 1,
        speed: options.speed ?? 1,
        blur: options.blur ?? true,
        colorMode: options.colorMode || 'mint'
      };

      // Animation state
      this.columns = [];
      this.fontSize = 16;
      this.columnWidth = this.fontSize * 0.8;
      this.animationId = null;
      this.lastFrame = 0;

      // Bind methods
      this.animate = this.animate.bind(this);
      this.handleResize = this.handleResize.bind(this);

      // Initialize
      this.resize();
      window.addEventListener('resize', this.handleResize);
    }

    handleResize() {
      // Debounce resize events
      if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => this.resize(), 150);
    }

    resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = this.canvas.getBoundingClientRect();

      // Set canvas size accounting for device pixel ratio
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.canvas.style.width = `${rect.width}px`;
      this.canvas.style.height = `${rect.height}px`;

      // Scale context for retina displays
      this.ctx.scale(dpr, dpr);

      // Store logical dimensions
      this.width = rect.width;
      this.height = rect.height;

      // Recalculate columns
      this.initializeColumns();
    }

    initializeColumns() {
      const columnCount = Math.ceil((this.width / this.columnWidth) * this.config.density);
      this.columns = [];

      for (let i = 0; i < columnCount; i++) {
        this.columns.push(this.createColumn(i));
      }
    }

    createColumn(index) {
      // Randomize starting position for organic feel
      const startY = -Math.random() * this.height;

      return {
        x: index * this.columnWidth,
        y: startY,
        // Each column has its own base speed for variation
        baseSpeed: 0.5 + Math.random() * 1.5,
        // Random symbol from the set
        symbol: this.getRandomSymbol(),
        // Brightness variation (0.6 - 1.0)
        brightness: 0.6 + Math.random() * 0.4,
        // Occasional horizontal wobble offset
        wobbleOffset: 0,
        wobbleSpeed: Math.random() * 0.02,
        wobbleAmount: Math.random() * 2
      };
    }

    getRandomSymbol() {
      // 5% chance to use a special word
      if (Math.random() < 0.05) {
        return SPECIAL_WORDS[Math.floor(Math.random() * SPECIAL_WORDS.length)];
      }
      return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    }

    getColor(brightness) {
      // For Option A, use only green palette with brightness variation
      const baseColor = brightness > 0.85 ? COLORS.primary :
                        brightness > 0.7 ? COLORS.secondary :
                        COLORS.tertiary;

      // Parse hex color and apply brightness
      const hex = baseColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);

      // Apply brightness multiplier
      const alpha = 0.5 + brightness * 0.5;

      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    drawSymbol(column) {
      const { x, y, symbol, brightness, wobbleOffset } = column;

      // Apply glow effect if enabled
      if (this.config.blur) {
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = this.getColor(brightness);
      }

      this.ctx.fillStyle = this.getColor(brightness);
      this.ctx.font = `${this.fontSize}px monospace`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'top';

      // Draw symbol with subtle wobble
      this.ctx.fillText(symbol, x + this.columnWidth / 2 + wobbleOffset, y);

      // Reset shadow
      if (this.config.blur) {
        this.ctx.shadowBlur = 0;
      }
    }

    updateColumn(column, deltaTime) {
      // Update position
      const speed = column.baseSpeed * this.config.speed * deltaTime * 0.05;
      column.y += speed;

      // Update wobble
      column.wobbleOffset = Math.sin(column.y * column.wobbleSpeed) * column.wobbleAmount;

      // Reset column when it goes off screen
      if (column.y > this.height + this.fontSize) {
        column.y = -this.fontSize;
        column.symbol = this.getRandomSymbol();
        column.brightness = 0.6 + Math.random() * 0.4;
        column.baseSpeed = 0.5 + Math.random() * 1.5;
      }
    }

    animate(timestamp) {
      // Calculate delta time for smooth animation
      const deltaTime = this.lastFrame ? timestamp - this.lastFrame : 16;
      this.lastFrame = timestamp;

      // Clear canvas with trailing effect (semi-transparent background)
      this.ctx.fillStyle = COLORS.background + '15'; // Very transparent for trail
      this.ctx.fillRect(0, 0, this.width, this.height);

      // Update and draw all columns
      for (const column of this.columns) {
        this.updateColumn(column, deltaTime);
        this.drawSymbol(column);
      }

      // Continue animation
      this.animationId = requestAnimationFrame(this.animate);
    }

    start() {
      if (!this.animationId) {
        this.lastFrame = 0;
        this.animationId = requestAnimationFrame(this.animate);
      }
    }

    stop() {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
    }

    destroy() {
      this.stop();
      window.removeEventListener('resize', this.handleResize);
      if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
    }
  }

  // Export to global scope
  window.PayFriendsMatrixRain = PayFriendsMatrixRain;
})();

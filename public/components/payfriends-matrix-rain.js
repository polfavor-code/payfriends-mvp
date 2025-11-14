/**
 * PayFriends Matrix Rain Component
 *
 * Canvas-based animated background featuring falling PayFriends-themed symbols
 * with Matrix-style aesthetics using mint/teal green color palette.
 *
 * Options:
 * - density: Controls column density (default: 1). Higher = more columns. Range: 0.5–2
 * - speed: Animation speed multiplier (default: 1). Higher = faster. Range: 0.5–3
 * - blur: Enable subtle glow effect (default: false)
 * - colorMode: "mint" (default, mostly mint green) or "multi" (with accent colors)
 *
 * Color Distribution (colorMode: "multi"):
 * - Mint/teal green: 80–90%
 * - Soft orange: ~7%
 * - Soft purple/indigo: ~3%
 *
 * Symbol Set:
 * - Currency: €, $, £, ¥, ₿, CHF, R$, ₹, ₺, ₩
 * - Social/emotion: 🙂, 😄, 🤝, ❤️, ⭐
 * - PF semantics: PF, +1, ✓, fair, 💸
 * - Fairness placeholder: ⚖ (to be replaced with custom SVG icon via customSymbol)
 *
 * Future Enhancement:
 * To replace ⚖ with a custom SVG fairness icon:
 * 1. Load your SVG as an image or inline it in canvas
 * 2. Update the draw method to render the custom icon when symbol === '⚖'
 * 3. Use ctx.drawImage() or path-based rendering for SVG
 *
 * Usage:
 * const rain = new PayFriendsMatrixRain({
 *   container: document.getElementById('matrix-bg'),
 *   density: 1,
 *   speed: 1,
 *   blur: true,
 *   colorMode: 'multi'
 * });
 */

class PayFriendsMatrixRain {
  constructor(options = {}) {
    this.container = options.container || document.body;
    this.density = options.density ?? 1;
    this.speed = options.speed ?? 1;
    this.blur = options.blur ?? false;
    this.colorMode = options.colorMode || 'multi';

    // Symbol sets
    this.currencySymbols = ['€', '$', '£', '¥', '₿', 'CHF', 'R$', '₹', '₺', '₩'];
    this.emojiSymbols = ['🙂', '😄', '🤝', '❤️', '⭐'];
    this.pfSymbols = ['PF', '+1', '✓', 'fair', '💸', '⚖'];
    this.allSymbols = [...this.currencySymbols, ...this.emojiSymbols, ...this.pfSymbols];

    // Color palette (Option B)
    this.colors = {
      mint: '#3ddc97',      // Main neon mint/teal
      mintAlt: '#2dd484',   // Variation
      orange: '#ff9d76',    // Soft orange accent
      purple: '#a78bfa',    // Soft purple/indigo accent
      bg: '#0a0f14'         // Near-black teal background
    };

    this.canvas = null;
    this.ctx = null;
    this.columns = [];
    this.animationId = null;
    this.resizeTimeout = null;

    this.init();
  }

  init() {
    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '0';

    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    // Handle resize
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);

    // Initial setup
    this.resize();
    this.setupColumns();
    this.animate();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.container.getBoundingClientRect();

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    this.ctx.scale(dpr, dpr);

    this.width = rect.width;
    this.height = rect.height;
  }

  handleResize() {
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      this.resize();
      this.setupColumns();
    }, 250);
  }

  setupColumns() {
    const fontSize = 16;
    const columnWidth = fontSize * 1.2;
    const columnCount = Math.floor(this.width / columnWidth * this.density);

    this.columns = [];
    for (let i = 0; i < columnCount; i++) {
      this.columns.push({
        x: i * columnWidth,
        y: -Math.random() * this.height,
        speed: (0.3 + Math.random() * 0.7) * this.speed,
        symbol: this.getRandomSymbol(),
        color: this.getRandomColor(),
        fontSize: fontSize,
        opacity: 0.6 + Math.random() * 0.4,
        // Rare chance for special words
        isSpecial: Math.random() < 0.02
      });
    }
  }

  getRandomSymbol() {
    // Occasional special words
    if (Math.random() < 0.05) {
      return Math.random() < 0.5 ? 'fair' : 'trust';
    }
    return this.allSymbols[Math.floor(Math.random() * this.allSymbols.length)];
  }

  getRandomColor() {
    if (this.colorMode === 'mint') {
      return Math.random() < 0.5 ? this.colors.mint : this.colors.mintAlt;
    }

    // Multi-color mode with proper distribution
    const rand = Math.random() * 100;
    if (rand < 90) {
      // 90% mint/teal variations
      return Math.random() < 0.5 ? this.colors.mint : this.colors.mintAlt;
    } else if (rand < 97) {
      // 7% orange
      return this.colors.orange;
    } else {
      // 3% purple
      return this.colors.purple;
    }
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    // Clear with fade effect for trails
    this.ctx.fillStyle = `${this.colors.bg}22`;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw and update columns
    this.columns.forEach(col => {
      // Apply blur if enabled
      if (this.blur) {
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = col.color;
      }

      // Set text properties
      this.ctx.font = `${col.isSpecial ? 'bold' : 'normal'} ${col.fontSize}px monospace`;
      this.ctx.fillStyle = col.color;
      this.ctx.globalAlpha = col.opacity;

      // Subtle wobble effect
      const wobble = Math.sin(Date.now() * 0.001 + col.x) * 0.5;

      // Draw symbol
      this.ctx.fillText(col.symbol, col.x + wobble, col.y);

      // Reset effects
      this.ctx.shadowBlur = 0;
      this.ctx.globalAlpha = 1;

      // Update position
      col.y += col.speed;

      // Reset when off screen
      if (col.y > this.height + 20) {
        col.y = -20;
        col.symbol = this.getRandomSymbol();
        col.color = this.getRandomColor();
        col.speed = (0.3 + Math.random() * 0.7) * this.speed;
        col.opacity = 0.6 + Math.random() * 0.4;
        col.isSpecial = Math.random() < 0.02;
      }
    });
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    window.removeEventListener('resize', this.handleResize);
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}

// Export for use in browser
if (typeof window !== 'undefined') {
  window.PayFriendsMatrixRain = PayFriendsMatrixRain;
}

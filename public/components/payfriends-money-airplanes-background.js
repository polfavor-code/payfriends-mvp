/**
 * PayFriends Money Airplanes Animated Background
 *
 * A stylish, minimalist animated background featuring:
 * - Folded money bills flying like paper airplanes
 * - Occasional coins and bitcoin icons as companions
 * - Flying from left and right, crossing behind the login card
 * - Smooth curved paths with gentle motion
 * - Low opacity (~18%) for subtle background effect
 *
 * Configuration options:
 * - speed: Global speed multiplier for flights (default: 1)
 * - density: How many flights on screen (0.5 = lighter, 1 = default, 2 = busier)
 * - opacity: Global opacity for all elements (default: 0.18)
 *
 * Visual Design:
 * - Dark background matching login page
 * - Paper airplane money bills (72-120px)
 * - Small coins/bitcoin (18-32px)
 * - PayFriends brand green (#3ddc97)
 * - Curved flight paths using quadratic Bezier curves
 *
 * Performance:
 * - Uses requestAnimationFrame for smooth 60fps
 * - Efficient canvas rendering with device pixel ratio support
 * - Automatic cleanup on destroy
 */

(function() {
  'use strict';

  // Currency symbols
  const COIN_SYMBOLS = ['€', '$', '£', '₿'];
  const BILL_SYMBOLS = ['€', '$', '₿'];

  // Colors
  const COLORS = {
    background: '#0e1116',
    planeBodyLight: '#3ddc97',    // PayFriends brand green
    planeBodyDark: '#22c55e',     // Lighter green
    planeOutline: '#16a34a',      // Darker green for edges
    coinGold: '#fbbf24',          // Gold for coins
    bitcoinOrange: '#f7931a',     // Bitcoin orange
    bitcoinGreen: '#3ddc97'       // Bitcoin in brand green
  };

  // Flight configuration
  const BASE_FLIGHT_COUNT = 6;    // Base number of concurrent flights
  const SPAWN_INTERVAL = 2000;    // ms between spawn attempts
  const FLIGHT_DURATION_MIN = 4000;  // Minimum flight time (ms)
  const FLIGHT_DURATION_MAX = 9000;  // Maximum flight time (ms)

  class PayFriendsMoneyAirplanesBackground {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });

      // Configuration
      this.config = {
        speed: options.speed ?? 1,
        density: options.density ?? 1,
        opacity: options.opacity ?? 0.18
      };

      // Animation state
      this.flights = [];
      this.animationId = null;
      this.lastFrame = 0;
      this.lastSpawnTime = 0;

      // Bind methods
      this.animate = this.animate.bind(this);
      this.handleResize = this.handleResize.bind(this);

      // Initialize
      this.resize();
      window.addEventListener('resize', this.handleResize);
    }

    handleResize() {
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

      // Recreate all flights with new dimensions
      this.initializeFlights();
    }

    initializeFlights() {
      const desiredCount = Math.ceil(BASE_FLIGHT_COUNT * this.config.density);
      this.flights = [];

      // Spawn initial flights with staggered start times
      for (let i = 0; i < desiredCount; i++) {
        const flight = this.createFlight();
        // Stagger start times by randomizing initial progress
        flight.startTime = Date.now() - Math.random() * flight.duration;
        this.flights.push(flight);
      }
    }

    createFlight() {
      // Random direction
      const direction = Math.random() < 0.5 ? 'left-to-right' : 'right-to-left';

      // Random vertical position (keep in middle 60% of screen)
      const yStart = this.height * (0.2 + Math.random() * 0.6);
      const yEnd = this.height * (0.2 + Math.random() * 0.6);

      // Start and end positions (slightly off-screen)
      const padding = 150;
      const start = direction === 'left-to-right'
        ? { x: -padding, y: yStart }
        : { x: this.width + padding, y: yStart };

      const end = direction === 'left-to-right'
        ? { x: this.width + padding, y: yEnd }
        : { x: -padding, y: yEnd };

      // Random curve control point for nice arc
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      const curveMagnitude = 100 + Math.random() * 200; // Random curve intensity
      const curveDirection = Math.random() < 0.5 ? 1 : -1; // Curve up or down

      const ctrl = {
        x: midX,
        y: midY + (curveMagnitude * curveDirection)
      };

      // Random flight type
      const typeRoll = Math.random();
      let type, coins;

      if (typeRoll < 0.5) {
        type = 'plane';
        coins = 0;
      } else if (typeRoll < 0.8) {
        type = 'plane-with-coins';
        coins = 1 + Math.floor(Math.random() * 3); // 1-3 coins
      } else {
        type = 'coins-only';
        coins = 2 + Math.floor(Math.random() * 4); // 2-5 coins
      }

      // Random sizes
      const planeSize = 72 + Math.random() * 48; // 72-120px
      const coinSize = 18 + Math.random() * 14;  // 18-32px

      // Random duration adjusted by speed
      const duration = (FLIGHT_DURATION_MIN + Math.random() * (FLIGHT_DURATION_MAX - FLIGHT_DURATION_MIN)) / this.config.speed;

      // Random rotation speed for coins
      const rotationSpeed = 0.001 + Math.random() * 0.002; // radians per ms

      return {
        id: Math.random().toString(36).substr(2, 9),
        type,
        direction,
        startTime: Date.now(),
        duration,
        start,
        end,
        ctrl,
        coins,
        planeSize,
        coinSize,
        rotationSpeed,
        symbol: type === 'coins-only'
          ? COIN_SYMBOLS[Math.floor(Math.random() * COIN_SYMBOLS.length)]
          : BILL_SYMBOLS[Math.floor(Math.random() * BILL_SYMBOLS.length)]
      };
    }

    // Calculate position along quadratic Bezier curve
    getPositionOnCurve(t, start, ctrl, end) {
      const t1 = 1 - t;
      return {
        x: t1 * t1 * start.x + 2 * t1 * t * ctrl.x + t * t * end.x,
        y: t1 * t1 * start.y + 2 * t1 * t * ctrl.y + t * t * end.y
      };
    }

    // Calculate tangent angle for rotation along curve
    getTangentAngle(t, start, ctrl, end) {
      const t1 = 1 - t;
      const dx = 2 * t1 * (ctrl.x - start.x) + 2 * t * (end.x - ctrl.x);
      const dy = 2 * t1 * (ctrl.y - start.y) + 2 * t * (end.y - ctrl.y);
      return Math.atan2(dy, dx);
    }

    drawPaperAirplane(x, y, size, angle, opacity) {
      const ctx = this.ctx;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.globalAlpha = opacity * this.config.opacity;

      // Paper airplane shape
      const w = size;
      const h = size * 0.5;

      // Main body (triangle)
      ctx.fillStyle = COLORS.planeBodyLight;
      ctx.beginPath();
      ctx.moveTo(-w * 0.5, 0);           // Nose
      ctx.lineTo(w * 0.3, h * 0.4);      // Bottom right
      ctx.lineTo(w * 0.3, -h * 0.4);     // Top right
      ctx.closePath();
      ctx.fill();

      // Wing fold (darker triangle)
      ctx.fillStyle = COLORS.planeBodyDark;
      ctx.beginPath();
      ctx.moveTo(-w * 0.5, 0);           // Nose
      ctx.lineTo(w * 0.1, h * 0.6);      // Wing tip bottom
      ctx.lineTo(w * 0.3, h * 0.4);      // Body bottom
      ctx.closePath();
      ctx.fill();

      // Top wing fold
      ctx.beginPath();
      ctx.moveTo(-w * 0.5, 0);           // Nose
      ctx.lineTo(w * 0.1, -h * 0.6);     // Wing tip top
      ctx.lineTo(w * 0.3, -h * 0.4);     // Body top
      ctx.closePath();
      ctx.fill();

      // Outline for definition
      ctx.strokeStyle = COLORS.planeOutline;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = opacity * this.config.opacity * 0.6;
      ctx.beginPath();
      ctx.moveTo(-w * 0.5, 0);
      ctx.lineTo(w * 0.3, h * 0.4);
      ctx.lineTo(w * 0.3, -h * 0.4);
      ctx.closePath();
      ctx.stroke();

      // Currency symbol on side
      ctx.globalAlpha = opacity * this.config.opacity * 0.8;
      ctx.fillStyle = COLORS.planeOutline;
      ctx.font = `bold ${size * 0.25}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.currentSymbol || '$', w * 0.05, 0);

      ctx.restore();
    }

    drawCoin(x, y, size, rotation, symbol, opacity) {
      const ctx = this.ctx;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.globalAlpha = opacity * this.config.opacity;

      // Determine color based on symbol
      const isbitcoin = symbol === '₿';
      const color = isbitcoin ? COLORS.bitcoinOrange : COLORS.coinGold;

      // Coin circle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.fill();

      // Darker outline
      ctx.strokeStyle = isbitcoin ? '#d97706' : '#f59e0b';
      ctx.lineWidth = 2;
      ctx.globalAlpha = opacity * this.config.opacity * 0.7;
      ctx.stroke();

      // Symbol
      ctx.globalAlpha = opacity * this.config.opacity;
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${size * 0.5}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(symbol, 0, 0);

      ctx.restore();
    }

    drawFlight(flight, now) {
      const elapsed = now - flight.startTime;
      const t = Math.min(elapsed / flight.duration, 1);

      // Fade in at start, fade out at end
      let opacity = 1;
      if (t < 0.1) {
        opacity = t / 0.1;
      } else if (t > 0.9) {
        opacity = (1 - t) / 0.1;
      }

      // Get position along curve
      const pos = this.getPositionOnCurve(t, flight.start, flight.ctrl, flight.end);
      const angle = this.getTangentAngle(t, flight.start, flight.ctrl, flight.end);

      // Store symbol for plane drawing
      this.currentSymbol = flight.symbol;

      // Draw plane if applicable
      if (flight.type === 'plane' || flight.type === 'plane-with-coins') {
        this.drawPaperAirplane(pos.x, pos.y, flight.planeSize, angle, opacity);
      }

      // Draw coins if applicable
      if (flight.coins > 0) {
        const coinRotation = elapsed * flight.rotationSpeed;

        for (let i = 0; i < flight.coins; i++) {
          // Offset coins behind the plane or in a cluster
          const offset = (i + 1) * -30; // Trail behind
          const coinT = Math.max(0, t - 0.05 * (i + 1)); // Slight delay per coin

          if (coinT > 0) {
            const coinPos = this.getPositionOnCurve(coinT, flight.start, flight.ctrl, flight.end);
            const wobble = Math.sin(elapsed * 0.003 + i) * 8; // Slight wobble

            this.drawCoin(
              coinPos.x,
              coinPos.y + wobble,
              flight.coinSize,
              coinRotation + i * 0.5,
              flight.symbol,
              opacity
            );
          }
        }
      }

      return t >= 1; // Return true if flight is complete
    }

    spawnNewFlight() {
      const desiredCount = Math.ceil(BASE_FLIGHT_COUNT * this.config.density);

      if (this.flights.length < desiredCount) {
        this.flights.push(this.createFlight());
      }
    }

    animate(timestamp) {
      this.animationId = requestAnimationFrame(this.animate);

      const now = Date.now();
      const deltaTime = timestamp - this.lastFrame;
      this.lastFrame = timestamp;

      // Clear canvas with background color
      this.ctx.fillStyle = COLORS.background;
      this.ctx.fillRect(0, 0, this.width, this.height);

      // Draw all flights and remove completed ones
      this.flights = this.flights.filter(flight => {
        const isComplete = this.drawFlight(flight, now);
        return !isComplete;
      });

      // Spawn new flights periodically
      if (now - this.lastSpawnTime > SPAWN_INTERVAL / this.config.speed) {
        this.spawnNewFlight();
        this.lastSpawnTime = now;
      }
    }

    start() {
      if (!this.animationId) {
        this.lastFrame = performance.now();
        this.lastSpawnTime = Date.now();
        this.animate(this.lastFrame);
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
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
      }
    }
  }

  // Export to global scope
  window.PayFriendsMoneyAirplanesBackground = PayFriendsMoneyAirplanesBackground;
})();

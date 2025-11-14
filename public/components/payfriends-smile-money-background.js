/**
 * PayFriends Smile Money Background Animation
 *
 * A much simpler, calmer background animation featuring only:
 * - Green smiley faces floating around
 * - Coins and money bills traveling between smileys like playful repayments
 * - Very subtle with 12% opacity for a barely-visible effect
 *
 * Configuration options:
 * - smileyCount: Number of green smiley faces (default: 12)
 * - maxCoinStreams: Max simultaneous money streams between smileys (default: 4)
 * - speed: Global speed multiplier for all movement (default: 1)
 *
 * Visual Design:
 * - Only green smiley faces as main objects (80-160px size range)
 * - Coins and bills as smaller traveling particles (16-32px)
 * - 12% opacity for everything - very subtle background effect
 * - PayFriends brand green (#22c55e / emerald green)
 *
 * Behaviors:
 * - Smileys move slowly in random directions and bounce off edges
 * - Coin/bill streams spawn randomly between smileys
 * - Each stream has 1-8 particles moving from source to target smiley
 * - Streams complete in 1-3 seconds
 */

(function() {
  'use strict';

  // Currency types for coins and bills
  const COIN_SYMBOLS = ['€', '$', '£', '¥', '₿', '₹', '₩'];

  // Colors
  const COLORS = {
    background: '#0a1420', // Very dark teal/navy
    smileyGreen: '#22c55e', // PayFriends brand green
    smileyFeatures: '#0d1a10', // Dark green for face features
    moneyGreen: '#3ddc97' // Lighter green for money particles
  };

  // Physics constants
  const BOUNCE_DAMPING = 0.92; // Energy retention on wall bounce
  const MIN_VELOCITY = 0.2;
  const MAX_VELOCITY = 1.5;

  class PayFriendsSmileMoneyBackground {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });

      // Configuration
      this.config = {
        smileyCount: options.smileyCount ?? 12,
        maxCoinStreams: options.maxCoinStreams ?? 4,
        speed: options.speed ?? 1
      };

      // Animation state
      this.smileys = [];
      this.coinStreams = []; // Active streams of coins/bills
      this.animationId = null;
      this.lastFrame = 0;
      this.nextStreamSpawn = 0;

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

      // Initialize or reposition smileys
      if (this.smileys.length === 0) {
        this.initializeSmileys(this.config.smileyCount);
      } else {
        this.repositionSmileys();
      }
    }

    initializeSmileys(count) {
      this.smileys = [];
      for (let i = 0; i < count; i++) {
        this.smileys.push(this.createSmiley());
      }
    }

    createSmiley() {
      // Size range: 80-160px (roughly double the old size)
      const size = 80 + Math.random() * 80;

      // Random position (avoid edges)
      const margin = size;
      const x = margin + Math.random() * (this.width - margin * 2);
      const y = margin + Math.random() * (this.height - margin * 2);

      // Random velocity (slow movement)
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.3 + Math.random() * 0.7;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      return {
        x,
        y,
        vx,
        vy,
        size,
        // Slight bobbing animation
        bobPhase: Math.random() * Math.PI * 2,
        bobSpeed: 0.02 + Math.random() * 0.02
      };
    }

    repositionSmileys() {
      // Adjust smiley positions to fit new canvas size
      for (const smiley of this.smileys) {
        const margin = smiley.size / 2;
        smiley.x = Math.max(margin, Math.min(this.width - margin, smiley.x));
        smiley.y = Math.max(margin, Math.min(this.height - margin, smiley.y));
      }
    }

    createCoinStream() {
      // Don't exceed max streams
      if (this.coinStreams.length >= this.config.maxCoinStreams) return;
      if (this.smileys.length < 2) return;

      // Pick two random smileys
      const sourceIdx = Math.floor(Math.random() * this.smileys.length);
      let targetIdx = Math.floor(Math.random() * this.smileys.length);

      // Make sure source and target are different
      while (targetIdx === sourceIdx && this.smileys.length > 1) {
        targetIdx = Math.floor(Math.random() * this.smileys.length);
      }

      const source = this.smileys[sourceIdx];
      const target = this.smileys[targetIdx];

      // Create 1-8 particles in this stream
      const particleCount = 1 + Math.floor(Math.random() * 8);
      const particles = [];

      // Determine if this stream is coins or bills
      const isBill = Math.random() < 0.4; // 40% bills, 60% coins

      for (let i = 0; i < particleCount; i++) {
        // Particle size: 16-32px
        const size = 16 + Math.random() * 16;

        // Random currency symbol for coins, or generic for bills
        const symbol = isBill ? null : COIN_SYMBOLS[Math.floor(Math.random() * COIN_SYMBOLS.length)];

        particles.push({
          x: source.x,
          y: source.y,
          targetX: target.x,
          targetY: target.y,
          size,
          isBill,
          symbol,
          progress: 0,
          // Slight delay between particles in the stream
          delay: i * 0.05,
          // Speed: complete in 1-3 seconds (progress per frame at 60fps)
          speed: (0.016 / (1 + Math.random() * 2))
        });
      }

      this.coinStreams.push({
        particles,
        source,
        target
      });
    }

    updateSmiley(smiley, deltaTime) {
      const dt = deltaTime / 16.67; // Normalize to 60fps
      const speedMult = this.config.speed;

      // Update position
      smiley.x += smiley.vx * dt * speedMult;
      smiley.y += smiley.vy * dt * speedMult;

      // Update bobbing animation
      smiley.bobPhase += smiley.bobSpeed * dt;

      // Bounce off edges
      const margin = smiley.size / 2;
      if (smiley.x - margin < 0) {
        smiley.x = margin;
        smiley.vx = Math.abs(smiley.vx) * BOUNCE_DAMPING;
      } else if (smiley.x + margin > this.width) {
        smiley.x = this.width - margin;
        smiley.vx = -Math.abs(smiley.vx) * BOUNCE_DAMPING;
      }

      if (smiley.y - margin < 0) {
        smiley.y = margin;
        smiley.vy = Math.abs(smiley.vy) * BOUNCE_DAMPING;
      } else if (smiley.y + margin > this.height) {
        smiley.y = this.height - margin;
        smiley.vy = -Math.abs(smiley.vy) * BOUNCE_DAMPING;
      }

      // Ensure minimum velocity
      const speed = Math.sqrt(smiley.vx * smiley.vx + smiley.vy * smiley.vy);
      if (speed < MIN_VELOCITY && speed > 0.01) {
        const scale = MIN_VELOCITY / speed;
        smiley.vx *= scale;
        smiley.vy *= scale;
      }

      // Cap maximum velocity
      if (speed > MAX_VELOCITY) {
        const scale = MAX_VELOCITY / speed;
        smiley.vx *= scale;
        smiley.vy *= scale;
      }
    }

    updateCoinStreams(deltaTime) {
      const dt = deltaTime / 16.67;
      const speedMult = this.config.speed;

      // Update all streams
      for (let i = this.coinStreams.length - 1; i >= 0; i--) {
        const stream = this.coinStreams[i];
        let allComplete = true;

        // Update each particle in the stream
        for (const particle of stream.particles) {
          // Handle particle delay
          if (particle.delay > 0) {
            particle.delay -= 0.016 * dt * speedMult;
            allComplete = false;
            continue;
          }

          // Update progress
          if (particle.progress < 1) {
            particle.progress += particle.speed * dt * speedMult;
            particle.progress = Math.min(1, particle.progress);
            allComplete = false;
          }

          // Update target position if smileys moved
          particle.targetX = stream.target.x;
          particle.targetY = stream.target.y;
        }

        // Remove completed streams
        if (allComplete) {
          this.coinStreams.splice(i, 1);
        }
      }
    }

    drawSmiley(smiley) {
      const { x, y, size, bobPhase } = smiley;
      const radius = size / 2;

      // Add slight vertical bob
      const bobOffset = Math.sin(bobPhase) * 3;

      this.ctx.save();
      this.ctx.translate(x, y + bobOffset);

      // Set global alpha to 12% for very subtle effect
      this.ctx.globalAlpha = 0.12;

      // Draw circle face
      this.ctx.beginPath();
      this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = COLORS.smileyGreen;
      this.ctx.fill();

      // Draw eyes (two small dots)
      this.ctx.fillStyle = COLORS.smileyFeatures;
      const eyeY = -radius * 0.25;
      const eyeSize = radius * 0.12;

      this.ctx.beginPath();
      this.ctx.arc(-radius * 0.3, eyeY, eyeSize, 0, Math.PI * 2);
      this.ctx.arc(radius * 0.3, eyeY, eyeSize, 0, Math.PI * 2);
      this.ctx.fill();

      // Draw smile (curved line)
      this.ctx.beginPath();
      const mouthY = radius * 0.15;
      this.ctx.arc(0, mouthY, radius * 0.45, 0, Math.PI, false);
      this.ctx.lineWidth = radius * 0.08;
      this.ctx.strokeStyle = COLORS.smileyFeatures;
      this.ctx.stroke();

      this.ctx.restore();
    }

    drawCoin(particle) {
      const { x, y, targetX, targetY, progress, size, symbol, delay } = particle;

      // Skip if still delayed
      if (delay > 0) return;

      // Calculate current position with ease-out
      const eased = 1 - Math.pow(1 - progress, 2);
      const currentX = x + (targetX - x) * eased;
      const currentY = y + (targetY - y) * eased;

      this.ctx.save();
      this.ctx.translate(currentX, currentY);

      // Set global alpha to 12%
      this.ctx.globalAlpha = 0.12;

      // Draw coin circle
      const radius = size / 2;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = COLORS.moneyGreen;
      this.ctx.fill();

      // Draw currency symbol
      this.ctx.fillStyle = COLORS.smileyFeatures;
      this.ctx.font = `bold ${size * 0.6}px system-ui, -apple-system, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(symbol, 0, 0);

      this.ctx.restore();
    }

    drawBill(particle) {
      const { x, y, targetX, targetY, progress, size, delay } = particle;

      // Skip if still delayed
      if (delay > 0) return;

      // Calculate current position with ease-out
      const eased = 1 - Math.pow(1 - progress, 2);
      const currentX = x + (targetX - x) * eased;
      const currentY = y + (targetY - y) * eased;

      this.ctx.save();
      this.ctx.translate(currentX, currentY);

      // Set global alpha to 12%
      this.ctx.globalAlpha = 0.12;

      // Draw bill rectangle
      const width = size * 1.6;
      const height = size * 0.7;
      const cornerRadius = height * 0.15;

      this.ctx.fillStyle = COLORS.moneyGreen;
      this.ctx.beginPath();
      this.ctx.moveTo(-width/2 + cornerRadius, -height/2);
      this.ctx.lineTo(width/2 - cornerRadius, -height/2);
      this.ctx.quadraticCurveTo(width/2, -height/2, width/2, -height/2 + cornerRadius);
      this.ctx.lineTo(width/2, height/2 - cornerRadius);
      this.ctx.quadraticCurveTo(width/2, height/2, width/2 - cornerRadius, height/2);
      this.ctx.lineTo(-width/2 + cornerRadius, height/2);
      this.ctx.quadraticCurveTo(-width/2, height/2, -width/2, height/2 - cornerRadius);
      this.ctx.lineTo(-width/2, -height/2 + cornerRadius);
      this.ctx.quadraticCurveTo(-width/2, -height/2, -width/2 + cornerRadius, -height/2);
      this.ctx.closePath();
      this.ctx.fill();

      // Draw generic money symbol ($)
      this.ctx.fillStyle = COLORS.smileyFeatures;
      this.ctx.font = `bold ${size * 0.5}px system-ui, -apple-system, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('$', 0, 0);

      this.ctx.restore();
    }

    animate(timestamp) {
      // Calculate delta time
      const deltaTime = this.lastFrame ? timestamp - this.lastFrame : 16;
      this.lastFrame = timestamp;

      // Clear canvas with solid background
      this.ctx.fillStyle = COLORS.background;
      this.ctx.fillRect(0, 0, this.width, this.height);

      // Spawn new coin streams randomly
      if (timestamp >= this.nextStreamSpawn) {
        this.createCoinStream();
        // Random interval: 1-3 seconds between new streams
        this.nextStreamSpawn = timestamp + 1000 + Math.random() * 2000;
      }

      // Update all smileys
      for (const smiley of this.smileys) {
        this.updateSmiley(smiley, deltaTime);
      }

      // Update coin streams
      this.updateCoinStreams(deltaTime);

      // Draw all smileys
      for (const smiley of this.smileys) {
        this.drawSmiley(smiley);
      }

      // Draw all coin/bill particles
      for (const stream of this.coinStreams) {
        for (const particle of stream.particles) {
          if (particle.isBill) {
            this.drawBill(particle);
          } else {
            this.drawCoin(particle);
          }
        }
      }

      // Continue animation
      this.animationId = requestAnimationFrame(this.animate);
    }

    start() {
      if (!this.animationId) {
        this.lastFrame = 0;
        this.nextStreamSpawn = 0;
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
  window.PayFriendsSmileMoneyBackground = PayFriendsSmileMoneyBackground;
})();

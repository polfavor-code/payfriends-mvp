/**
 * PayFriends Bouncy Background Animation
 *
 * A fun, playful animated background featuring bouncing green smileys, currency symbols,
 * and PayFriends branding icons that interact with each other in a friendly, social way.
 * Subtle and brand-aligned with PayFriends green aesthetic.
 *
 * Configuration options:
 * - iconCount: Number of bouncing icons (default: 36, range: 20-60)
 *   Automatically adjusts based on screen size
 * - particleFrequency: How often currency transaction particles spawn (default: 0.4)
 *   Higher = more frequent transactions (range: 0-1)
 * - speed: Global speed multiplier for all movement (default: 1, range: 0.5-2)
 *   Lower = slower, calmer animation
 *
 * Icon Types:
 * - Green Smileys: Custom-drawn green circles with smiley faces (happy, grin, cool, love, wink, cute)
 * - PayFriends Themes: Fairness icon (SVG), Handshake (SVG), ✓, 💸, 💚
 * - Currency: €, $, £, ¥, ₿, CHF, R$, ₹, ₺, ₩, 💰, 🪙
 *
 * Visual Design:
 * - All icons are 40% larger than original for better visibility
 * - All icons rendered at 33% opacity for subtle background effect
 * - Green color scheme (#22c55e) matching PayFriends brand
 *
 * Behaviors:
 * - Icons bounce softly off screen edges
 * - Icons collide and bounce off each other
 * - Currency particles travel between smileys (representing payments)
 * - Random events: glows, pulses, spins
 *
 * How to customize:
 * - Add/remove icon types: Edit GREEN_SMILEYS, PAYFRIENDS_ICONS, or CURRENCY arrays
 * - Adjust bounce physics: Change BOUNCE_DAMPING (lower = bouncier)
 * - Adjust collision response: Change COLLISION_DAMPING
 * - Adjust particle behavior: Edit createTransactionParticle method
 */

(function() {
  'use strict';

  // Icon sets
  // Green smiley variants (rendered as custom green circles)
  const GREEN_SMILEYS = ['happy', 'grin', 'cool', 'love', 'wink', 'cute'];
  const PAYFRIENDS_ICONS = ['✓', '💸', '💚', 'fairness', 'handshake'];
  const CURRENCY = ['€', '$', '£', '¥', '₿', 'CHF', 'R$', '₹', '₺', '₩', '💰', '🪙'];

  // Physics constants
  const BOUNCE_DAMPING = 0.85; // Energy loss on wall bounce (lower = less bouncy)
  const COLLISION_DAMPING = 0.95; // Energy loss on icon collision
  const MIN_VELOCITY = 0.3; // Minimum velocity to prevent icons from getting stuck
  const MAX_VELOCITY = 3; // Maximum velocity to prevent chaos

  // Colors
  const COLORS = {
    background: '#0a1420', // Very dark teal/navy
    glow: 'rgba(61, 220, 151, 0.3)', // Soft mint glow
    pulse: 'rgba(61, 220, 151, 0.6)' // Brighter pulse
  };

  class PayFriendsBouncyBackground {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });

      // Configuration
      this.config = {
        iconCount: options.iconCount ?? 36,
        particleFrequency: options.particleFrequency ?? 0.4,
        speed: options.speed ?? 1
      };

      // Animation state
      this.icons = [];
      this.particles = [];
      this.animationId = null;
      this.lastFrame = 0;
      this.particleTimer = 0;

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

      // Adjust icon count based on screen size
      const area = this.width * this.height;
      const densityFactor = Math.sqrt(area / (1920 * 1080)); // Normalize to 1080p
      const adjustedIconCount = Math.round(this.config.iconCount * densityFactor);
      const targetIconCount = Math.max(20, Math.min(60, adjustedIconCount));

      // Initialize or adjust icons
      if (this.icons.length === 0) {
        this.initializeIcons(targetIconCount);
      } else {
        this.repositionIcons();
      }
    }

    initializeIcons(count) {
      this.icons = [];
      for (let i = 0; i < count; i++) {
        this.icons.push(this.createIcon());
      }
    }

    createIcon() {
      // Determine icon type and content
      const roll = Math.random();
      let type, content, size;

      if (roll < 0.4) { // 40% green smileys
        type = 'smiley';
        content = GREEN_SMILEYS[Math.floor(Math.random() * GREEN_SMILEYS.length)];
        size = 52 + Math.random() * 38; // 52-90px (40% larger)
      } else if (roll < 0.7) { // 30% currency
        type = 'currency';
        content = CURRENCY[Math.floor(Math.random() * CURRENCY.length)];
        size = 42 + Math.random() * 30; // 42-72px (40% larger)
      } else { // 30% PayFriends icons
        type = 'payfriends';
        content = PAYFRIENDS_ICONS[Math.floor(Math.random() * PAYFRIENDS_ICONS.length)];
        size = 47 + Math.random() * 37; // 47-84px (40% larger)
      }

      // Random position (avoid edges)
      const margin = size;
      const x = margin + Math.random() * (this.width - margin * 2);
      const y = margin + Math.random() * (this.height - margin * 2);

      // Random velocity
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.5;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      return {
        type,
        content,
        x,
        y,
        vx,
        vy,
        size,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.02, // Slow rotation
        glow: 0, // Glow effect (0-1)
        glowDecay: 0.95,
        nextEvent: Date.now() + 3000 + Math.random() * 7000 // Time until next random event
      };
    }

    repositionIcons() {
      // Adjust icon positions to fit new canvas size
      for (const icon of this.icons) {
        const margin = icon.size;
        icon.x = Math.max(margin, Math.min(this.width - margin, icon.x));
        icon.y = Math.max(margin, Math.min(this.height - margin, icon.y));
      }
    }

    createTransactionParticle() {
      // Find two random smiley icons
      const smileys = this.icons.filter(icon => icon.type === 'smiley');
      if (smileys.length < 2) return;

      const from = smileys[Math.floor(Math.random() * smileys.length)];
      const to = smileys[Math.floor(Math.random() * smileys.length)];
      if (from === to) return;

      // Create particle
      const particleTypes = ['€', '✓', '💸'];
      const content = particleTypes[Math.floor(Math.random() * particleTypes.length)];

      this.particles.push({
        content,
        x: from.x,
        y: from.y,
        targetX: to.x,
        targetY: to.y,
        target: to,
        progress: 0,
        size: 20,
        speed: 0.02 + Math.random() * 0.02 // 2-4% per frame
      });
    }

    updateIcon(icon, deltaTime) {
      const dt = deltaTime / 16.67; // Normalize to 60fps
      const speedMult = this.config.speed;

      // Update position
      icon.x += icon.vx * dt * speedMult;
      icon.y += icon.vy * dt * speedMult;

      // Update rotation
      icon.rotation += icon.rotationSpeed * dt;

      // Update glow
      if (icon.glow > 0.01) {
        icon.glow *= icon.glowDecay;
      } else {
        icon.glow = 0;
      }

      // Bounce off edges
      const margin = icon.size / 2;
      if (icon.x - margin < 0) {
        icon.x = margin;
        icon.vx = Math.abs(icon.vx) * BOUNCE_DAMPING;
      } else if (icon.x + margin > this.width) {
        icon.x = this.width - margin;
        icon.vx = -Math.abs(icon.vx) * BOUNCE_DAMPING;
      }

      if (icon.y - margin < 0) {
        icon.y = margin;
        icon.vy = Math.abs(icon.vy) * BOUNCE_DAMPING;
      } else if (icon.y + margin > this.height) {
        icon.y = this.height - margin;
        icon.vy = -Math.abs(icon.vy) * BOUNCE_DAMPING;
      }

      // Ensure minimum velocity
      const speed = Math.sqrt(icon.vx * icon.vx + icon.vy * icon.vy);
      if (speed < MIN_VELOCITY && speed > 0.01) {
        const scale = MIN_VELOCITY / speed;
        icon.vx *= scale;
        icon.vy *= scale;
      }

      // Cap maximum velocity
      if (speed > MAX_VELOCITY) {
        const scale = MAX_VELOCITY / speed;
        icon.vx *= scale;
        icon.vy *= scale;
      }

      // Random events
      const now = Date.now();
      if (now >= icon.nextEvent) {
        this.triggerRandomEvent(icon);
        icon.nextEvent = now + 3000 + Math.random() * 7000;
      }
    }

    triggerRandomEvent(icon) {
      const eventType = Math.random();

      if (eventType < 0.5) {
        // Glow effect
        icon.glow = 1;
      } else if (eventType < 0.7) {
        // Spin
        icon.rotationSpeed = (Math.random() - 0.5) * 0.15;
        setTimeout(() => {
          icon.rotationSpeed = (Math.random() - 0.5) * 0.02;
        }, 1000);
      } else {
        // Pulse (handled by glow)
        icon.glow = 0.8;
      }
    }

    checkCollisions() {
      for (let i = 0; i < this.icons.length; i++) {
        for (let j = i + 1; j < this.icons.length; j++) {
          const a = this.icons[i];
          const b = this.icons[j];

          // Calculate distance
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = (a.size + b.size) / 2;

          if (distance < minDistance) {
            // Collision detected!
            this.resolveCollision(a, b, dx, dy, distance, minDistance);

            // Spawn transaction particle if one is currency and one is smiley
            if ((a.type === 'currency' && b.type === 'smiley') ||
                (a.type === 'smiley' && b.type === 'currency')) {
              if (Math.random() < 0.3) { // 30% chance
                const smiley = a.type === 'smiley' ? a : b;
                smiley.glow = 0.6;
              }
            }
          }
        }
      }
    }

    resolveCollision(a, b, dx, dy, distance, minDistance) {
      // Separate icons
      const overlap = minDistance - distance;
      const nx = dx / distance; // Normalized direction
      const ny = dy / distance;

      // Move icons apart
      const separationX = nx * overlap * 0.5;
      const separationY = ny * overlap * 0.5;
      a.x -= separationX;
      a.y -= separationY;
      b.x += separationX;
      b.y += separationY;

      // Elastic collision (simplified)
      const dvx = b.vx - a.vx;
      const dvy = b.vy - a.vy;
      const dotProduct = dvx * nx + dvy * ny;

      if (dotProduct < 0) { // Only collide if moving towards each other
        const impulse = dotProduct * COLLISION_DAMPING;
        a.vx += impulse * nx;
        a.vy += impulse * ny;
        b.vx -= impulse * nx;
        b.vy -= impulse * ny;

        // Add glow effect on collision
        a.glow = Math.max(a.glow, 0.4);
        b.glow = Math.max(b.glow, 0.4);
      }
    }

    updateParticles(deltaTime) {
      const dt = deltaTime / 16.67;

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.progress += p.speed * dt * this.config.speed;

        if (p.progress >= 1) {
          // Particle reached target - make target glow
          if (p.target) {
            p.target.glow = 1;
          }
          this.particles.splice(i, 1);
        }
      }
    }

    drawGreenSmiley(smileyType, size) {
      const radius = size / 2;
      const greenColor = '#22c55e'; // PayFriends green

      // Draw circle face
      this.ctx.beginPath();
      this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = greenColor;
      this.ctx.fill();

      // Draw eyes and mouth based on type
      this.ctx.fillStyle = '#0a1420'; // Dark color for features
      const eyeY = -radius * 0.2;
      const eyeSize = radius * 0.15;
      const mouthY = radius * 0.2;

      // Eyes
      this.ctx.beginPath();
      this.ctx.arc(-radius * 0.3, eyeY, eyeSize, 0, Math.PI * 2);
      this.ctx.arc(radius * 0.3, eyeY, eyeSize, 0, Math.PI * 2);
      this.ctx.fill();

      // Mouth variations
      this.ctx.beginPath();
      if (smileyType === 'happy' || smileyType === 'grin') {
        this.ctx.arc(0, mouthY, radius * 0.4, 0, Math.PI, false);
      } else if (smileyType === 'cool') {
        this.ctx.arc(0, mouthY, radius * 0.3, 0, Math.PI, false);
      } else if (smileyType === 'love') {
        this.ctx.arc(0, mouthY, radius * 0.5, 0, Math.PI, false);
      } else if (smileyType === 'wink') {
        this.ctx.arc(0, mouthY, radius * 0.35, 0, Math.PI, false);
      } else {
        this.ctx.arc(0, mouthY, radius * 0.4, 0, Math.PI, false);
      }
      this.ctx.lineWidth = radius * 0.1;
      this.ctx.stroke();
    }

    drawSVGIcon(iconType, size) {
      const scale = size / 800; // Normalize to icon size
      this.ctx.save();
      this.ctx.scale(scale, scale);
      this.ctx.translate(-400, -366); // Center the SVG
      this.ctx.fillStyle = '#3ddc97'; // PayFriends green

      // SVG paths from the handshake/fairness icon
      if (iconType === 'handshake' || iconType === 'fairness') {
        const path = new Path2D('M2105 7195 c-258 -34 -335 -47 -405 -70 -41 -13 -95 -31 -120 -39 -78 -24 -163 -57 -225 -86 -33 -15 -67 -31 -75 -34 -8 -3 -44 -24 -80 -45 -36 -22 -83 -50 -105 -62 -22 -12 -52 -31 -67 -43 -14 -11 -46 -34 -69 -51 -184 -129 -445 -405 -544 -575 -16 -28 -39 -66 -50 -83 -52 -80 -165 -314 -165 -341 0 -9 -9 -35 -20 -56 -11 -22 -27 -70 -36 -107 -8 -38 -24 -97 -34 -133 -26 -86 -51 -321 -53 -483 -1 -153 25 -427 49 -507 9 -30 27 -93 39 -140 39 -145 66 -214 155 -391 21 -42 46 -88 56 -103 9 -16 25 -40 33 -54 9 -15 25 -42 36 -61 44 -73 186 -243 306 -366 198 -202 575 -576 590 -586 8 -5 22 -9 31 -9 9 0 149 133 311 295 162 162 317 310 344 329 48 33 145 77 213 98 20 6 85 8 155 5 105 -4 130 -9 200 -37 44 -18 93 -43 108 -56 16 -13 33 -24 38 -24 5 0 41 -32 79 -71 53 -53 81 -94 116 -163 41 -83 46 -101 52 -189 5 -63 12 -101 21 -106 7 -5 53 -11 102 -15 102 -8 218 -47 274 -93 19 -15 339 -333 712 -706 960 -961 983 -983 1038 -1021 35 -24 73 -39 126 -50 70 -14 81 -14 151 3 42 10 91 29 109 42 69 51 138 132 175 207 37 74 38 81 39 182 0 103 -1 106 -37 170 -21 37 -71 99 -115 142 -43 42 -315 315 -605 605 -290 290 -640 641 -778 778 -200 200 -252 258 -261 288 -28 103 68 205 173 182 25 -6 218 -193 899 -874 968 -967 920 -925 1069 -937 153 -12 261 28 348 128 65 76 93 145 99 240 7 111 -8 184 -51 249 -20 32 -383 402 -881 899 -465 465 -853 857 -861 872 -8 15 -14 47 -14 72 0 87 89 151 180 131 24 -5 234 -210 901 -876 479 -478 875 -869 880 -869 5 0 26 -11 47 -25 47 -31 152 -46 250 -35 158 17 293 146 328 312 24 114 6 228 -51 313 -18 28 -520 535 -1115 1128 -962 958 -1085 1077 -1112 1077 -27 0 -71 -40 -352 -321 -177 -177 -337 -332 -358 -345 -20 -13 -39 -28 -43 -33 -13 -21 -153 -84 -250 -112 -85 -24 -118 -29 -216 -29 -80 0 -130 5 -160 15 -24 9 -64 20 -89 26 -48 11 -167 68 -213 103 -174 132 -264 256 -328 452 -31 92 -33 108 -33 234 0 128 2 141 36 240 33 98 64 160 130 257 14 22 173 186 352 365 281 280 326 328 326 354 0 24 -13 40 -71 89 -73 62 -81 68 -190 145 -66 46 -75 51 -176 108 -32 17 -65 36 -73 41 -37 23 -168 81 -181 81 -8 0 -33 9 -54 20 -22 11 -74 29 -116 40 -41 11 -91 26 -110 34 -19 7 -72 19 -119 25 -47 6 -125 18 -175 26 -137 21 -325 26 -440 10z M5670 7200 c-58 -4 -130 -12 -160 -18 -30 -7 -93 -16 -140 -22 -47 -5 -119 -21 -160 -35 -41 -13 -97 -32 -125 -41 -156 -50 -332 -131 -435 -198 -44 -29 -175 -116 -203 -136 -75 -51 -277 -243 -662 -632 -439 -441 -441 -443 -480 -528 l-40 -85 0 -146 c0 -141 1 -148 30 -210 63 -136 152 -225 291 -290 67 -31 74 -32 204 -33 133 -1 136 0 210 33 41 18 92 48 114 65 22 17 226 217 454 444 314 313 420 412 438 412 25 0 271 -242 1709 -1678 458 -457 670 -662 685 -662 23 0 93 68 150 145 19 26 47 62 63 80 15 18 27 37 27 43 0 5 7 15 15 22 14 12 43 61 104 175 15 28 32 59 38 70 33 58 127 294 138 345 4 19 18 71 31 115 13 44 28 123 34 175 6 52 15 142 21 200 19 174 -10 529 -57 700 -52 190 -91 294 -164 441 -97 195 -159 291 -294 453 -66 79 -221 234 -280 281 -119 95 -231 175 -245 175 -4 0 -21 10 -36 23 -38 30 -72 48 -230 123 -85 40 -177 75 -240 90 -33 8 -85 24 -115 34 -50 18 -165 38 -340 60 -113 14 -242 18 -350 10z');
        this.ctx.fill(path);

        // Additional smaller paths
        const path2 = new Path2D('M2261 3205 c-68 -19 -105 -51 -419 -366 -210 -210 -249 -254 -279 -314 -34 -66 -35 -73 -31 -150 7 -117 54 -196 156 -266 57 -39 118 -53 206 -47 112 7 150 35 447 335 140 142 268 275 282 295 16 21 34 68 44 109 57 255 -161 472 -406 404z');
        this.ctx.fill(path2);
        const path3 = new Path2D('M2930 2531 c-63 -20 -154 -99 -405 -353 l-271 -273 -28 -78 c-33 -91 -32 -146 4 -237 25 -62 111 -152 169 -177 87 -37 249 -24 316 25 20 15 160 150 311 301 320 318 338 344 338 471 0 63 -4 84 -28 130 -37 71 -97 131 -170 169 -51 27 -68 31 -135 30 -42 0 -87 -4 -101 -8z');
        this.ctx.fill(path3);
        const path4 = new Path2D('M3650 1870 c-87 -12 -141 -56 -446 -362 -318 -319 -310 -308 -321 -438 -14 -167 81 -300 244 -342 64 -16 83 -17 132 -8 117 24 129 34 421 328 152 152 290 299 308 325 106 158 38 368 -148 461 -71 36 -120 45 -190 36z');
        this.ctx.fill(path4);
        const path5 = new Path2D('M4242 1169 c-55 -26 -98 -65 -335 -302 -284 -284 -322 -327 -343 -386 -16 -43 -17 -140 -3 -200 19 -85 108 -178 206 -218 94 -38 158 -37 243 3 57 27 99 65 341 307 152 151 291 299 309 327 61 95 60 225 -4 326 -46 74 -99 118 -181 149 -90 34 -151 32 -233 -6z');
        this.ctx.fill(path5);
      }

      this.ctx.restore();
    }

    drawIcon(icon) {
      const { x, y, content, size, rotation, glow, type } = icon;

      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.rotate(rotation);

      // Set global alpha to 33% for subtle background effect
      this.ctx.globalAlpha = 0.33;

      // Draw glow effect
      if (glow > 0.1) {
        this.ctx.shadowBlur = 20 * glow;
        this.ctx.shadowColor = COLORS.glow;
      }

      // Draw based on icon type
      if (type === 'smiley') {
        // Draw custom green smiley
        this.drawGreenSmiley(content, size);
      } else if (type === 'payfriends' && (content === 'handshake' || content === 'fairness')) {
        // Draw SVG icon
        this.drawSVGIcon(content, size);
      } else {
        // Draw emoji or text (currency, ✓, etc.)
        this.ctx.font = `${size}px Arial, sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        if (content.length === 1 || content.match(/[\u{1F300}-\u{1F9FF}]/u)) {
          // Emoji
          this.ctx.fillStyle = '#ffffff';
        } else {
          // Text (✓, etc.)
          this.ctx.fillStyle = '#3ddc97';
        }

        this.ctx.fillText(content, 0, 0);
      }

      this.ctx.restore();
    }

    drawParticle(particle) {
      const { content, x, y, targetX, targetY, progress, size } = particle;

      // Calculate current position (ease-out curve)
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentX = x + (targetX - x) * eased;
      const currentY = y + (targetY - y) * eased;

      // Draw particle with trail
      this.ctx.save();

      // Glow
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = COLORS.pulse;

      // Draw
      this.ctx.font = `${size}px Arial, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = '#3ddc97';
      this.ctx.globalAlpha = 0.8 + Math.sin(progress * Math.PI * 4) * 0.2; // Pulse
      this.ctx.fillText(content, currentX, currentY);

      this.ctx.restore();
    }

    animate(timestamp) {
      // Calculate delta time
      const deltaTime = this.lastFrame ? timestamp - this.lastFrame : 16;
      this.lastFrame = timestamp;

      // Clear canvas
      this.ctx.fillStyle = COLORS.background;
      this.ctx.fillRect(0, 0, this.width, this.height);

      // Spawn transaction particles
      this.particleTimer += deltaTime / 1000;
      const spawnInterval = 2 / Math.max(0.1, this.config.particleFrequency); // Seconds between spawns
      if (this.particleTimer >= spawnInterval) {
        this.createTransactionParticle();
        this.particleTimer = 0;
      }

      // Update physics
      for (const icon of this.icons) {
        this.updateIcon(icon, deltaTime);
      }
      this.checkCollisions();
      this.updateParticles(deltaTime);

      // Draw everything
      for (const icon of this.icons) {
        this.drawIcon(icon);
      }
      for (const particle of this.particles) {
        this.drawParticle(particle);
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
  window.PayFriendsBouncyBackground = PayFriendsBouncyBackground;
})();

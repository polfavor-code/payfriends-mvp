/**
 * PayFriends Bouncy Background Animation
 *
 * A fun, playful animated background featuring bouncing green smileys, currency symbols,
 * and PayFriends branding icons that interact with each other in a friendly, social way.
 * Subtle and brand-aligned with PayFriends green aesthetic.
 *
 * Configuration options:
 * - iconCount: Number of bouncing icons (default: 12, range: 10-40)
 *   Automatically adjusts based on screen size
 * - particleFrequency: How often currency transaction particles spawn (default: 0.4)
 *   Higher = more frequent transactions (range: 0-1)
 * - speed: Global speed multiplier for all movement (default: 1, range: 0.5-2)
 *   Lower = slower, calmer animation
 *
 * Icon Types:
 * - Green Smileys: Custom-drawn green circles with smiley faces (happy, grin, cool, love, wink, cute)
 * - PayFriends Themes: 💸, 💚, ❤️
 * - Currency: €, $, £, ¥, ₿, CHF, R$, ₹, ₺, ₩, 💰, 🪙
 * - Speech Bubbles: Playful text balloons with friendly messages
 *
 * Visual Design:
 * - Emojis and hearts are largest (60-90px) for fun, playful feel
 * - Speech bubbles are mid-sized (45-55px) with friendly text
 * - Currency symbols are smaller (28-44px) for subtle details
 * - All icons rendered at 18% opacity for very subtle background effect
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
  const PAYFRIENDS_ICONS = ['💸', '💚', '❤️'];
  const CURRENCY = ['€', '$', '£', '¥', '₿', 'CHF', 'R$', '₹', '₺', '₩', '💰', '🪙'];
  const SPEECH_BUBBLE_TEXTS = ['Thanks!', 'Deal', 'All good', 'Paid', 'Tomorrow?', '✓', 'Got it'];

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
        iconCount: options.iconCount ?? 12,
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
      const targetIconCount = Math.max(10, Math.min(40, adjustedIconCount));

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

      if (roll < 0.35) { // 35% green smileys
        type = 'smiley';
        content = GREEN_SMILEYS[Math.floor(Math.random() * GREEN_SMILEYS.length)];
        size = 60 + Math.random() * 30; // 60-90px (big and fun)
      } else if (roll < 0.6) { // 25% currency
        type = 'currency';
        content = CURRENCY[Math.floor(Math.random() * CURRENCY.length)];
        size = 28 + Math.random() * 16; // 28-44px (smaller, subtle details)
      } else if (roll < 0.8) { // 20% speech bubbles
        type = 'bubble';
        content = SPEECH_BUBBLE_TEXTS[Math.floor(Math.random() * SPEECH_BUBBLE_TEXTS.length)];
        size = 45 + Math.random() * 10; // 45-55px (mid-sized)
      } else { // 20% PayFriends icons (hearts, money emojis)
        type = 'payfriends';
        content = PAYFRIENDS_ICONS[Math.floor(Math.random() * PAYFRIENDS_ICONS.length)];
        size = 60 + Math.random() * 30; // 60-90px (big and fun like smileys)
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
      const particleTypes = ['€', '💸', '💰'];
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

    drawSpeechBubble(text, size) {
      // Calculate dimensions based on text length and size
      const padding = size * 0.25;
      const fontSize = size * 0.30;
      this.ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
      const textMetrics = this.ctx.measureText(text);
      const textWidth = textMetrics.width;

      const bubbleWidth = textWidth + padding * 2;
      const bubbleHeight = fontSize * 1.8;
      const cornerRadius = bubbleHeight * 0.25;

      // Choose bubble color scheme (alternate between dark and light)
      const isDark = Math.random() > 0.5;
      const bgColor = isDark ? '#1a2332' : '#3ddc97';
      const textColor = isDark ? '#3ddc97' : '#0a1420';

      // Draw rounded rectangle
      this.ctx.fillStyle = bgColor;
      this.ctx.beginPath();
      this.ctx.moveTo(-bubbleWidth/2 + cornerRadius, -bubbleHeight/2);
      this.ctx.lineTo(bubbleWidth/2 - cornerRadius, -bubbleHeight/2);
      this.ctx.quadraticCurveTo(bubbleWidth/2, -bubbleHeight/2, bubbleWidth/2, -bubbleHeight/2 + cornerRadius);
      this.ctx.lineTo(bubbleWidth/2, bubbleHeight/2 - cornerRadius);
      this.ctx.quadraticCurveTo(bubbleWidth/2, bubbleHeight/2, bubbleWidth/2 - cornerRadius, bubbleHeight/2);

      // Add small tail
      const tailSize = bubbleHeight * 0.15;
      this.ctx.lineTo(tailSize, bubbleHeight/2);
      this.ctx.lineTo(0, bubbleHeight/2 + tailSize);
      this.ctx.lineTo(-tailSize, bubbleHeight/2);

      this.ctx.lineTo(-bubbleWidth/2 + cornerRadius, bubbleHeight/2);
      this.ctx.quadraticCurveTo(-bubbleWidth/2, bubbleHeight/2, -bubbleWidth/2, bubbleHeight/2 - cornerRadius);
      this.ctx.lineTo(-bubbleWidth/2, -bubbleHeight/2 + cornerRadius);
      this.ctx.quadraticCurveTo(-bubbleWidth/2, -bubbleHeight/2, -bubbleWidth/2 + cornerRadius, -bubbleHeight/2);
      this.ctx.closePath();
      this.ctx.fill();

      // Draw text
      this.ctx.fillStyle = textColor;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(text, 0, -bubbleHeight * 0.05);
    }

    drawIcon(icon) {
      const { x, y, content, size, rotation, glow, type } = icon;

      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.rotate(rotation);

      // Set global alpha to 18% for very subtle background effect
      this.ctx.globalAlpha = 0.18;

      // Draw glow effect
      if (glow > 0.1) {
        this.ctx.shadowBlur = 20 * glow;
        this.ctx.shadowColor = COLORS.glow;
      }

      // Draw based on icon type
      if (type === 'smiley') {
        // Draw custom green smiley
        this.drawGreenSmiley(content, size);
      } else if (type === 'bubble') {
        // Draw speech bubble
        this.drawSpeechBubble(content, size);
      } else {
        // Draw emoji or text (currency, hearts, money emojis, etc.)
        this.ctx.font = `${size}px Arial, sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        if (content.length === 1 || content.match(/[\u{1F300}-\u{1F9FF}]/u)) {
          // Emoji
          this.ctx.fillStyle = '#ffffff';
        } else {
          // Text (currency symbols, etc.)
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

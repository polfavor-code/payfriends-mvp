/**
 * PayFriends Two Smileys Animated Background
 *
 * A simple, fun animated background featuring:
 * - ONLY TWO big green smiley faces floating around
 * - They bounce off walls and each other
 * - Money flows between them (coins, bills, bitcoin icons)
 * - All elements at 18% opacity for subtle background effect
 *
 * Configuration options:
 * - speed: Global speed multiplier for movement and money streams (default: 1)
 * - moneyStreamFrequency: How often new money streams start (default: 1)
 * - className: For absolute inset-0 placement
 *
 * Visual Design:
 * - Exactly 2 large smiley faces (160-220px diameter)
 * - BIG money pieces (40-70px, double previous versions)
 * - 18% opacity for everything - subtle background effect
 * - PayFriends brand green (#3ddc97)
 *
 * Behaviors:
 * - Smileys float around and bounce off screen edges
 * - When smileys collide, they bounce off each other
 * - Money streams spawn randomly between the two smileys
 * - Each stream has 1-8 pieces (coins, bills, or bitcoin icons)
 * - Streams complete in 1-3 seconds
 * - Max 3 concurrent streams
 */

(function() {
  'use strict';

  // Currency symbols for coins
  const COIN_SYMBOLS = ['€', '$', '£', '₿'];

  // Colors
  const COLORS = {
    background: '#0e1116', // Dark background matching login page
    smileyGreen: '#3ddc97', // PayFriends brand green
    smileyFeaturesDark: '#1a5c3d', // Darker green for face features
    moneyGreen: '#3ddc97', // Lighter green for coins and bills
    bitcoinOrange: '#f7931a', // Bitcoin orange
    bitcoinGreen: '#3ddc97' // Alternative bitcoin green
  };

  // Physics constants
  const BOUNCE_DAMPING = 0.95; // Energy retention on bounce
  const MIN_VELOCITY = 0.4;
  const MAX_VELOCITY = 2.0;
  const COLLISION_THRESHOLD = 1.02; // Multiplier for collision detection (slightly larger than touching)

  class PayFriendsTwoSmileysBackground {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });

      // Configuration
      this.config = {
        speed: options.speed ?? 1,
        moneyStreamFrequency: options.moneyStreamFrequency ?? 1
      };

      // Animation state
      this.smileys = []; // Exactly 2 smileys
      this.moneyStreams = []; // Active streams of money
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
        this.initializeSmileys();
      } else {
        this.repositionSmileys();
      }
    }

    initializeSmileys() {
      this.smileys = [];

      // Create exactly 2 smileys
      for (let i = 0; i < 2; i++) {
        this.smileys.push(this.createSmiley(i));
      }
    }

    createSmiley(index) {
      // Size range: 160-220px (BIG smileys)
      const size = 160 + Math.random() * 60;

      // Position smileys on opposite sides of the screen initially
      const margin = size * 1.5;
      let x, y;

      if (index === 0) {
        // First smiley on left side
        x = margin + Math.random() * (this.width * 0.3);
        y = margin + Math.random() * (this.height - margin * 2);
      } else {
        // Second smiley on right side
        x = this.width * 0.7 + Math.random() * (this.width * 0.3 - margin * 2);
        y = margin + Math.random() * (this.height - margin * 2);
      }

      // Random velocity (slow to medium movement)
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.0;
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
        bobSpeed: 0.015 + Math.random() * 0.015
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

    createMoneyStream() {
      // Don't exceed max streams (3)
      if (this.moneyStreams.length >= 3) return;
      if (this.smileys.length < 2) return;

      // With only 2 smileys, randomly choose direction
      const sourceIdx = Math.random() < 0.5 ? 0 : 1;
      const targetIdx = sourceIdx === 0 ? 1 : 0;

      const source = this.smileys[sourceIdx];
      const target = this.smileys[targetIdx];

      // Create 1-8 pieces in this stream
      const pieceCount = 1 + Math.floor(Math.random() * 8);
      const pieces = [];

      // Randomly choose type: coins, bills, or bitcoin
      const rand = Math.random();
      let type;
      if (rand < 0.4) {
        type = 'coins';
      } else if (rand < 0.7) {
        type = 'bills';
      } else {
        type = 'bitcoin';
      }

      for (let i = 0; i < pieceCount; i++) {
        // BIG piece size: 40-70px (double the previous 16-32px)
        const size = 40 + Math.random() * 30;

        // Random currency symbol for coins
        const symbol = type === 'coins'
          ? COIN_SYMBOLS[Math.floor(Math.random() * COIN_SYMBOLS.length)]
          : '₿';

        pieces.push({
          x: source.x,
          y: source.y,
          targetX: target.x,
          targetY: target.y,
          size,
          type,
          symbol,
          progress: 0,
          // Slight delay between pieces in the stream
          delay: i * 0.08,
          // Speed: complete in 1-3 seconds (progress per frame at 60fps)
          speed: (0.016 / (1 + Math.random() * 2))
        });
      }

      this.moneyStreams.push({
        pieces,
        source,
        target
      });
    }

    checkSmileyCollision(smiley1, smiley2) {
      // Calculate distance between centers
      const dx = smiley2.x - smiley1.x;
      const dy = smiley2.y - smiley1.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check if smileys are colliding
      const minDistance = (smiley1.size / 2 + smiley2.size / 2) * COLLISION_THRESHOLD;

      if (distance < minDistance && distance > 0) {
        // Collision detected! Bounce them off each other

        // Normalize the collision vector
        const nx = dx / distance;
        const ny = dy / distance;

        // Relative velocity
        const dvx = smiley2.vx - smiley1.vx;
        const dvy = smiley2.vy - smiley1.vy;

        // Relative velocity in collision normal direction
        const dvn = dvx * nx + dvy * ny;

        // Do not resolve if velocities are separating
        if (dvn > 0) return;

        // Apply impulse to separate and bounce
        const impulse = dvn * BOUNCE_DAMPING;

        smiley1.vx += impulse * nx;
        smiley1.vy += impulse * ny;
        smiley2.vx -= impulse * nx;
        smiley2.vy -= impulse * ny;

        // Separate smileys to prevent overlap
        const overlap = minDistance - distance;
        const separationX = nx * overlap / 2;
        const separationY = ny * overlap / 2;

        smiley1.x -= separationX;
        smiley1.y -= separationY;
        smiley2.x += separationX;
        smiley2.y += separationY;
      }
    }

    updateSmiley(smiley, deltaTime) {
      const dt = deltaTime / 16.67; // Normalize to 60fps
      const speedMult = this.config.speed;

      // Update position
      smiley.x += smiley.vx * dt * speedMult;
      smiley.y += smiley.vy * dt * speedMult;

      // Update bobbing animation
      smiley.bobPhase += smiley.bobSpeed * dt;

      // Bounce off edges with elastic feel
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

    updateMoneyStreams(deltaTime) {
      const dt = deltaTime / 16.67;
      const speedMult = this.config.speed;

      // Update all streams
      for (let i = this.moneyStreams.length - 1; i >= 0; i--) {
        const stream = this.moneyStreams[i];
        let allComplete = true;

        // Update each piece in the stream
        for (const piece of stream.pieces) {
          // Handle piece delay
          if (piece.delay > 0) {
            piece.delay -= 0.016 * dt * speedMult;
            allComplete = false;
            continue;
          }

          // Update progress
          if (piece.progress < 1) {
            piece.progress += piece.speed * dt * speedMult;
            piece.progress = Math.min(1, piece.progress);
            allComplete = false;
          }

          // Update target position if smileys moved
          piece.targetX = stream.target.x;
          piece.targetY = stream.target.y;
        }

        // Remove completed streams
        if (allComplete) {
          this.moneyStreams.splice(i, 1);
        }
      }
    }

    drawSmiley(smiley) {
      const { x, y, size, bobPhase } = smiley;
      const radius = size / 2;

      // Add slight vertical bob
      const bobOffset = Math.sin(bobPhase) * 4;

      this.ctx.save();
      this.ctx.translate(x, y + bobOffset);

      // Set global alpha to 18% for subtle effect
      this.ctx.globalAlpha = 0.18;

      // Draw circle face
      this.ctx.beginPath();
      this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = COLORS.smileyGreen;
      this.ctx.fill();

      // Draw eyes (two small darker green dots)
      this.ctx.fillStyle = COLORS.smileyFeaturesDark;
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
      this.ctx.strokeStyle = COLORS.smileyFeaturesDark;
      this.ctx.stroke();

      this.ctx.restore();
    }

    drawCoin(piece) {
      const { x, y, targetX, targetY, progress, size, symbol, delay } = piece;

      // Skip if still delayed
      if (delay > 0) return;

      // Calculate current position with ease-out
      const eased = 1 - Math.pow(1 - progress, 2);
      const currentX = x + (targetX - x) * eased;
      const currentY = y + (targetY - y) * eased;

      this.ctx.save();
      this.ctx.translate(currentX, currentY);

      // Set global alpha to 18%
      this.ctx.globalAlpha = 0.18;

      // Draw coin circle
      const radius = size / 2;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = COLORS.moneyGreen;
      this.ctx.fill();

      // Draw currency symbol
      this.ctx.fillStyle = COLORS.smileyFeaturesDark;
      this.ctx.font = `bold ${size * 0.6}px system-ui, -apple-system, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(symbol, 0, 0);

      this.ctx.restore();
    }

    drawBill(piece) {
      const { x, y, targetX, targetY, progress, size, delay } = piece;

      // Skip if still delayed
      if (delay > 0) return;

      // Calculate current position with ease-out
      const eased = 1 - Math.pow(1 - progress, 2);
      const currentX = x + (targetX - x) * eased;
      const currentY = y + (targetY - y) * eased;

      this.ctx.save();
      this.ctx.translate(currentX, currentY);

      // Set global alpha to 18%
      this.ctx.globalAlpha = 0.18;

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

      // Draw money symbol
      this.ctx.fillStyle = COLORS.smileyFeaturesDark;
      this.ctx.font = `bold ${size * 0.5}px system-ui, -apple-system, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('$', 0, 0);

      this.ctx.restore();
    }

    drawBitcoin(piece) {
      const { x, y, targetX, targetY, progress, size, delay } = piece;

      // Skip if still delayed
      if (delay > 0) return;

      // Calculate current position with ease-out
      const eased = 1 - Math.pow(1 - progress, 2);
      const currentX = x + (targetX - x) * eased;
      const currentY = y + (targetY - y) * eased;

      this.ctx.save();
      this.ctx.translate(currentX, currentY);

      // Set global alpha to 18%
      this.ctx.globalAlpha = 0.18;

      // Draw bitcoin circle (randomly choose orange or green)
      const radius = size / 2;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
      // Randomly use orange or green for variety
      this.ctx.fillStyle = Math.random() < 0.5 ? COLORS.bitcoinOrange : COLORS.bitcoinGreen;
      this.ctx.fill();

      // Draw bitcoin symbol ₿
      this.ctx.fillStyle = COLORS.smileyFeaturesDark;
      this.ctx.font = `bold ${size * 0.65}px system-ui, -apple-system, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('₿', 0, 0);

      this.ctx.restore();
    }

    animate(timestamp) {
      // Calculate delta time
      const deltaTime = this.lastFrame ? timestamp - this.lastFrame : 16;
      this.lastFrame = timestamp;

      // Clear canvas with solid background
      this.ctx.fillStyle = COLORS.background;
      this.ctx.fillRect(0, 0, this.width, this.height);

      // Spawn new money streams based on frequency
      if (timestamp >= this.nextStreamSpawn) {
        this.createMoneyStream();
        // Interval based on moneyStreamFrequency (1 = default, higher = more frequent)
        const baseInterval = 2000; // 2 seconds base
        const interval = baseInterval / this.config.moneyStreamFrequency;
        this.nextStreamSpawn = timestamp + interval + Math.random() * interval;
      }

      // Update all smileys
      for (const smiley of this.smileys) {
        this.updateSmiley(smiley, deltaTime);
      }

      // Check collision between the two smileys
      if (this.smileys.length === 2) {
        this.checkSmileyCollision(this.smileys[0], this.smileys[1]);
      }

      // Update money streams
      this.updateMoneyStreams(deltaTime);

      // Draw all smileys
      for (const smiley of this.smileys) {
        this.drawSmiley(smiley);
      }

      // Draw all money pieces
      for (const stream of this.moneyStreams) {
        for (const piece of stream.pieces) {
          if (piece.type === 'coins') {
            this.drawCoin(piece);
          } else if (piece.type === 'bills') {
            this.drawBill(piece);
          } else if (piece.type === 'bitcoin') {
            this.drawBitcoin(piece);
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
  window.PayFriendsTwoSmileysBackground = PayFriendsTwoSmileysBackground;
})();

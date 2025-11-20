/**
 * PayFriends Money Planes Animated Background
 *
 * Canvas-based animated background using a sprite sheet of money paper airplanes.
 * Features random flight paths, rotation, scaling, and playful motion patterns.
 *
 * @param {HTMLCanvasElement} canvas - The canvas element to render on
 * @param {Object} options - Configuration options
 * @param {number} options.density - Plane count multiplier (default: 1)
 * @param {number} options.speed - Global speed multiplier (default: 1)
 * @param {number} options.opacity - Global opacity (default: 0.33)
 */
(function() {
  'use strict';

  // Flight path types
  const PATH_TYPES = {
    STRAIGHT: 'straight',
    CURVED: 'curved',
    WOBBLE: 'wobble',
    LOOP: 'loop',
    DIAGONAL_DOWN: 'diagonal_down',
    DIAGONAL_UP: 'diagonal_up'
  };

  // Configuration
  const MAX_PLANES = 6;
  const SPAWN_INTERVAL_MIN = 1000; // ms
  const SPAWN_INTERVAL_MAX = 3000; // ms
  const FLIGHT_DURATION_MIN = 2500; // ms
  const FLIGHT_DURATION_MAX = 7000; // ms
  const SCALE_MIN = 0.4;
  const SCALE_MAX = 1.4;
  const ROTATION_VARIANCE = 25; // degrees

  /**
   * Sprite sheet configuration
   * Define regions for each currency plane in the sprite sheet
   * Sprite sheet is 1024×1536px with 12 money paper airplanes
   * Format: { sx, sy, sw, sh, facing } in pixels
   * facing: "left" or "right" - which direction the plane's nose points in the sprite image
   */
  const SPRITES = [
    // Row 1
    { sx: 60, sy: 50, sw: 300, sh: 150, facing: "left" },    // USD $100 plane (top left) - nose points LEFT
    { sx: 580, sy: 50, sw: 300, sh: 200, facing: "right" },  // EUR €50 plane (top right) - nose points RIGHT

    // Row 2
    { sx: 60, sy: 330, sw: 200, sh: 150, facing: "right" },   // CHF 20 green plane (left)
    { sx: 360, sy: 270, sw: 220, sh: 180, facing: "right" },  // GBP plane (center)
    { sx: 620, sy: 330, sw: 220, sh: 140, facing: "right" },  // EUR €50 flat bill (right)

    // Row 3
    { sx: 120, sy: 540, sw: 280, sh: 180, facing: "right" },  // EUR €100 yellow plane (left)
    { sx: 720, sy: 600, sw: 280, sh: 160, facing: "right" },  // JPY plane (right)

    // Row 4
    { sx: 60, sy: 850, sw: 240, sh: 140, facing: "right" },   // EUR €100 green plane (left)
    { sx: 420, sy: 840, sw: 200, sh: 140, facing: "right" },  // EUR €20 yellow plane (center)
    { sx: 660, sy: 880, sw: 200, sh: 120, facing: "right" },  // EUR €10 bill (right)

    // Row 5
    { sx: 60, sy: 1130, sw: 260, sh: 150, facing: "right" },  // EUR €100 green plane (bottom left)
    { sx: 420, sy: 1160, sw: 230, sh: 140, facing: "right" }, // EUR €20 yellow plane (bottom center)
    { sx: 760, sy: 1140, sw: 180, sh: 140, facing: "right" }  // GBP £20 green plane (bottom right)
  ];

  class PayFriendsMoneyPlanesAnimated {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: true });

      // Configuration
      this.config = {
        density: options.density ?? 1,
        speed: options.speed ?? 1,
        opacity: options.opacity ?? 0.33
      };

      // State
      this.planes = [];
      this.animationId = null;
      this.lastSpawnTime = 0;
      this.spriteImage = null;
      this.spriteLoaded = false;
      this.spriteLoadError = false;

      // Bind methods
      this.animate = this.animate.bind(this);
      this.handleResize = this.handleResize.bind(this);

      // Load sprite sheet
      this.loadSpriteSheet();

      // Initialize
      this.resize();
      window.addEventListener('resize', this.handleResize);
    }

    loadSpriteSheet() {
      this.spriteImage = new Image();

      this.spriteImage.onload = () => {
        this.spriteLoaded = true;
        console.log('PayFriends sprite sheet loaded successfully');
      };

      this.spriteImage.onerror = () => {
        this.spriteLoadError = true;
        console.warn('PayFriends sprite sheet failed to load. Using fallback rendering.');
      };

      this.spriteImage.src = '/images/background/flying-money-planes.png';
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
    }

    getRandomPathType() {
      const rand = Math.random();
      if (rand < 0.25) return PATH_TYPES.STRAIGHT;
      if (rand < 0.5) return PATH_TYPES.CURVED;
      if (rand < 0.7) return PATH_TYPES.WOBBLE;
      if (rand < 0.85) return PATH_TYPES.DIAGONAL_DOWN;
      if (rand < 0.95) return PATH_TYPES.DIAGONAL_UP;
      return PATH_TYPES.LOOP;
    }

    getRandomSprite() {
      const index = Math.floor(Math.random() * SPRITES.length);
      return SPRITES[index];
    }

    createPlane() {
      const pathType = this.getRandomPathType();
      const sprite = this.getRandomSprite();
      const scale = SCALE_MIN + Math.random() * (SCALE_MAX - SCALE_MIN);
      const duration = (FLIGHT_DURATION_MIN + Math.random() * (FLIGHT_DURATION_MAX - FLIGHT_DURATION_MIN)) / this.config.speed;
      const wobblePhase = Math.random() * Math.PI * 2; // Random phase for wobble variation

      // Determine start and end positions based on path type
      let start, end, control1, control2;

      switch (pathType) {
        case PATH_TYPES.STRAIGHT:
          // Left to right or right to left
          if (Math.random() < 0.5) {
            start = { x: -100, y: this.height * (0.2 + Math.random() * 0.6) };
            end = { x: this.width + 100, y: start.y + (Math.random() - 0.5) * 100 };
          } else {
            start = { x: this.width + 100, y: this.height * (0.2 + Math.random() * 0.6) };
            end = { x: -100, y: start.y + (Math.random() - 0.5) * 100 };
          }
          break;

        case PATH_TYPES.CURVED:
          // Curved path using Bezier
          if (Math.random() < 0.5) {
            start = { x: -100, y: this.height * (0.3 + Math.random() * 0.4) };
            end = { x: this.width + 100, y: this.height * (0.3 + Math.random() * 0.4) };
            control1 = {
              x: this.width * 0.3,
              y: start.y + (Math.random() - 0.5) * this.height * 0.4
            };
            control2 = {
              x: this.width * 0.7,
              y: end.y + (Math.random() - 0.5) * this.height * 0.4
            };
          } else {
            start = { x: this.width + 100, y: this.height * (0.3 + Math.random() * 0.4) };
            end = { x: -100, y: this.height * (0.3 + Math.random() * 0.4) };
            control1 = {
              x: this.width * 0.7,
              y: start.y + (Math.random() - 0.5) * this.height * 0.4
            };
            control2 = {
              x: this.width * 0.3,
              y: end.y + (Math.random() - 0.5) * this.height * 0.4
            };
          }
          break;

        case PATH_TYPES.DIAGONAL_DOWN:
          // Top-left to bottom-right or top-right to bottom-left
          if (Math.random() < 0.5) {
            start = { x: -100, y: -100 };
            end = { x: this.width + 100, y: this.height + 100 };
          } else {
            start = { x: this.width + 100, y: -100 };
            end = { x: -100, y: this.height + 100 };
          }
          break;

        case PATH_TYPES.DIAGONAL_UP:
          // Bottom-left to top-right or bottom-right to top-left
          if (Math.random() < 0.5) {
            start = { x: -100, y: this.height + 100 };
            end = { x: this.width + 100, y: -100 };
          } else {
            start = { x: this.width + 100, y: this.height + 100 };
            end = { x: -100, y: -100 };
          }
          break;

        case PATH_TYPES.WOBBLE:
          // Horizontal with sine wave wobble
          if (Math.random() < 0.5) {
            start = { x: -100, y: this.height * 0.5 };
            end = { x: this.width + 100, y: this.height * 0.5 };
          } else {
            start = { x: this.width + 100, y: this.height * 0.5 };
            end = { x: -100, y: this.height * 0.5 };
          }
          break;

        case PATH_TYPES.LOOP:
          // Circular/looping path
          if (Math.random() < 0.5) {
            start = { x: -100, y: this.height * 0.5 };
            end = { x: this.width + 100, y: this.height * 0.5 };
            control1 = { x: this.width * 0.25, y: this.height * 0.2 };
            control2 = { x: this.width * 0.75, y: this.height * 0.8 };
          } else {
            start = { x: this.width + 100, y: this.height * 0.5 };
            end = { x: -100, y: this.height * 0.5 };
            control1 = { x: this.width * 0.75, y: this.height * 0.2 };
            control2 = { x: this.width * 0.25, y: this.height * 0.8 };
          }
          break;
      }

      // Calculate flight heading (left or right) based on start and end positions
      const vx = end.x - start.x;
      const heading = vx >= 0 ? "right" : "left";

      // Determine if we need to flip the sprite horizontally
      // If sprite faces left but we're going right, or vice versa, we need to flip
      const needsFlip = sprite.facing !== heading;

      return {
        sprite,
        pathType,
        start,
        end,
        control1,
        control2,
        scale,
        duration,
        startTime: Date.now(),
        wobblePhase,
        wobbleFrequency: 0.003 + Math.random() * 0.002,
        wobbleAmplitude: 20 + Math.random() * 40,
        heading,        // "left" or "right" - which way the plane is flying
        needsFlip       // whether to flip sprite horizontally
      };
    }

    getPositionOnPath(plane, t) {
      const { pathType, start, end, control1, control2, wobbleFrequency, wobbleAmplitude } = plane;
      let x, y;

      switch (pathType) {
        case PATH_TYPES.STRAIGHT:
        case PATH_TYPES.DIAGONAL_DOWN:
        case PATH_TYPES.DIAGONAL_UP:
          x = start.x + (end.x - start.x) * t;
          y = start.y + (end.y - start.y) * t;
          break;

        case PATH_TYPES.CURVED:
        case PATH_TYPES.LOOP:
          // Cubic Bezier curve
          const t1 = 1 - t;
          x = t1 * t1 * t1 * start.x +
              3 * t1 * t1 * t * control1.x +
              3 * t1 * t * t * control2.x +
              t * t * t * end.x;
          y = t1 * t1 * t1 * start.y +
              3 * t1 * t1 * t * control1.y +
              3 * t1 * t * t * control2.y +
              t * t * t * end.y;
          break;

        case PATH_TYPES.WOBBLE:
          x = start.x + (end.x - start.x) * t;
          y = start.y + (end.y - start.y) * t + Math.sin(t * Math.PI * 4) * wobbleAmplitude;
          break;
      }

      return { x, y };
    }

    getTangentAngle(plane, t) {
      const { pathType, start, end, control1, control2 } = plane;
      let dx, dy;

      switch (pathType) {
        case PATH_TYPES.STRAIGHT:
        case PATH_TYPES.DIAGONAL_DOWN:
        case PATH_TYPES.DIAGONAL_UP:
          dx = end.x - start.x;
          dy = end.y - start.y;
          break;

        case PATH_TYPES.CURVED:
        case PATH_TYPES.LOOP:
          // Derivative of cubic Bezier
          const t1 = 1 - t;
          dx = 3 * t1 * t1 * (control1.x - start.x) +
               6 * t1 * t * (control2.x - control1.x) +
               3 * t * t * (end.x - control2.x);
          dy = 3 * t1 * t1 * (control1.y - start.y) +
               6 * t1 * t * (control2.y - control1.y) +
               3 * t * t * (end.y - control2.y);
          break;

        case PATH_TYPES.WOBBLE:
          dx = end.x - start.x;
          dy = (end.y - start.y) + Math.cos(t * Math.PI * 4) * Math.PI * 4 * plane.wobbleAmplitude;
          break;
      }

      return Math.atan2(dy, dx);
    }

    drawPlane(plane, now) {
      const elapsed = now - plane.startTime;
      const t = Math.min(elapsed / plane.duration, 1);

      // Fade in/out
      let opacity = this.config.opacity;
      if (t < 0.1) {
        opacity *= t / 0.1;
      } else if (t > 0.9) {
        opacity *= (1 - t) / 0.1;
      }

      // Get position
      const pos = this.getPositionOnPath(plane, t);

      // NEW ROTATION LOGIC: No more path-based rotation that causes upside-down planes
      // Base orientation is purely horizontal based on flight direction
      const baseAngle = plane.heading === "right" ? 0 : Math.PI;

      // Add only a small wobble (bank) for natural paper airplane movement
      // This keeps the plane nose-forward but adds slight tilt
      const wobbleAmplitude = (5 * Math.PI) / 180; // 5 degrees max
      const wobble = Math.sin(elapsed * 0.002 * 2 + plane.wobblePhase) * wobbleAmplitude;

      const angle = baseAngle + wobble;

      // Draw
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.translate(pos.x, pos.y);

      // Apply rotation (plane nose always forward with slight wobble)
      ctx.rotate(angle);

      // Handle horizontal flip if needed
      // If sprite faces opposite direction from flight, flip it horizontally
      const scaleX = plane.needsFlip ? -1 : 1;
      const scaleY = 1; // Never flip vertically

      ctx.scale(scaleX, scaleY);

      // Calculate scaled dimensions
      const drawWidth = plane.sprite.sw * plane.scale;
      const drawHeight = plane.sprite.sh * plane.scale;

      if (this.spriteLoaded) {
        // Draw from sprite sheet, centered on (0, 0) after transforms
        ctx.drawImage(
          this.spriteImage,
          plane.sprite.sx,
          plane.sprite.sy,
          plane.sprite.sw,
          plane.sprite.sh,
          -drawWidth / 2,
          -drawHeight / 2,
          drawWidth,
          drawHeight
        );
      }

      ctx.restore();

      return t >= 1; // Return true if complete
    }


    spawnPlane() {
      const maxPlanes = Math.ceil(MAX_PLANES * this.config.density);
      if (this.planes.length < maxPlanes) {
        this.planes.push(this.createPlane());
      }
    }

    animate(timestamp) {
      this.animationId = requestAnimationFrame(this.animate);

      const now = Date.now();

      // Clear canvas
      this.ctx.clearRect(0, 0, this.width, this.height);

      // Draw all planes and remove completed ones
      this.planes = this.planes.filter(plane => {
        const isComplete = this.drawPlane(plane, now);
        return !isComplete;
      });

      // Spawn new planes
      const timeSinceLastSpawn = now - this.lastSpawnTime;
      const spawnInterval = SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);

      if (timeSinceLastSpawn > spawnInterval / this.config.speed) {
        this.spawnPlane();
        this.lastSpawnTime = now;
      }
    }

    start() {
      if (!this.animationId) {
        this.lastSpawnTime = Date.now();
        this.animate(performance.now());
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
      this.planes = [];
      this.spriteImage = null;
    }
  }

  // Export to global scope
  window.PayFriendsMoneyPlanesAnimated = PayFriendsMoneyPlanesAnimated;
})();

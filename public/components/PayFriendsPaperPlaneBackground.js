/**
 * PayFriends Paper Plane Background
 *
 * Canvas-based animated background using 25 individual transparent paper plane PNGs.
 * Features smooth flight paths, subtle rotation, and playful motion.
 *
 * @param {HTMLCanvasElement} canvas - The canvas element to render on
 * @param {Object} options - Configuration options
 * @param {number} options.density - Plane count multiplier (default: 1)
 * @param {number} options.speed - Global speed multiplier (default: 1)
 * @param {number} options.opacity - Global opacity (default: 0.33)
 */
(function() {
  'use strict';

  // Generate array of 25 plane image paths
  const PLANE_SOURCES = Array.from({ length: 25 }, (_, i) =>
    `/images/planes/plane-${String(i + 1).padStart(2, "0")}.png`
  );

  // Configuration
  const MAX_PLANES = 8;
  const SPAWN_INTERVAL_MIN = 1000; // ms
  const SPAWN_INTERVAL_MAX = 3000; // ms
  const FLIGHT_DURATION_MIN = 3000; // ms
  const FLIGHT_DURATION_MAX = 8000; // ms
  const SCALE_MIN = 0.7;
  const SCALE_MAX = 1.4;
  const ROTATION_MAX = 25; // degrees max deviation from horizontal

  class PayFriendsPaperPlaneBackground {
    constructor(canvas, options = {}) {
      // Guard against server-side rendering
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        console.warn('PayFriendsPaperPlaneBackground requires browser environment');
        return;
      }

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
      this.planeImages = [];
      this.imagesLoaded = false;
      this.loadError = false;

      // Bind methods
      this.animate = this.animate.bind(this);
      this.handleResize = this.handleResize.bind(this);

      // Load plane images
      this.loadPlaneImages();

      // Initialize
      this.resize();
      window.addEventListener('resize', this.handleResize);
    }

    async loadPlaneImages() {
      try {
        const imagePromises = PLANE_SOURCES.map((src) => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => {
              console.warn(`Failed to load plane image: ${src}`);
              resolve(null); // Resolve with null instead of rejecting
            };
            img.src = src;
          });
        });

        const loadedImages = await Promise.all(imagePromises);
        this.planeImages = loadedImages.filter(img => img !== null);

        if (this.planeImages.length === 0) {
          this.loadError = true;
          console.warn('No plane images loaded. Background will be empty.');
        } else {
          this.imagesLoaded = true;
          console.log(`PayFriends paper planes loaded: ${this.planeImages.length} of ${PLANE_SOURCES.length}`);
        }
      } catch (err) {
        this.loadError = true;
        console.warn('Failed to load plane images:', err);
      }
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

    getRandomPlaneImage() {
      if (this.planeImages.length === 0) return null;
      const index = Math.floor(Math.random() * this.planeImages.length);
      return this.planeImages[index];
    }

    createPlane() {
      const planeImage = this.getRandomPlaneImage();
      if (!planeImage) return null;

      const scale = SCALE_MIN + Math.random() * (SCALE_MAX - SCALE_MIN);
      const duration = (FLIGHT_DURATION_MIN + Math.random() * (FLIGHT_DURATION_MAX - FLIGHT_DURATION_MIN)) / this.config.speed;

      // Determine direction: left-to-right or right-to-left
      const leftToRight = Math.random() < 0.5;

      // Add slight vertical variation (up or down diagonal)
      const startY = this.height * (0.2 + Math.random() * 0.6);
      const endY = startY + (Math.random() - 0.5) * this.height * 0.3;

      let start, end;
      if (leftToRight) {
        start = { x: -150, y: startY };
        end = { x: this.width + 150, y: endY };
      } else {
        start = { x: this.width + 150, y: startY };
        end = { x: -150, y: endY };
      }

      // Create control points for a gentle Bezier curve
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      const curvature = (Math.random() - 0.5) * this.height * 0.2;

      const control1 = {
        x: start.x + (end.x - start.x) * 0.25,
        y: start.y + (end.y - start.y) * 0.25 + curvature * 0.5
      };

      const control2 = {
        x: start.x + (end.x - start.x) * 0.75,
        y: start.y + (end.y - start.y) * 0.75 + curvature * 0.5
      };

      // Calculate heading
      const vx = end.x - start.x;
      const heading = vx >= 0 ? "right" : "left";

      // Random phase for wobble variation
      const wobblePhase = Math.random() * Math.PI * 2;
      const wobbleFrequency = 0.5 + Math.random() * 0.5; // Slow wobble

      return {
        image: planeImage,
        start,
        end,
        control1,
        control2,
        scale,
        duration,
        startTime: Date.now(),
        heading,
        wobblePhase,
        wobbleFrequency
      };
    }

    getPositionOnPath(plane, t) {
      // Cubic Bezier curve
      const { start, end, control1, control2 } = plane;
      const t1 = 1 - t;

      const x = t1 * t1 * t1 * start.x +
                3 * t1 * t1 * t * control1.x +
                3 * t1 * t * t * control2.x +
                t * t * t * end.x;

      const y = t1 * t1 * t1 * start.y +
                3 * t1 * t1 * t * control1.y +
                3 * t1 * t * t * control2.y +
                t * t * t * end.y;

      return { x, y };
    }

    getTangentAngle(plane, t) {
      // Get derivative of Bezier curve for smooth orientation
      const { start, end, control1, control2 } = plane;
      const t1 = 1 - t;

      const dx = 3 * t1 * t1 * (control1.x - start.x) +
                 6 * t1 * t * (control2.x - control1.x) +
                 3 * t * t * (end.x - control2.x);

      const dy = 3 * t1 * t1 * (control1.y - start.y) +
                 6 * t1 * t * (control2.y - control1.y) +
                 3 * t * t * (end.y - control2.y);

      return Math.atan2(dy, dx);
    }

    drawPlane(plane, now) {
      const elapsed = now - plane.startTime;
      const t = Math.min(elapsed / plane.duration, 1);

      // Fade in/out for smooth appearance
      let opacity = this.config.opacity;
      if (t < 0.1) {
        opacity *= t / 0.1;
      } else if (t > 0.9) {
        opacity *= (1 - t) / 0.1;
      }

      // Get position
      const pos = this.getPositionOnPath(plane, t);

      // Get base angle from path tangent
      let baseAngle = this.getTangentAngle(plane, t);

      // Constrain rotation to prevent upside-down or excessive spinning
      // Keep angle within roughly -25° to +25° from horizontal
      const maxRotation = (ROTATION_MAX * Math.PI) / 180;

      // Normalize angle to -PI to PI range
      while (baseAngle > Math.PI) baseAngle -= 2 * Math.PI;
      while (baseAngle < -Math.PI) baseAngle += 2 * Math.PI;

      // If angle is too steep, clamp it
      if (Math.abs(baseAngle) > maxRotation) {
        baseAngle = Math.sign(baseAngle) * maxRotation;
      }

      // Add subtle wobble for natural paper airplane banking
      const wobbleAmplitude = (3 * Math.PI) / 180; // 3 degrees
      const wobble = Math.sin(elapsed * 0.001 * plane.wobbleFrequency + plane.wobblePhase) * wobbleAmplitude;

      const angle = baseAngle + wobble;

      // Draw
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);

      // Calculate draw dimensions based on natural image size
      const naturalWidth = plane.image.naturalWidth || 200;
      const naturalHeight = plane.image.naturalHeight || 150;
      const drawWidth = naturalWidth * plane.scale;
      const drawHeight = naturalHeight * plane.scale;

      // Draw plane centered on (0, 0) after transforms
      ctx.drawImage(
        plane.image,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight
      );

      ctx.restore();

      return t >= 1; // Return true if complete
    }

    spawnPlane() {
      const maxPlanes = Math.ceil(MAX_PLANES * this.config.density);
      if (this.planes.length < maxPlanes && this.imagesLoaded) {
        const plane = this.createPlane();
        if (plane) {
          this.planes.push(plane);
        }
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
      this.planeImages = [];
    }
  }

  // Export to global scope
  window.PayFriendsPaperPlaneBackground = PayFriendsPaperPlaneBackground;
})();

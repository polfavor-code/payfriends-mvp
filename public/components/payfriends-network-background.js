/**
 * PayFriends Network Background Animation
 *
 * A living network of friends connected by lines with transactions moving between them.
 * Represents the social, friendly, and premium nature of PayFriends.
 *
 * Configuration options:
 * - nodeCount: Number of friend nodes in the network (default: 32, range: 20 - 60)
 *   Controls network density. More nodes = more connections, but may impact performance.
 *
 * - maxConnectionsPerNode: Maximum edges each node can have (default: 4, range: 2 - 6)
 *   Higher values create a denser network. Keep ≤ 5 for visual clarity.
 *
 * - transactionFrequency: How often transactions spawn (default: 0.3, range: 0.1 - 1.0)
 *   Higher values = more particles. 0.3 = roughly 30% chance per second per edge.
 *
 * - speed: Speed multiplier for all movement (default: 1, range: 0.5 - 2)
 *   Affects node drift speed and transaction particle speed.
 *
 * Customizing node icons:
 * Edit the NODE_ICONS array below to change which emoji/text appear on nodes.
 * Current: 🙂, 😄, 🤝, €, 💸, ⚖, PF
 *
 * Customizing transaction labels:
 * Edit the TRANSACTION_LABELS array to change particle labels.
 * Current: €, ✓, +1, 💸, 🤝
 */

(function() {
  'use strict';

  // Node icon options (shown on some friend nodes)
  const NODE_ICONS = ['🙂', '😄', '🤝', '€', '💸', '⚖', 'PF'];

  // Transaction particle labels
  const TRANSACTION_LABELS = ['€', '✓', '+1', '💸', '🤝'];

  // PayFriends color palette
  const COLORS = {
    // Deep navy/teal background (similar to Matrix version)
    background: 'rgba(2, 6, 23, 1)',
    // Main mint/teal for nodes and lines (PayFriends brand)
    primary: '#3ddc97',
    // Soft teal for dimmer nodes
    secondary: '#2db079',
    // Accent colors for variety
    accentOrange: '#ff9b6b',
    accentPurple: '#b88bff',
    // Line color (lower opacity)
    lineColor: 'rgba(61, 220, 151, 0.15)',
    lineBright: 'rgba(61, 220, 151, 0.3)'
  };

  class PayFriendsNetworkBackground {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });

      // Configuration
      this.config = {
        nodeCount: options.nodeCount ?? 32,
        maxConnectionsPerNode: options.maxConnectionsPerNode ?? 4,
        transactionFrequency: options.transactionFrequency ?? 0.3,
        speed: options.speed ?? 1
      };

      // Animation state
      this.nodes = [];
      this.edges = [];
      this.transactions = [];
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
      if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => this.resize(), 150);
    }

    resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = this.canvas.getBoundingClientRect();

      // Set canvas size for retina displays
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.canvas.style.width = `${rect.width}px`;
      this.canvas.style.height = `${rect.height}px`;

      // Scale context
      this.ctx.scale(dpr, dpr);

      // Store logical dimensions
      this.width = rect.width;
      this.height = rect.height;

      // Reinitialize network
      this.initializeNetwork();
    }

    initializeNetwork() {
      this.nodes = [];
      this.edges = [];
      this.transactions = [];

      // Create nodes distributed across viewport
      for (let i = 0; i < this.config.nodeCount; i++) {
        this.nodes.push(this.createNode());
      }

      // Create connections between nearby nodes
      this.createConnections();
    }

    createNode() {
      // Random position with margin from edges
      const margin = 50;
      const baseX = margin + Math.random() * (this.width - margin * 2);
      const baseY = margin + Math.random() * (this.height - margin * 2);

      // Node appearance
      const hasIcon = Math.random() < 0.4; // 40% of nodes show an icon
      const useAccent = Math.random() < 0.15; // 15% use accent colors

      let color;
      if (useAccent) {
        color = Math.random() < 0.5 ? COLORS.accentOrange : COLORS.accentPurple;
      } else {
        color = Math.random() < 0.7 ? COLORS.primary : COLORS.secondary;
      }

      return {
        baseX,
        baseY,
        x: baseX,
        y: baseY,
        // Drift parameters (orbital motion)
        driftRadius: 8 + Math.random() * 12, // Small radius for subtle movement
        driftSpeed: 0.0003 + Math.random() * 0.0005, // Very slow
        driftAngle: Math.random() * Math.PI * 2,
        // Visual properties
        radius: 3 + Math.random() * 2,
        color,
        icon: hasIcon ? NODE_ICONS[Math.floor(Math.random() * NODE_ICONS.length)] : null,
        brightness: 0.7 + Math.random() * 0.3,
        // For pulsing effect
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.001 + Math.random() * 0.002
      };
    }

    createConnections() {
      // For each node, connect to nearby nodes
      for (let i = 0; i < this.nodes.length; i++) {
        const node = this.nodes[i];
        const distances = [];

        // Calculate distances to all other nodes
        for (let j = 0; j < this.nodes.length; j++) {
          if (i === j) continue;
          const other = this.nodes[j];
          const dx = other.baseX - node.baseX;
          const dy = other.baseY - node.baseY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          distances.push({ index: j, distance });
        }

        // Sort by distance and connect to nearest nodes
        distances.sort((a, b) => a.distance - b.distance);
        const connectCount = Math.min(
          this.config.maxConnectionsPerNode,
          distances.length
        );

        for (let k = 0; k < connectCount; k++) {
          const targetIndex = distances[k].index;

          // Avoid duplicate edges (check if edge already exists)
          const edgeExists = this.edges.some(
            e => (e.from === i && e.to === targetIndex) ||
                 (e.from === targetIndex && e.to === i)
          );

          if (!edgeExists) {
            this.edges.push({
              from: i,
              to: targetIndex,
              pulsePhase: Math.random() * Math.PI * 2,
              pulseSpeed: 0.001 + Math.random() * 0.001
            });
          }
        }
      }
    }

    updateNodes(deltaTime) {
      for (const node of this.nodes) {
        // Update drift angle
        node.driftAngle += node.driftSpeed * deltaTime * this.config.speed;

        // Calculate new position (orbital drift around base position)
        node.x = node.baseX + Math.cos(node.driftAngle) * node.driftRadius;
        node.y = node.baseY + Math.sin(node.driftAngle) * node.driftRadius;

        // Update pulse for subtle breathing effect
        node.pulsePhase += node.pulseSpeed * deltaTime;
      }
    }

    spawnTransaction(deltaTime) {
      // Control transaction frequency
      const spawnChance = this.config.transactionFrequency * deltaTime * 0.001;

      if (Math.random() < spawnChance && this.edges.length > 0) {
        // Pick random edge
        const edge = this.edges[Math.floor(Math.random() * this.edges.length)];

        // Limit active transactions for performance
        if (this.transactions.length < 20) {
          const useAccent = Math.random() < 0.2;
          const color = useAccent
            ? (Math.random() < 0.5 ? COLORS.accentOrange : COLORS.accentPurple)
            : COLORS.primary;

          this.transactions.push({
            edge,
            t: 0, // Position along edge (0 to 1)
            speed: 0.0003 + Math.random() * 0.0003,
            color,
            label: Math.random() < 0.5
              ? TRANSACTION_LABELS[Math.floor(Math.random() * TRANSACTION_LABELS.length)]
              : null
          });
        }
      }
    }

    updateTransactions(deltaTime) {
      // Update existing transactions
      for (let i = this.transactions.length - 1; i >= 0; i--) {
        const tx = this.transactions[i];
        tx.t += tx.speed * deltaTime * this.config.speed;

        // Remove when it reaches the end
        if (tx.t >= 1) {
          this.transactions.splice(i, 1);
        }
      }
    }

    drawEdges() {
      this.ctx.lineCap = 'round';

      for (const edge of this.edges) {
        const fromNode = this.nodes[edge.from];
        const toNode = this.nodes[edge.to];

        // Slight pulsing brightness
        edge.pulsePhase += edge.pulseSpeed;
        const pulseBrightness = 0.7 + Math.sin(edge.pulsePhase) * 0.3;

        // Draw line
        this.ctx.strokeStyle = pulseBrightness > 0.85
          ? COLORS.lineBright
          : COLORS.lineColor;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(fromNode.x, fromNode.y);
        this.ctx.lineTo(toNode.x, toNode.y);
        this.ctx.stroke();
      }
    }

    drawNodes() {
      for (const node of this.nodes) {
        // Subtle pulse
        const pulse = 0.9 + Math.sin(node.pulsePhase) * 0.1;
        const radius = node.radius * pulse;

        // Glow effect
        this.ctx.shadowBlur = 12;
        this.ctx.shadowColor = node.color;

        // Draw node circle
        this.ctx.fillStyle = node.color;
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Reset shadow
        this.ctx.shadowBlur = 0;

        // Draw icon if node has one
        if (node.icon) {
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          this.ctx.font = '10px sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillText(node.icon, node.x, node.y);
        }
      }
    }

    drawTransactions() {
      for (const tx of this.transactions) {
        const fromNode = this.nodes[tx.edge.from];
        const toNode = this.nodes[tx.edge.to];

        // Interpolate position along edge
        const x = fromNode.x + (toNode.x - fromNode.x) * tx.t;
        const y = fromNode.y + (toNode.y - fromNode.y) * tx.t;

        // Draw glowing particle
        this.ctx.shadowBlur = 16;
        this.ctx.shadowColor = tx.color;
        this.ctx.fillStyle = tx.color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        // Draw label if present
        if (tx.label) {
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          this.ctx.font = 'bold 9px sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillText(tx.label, x, y);
        }
      }
    }

    animate(timestamp) {
      const deltaTime = this.lastFrame ? timestamp - this.lastFrame : 16;
      this.lastFrame = timestamp;

      // Clear with solid background (no trails for this effect)
      this.ctx.fillStyle = COLORS.background;
      this.ctx.fillRect(0, 0, this.width, this.height);

      // Update state
      this.updateNodes(deltaTime);
      this.spawnTransaction(deltaTime);
      this.updateTransactions(deltaTime);

      // Draw in layers
      this.drawEdges();
      this.drawNodes();
      this.drawTransactions();

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
  window.PayFriendsNetworkBackground = PayFriendsNetworkBackground;
})();

/**
 * Unified Top Bar Component
 * For manage and review pages - shows title, subtitle, and return button
 */

/**
 * Renders a page top bar with title, subtitle, and return button
 * @param {Object} options
 * @param {string} options.title - Main title (e.g., "Manage agreement")
 * @param {string} [options.subtitle] - Optional subtitle (e.g., "For new bicycle — Bob")
 * @param {string} [options.href="/app"] - Return link destination
 * @returns {HTMLElement} The top bar container element
 */
export function renderPageTopbar({ title, subtitle, href = "/app" }) {
  const container = document.createElement("div");
  container.className = "page-topbar-container";
  container.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 24px 0; margin-bottom: 16px;";

  // Left side: Title and subtitle
  const left = document.createElement("div");
  left.style.cssText = "flex: 1;";

  const titleEl = document.createElement("h1");
  titleEl.textContent = title;
  titleEl.style.cssText = "margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: var(--text);";
  left.appendChild(titleEl);

  if (subtitle) {
    const subtitleEl = document.createElement("div");
    subtitleEl.textContent = subtitle;
    subtitleEl.style.cssText = "margin: 0; font-size: 16px; color: var(--muted);";
    left.appendChild(subtitleEl);
  }

  // Right side: Return button
  const right = document.createElement("a");
  right.href = href;
  right.className = "return-button";
  right.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0 16px;
    height: 40px;
    border-radius: 10px;
    background: var(--accent);
    color: #0d130f;
    font-weight: 700;
    text-decoration: none;
    transition: filter 0.2s ease;
    border: none;
  `;

  // Arrow icon (left arrow)
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("width", "16");
  icon.setAttribute("height", "16");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "currentColor");
  icon.style.cssText = "flex-shrink: 0;";

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z");
  icon.appendChild(path);

  const text = document.createElement("span");
  text.textContent = "Return to My agreements";

  right.appendChild(icon);
  right.appendChild(text);

  // Hover effect
  right.addEventListener("mouseenter", () => {
    right.style.filter = "brightness(1.06)";
  });
  right.addEventListener("mouseleave", () => {
    right.style.filter = "brightness(1)";
  });

  container.appendChild(left);
  container.appendChild(right);

  return container;
}

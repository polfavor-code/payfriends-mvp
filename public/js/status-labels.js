/**
 * Status label and styling utilities
 * Provides consistent status labeling and badge styling across the app
 */

/**
 * Get human-friendly status label
 * @param {string} status - Agreement status (pending, active, overdue, completed, cancelled)
 * @param {string} [borrowerFirstName] - Borrower's first name (for pending status)
 * @returns {string} Human-readable status label
 */
export function getStatusLabel(status, borrowerFirstName) {
  switch (status) {
    case "pending":
      return borrowerFirstName
        ? `Pending review by ${borrowerFirstName}`
        : "Pending review";
    case "active":
      return "Active";
    case "overdue":
      return "Overdue";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Pending review";
  }
}

/**
 * Get Tailwind-style CSS classes for status badge
 * @param {string} status - Agreement status
 * @returns {string} Space-separated CSS classes
 */
export function getStatusBadgeClass(status) {
  switch (status) {
    case "pending":
      return "bg-yellow-500/15 text-yellow-300 border border-yellow-600/40";
    case "active":
      return "bg-green-500/15 text-green-300 border border-green-600/40";
    case "overdue":
      return "bg-red-500/15 text-red-300 border border-red-600/40";
    case "completed":
      return "bg-gray-500/15 text-gray-300 border border-gray-600/40";
    case "cancelled":
      return "bg-gray-500/15 text-gray-300 border border-gray-600/40";
    default:
      return "bg-yellow-500/15 text-yellow-300 border border-yellow-600/40";
  }
}

/**
 * Get inline CSS styles for status badge (for compatibility with non-Tailwind apps)
 * @param {string} status - Agreement status
 * @returns {string} CSS style string
 */
export function getStatusBadgeStyle(status) {
  const baseStyle = "display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;";
  switch (status) {
    case "pending":
      return `${baseStyle} background: rgba(245, 158, 11, 0.15); color: #fcd34d; border: 1px solid rgba(202, 138, 4, 0.4);`;
    case "active":
      return `${baseStyle} background: rgba(34, 197, 94, 0.15); color: #86efac; border: 1px solid rgba(22, 163, 74, 0.4);`;
    case "overdue":
      return `${baseStyle} background: rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid rgba(220, 38, 38, 0.4);`;
    case "completed":
      return `${baseStyle} background: rgba(107, 114, 128, 0.15); color: #d1d5db; border: 1px solid rgba(75, 85, 99, 0.4);`;
    case "cancelled":
      return `${baseStyle} background: rgba(107, 114, 128, 0.15); color: #d1d5db; border: 1px solid rgba(75, 85, 99, 0.4);`;
    default:
      return `${baseStyle} background: rgba(245, 158, 11, 0.15); color: #fcd34d; border: 1px solid rgba(202, 138, 4, 0.4);`;
  }
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // PayFriends main app colors
        pf: {
          bg: '#0e1116',
          card: '#151a21',
          'card-border': 'rgba(255, 255, 255, 0.06)',
          text: '#e6eef6',
          muted: '#a7b0bd',
          accent: '#3ddc97',
          'accent-hover': '#45e8a1',
          danger: '#ef4444',
          'danger-ink': '#fca5a5',
          'danger-border': 'rgba(239, 68, 68, 0.28)',
          'danger-bg': 'rgba(239, 68, 68, 0.06)',
          warning: '#f97316',
          'warning-ink': '#fb923c',
          'warning-border': 'rgba(249, 115, 22, 0.28)',
          'warning-bg': 'rgba(249, 115, 22, 0.06)',
          input: '#10151d',
        },
        // Admin-specific colors - dense, ops-style
        admin: {
          bg: '#0f1419',
          surface: '#1a1f2e',
          border: '#2d3748',
          text: '#e2e8f0',
          muted: '#718096',
        },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        'pf': '10px',
        'pf-lg': '16px',
      },
      boxShadow: {
        'pf-card': '0 10px 30px rgba(0, 0, 0, 0.35)',
        'pf-glow': '0 0 22px rgba(61, 220, 151, 0.22)',
        'pf-glow-hover': '0 0 26px rgba(61, 220, 151, 0.30)',
      },
    },
  },
  plugins: [],
};

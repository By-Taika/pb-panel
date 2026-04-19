/** @type {import('tailwindcss').Config} */
export default {
  content: ['./client/index.html', './client/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'monospace'],
      },
      colors: {
        panel: {
          bg: '#0a0a0b',
          surface: '#111214',
          raised: '#17181b',
          border: '#222428',
          muted: '#6b6e76',
          text: '#d4d6db',
          accent: '#10b981',
          accent2: '#8b5cf6',
          danger: '#ef4444',
          warn: '#f59e0b',
        },
      },
      boxShadow: {
        glow: '0 0 24px -8px rgba(16,185,129,0.4)',
      },
    },
  },
  plugins: [],
};

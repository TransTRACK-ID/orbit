/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  presets: [require('@transtrack/ui/tailwind-preset')],
  content: [
    './app.vue',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './components/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        surface: {
          50: 'var(--surface-50)',
          100: 'var(--surface-100)',
          200: 'var(--surface-200)',
          300: 'var(--surface-300)',
          400: 'var(--surface-400)',
          500: 'var(--surface-500)',
          600: 'var(--surface-600)',
          700: 'var(--surface-700)',
          800: 'var(--surface-800)',
          900: 'var(--surface-900)',
          950: 'var(--surface-950)',
        },
        accent: {
          DEFAULT: '#CF513D',
          hover: '#b84330',
          soft: 'oklch(62% 0.22 27 / 0.08)',
        },
        kanban: {
          backlog: '#6B7280',
          progress: '#2563EB',
          review: '#7C3AED',
          done: '#22C55E',
        },
      },
      animation: {
        'slide-in-right': 'slideInRight 0.2s ease-out',
        'slide-out-right': 'slideOutRight 0.2s ease-in',
        'fade-in': 'fadeIn 0.15s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
        'fade-up': 'fadeUp 0.2s ease-out',
      },
      keyframes: {
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideOutRight: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

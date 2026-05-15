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
        primary: {
          50: '#FFF5F7',
          100: '#FFE0E6',
          200: '#FFC2CD',
          300: '#FF9AAF',
          400: '#F47289',
          500: '#E84D6A',
          600: '#D43A5A',
          700: '#B02A45',
          800: '#8A2236',
          900: '#5C1726',
          950: '#2E0B13',
        },
        accent: {
          DEFAULT: '#E84D6A',
          hover: '#D43A5A',
          soft: 'rgba(232, 77, 106, 0.08)',
        },
        kanban: {
          backlog: '#97858E',
          progress: '#E84D6A',
          review: '#C084A8',
          done: '#7AB08A',
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

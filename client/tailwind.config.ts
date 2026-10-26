/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#152420',
          soft: '#3F504A',
          mute: '#687770',
        },
        paper: {
          DEFAULT: '#F7F3EB',
          soft: '#FCFAF6',
          deep: '#EFE7D9',
        },
        brand: {
          50: '#EDF7F2',
          100: '#D7EEE3',
          200: '#AEDCC9',
          300: '#7CC3AA',
          400: '#46A384',
          500: '#238366',
          600: '#146B53',
          700: '#0E5345',
          800: '#0D443A',
          900: '#0C3A32',
          950: '#07251F',
        },
        sun: {
          DEFAULT: '#F2B33D',
          soft: '#FBEDCC',
          deep: '#9A6410',
        },
        clay: {
          DEFAULT: '#C2452D',
          soft: '#F8E5DF',
        },
        sky: {
          soft: '#E7EFF5',
          deep: '#2B5F7E',
        },
        line: '#E5DDCF',
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Manrope Variable', 'Manrope', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(21, 36, 32, 0.04), 0 14px 34px -22px rgba(21, 36, 32, 0.28)',
        lift: '0 2px 4px rgba(21, 36, 32, 0.05), 0 22px 44px -20px rgba(21, 36, 32, 0.3)',
        ticket: '0 1px 0 rgba(255,255,255,.6) inset, 0 20px 50px -28px rgba(13, 68, 58, .45)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'overlay-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'dialog-in': {
          '0%': { opacity: '0', transform: 'translate(-50%, -48%) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .5s ease-out both',
        'overlay-in': 'overlay-in .16s ease-out both',
        'dialog-in': 'dialog-in .18s ease-out both',
      },
    },
  },
  plugins: [],
};

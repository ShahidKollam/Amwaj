/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        emerald: {
          DEFAULT: '#064B3C',
          dark: '#03382E',
          light: '#0A6B54',
        },
        gold: {
          DEFAULT: '#C69A50',
          light: '#D4B06A',
          dark: '#A67C3A',
        },
        ivory: '#FAF8F3',
        surface: '#FFFFFF',
        charcoal: '#242424',
        muted: '#6B6B6B',
        border: '#E9E3DA',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 12px rgba(6, 75, 60, 0.08)',
        card: '0 4px 20px rgba(6, 75, 60, 0.06)',
      },
    },
  },
  plugins: [],
};

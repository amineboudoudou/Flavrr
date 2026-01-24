/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FF1493',
        accent: '#FF69B4',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { 
            boxShadow: '0 0 0 0 rgba(255, 20, 147, 0.7)',
            opacity: '1' 
          },
          '50%': { 
            boxShadow: '0 0 0 10px rgba(255, 20, 147, 0)',
            opacity: '0.8' 
          },
        }
      }
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,js,jsx,ts,tsx}",
  ],
// tailwind.config.js
theme: {
  extend: {
    keyframes: {
      flash: {
        '0%, 100%': { opacity: '1', color: '#dc2626' },
        '50%': { opacity: '0.3', color: '#dc2626' },
      },
    },
    animation: {
      flash: 'flash 1s infinite',
    },
  },
},

  plugins: [],
}


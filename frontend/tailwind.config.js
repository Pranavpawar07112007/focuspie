/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#3B82F6', // Electric Blue
          cyan: '#C9FFED', // Mint Cyan
          yellow: '#FFFEED', // Extremely Pale Yellow
          white: '#FAFBFF', // Very Faint Blue-Tint White
          slate950: '#020617',
          slate900: '#0f172a',
          slate50: '#f8fafc',
          rose: '#f43f5e', // Neon rose for distractions
          purple: '#a855f7', // Electric purple for focus
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        handwritten: ['Gloria Hallelujah', 'cursive'],
      },
      animation: {
        'bounce-slow': 'bounceSlow 3s infinite',
        'scan-slow': 'scanSlow 4s linear infinite',
      },
      keyframes: {
        bounceSlow: {
          '0%, 100%': { transform: 'translateY(-2%)' },
          '50%': { transform: 'translateY(2%)' },
        },
        scanSlow: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        }
      }
    },
  },
  plugins: [],
}

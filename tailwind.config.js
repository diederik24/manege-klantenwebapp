/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#e72d81',
          light: '#e84b92',
          dark: '#FF1493',
        },
        purple: {
          DEFAULT: '#9333EA',
          500: '#9333EA',
        },
      },
    },
  },
  plugins: [],
}




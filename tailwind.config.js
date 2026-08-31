/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@tremor/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#1E1E1E',
        slate: '#5E5E5E',
        steel: '#C2C2C2',
        canvas: '#FCFBF9',
        primary: {
          DEFAULT: '#2955E3',
          hover: '#1D4ED8',
        },
        tint: {
          open: {
            DEFAULT: '#E0F2FE',
            text: '#0369A1',
          },
          filling: {
            DEFAULT: '#FEF9C3',
            text: '#A16207',
          },
          review: {
            DEFAULT: '#F3E8FF',
            text: '#6B21A8',
          },
          released: {
            DEFAULT: '#D1FAE5',
            text: '#065F46',
          },
          rejected: {
            DEFAULT: '#FFE4E6',
            text: '#9F1239',
          },
          expired: {
            DEFAULT: '#F3F4F6',
            text: '#374151',
          },
        },
      },
      borderRadius: {
        button: '8px',
        card: '12px',
      },
      lineHeight: {
        body: '1.55',
      },
    },
  },
  plugins: [],
}

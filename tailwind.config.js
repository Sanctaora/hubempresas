/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Azul-marinho do lettering "Lem Casa"
        brand: {
          50: '#eef2fa', 100: '#dde5f4', 200: '#bccbe8', 300: '#8fa5d4', 400: '#5f78b5',
          500: '#3b5294', 600: '#1e2b5f', 700: '#18234f', 800: '#131c40', 900: '#0e1531',
        },
        // Azul do telhado do símbolo
        azul: { 50: '#e6f6fc', 100: '#c9ecf8', 200: '#94d8f1', 400: '#2fb4e3', 500: '#00a1d9', 600: '#0088bb', 700: '#006d96' },
        // Verdes das faixas do símbolo
        verde: { 50: '#f1f9e8', 100: '#ddf1c8', 200: '#bfe496', 400: '#97d25a', 500: '#7cc52f', 600: '#4cb848', 700: '#3a8f2f' },
      },
      fontFamily: { sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'] },
      backgroundImage: { 'brand-gradient': 'linear-gradient(90deg, #00a1d9 0%, #4cb848 100%)' },
    },
  },
  plugins: [],
}

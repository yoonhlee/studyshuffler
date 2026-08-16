/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Validated data-viz palette (light surface). Dark mode is out of MVP scope.
        series: '#2a78d6',
        deficit: '#e4e4e1',
        alarm: '#e34948',
      },
    },
  },
  plugins: [],
};

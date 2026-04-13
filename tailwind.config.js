/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // High-contrast outdoor palette — readable in direct Italian sunlight
        trail:   { DEFAULT: '#39FF14', dark: '#22B800', dim: '#1A8C00' },
        surface: { DEFAULT: '#0D1B0F', card: '#142016', border: '#1E3322' },
        amber:   { trail: '#FFB800', warn: '#FF6B00' },
        danger:  '#FF3B30',
        text:    { primary: '#F5F5F5', muted: '#9CA3AF', dim: '#6B7280' },
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nostr: {
          purple: '#8B5CF6',
          dark: '#1a1a2e',
        },
      },
    },
  },
  plugins: [],
};

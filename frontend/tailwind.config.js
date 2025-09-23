/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html","./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 600:"#204972", 700:"#1a3c5f", 800:"#142f4b" },
      },
    },
  },
  plugins: [],
};

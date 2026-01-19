/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void: {
          blue: "#0a0a2e",
          glow: "#4fc3f7",
          accent: "#6366f1",
        }
      }
    },
  },
  plugins: [],
}

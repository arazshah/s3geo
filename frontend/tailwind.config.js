/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        app: {
          bg: "#07111F",
          panel: "#111827",
          panel2: "#162033",
          border: "#243244",
          text: "#F8FAFC",
          muted: "#94A3B8",
          blue: "#2563EB",
          cyan: "#06B6D4",
          green: "#10B981",
          amber: "#F59E0B",
          red: "#EF4444",
          purple: "#8B5CF6"
        }
      },
      boxShadow: {
        panel: "0 20px 60px rgba(0,0,0,0.35)"
      }
    }
  },
  plugins: []
};

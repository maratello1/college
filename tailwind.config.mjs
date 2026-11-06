/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          cyan: "#38bdf8",
          blue: "#3b82f6",
          indigo: "#6366f1",
          emerald: "#10b981",
          ruby: "#f43f5e",
          amber: "#f59e0b",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        mono: [
          '"SF Mono"',
          '"Fira Code"',
          '"Roboto Mono"',
          "Consolas",
          "monospace",
        ],
      },
      animation: {
        "orb-float": "orbFloat 18s ease-in-out infinite alternate",
        "pulse-glow": "pulseGlow 2s infinite",
      },
      keyframes: {
        orbFloat: {
          "0%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(30px, -20px) scale(1.08)" },
          "100%": { transform: "translate(-20px, 30px) scale(0.96)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.4", transform: "scale(0.95)" },
          "50%": { opacity: "0.8", transform: "scale(1.05)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;

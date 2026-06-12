import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        tr: {
          orange: "#ff8000",
          "orange-dark": "#cc6600",
          navy: "#0a1929",
          "navy-2": "#102a43",
          slate: "#9fb3c8",
          "slate-2": "#6b7c8c",
        },
      },
      fontFamily: {
        sans: [
          "Segoe UI",
          "-apple-system",
          "BlinkMacSystemFont",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;

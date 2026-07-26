import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        canvas: "#f5f7fb",
        card: "#ffffff",
        accent: "#ff7a1a",
        accentAlt: "#2dd4bf",
        accentSoft: "#fef3c7",
      },
      fontFamily: {
        display: ['"Poppins"', "ui-sans-serif", "system-ui", "sans-serif"],
        body: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        soft: "0 24px 45px -28px rgba(15, 23, 42, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;

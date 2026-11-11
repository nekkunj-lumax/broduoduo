import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-plex-sans)", "IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
      colors: {
        // Steel blue brand scale (cool, desaturated — deliberately not purple)
        steel: {
          50: "#f1f6fa",
          100: "#dfeaf3",
          200: "#c4d8e8",
          300: "#99bcd6",
          400: "#6899bd",
          500: "#477da4",
          600: "#376488",
          700: "#2f5170",
          800: "#2b445d",
          900: "#283b50",
          950: "#1a2636",
        },
        ink: {
          DEFAULT: "#0f1b2a",
          muted: "#52627a",
          faint: "#8696ad",
        },
        canvas: "#f4f6f9",
      },
      boxShadow: {
        panel: "0 1px 2px rgba(15,27,42,0.05), 0 0 0 1px rgba(15,27,42,0.05)",
      },
    },
  },
  plugins: [],
};
export default config;

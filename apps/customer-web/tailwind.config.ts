import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#FFF5F0",
          100: "#FFE8DD",
          200: "#FFCDB8",
          300: "#FFAA89",
          400: "#FF8760",
          500: "#FF6A3D",
          600: "#EE4F20",
          700: "#C73F18",
          800: "#9E341A",
          900: "#802F1A",
        },
        cream: {
          50: "#FFFCF9",
          100: "#FFF8F2",
          200: "#FBEFE4",
        },
        ink: {
          400: "#8C7B72",
          500: "#6F5F57",
          600: "#54463F",
          700: "#3B2F2A",
          800: "#2B211D",
          900: "#1E1613",
        },
      },
      fontFamily: {
        sans: ["var(--font-outfit)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(120, 60, 30, 0.06), 0 8px 24px -8px rgba(120, 60, 30, 0.12)",
        glow: "0 8px 24px -6px rgba(255, 106, 61, 0.45)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;

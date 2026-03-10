import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Figtree", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          red: "#dc2f1f",
          "red-hover": "#ef4432",
        },
        dark: {
          bg: "#0e1014",
          surface: "#191d26",
          "surface-2": "#1f2433",
          border: "#272e3d",
          "border-2": "#313a4d",
          "text-primary": "#edf0f5",
          "text-secondary": "#8892a4",
          "text-muted": "#505c6e",
        },
        light: {
          bg: "#f6f5f2",
          surface: "#ffffff",
          "surface-2": "#f2f0ec",
          border: "#dedad4",
          "text-primary": "#181614",
          "text-secondary": "#5c564e",
          "text-muted": "#9c9488",
        },
      },
      borderRadius: {
        card: "14px",
        input: "9px",
        btn: "9px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
        "card-dark": "0 1px 4px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};

export default config;

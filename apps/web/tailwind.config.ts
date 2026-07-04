import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0a0a0a",
          card: "#141414",
          hover: "#1a1a1a",
        },
        border: {
          DEFAULT: "#262626",
        },
        text: {
          primary: "#fafafa",
          secondary: "#a3a3a3",
          muted: "#525252",
        },
        accent: {
          DEFAULT: "#3b82f6",
          hover: "#2563eb",
        },
      },
    },
  },
  plugins: [],
};

export default config;

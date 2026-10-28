import type { Config } from "tailwindcss";

// Surface tokens used across the app (bg-base-100, text-base-content/60, ...).
// They are defined as RGB channels in globals.css so opacity modifiers work.
const token = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "base-100": token("--base-100"),
        "base-200": token("--base-200"),
        "base-300": token("--base-300"),
        "base-content": token("--base-content"),
        brand: token("--brand"),
      },
    },
  },
  // The map, print views and exports are light; keep the UI light too instead
  // of following the OS setting.
  plugins: [require("rippleui")({ removeThemes: ["dark"] })],
};

export default config;

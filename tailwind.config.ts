import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'brand-bg': '#FFFFFF',
        'brand-primary': '#00dada',
        'brand-secondary': '#ffd400',
        'brand-title': '#0d0d0d',
        'brand-highlight': '#25bccd',
        'brand-text': '#333',
      },
      fontFamily: {
        sans: [
          'Poppins',
          'system-ui',
          'Avenir',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        body: ["Karla", "system-ui", "sans-serif"],
      },
      colors: {
        shore: {
          ink: "#0B0D11",
          panel: "#141A22",
          line: "#2A3742",
          sand: "#EDE7DD",
          mute: "#9AA3AD",
          accent: "#7FA79B",
        },
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      colors: {
        ink: {
          50: "#f6f6f7",
          100: "#e3e3e6",
          200: "#c7c8cd",
          300: "#9b9da6",
          400: "#6f717c",
          500: "#4b4d57",
          600: "#34363f",
          700: "#23252c",
          800: "#16171c",
          900: "#0e0f13",
          950: "#08090b",
        },
        brass: {
          DEFAULT: "#c9a45c",
          bright: "#e2bd74",
          deep: "#a8843f",
          tint: "#1c1708",
        },
        live: {
          DEFAULT: "#5fd4c4",
          deep: "#2f9e90",
        },
        bone: "#ece6d8",
        slate: {
          DEFAULT: "#8b8d98",
          dim: "#5b5d68",
        },
        sig: "#c9a45c",
      },
      backgroundImage: {
        "dot-grid": "radial-gradient(rgba(236,230,216,0.10) 0.7px, transparent 0.7px)",
        "brass-sheen":
          "linear-gradient(135deg, rgba(226,189,116,0.18) 0%, rgba(201,164,92,0.04) 40%, transparent 70%)",
      },
      boxShadow: {
        "glow-brass": "0 0 24px -4px rgba(201,164,92,0.45)",
        "glow-live": "0 0 18px -2px rgba(95,212,196,0.55)",
        seal: "0 0 0 1px rgba(201,164,92,0.35), 0 8px 40px -12px rgba(201,164,92,0.4)",
      },
      animation: {
        shine: "shine 2.6s ease-in-out infinite",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        "mesh-drift": "mesh-drift 22s ease-in-out infinite alternate",
        "mesh-drift-slow": "mesh-drift-slow 30s ease-in-out infinite alternate",
        "seal-spin": "seal-spin 40s linear infinite",
        rise: "rise 0.6s cubic-bezier(0.22,1,0.36,1) both",
      },
      keyframes: {
        shine: {
          "0%": { transform: "translateX(-160%) skewX(-12deg)" },
          "60%, 100%": { transform: "translateX(360%) skewX(-12deg)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
        "mesh-drift": {
          "0%": { transform: "translate3d(-6%, -4%, 0) scale(1)" },
          "100%": { transform: "translate3d(8%, 6%, 0) scale(1.15)" },
        },
        "mesh-drift-slow": {
          "0%": { transform: "translate3d(6%, 8%, 0) scale(1.1)" },
          "100%": { transform: "translate3d(-8%, -6%, 0) scale(1)" },
        },
        "seal-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
}

export default config

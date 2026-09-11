/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Existing navy scale — unchanged, still used throughout Chat 7 shell.
        navy: {
          975: "#070a11", // deepest background layer, for premium depth behind panels
          950: "#0a0e17",
          900: "#0f1420",
          850: "#141a29", // card/panel surface, one step up from base background
          800: "#161d2e",
          700: "#1f2937",
          650: "#2a3448", // subtle border/divider tone, richer than a flat slate line
        },
        slate: {
          850: "#1a2332",
        },
        // Base risk palette — unchanged. Source of truth for light theme and
        // for small badges/icons where legibility needs the punchier flat tone.
        risk: {
          green: "#22c55e",
          yellow: "#eab308",
          orange: "#f97316",
          red: "#ef4444",
          grey: "#6b7280",
        },
        // Muted/deepened counterparts for dark-theme surfaces (zone fills,
        // large-area backgrounds) — see src/utils/riskLevels.js, which is the
        // actual source of truth for these values at render time. Kept here
        // too so Tailwind-class usage (e.g. borders) can reference them
        // without duplicating hex literals inline.
        riskMuted: {
          green: "#3f9463",
          yellow: "#c9a227",
          orange: "#d97a3f",
          red: "#c4453f",
          grey: "#6b7787",
        },
        // Brand accent — the electric blue from the landing page (black +
        // blue identity). Aliased separately from Tailwind's default sky/blue
        // scale so every accent usage (search bar focus ring, mesh-line
        // stroke, satellite-toggle active state, landing-page glow text)
        // draws from one named token instead of picking arbitrary shades —
        // if the brand blue ever shifts, it's one edit here.
        accent: {
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

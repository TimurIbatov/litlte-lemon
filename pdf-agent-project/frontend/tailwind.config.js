/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        raise: "var(--bg-raise)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        accent: "var(--accent)",
        accentink: "var(--accent-ink)",
        danger: "var(--danger)",
        dangerbg: "var(--danger-bg)",
      },
      boxShadow: {
        card: "0 16px 40px rgba(48, 32, 12, 0.06)",
      },
    },
  },
  plugins: [],
};

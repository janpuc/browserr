// Tailwind v4 ships its own PostCSS plugin and handles vendor prefixing
// internally (Lightning CSS), so the v3 `tailwindcss` + `autoprefixer` plugins
// are gone.
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

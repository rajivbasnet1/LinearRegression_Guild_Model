/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── Neutral surface ramp ──────────────────────────────────────────────
        // Cool-tinted near-black. Not navy, not pure black. Slightly blue-shifted.
        base:    'oklch(0.12 0.018 245)',    // page background
        surface: 'oklch(0.16 0.018 245)',    // nav, sidebars
        card:    'oklch(0.19 0.016 248)',    // cards, panels
        line:    'oklch(0.26 0.022 248)',    // borders, dividers
        subtle:  'oklch(0.22 0.018 248)',    // hover states, nested fills

        // ── Ink ───────────────────────────────────────────────────────────────
        ink:     'oklch(0.90 0.008 245)',    // primary text
        dim:     'oklch(0.60 0.010 245)',    // secondary / metadata text
        ghost:   'oklch(0.38 0.012 245)',    // placeholder, disabled

        // ── Accent ────────────────────────────────────────────────────────────
        // Warm amber — restrained, used only for primary actions + current state
        amber:   'oklch(0.76 0.13 78)',      // primary accent
        'amber-dim': 'oklch(0.55 0.09 78)', // amber on dark (for text on surface)

        // ── Semantic states ───────────────────────────────────────────────────
        // Muted — never neon. Hue carries the meaning; lightness stays near 0.62.
        win:     'oklch(0.62 0.08 148)',     // advance / winner
        'win-bg':'oklch(0.19 0.04 148)',     // win state background
        out:     'oklch(0.60 0.08 22)',      // eliminated
        'out-bg':'oklch(0.19 0.04 22)',      // eliminated background
        info:    'oklch(0.62 0.07 228)',     // neutral info
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },

      fontSize: {
        // Fixed rem scale (product UI, not fluid marketing)
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],   // 11px
        xs:    ['0.75rem',   { lineHeight: '1.125rem' }],// 12px
        sm:    ['0.8125rem', { lineHeight: '1.25rem' }], // 13px
        base:  ['0.875rem',  { lineHeight: '1.5rem' }],  // 14px
        md:    ['1rem',      { lineHeight: '1.5rem' }],  // 16px
        lg:    ['1.125rem',  { lineHeight: '1.625rem' }],// 18px
        xl:    ['1.25rem',   { lineHeight: '1.75rem' }], // 20px
        '2xl': ['1.5rem',    { lineHeight: '2rem' }],    // 24px
      },

      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '14px',
      },

      transitionDuration: {
        DEFAULT: '150ms',
      },

      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.16, 1, 0.3, 1)', // ease-out-expo
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Mac OS X "Aqua" font stack — Lucida Grande is the period-accurate system face.
      // Tailwind is used for layout/spacing ONLY; the gloss is layered in index.css.
      fontFamily: {
        aqua: ['"Lucida Grande"', '"Lucida Sans Unicode"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        aqua: {
          blue:        '#3875D7', // selection / highlight
          gelTop:      '#A9CCF5', // primary gel gradient top
          gelMid:      '#4A90E2', // primary gel gradient mid
          gelBot:      '#1C5FCB', // primary gel gradient bottom
          metal:       '#B8B8B8', // brushed-aluminium base
          metalLight:  '#D6D6D6', // brushed gradient top
          metalDark:   '#ABABAB', // brushed gradient bottom
          panel:       '#ECECEC', // interior window panel
          line:        'rgba(0,0,0,.03)', // pinstripe line
          ink:         '#1a1a1a', // primary text
          muted:       '#6a6a6a', // secondary text
          online:      '#28C840',
          away:        '#FEBC2E',
          blocked:     '#FF5F57',
          close:       '#FF5F57', // traffic light: close
          min:         '#FEBC2E', // traffic light: minimize
          zoom:        '#28C840', // traffic light: zoom
        },
      },
      fontSize: {
        'aqua-xs':   '10px',
        'aqua-sm':   '11px',
        'aqua-base': '12px', // Aqua body text ~12px
        'aqua-lg':   '14px',
      },
      boxShadow: {
        // Dramatic floating-window shadow (windows lift off the desktop).
        'aqua-window': '0 22px 70px rgba(0,0,0,.45), 0 2px 6px rgba(0,0,0,.3)',
        // Breathing glow for the default/pulse button — see index.css keyframes.
        'aqua-pulse': '0 0 0 3px rgba(74,144,226,.45), 0 2px 6px rgba(28,95,203,.6)',
        'aqua-inset': 'inset 0 1px 0 rgba(255,255,255,.6), inset 0 -1px 2px rgba(0,0,0,.15)',
      },
    },
  },
  plugins: [],
}

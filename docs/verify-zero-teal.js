/**
 * verify-zero-teal.js
 *
 * Run from the browser DevTools console on any iCareerOS route after the
 * Design System & Brand Overhaul (PRs #155–#167) has been deployed.
 *
 * Reports any element still rendering a teal or navy computed color.
 * Expected output on a clean build: ✅ Zero teal/navy computed styles found.
 *
 * Usage:
 *   1. Open the page you want to check in Chrome/Firefox
 *   2. Open DevTools (F12) → Console tab
 *   3. Paste the entire IIFE below and press Enter
 *   4. Repeat on each route: /, /login, /signup, /dashboard, /settings
 */
(function checkNoTeal() {
  // Matches common teal/cyan computed RGB values
  // teal: rgb(0,128,128)  tw-teal-500: rgb(20,184,166)  tw-teal-600: rgb(13,148,136)
  const TEAL_RE = /rgb\(\s*(?:0\s*,\s*1(?:2[0-9]|[3-9]\d)\s*,\s*1(?:2[0-9]|[3-9]\d)|1[23]\s*,\s*1(?:4[0-9]|[5-8]\d)\s*,\s*1(?:3[0-9]|[4-6]\d))\s*\)/i;

  // Matches navy dark palette: very low-red, low-green, mid-blue (navy-800/900 territory)
  // e.g. rgb(10,25,80) through rgb(30,47,120) — roughly the old --navy-800/900 range
  const NAVY_RE = /rgb\(\s*(?:[0-9]|[12]\d|30)\s*,\s*(?:[0-9]|[12]\d|3[0-9]|4[0-7])\s*,\s*(?:[5-9]\d|1(?:0[0-9]|1[0-9]|2[0-7]))\s*\)/i;

  const PROPS = [
    'color',
    'background-color',
    'border-color',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'outline-color',
    'fill',
    'stroke',
    'box-shadow',
    'text-decoration-color',
  ];

  const hits = [];

  document.querySelectorAll('*').forEach(el => {
    try {
      const cs = window.getComputedStyle(el);
      PROPS.forEach(prop => {
        const v = cs.getPropertyValue(prop);
        if (v && (TEAL_RE.test(v) || NAVY_RE.test(v))) {
          hits.push({ element: el, prop, value: v });
        }
      });
    } catch (_) {
      // cross-origin iframes etc — skip silently
    }
  });

  if (hits.length === 0) {
    console.log(
      '%c✅ Zero teal/navy computed styles found.',
      'color: #22c55e; font-weight: bold; font-size: 14px;'
    );
  } else {
    console.warn(`⚠️  ${hits.length} teal/navy hit(s) found — investigate below:`);
    hits.forEach(({ element, prop, value }) => {
      console.warn(`  ${prop}: ${value}`, element);
    });
  }

  return hits;
})();

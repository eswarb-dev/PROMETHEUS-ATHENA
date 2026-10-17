# PROMETHEUS // ATHENA

Phase 03: Home dashboard using React Bits MagicBento, with compact left navigation over the Phase 01 SoftAurora background.

Run `npm install`, then `npm run dev`. Production build: `npm run build`.

The JavaScript/CSS WebGL2 component comes from [React Bits Soft Aurora](https://reactbits.dev/backgrounds/soft-aurora), with one local cleanup guard to avoid deleting invalid GPU resources after context restoration. Its original motion, visibility, resize, pointer and pulse behavior is preserved. Reduced motion slows the flow and disables intro/pulses, following upstream behavior.

The supplied indigo/cyan palette over #080D1A establishes the requested midnight academic identity. Fixed background layering leaves room for the dashboard. System typography avoids extra font downloads.

The navigation uses the [React Bits JavaScript/CSS Dock](https://reactbits.dev/components/dock), with native `position="left"`, viewport fitting, keyboard controls, magnification, bounce and right-side labels. Local source changes add `aria-current` for the active item and reserve combined neighboring magnification in the fit calculation so short landscape screens do not clip. Hugeicons outline symbols identify each destination, including the intelligence icon for ATHENA.

`src/components/navigation/AthenaDock.jsx` defines the seven destinations and configuration: 40px base, 50px peak, 110px distance, 54px panel, 6px gap and #7C6CFF accent. Labels use 11px text and 5px/8px padding. The translucent midnight panel connects navigation to the existing palette; the accent identifies focus and selection. The fixed navigation layer sits above content at z-index 10 and leaves pointer events outside the Dock available to the page. Main content reserves space on the left to avoid overlap on narrow screens.

Navigation uses local state in `src/App.jsx`. Only Home renders the six-card dashboard; other destinations show a temporary section label. No routes or other destination pages are implemented. The background source, styles and Aurora props are unchanged from Phase 01.

The [React Bits MagicBento JavaScript/CSS implementation](https://reactbits.dev/components/magic-bento) uses custom JSX from `src/components/dashboard/AthenaDashboard.jsx`. Its own layout observer chooses four, two or one columns. Rows have a 190px minimum and grow with content; cards use 18px corners, 12px gaps, navy surfaces and subtle indigo spotlight/borders. Stars, tilt and magnetism are disabled. Non-action cards remain non-buttons; clicks provide only the upstream decorative wave. One local engine correction triggers the intro when any part of the grid becomes visible, avoiding a hidden dashboard when a stacked grid cannot reach the original 15% whole-grid visibility threshold. No additional dependencies were needed.

All study records and visualizations are static sample data, labeled in the header. No real study tracking, analytics or AI runs. The greeting uses Asia/Kolkata time. The roadmap gets extra space for its sequence; mini progress/activity graphics make the supplied sample values easier to scan without a chart library.

Design direction: ENERGY 1 / RHYTHM 1 / MOTION 2. Restrained magnification aids targeting; bounce confirms selection. System typography and minimal preview spacing keep attention on the navigation review.

Verification: production build passes; local Chrome checked desktop/tablet/mobile, short landscape, selection, glow, spotlight, click wave, scrolling, reduced motion, one canvas and no runtime console errors. A two-second headless idle sample recorded no Dock/Bento animation callbacks after settling; Aurora remained animated. Upstream React ref lint warnings remain distinct from runtime results.

Visual approval is required before the next phase.

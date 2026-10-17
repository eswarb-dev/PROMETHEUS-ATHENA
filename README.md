# PROMETHEUS // ATHENA

Phase 05: Settings now opens a local profile preview, alongside the unchanged Home dashboard, compact navigation and optional onboarding preview.

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

Onboarding preview: open `http://127.0.0.1:5173/?onboarding=1`. The normal `/` URL still opens Home. The Dock is hidden only during onboarding; the same Aurora stays mounted. The actual [React Bits Stepper](https://reactbits.dev/components/stepper) supplies numbered horizontal indicators, slide transitions, animated height and responsive tight mode. Five steps collect Account, Direction, Skills, Study Style and Review. The 800px navy frame keeps the setup focused; indigo ties selection to the existing navigation palette. Controls use system typography and visible focus. The sole local Stepper adjustment makes the outgoing animation panel inert so hidden inputs cannot receive focus.

Account, goal, skills and preferences use separate React state. Each step validates before Continue is enabled, and previously visited indicators cannot bypass invalid earlier fields. Skills use selfReportedLevel with verifiedLevel/confidenceScore unset. Reminders are preference data only. Completion creates a temporary profile without passwords and clears both password state fields. No storage, cookies, auth service or backend is used; reloading resets setup. Open Dashboard returns to `/` and discards the temporary state.

Onboarding checks covered account validation, visibility controls, custom direction/skill, self-reported levels, starting from scratch, all preferences, review, Back/indicators, completion, password-state clearing, no password in the profile, storage remaining empty, no submissions, dashboard return, responsive layouts and reduced-motion loading. Upstream ref lint warnings remain; no runtime console or WebGL errors were observed. No dependencies were added.

Settings uses the actual [React Bits SpotlightCard](https://reactbits.dev/components/spotlight-card), with the upstream engine unchanged: dark theme, indigo light, intensity 0.10, size 260, softness 0.82, border glow 0.42, proximity 70 and smoothing 0.32. Ambient light and grain are disabled; flare remains enabled. A navy surface and restrained avatar gradient keep the existing midnight identity. The page reserves the same left navigation clearance as Home; the secondary learning snapshot is explicitly sample data.

`src/components/profile/demoProfile.js` is the single temporary profile source, aligned with onboarding's account, goal, skills and preferences concepts. Local edits survive section switching but reset on reload. Email is read-only. Editing the name updates the avatar initial immediately; Cancel discards unsaved form edits. Skills remain self-reported. This page is not connected to onboarding or authenticated identity yet.

`ProfileAvatar` shows a supplied image or only the first trimmed, uppercased name character, with `?` for missing names and a fallback on image errors. Photo selection accepts decodable PNG/JPEG/WEBP files under 5 MiB. Temporary Object URLs are separate from account.avatarUrl and are revoked on replacement, removal, rejected decode, cancelled pending selection or unmount. No files, Base64, storage writes or uploads are used by the application.

Profile checks covered initials and live name edits, Cancel/Save, image formats/validation, Object URL lifecycle, navigation, narrow layouts, pointer spotlight/glow/flare, keyboard focus and reduced motion. Home and onboarding remain intact with one Aurora canvas and no observed runtime console/WebGL errors. No dependencies were added; upstream ref lint warnings remain.

Visual approval is required before the next phase. No backend authentication or profile persistence is implemented.

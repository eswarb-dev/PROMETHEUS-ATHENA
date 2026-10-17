# PROMETHEUS // ATHENA

Phase 07: Today consumes a live study-plan contract alongside the unchanged Roadmap, Home, profile, navigation and onboarding preview.

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

Roadmap uses the existing SpotlightCard for one selected-topic panel, actual React Bits [AnimatedContent](https://reactbits.dev/animations/animated-content) for group reveals, and [BranchedMenu](https://reactbits.dev/c/micro/branched-menu) for structure navigation. Its example menu data was removed; a controlled selection prop keeps prerequisites and flow selections aligned with the navigator. The branch drawing/folding engine remains intact. Status labels, icons and colors share `roadmapStatus.js`. The flow uses lightweight cards regardless of topic count, preventing per-topic spotlight engines. Indigo selection and subtle CSS connectors make navigation clear without a canvas graph.

Roadmap API contract:

| Method | Path relative to VITE_API_BASE_URL | Response |
| --- | --- | --- |
| GET | /roadmaps/active | Roadmap object; null, 204 or 404 means no active roadmap |
| GET | /roadmaps/:id/sections | Array of sections |
| GET | /roadmaps/:id/topics | Array of topics |
| GET | /topics/:id | One topic (available service method) |

Set the public `VITE_API_BASE_URL` in your local Vite environment and restart the dev server. It may be an HTTP(S) base URL or a same-origin relative path. Leave it empty to show the unavailable state without fetching. Never put secrets in VITE variables. No backend/vendor, authentication scheme or write endpoint is assumed. Cross-origin backends must support the frontend origin through CORS. No status mutation controls are exposed.

Roadmaps require nonempty string `id` and `title`; optional `goal` is text, `progressPercent` is 0–100, and `estimatedRemainingMinutes` is nonnegative minutes. Sections require `id`, `roadmapId` and `title`; optional `order` determines sorting. Topics require `id`, `sectionId`, `title` and one status: completed/current/planned/suggested/gap. Optional fields: description, order, nonnegative estimatedMinutes, selfReportedLevel, verifiedLevel, confidenceScore (0–1), prerequisiteTopicIds (string array), suggestedByAthena (boolean). IDs must be unique; sections must belong to the active roadmap, and topics to returned sections. Invalid data fails closed to the error state. Unresolved prerequisite IDs display Unknown prerequisite. Explicit null verifiedLevel displays Not tested; omitted fields stay omitted. Completion counts derive only from returned topics; no time estimates are inferred.

`roadmapService.js` validates responses and limits requests to 15 seconds. `useRoadmap` aborts on unmount, cancels sibling requests on failure and avoids StrictMode's discarded initial fetch. Summary/navigation/section animation groups use GSAP contexts with upstream cleanup. Loading, unavailable, empty, loaded and retryable error states are distinct. No sample topics, fallback dataset, speculative generation or successful local writes exist in this page. Existing sample Home/Profile content is separate and unchanged.

Verification: build passes. Service contract tests covered missing configuration with zero fetches, empty responses, malformed data, duplicate IDs, HTTP failure and cancellation. Isolated browser tests used intercepted transport responses outside the application to exercise loading/empty/loaded/error/retry, selection, prerequisites, statuses, keyboard, reduced motion, desktop/tablet/mobile and 50 topics with one SpotlightCard. These are simulated transport checks, not proof of a deployed backend. The normal app currently shows data source unavailable. No test datasets or test server configuration are included in the application.

Today uses actual React Bits [AnimatedList](https://reactbits.dev/components/animated-list), [SpringCheck](https://reactbits.dev/micro/spring-check) and [SpecularButton](https://reactbits.dev/components/specular-button). Example list data and the default checkbox label were removed. AnimatedList has an opt-in grid role for interactive rows so its native checkboxes remain accessible; its scrolling, reveal, selection and keyboard engine are retained. Rows show only returned task fields. Compact navy surfaces and one optional primary SpecularButton keep the productivity theme. Completed text stays readable. The Today bundle (including Motion) is lazy-loaded when the section opens.

Today API contract, relative to the same VITE_API_BASE_URL:

| Method | Path | Response / capability |
| --- | --- | --- |
| GET | /today | Plan object with date and tasks array |
| PATCH | /tasks/:id/status | Accepts status; returns the persisted task. Requires capabilities.updateTask=true |
| POST | /focus-sessions | Accepts taskId; returns active session. Requires capabilities.focusSessions=true |

The plan may include timezone (valid IANA zone), plannedMinutes, completedMinutes, taskCount, completedTaskCount, activeSession and capabilities. Tasks require nonempty id/title and status planned/in_progress/completed/missed; optional fields include description, estimatedMinutes, actualMinutes, priority, topicId, topicTitle, roadmapId, scheduledFor, order and completedAt. scheduledFor, if present, must match the plan's YYYY-MM-DD date. IDs must be unique. Counts derive from actual returned task rows; durations use returned plan values, or sum complete estimates when every task has an estimate. No duration is inferred from missing data. A date-only plan date is formatted without a timezone shift; session instants use the returned timezone, falling back to Asia/Kolkata.

Capabilities default to false even with an API URL. A backend must advertise a capability only when its documented endpoint is implemented and authorized. No task/session writes occur without it. Checkboxes are controlled and pessimistic: a task stays in its previous visible state until PATCH and a fresh GET confirm it. Only the pending task is disabled, duplicate writes are guarded, and reconciliation failures show an inline refresh action. No optimistic success is fabricated. Future shared-query invalidation can reuse the hook's refetch boundary; existing Home statistics are untouched.

Focus sessions require server id/taskId/startedAt with an explicit timestamp offset. A confirmed response is reconciled with GET /today before display. Elapsed display derives from that server timestamp and current browser time; it does not persist or create session state. Conflicting active sessions suppress Start. No frontend-only timer/session or end-session endpoint is invented. SpecularButton uses its upstream WebGL shader with autoAnimate=false; at most one renders, alongside the single Aurora canvas.

Today distinguishes loading, unavailable, empty, loaded, all-completed and retryable error states. No planning endpoint or planning action is assumed. Missing API configuration makes zero requests and shows zero tasks. Requests have a 15-second limit and abort on unmount; the StrictMode discarded mount makes no duplicate read. Read ordering prevents stale refetch responses from replacing newer data.

Verification used external contract tests and intercepted browser transport, not a deployed backend: no-API/no-fetch, skeleton, empty, exact task rows/statuses, date formatting, arrows/Home/End/Enter, Space checkbox activation, write success/refetch, pending isolation, duplicate-write prevention, failure preserving visible status, focus failure/success, active-session elapsed display, disabled capabilities, completed day, reduced motion and responsive desktop/tablet/mobile. Home/Roadmap/Profile/Onboarding and Aurora/Dock were checked. No test task dataset or configured test API is included in the app. Motion was the only new dependency. Build passes; upstream ref lint warnings remain separate from runtime verification.

Visual approval is required before the next phase. No backend, authentication, task generation or persistence has been implemented.

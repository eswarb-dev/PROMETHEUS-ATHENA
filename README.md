# PROMETHEUS // ATHENA

Phase 14 extends Supabase authentication and verified-account onboarding with branded transactional emails and an authenticated welcome-mail outbox. The existing midnight Aurora, Dock, MagicBento, Stepper, Spotlight, task controls and charts retain their visual identity. No production demo records are supplied.

## Local setup

```powershell
npm ci
# Only for a new checkout; preserve an existing configured .env.local.
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run dev
```

Set `VITE_SUPABASE_URL` to your project's API URL and `VITE_SUPABASE_PUBLISHABLE_KEY` to its new `sb_publishable_…` key. The example contains blank values; local environment files are ignored. Missing or invalid configuration produces a controlled unavailable state. Never put a secret/service key or database password in a `VITE_` variable.

One provider restores `getSession()` and owns the only `onAuthStateChange()` listener. A fresh browser sees Sign In, with the Dock hidden and no private database reads. Supabase Auth handles passwords, sessions and verification. No custom token/password/OTP storage is used. `VITE_ATHENA_API_BASE_URL` remains reserved for the future reasoning transport; database services do not use it. Saved ATHENA conversations remain read-only.

## Authentication

Sign In, Create Account, verification, Forgot Password and Reset Password use the existing Supabase client directly. Signup metadata contains only the name. OTP cells accept typing, paste/autofill and keyboard navigation; verification is not automatically retried. A shared pending lock blocks simultaneous auth submissions; resend attempts start a 60-second cooldown. Passwords are not trimmed and are cleared after submission. Signup/reset enforce at least eight characters; login accepts existing passwords without applying signup strength rules. Forgot-password responses do not disclose whether an account exists.

Auth views use `?auth=login`, `signup`, `verify`, `forgot` or `reset`; email and codes remain only in transient flow state. Direct `?auth=verify` without flow context returns to login. Arbitrary `next`/redirect parameters are ignored. Recovery redirects are constructed solely from the application's own origin. Supabase's SDK consumes recovery callbacks; `PASSWORD_RECOVERY` keeps the reset form ahead of the application until the user chooses Continue to ATHENA. A tab-local `sessionStorage` routing marker contains only the recovery owner's ID, allowing the same restored Supabase session to reload its reset form. It stores no credential/token and is cleared on completion, sign-out or an identity change. If storage is unavailable, the current flow still works in memory. An invalid/expired recovery link offers fresh instructions instead of allowing a password update.

The hosted project currently has email confirmation **enabled**, **eight-digit OTPs**, a minimum password length of **eight**, Site URL `http://localhost:5173`, and allowed redirects `http://localhost:5173/**` and `http://127.0.0.1:5173/**`. No deployed production domain was found or invented. `VITE_AUTH_OTP_LENGTH` can override the eight-cell UI when the project's configured length changes.

**Hosted email:** Phase 14 deployed the branded confirmation template containing `{{ .Token }}` and recovery template containing `{{ .ConfirmationURL }}` after the user configured custom SMTP. This resolves the Phase 13 default-provider restriction on template customization. The verification screen expects an eight-digit code. Development redirects and the eight-character minimum password policy remain configured. Inbox receipt and completed live verification are tracked separately from deployment below; inbound AI mail remains outside this phase.

Routing waits for session restoration and then loads just `get_auth_profile()`. Incomplete accounts enter the existing five-step Stepper with a read-only verified identity and no password fields. Completed accounts enter Home; other page snapshots load only when opened. The application shell is loaded separately from authentication. The Auth-user trigger creates a minimal profile with `onboarding_completed=false`; the owner-scoped profile RPC handles pre-existing Auth users idempotently. `complete_onboarding` requires a verified Auth email and atomically writes the profile, preferences, notification consent and self-reported skills before setting completion. Failed writes roll back; retries do not duplicate records or establish verified knowledge. Settings → Account → Sign out uses Supabase and clears all user-scoped caches/transient page state without clearing unrelated browser storage.

Development-only `/?onboarding=1` preserves the standalone Stepper preview; it cannot submit accounts or profiles. Production uses protected routing.

The auth panel uses actual React Bits [BlurText](https://reactbits.dev/text-animations/blur-text), [StarBorder](https://reactbits.dev/animations/star-border), [GlassSurface](https://reactbits.dev/components/glass-surface), and the existing AnimatedContent. New upstream sources were fetched from React Bits commit `c2a1408d9219a5bd7a2d9c93c9c499042f5fa34a`. One glass panel and one primary StarBorder sit above the existing single Aurora. Glass uses SVG refraction where supported and its frosted fallback otherwise; it does not allocate a second WebGL context without a backdrop. The internal dark surface preserves text contrast. Reduced motion makes the title immediately readable; labels and errors are not animated.

## Database setup

The CLI is available through `npx supabase` (verified version 2.121.0); local Supabase requires a running Docker engine. The supplied ATHENA project is linked and all six migrations have been applied. Its URL and publishable key are stored only in ignored `.env.local`; the example keeps these values blank.

Use your actual project reference when linking; do not copy an invented reference:

```powershell
npx supabase login
npx supabase link --project-ref <your-actual-project-ref>
npx supabase migration list
# Review the five SQL files before applying them.
npx supabase db push
npx supabase db query --linked --file supabase/verify.sql
```

Enter the database password through the CLI prompt when required. Keep it out of files and command history. For an isolated local stack, run `npx supabase start`, then `npx supabase db reset --local`; resetting deletes that local database. Migrations contain no seed records.

The schema contains profiles, study/notification preferences, roadmaps, sections, topics, prerequisites, daily tasks, study sessions, knowledge topics, and ATHENA conversations/messages. `user_skills` is a **security-invoker view** over `knowledge_topics`, with `title` exposed as `name`. One canonical row owns the self-report and separate diagnostic verification fields. Names are unique per user after trimming and case normalization.

All 12 private tables enable RLS. Child policies follow roadmap/conversation ownership. Composite foreign keys prevent cross-owner roadmap links, cross-roadmap sections/topics and mismatched prerequisites. Session reference validation enforces task/topic ownership. One reusable trigger maintains `updated_at`. Indexes cover owner/date/status and child lookups.

Authenticated grants allow only appropriate fields and operations. Verification fields, assistant messages, task timestamps and session clocks have no direct browser write grants. `set_task_status` and `start_focus_session` are narrowly scoped security-definer transactions with explicit `auth.uid()` ownership checks and an empty search path. Session duration is generated by PostgreSQL from server timestamps. Starting duplicate active sessions is rejected; completing a task closes its active session and updates actual minutes atomically. Task/session creation beyond these existing actions remains a future trusted planner responsibility.

## Data access and cache

Pages use React Query hooks → services → one Supabase client → RLS-protected PostgreSQL. Reads use one snapshot RPC per page:

| Page | RPC | Fresh for |
| --- | --- | --- |
| Home | `get_home_snapshot()` | 45 seconds |
| Roadmap | `get_roadmap_snapshot()` | 60 seconds |
| Today | `get_today_snapshot(p_date)` | 30 seconds |
| Knowledge | `get_knowledge_snapshot()` | 60 seconds |
| Progress | `get_progress_snapshot(p_range)` | 60 seconds |
| Settings | `get_settings_snapshot()` | 180 seconds |
| ATHENA history | `get_athena_snapshot(p_conversation_id)` | 60 seconds |

Snapshot functions use security invoker and owner scoping. Settings account email, creation time and provider are selected from the central session's safe user fields, without another Auth request; tokens and arbitrary metadata are never added to page data. The database owns profile name and learning preferences. Notification preferences store consent only; email/WhatsApp delivery controls remain unavailable.

One QueryClient retains inactive queries for 10 minutes, retries failed reads once, disables window-focus refetch, and refetches stale data on mount/reconnect. Requests with the same key share one in-flight promise. Reads can complete into the cache after page navigation, avoiding StrictMode/navigation cancellation churn; identity changes cancel queries and clear the entire in-memory cache before publishing the next identity. Keys include user ID and date/range where relevant. No cache persistence, polling or Realtime subscriptions are enabled. Study dates use Asia/Kolkata consistently in SQL and the frontend.

Writes wait for database acknowledgment and invalidate only related keys:

- Task/session: Today, Home, Progress.
- Knowledge self-report: Knowledge, Home.
- Roadmap topic: Roadmap, Home, Progress.
- Profile/preferences/notification settings: Settings.

Home renders only cards backed by non-null snapshot data. Missing analytics produce empty states. No simulated greeting identity, streak, progress percentage, task list or mentor suggestion is supplied. Streak metrics are omitted until the database provides them. ATHENA history is capped at 100 messages; Progress history at 50 sessions. Future large roadmap/knowledge collections will require pagination.

## Scheduled database health

`.github/workflows/supabase-keepalive.yml` makes **one** timestamp-only database RPC request at `17 2,10,18 * * *` UTC (07:47, 15:47 and 23:47 Asia/Kolkata), or through `workflow_dispatch`. It has no retries or loops and reads no personal tables. The publishable key goes in `apikey`, not `Authorization: Bearer`: [new keys are not JWTs](https://supabase.com/docs/guides/getting-started/api-keys). Only `anon` and `authenticated` receive execute permission on `project_keepalive()`.

Configure repository secrets interactively:

```powershell
gh secret set SUPABASE_URL --repo eswarb-dev/PROMETHEUS-ATHENA
gh secret set SUPABASE_PUBLISHABLE_KEY --repo eswarb-dev/PROMETHEUS-ATHENA
gh workflow run supabase-keepalive.yml --repo eswarb-dev/PROMETHEUS-ATHENA
gh run list --repo eswarb-dev/PROMETHEUS-ATHENA --workflow=supabase-keepalive.yml --limit 3
```

No secret/service key is needed. [Free Supabase projects may pause after low activity over seven days; Pro prevents automatic pausing](https://supabase.com/docs/guides/platform/free-project-pausing). This request checks database health and supplies minimal activity. [GitHub schedules may be delayed or dropped, and inactive public repositories can have schedules disabled](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule). This is best effort, not an uptime SLA or a guarantee against pausing. Paid Supabase plans are the official no-auto-pause solution.

## Verification

```powershell
npm test
npm run build
npm run lint
```

`npm test` runs seven tests covering Auth request/error contracts and URL safety, plus the actual migrations in disposable PGlite PostgreSQL. Database checks include RLS, anonymous denial, cross-user/child ownership, protected verification fields, snapshots, keepalive, server-clock sessions, profile provisioning and atomic/idempotent verified onboarding. Cache tests cover request deduplication, expiry, identity cancellation and targeted invalidation. Test Auth scaffolding and fixture records exist only in isolated tests. These tests do not contact Supabase or use production data.

Phase 13 Chrome checks passed with intercepted Supabase Auth responses and snapshots backed by disposable PostgreSQL: invalid credentials, signup mismatch validation, masked eight-cell OTP, incomplete/expired/missing-session/successful verification, resend cooldown, duplicate-submit protection, authenticated Stepper without password fields, final onboarding handoff, session restore, logout, complete/incomplete routing and User A/User B isolation. Recovery exercised the actual SDK callback parser and PASSWORD_RECOVERY event, then password update and application continuation. Login/OTP Enter submission works. Auth layouts were checked at 320/390/768/1440 widths and 812×375 landscape. Normal/reduced motion and the forced frosted fallback path were tested in Chromium; native Firefox/Safari were not run. No runtime, unexpected console or context-loss errors were observed; intentionally rejected Auth requests produced expected HTTP errors. Local scripts/screenshots remain outside the production application.

Phase 12 local Chrome checks passed with intercepted Supabase requests backed by disposable PostgreSQL: seven pages with no session issue zero database requests; each authenticated page performs one initial snapshot; fresh navigation uses cache; Home refetches after expiry; task writes refresh Today/Home/Progress while retaining Settings/Knowledge; profile saves refresh only Settings; sign-out clears owner cache. Missing configuration also produces seven controlled unavailable states. Widths 320, 390, 768 and 1440 were checked, with all seven authenticated pages checked at 320/768/1440. No runtime or console errors were observed. These browser scripts and screenshots are local verification artifacts outside the application, not production fixtures.

At the Phase 13 checkpoint, six migrations were deployed and hosted template customization was blocked by the default email provider. Phase 12 publishable-key checks verified keepalive and anonymous denial for private tables, the skills view and Home snapshot. Phase 14 replaces that provider with the user-configured custom SMTP and adds the seventh migration; see the mail section below for current validation boundaries. Existing upstream React Bits lint warnings are separate from runtime errors. The build passes with Vite's warning that the main bundle exceeds 500 kB; the application shell is separately loaded.

Component sources: [Soft Aurora](https://reactbits.dev/backgrounds/soft-aurora), [Dock](https://reactbits.dev/components/dock), [MagicBento](https://reactbits.dev/components/magic-bento), [Stepper](https://reactbits.dev/components/stepper) and the previously integrated React Bits controls. Indigo/cyan over `#080D1A` preserves the requested academic identity; layout leaves room for the vertical Dock on narrow screens. Design settings: ENERGY 1 / RHYTHM 1 / MOTION 2.

# Phase 14: PROMETHEUS Mail

Supabase Auth sends signup verification, password recovery, password-changed and email-changed messages through custom Gmail SMTP: `smtp.gmail.com:465`, sender `PROMETHEUS // ATHENA <prometheus.inference@gmail.com>`. The selectable verification code comes from Supabase Auth; the configured length is eight digits. Branded inline HTML lives in `supabase/templates/`. Auth owns OTP generation, expiry, rate limits and recovery links.

Application welcome mail uses `send-welcome-email`, a separate authenticated Edge Function. It verifies the bearer token using Auth `getUser`, derives the recipient from that user, and claims a database outbox row through service-only RPCs. It accepts no recipient or user ID. A profile transition to completed queues the row only for verified accounts, inside the onboarding transaction. Existing completed accounts are not backfilled.

The private RLS-enabled `transactional_mail_log` stores operational metadata only. Its unique `(user_id, mail_type)` constraint and locked claims prevent concurrent duplicate sends. Temporary pre-delivery failures allow at most three attempts, with 60/120-second delays. Due retries happen on a later authenticated app load; there is no background scheduler. Mail failure never rolls back onboarding. SMTP cannot guarantee exactly-once delivery: ambiguous outcomes and interrupted acknowledgements remain locked for operator reconciliation, without automatic resends.

Auth SMTP credentials live in Supabase Authentication settings. Edge Functions require separate Supabase secrets named `PROMETHEUS_MAIL_FROM`, `PROMETHEUS_SMTP_HOST`, `PROMETHEUS_SMTP_PORT`, `PROMETHEUS_SMTP_USER`, and `PROMETHEUS_SMTP_PASSWORD`. Use the sender above, Gmail host, port 465 and a Google App Password from the account with 2-Step Verification enabled. Never use the regular Google password. Never place mail credentials in Vite variables, frontend files, database rows or Git. The platform-provided service-role key stays inside the function. Optional `ATHENA_APP_URL` controls the trusted welcome link and browser origin; its default is `http://localhost:5173`. Set it to the deployed application origin before production use.

Personal Gmail is an initial small-scale transport with provider sending limits. No tracking, inbox access, Gmail OAuth, AI replies or reasoning providers are included. Future `mail_threads`, `mail_messages` and `mail_agent_runs` belong to Phase 15; those tables are not created here.

Validation: `npm test`, `npm run build`, `npm run lint`; Edge checks: `npx deno check --config supabase/functions/deno.json supabase/functions/send-welcome-email/index.ts` and `npx deno test --config supabase/functions/deno.json supabase/functions/_shared/mail/mail_test.ts`. Isolated PostgreSQL and SMTP unit tests do not prove live inbox delivery. Hosted signup, OTP, recovery and welcome delivery require an explicitly approved test mailbox and actual inbox confirmation; never infer delivery from a saved setting or HTTP success.

Phase 14 hosted checks: custom SMTP fields match the intended sender/host/port, all four Auth templates were accepted, migration history includes the mail foundation and learning-direction correction, and the welcome function is active with its separate SMTP secrets configured. Real signup and recovery requests to the explicitly approved test mailbox returned HTTP 200; signup required verification and did not create an authenticated session. Anonymous and invalid-token welcome requests returned 401. Inbox receipt, correct OTP, completed recovery/login, and live welcome deduplication require separate confirmation.

## Production deployment and onboarding correction

Production origin: https://prometheus-athena.eswarbalu28.workers.dev. Cloudflare reports this existing Git-connected project as a Worker, rather than Pages. The application remains a Vite SPA: `npm run build` writes `dist`, and `npx wrangler deploy` serves those static assets with SPA fallback. No backend Worker handler was added. Git integration tracks `eswarb-dev/PROMETHEUS-ATHENA`, branch `main`.

Workers Builds must provide the public build variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_AUTH_OTP_LENGTH=8`. These are compiled into the browser bundle. Keep Cloudflare tokens, SMTP credentials and Supabase service-role keys out of all `VITE_*` variables. Local `.env` and Wrangler state are ignored. The local Cloudflare automation token is used only for authenticated API operations, never as a build variable.

Supabase Site URL uses the production origin. Redirects include its root and `/**`, plus `http://localhost:5173/**` and `http://127.0.0.1:5173/**`. Auth redirect destinations come from the current browser origin and fixed application state. The welcome function's `ATHENA_APP_URL` uses production while retaining the two known development origins for CORS.

Signup email presents Supabase's eight-digit token first and includes its confirmation-link fallback. A verified session clears stale Auth URL errors. Returning focus or visibility to the verification screen performs one debounced session check without continuous polling.

Onboarding supports one to three directions, including custom names, with one explicitly stored primary. The `user_learning_directions` table has owner-only reads; validated RPCs write complete direction sets atomically. Unique normalized names, a unique primary index and a deferred constraint enforce the set. Existing single directions migrate to one primary row. `profiles.direction` remains a synchronized primary-name compatibility field; direct browser writes to that column are revoked. Settings can display and edit directions, and active-roadmap snapshots include the learning profile.

Skills use chip selection, an inline custom input, compact proficiency groups and removal controls. Editors use two columns on desktop and one on mobile. Starting from scratch clears skills and disables selection; both client normalization and onboarding RPC reject a scratch payload containing skills. Self-reported levels remain separate from diagnostic verification.

Correction checks passed: twelve automated tests, build and lint (existing upstream warnings), and isolated Chromium regression checks at 1440/1024/768/390/320 pixels without horizontal overflow or unexpected console errors. These fixture-backed checks cover Auth callbacks, focus/visibility session detection, stale URL cleanup, onboarding, Settings, logout/login and recovery routing. They do not establish live inbox delivery or completed real-account verification. Production root and SPA fallback initially returned HTTP 200 with the expected public Supabase configuration and no browser console errors; fresh deployment checks are recorded separately when complete.

Production verification on 2026-10-19: all three public Workers Builds variables were verified, and the Git-triggered builds for `eb314a3` and `a871374` succeeded. Production root and SPA fallback returned HTTP 200 after deployment. After an initial invalid-credentials response, the mailbox owner completed recovery through the production reset screen and updated the local test credential. Live production login, three-direction onboarding, scratch-mode controls, profile completion, session restoration, logout and repeat login/logout then passed without JavaScript or console errors. The welcome function reported `sent`; two subsequent requests returned `no_delivery_due`, and an authenticated caller-supplied recipient was rejected with HTTP 400. The recovery request itself returned HTTP 200 with the production `/?auth=reset` redirect. Inbox confirmation of welcome delivery and a fresh signup/OTP test using a second explicitly approved mailbox remain separate requirements. No password, OTP, recovery link, SMTP credential or Cloudflare token is included in test output or source control.

The mailbox owner subsequently confirmed welcome receipt with correct sender and branding. Fresh production signup using a second explicitly approved test address returned HTTP 200, showed eight OTP cells, and completed verification with a real user-entered code (HTTP 200). The resulting authenticated session routed to onboarding without runtime errors and was signed out (HTTP 204). No profile was submitted for this second account. The test password existed only transiently for signup; neither it nor the OTP was printed or saved. The confirmation template includes both code and link. A separate successful click-through of that signup link was not performed after OTP verification consumed the challenge; callback/session detection remains covered by the isolated browser regression checks.

## Personalization and reminders

Onboarding retains Account / Direction / Skills / Preferences / Review. Skills use two columns on desktop/tablet and one on mobile, case-insensitive custom-name deduplication, removal, self-reported proficiency and exclusive scratch mode. Shared compact selects power onboarding and Settings. Reminder choices are Email, WhatsApp, Both (recommended), and None; the recommendation never preselects consent. WhatsApp requires an E.164 number, stored privately under owner RLS with verification initially false. Settings controls reminder consent, weekly reports, timezone and an optional time override. Existing preferences are preserved; null legacy flags become false, with no automatic opt-in.

`get_user_learning_context()` is the canonical owner-scoped learning context used by Today, Roadmap and ATHENA history snapshots. It includes directions, goal, self-reported versus verified skills, study preferences, planner policy and mentor strategy; it excludes email addresses and phone numbers. Daily minutes bound required planning, task size bounds generated tasks, study period controls reminder timing, and learning style selects practical-first, concept-first, balanced or exercise/checkpoint instructions. `plan_today_from_roadmap()` uses real active roadmap topics and completed prerequisites, creates tasks only for the user's local today, and deduplicates topic planning. Excess or unknown-duration work is labelled optional; explicit optional tasks do not consume the required budget. Saved roadmap estimates expose pacing and estimated study days. Settings invalidates affected snapshots. ATHENA reasoning/chat remains disconnected and read-only: deterministic policy tests do not establish a working LLM integration.

The Supabase-side `athena-reminder-dispatch` cron job runs every five minutes through pg_cron/pg_net. Vault stores `athena_reminder_endpoint` and `athena_reminder_scheduler_secret`; the matching `ATHENA_REMINDER_SCHEDULER_SECRET` lives only in Edge Function secrets. Browser requests require a verified Supabase session and may request only a once-per-local-day test to their own verified address. Scheduler calls use the separate secret. There is no arbitrary recipient API. Never expose these credentials or SMTP settings through `VITE_*` variables.

`reminder_runtime` is private operational configuration. Email and scheduling are enabled after SMTP verification; WhatsApp stays disabled. Jobs are created only for verified, onboarded users with explicit channel and event consent. Scheduling uses the stored timezone and preferred time, or morning 09:00 / afternoon 14:00 / evening 18:00 / night 21:00 / flexible 18:00. A 15-minute catch-up window covers ordinary cron delays. Real incomplete required tasks trigger study reminders; a gentle two-hour follow-up is limited to budgets above 60 minutes without a study session. Sunday weekly reminders require actual recent completed study history. There are no fabricated reminders for empty accounts.

`reminder_jobs` deduplicates owner/event/window/target; `reminder_deliveries` stores separate Email and WhatsApp outcomes. Both fans out independently, so a WhatsApp setup failure cannot mark Email failed or sent. None creates no sends. Claims use row locks, recheck consent and readiness, and expire after 24 hours. Known transient failures retry at most three attempts. Ambiguous delivery remains `unknown_delivery` (or an unacknowledged `sending` claim) and is not automatically reclaimed, avoiding duplicate mail after uncertain provider acceptance. Consent withdrawal cancels queued retries; it cannot recall an in-flight send. Logs contain delivery metadata and safe error codes, not recipients, bodies, prompts or secrets. Owner-only read policies and restricted server RPCs protect the queue.

`dispatch-reminders` shares the existing pinned Nodemailer transport and fixed PROMETHEUS sender with welcome mail. It processes up to three deliveries per invocation; increase capacity deliberately if sustained queue volume exceeds this small-project limit. The provider-neutral WhatsApp adapter accepts allowlisted reminder templates only, uses delivery IDs for idempotency, and requires `ATHENA_WHATSAPP_PROVIDER_URL`, `ATHENA_WHATSAPP_PROVIDER_TOKEN` and `ATHENA_WHATSAPP_SENDER_ID`. Provider setup, a trusted number-verification integration and explicit operational activation are future work; saving a number does not verify it or enable delivery. Channel mode is `REMINDERS_ONLY`. WhatsApp AI chat, inbound processing, Gmail inbox automation and inbound AI email are absent. Outbound transport/template boundaries permit a future separate email feature without enabling it now.

Validation on 2026-10-19: sixteen Node/PostgreSQL tests and seven Deno mail/reminder tests passed; both Edge Functions type-check. Tests cover 30-minute/build-first/quick versus 90-minute/theory-first/deep policies, owner isolation, phone privacy, timezone scheduling, fan-out, consent withdrawal, bounded retry, duplicate prevention and onboarding replay. Responsive Chromium fixture checks cover 1440/1024/768/390/320 pixels, onboarding and synchronized Settings. Ten selected skills measured 70 px shorter on desktop/tablet and 140 px shorter on mobile than the prior card spacing. Hosted migrations and both functions were deployed. Cron is active and a scheduled dispatcher request returned HTTP 200. A real test reminder to the explicitly approved primary mailbox was accepted once; repeating it returned `no_delivery_due`. Original account preferences were restored. The mailbox owner confirmed receipt, sender, branding and working production link. WhatsApp behavior is fixture-tested only; no live WhatsApp delivery occurred.

Visual regression checking also found the existing SpecularButton forced its WebGL context lost during React's development remount. Cleanup still deletes buffers/programs, but no longer explicitly loses the reusable canvas context. Chromium checks inspect actual WebGL context state in addition to console errors.

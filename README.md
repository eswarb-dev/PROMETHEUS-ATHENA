# PROMETHEUS // ATHENA

Phase 13: Supabase browser authentication, protected session routing and verified-account onboarding. The existing midnight Aurora, Dock, MagicBento, Stepper, Spotlight, task controls and charts retain their visual identity. No production demo records are supplied.

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

**Hosted email limitation:** Supabase rejected template customization with: "Email template modification is not available for free tier projects using the default email provider." The current confirmation email therefore retains its standard confirmation link; the verification screen supports that link and also provides OTP entry. The branded confirmation template containing `{{ .Token }}` and the recovery template containing `{{ .ConfirmationURL }}` are prepared in `supabase/templates/`, but are **not deployed**. A full `supabase config push` will fail on these pending templates until the provider/plan supports them. Development redirects and the eight-character password policy were applied separately. Custom SMTP, Gmail credentials, custom transactional welcome mail and AI email automation are excluded from this phase.

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

Hosted migration history matches all six local migrations. Live metadata checks confirm the new profile trigger, completion column and owner-only auth/onboarding RPC permissions. Phase 12 publishable-key checks verified keepalive and anonymous denial for all private tables, the skills view and Home snapshot. No hosted test accounts or user records were created. Live signup, inbox delivery, actual email-code verification and real-account recovery/logout remain untested: the user has not supplied an approved disposable development address. Hosted OTP template customization is blocked as described above. Existing upstream React Bits lint warnings are separate from runtime errors. The build passes with Vite's warning that the main bundle exceeds 500 kB; the application shell is separately loaded, and further bundle splitting remains possible.

Component sources: [Soft Aurora](https://reactbits.dev/backgrounds/soft-aurora), [Dock](https://reactbits.dev/components/dock), [MagicBento](https://reactbits.dev/components/magic-bento), [Stepper](https://reactbits.dev/components/stepper) and the previously integrated React Bits controls. Indigo/cyan over `#080D1A` preserves the requested academic identity; layout leaves room for the vertical Dock on narrow screens. Design settings: ENERGY 1 / RHYTHM 1 / MOTION 2.

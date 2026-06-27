import { neon } from "@neondatabase/serverless";

export type WorkItemType = "Bug" | "Task" | "User Story" | "Feature";
export type WorkItemState = "Backlog" | "In Progress" | "Done";
export type Priority = 1 | 2 | 3 | 4;
export type ProjectKey =
  | "Platform"
  | "Editorial"
  | "Compliance"
  | "Infrastructure";

export const PROJECTS: ProjectKey[] = [
  "Platform",
  "Editorial",
  "Compliance",
  "Infrastructure",
];

export const TEAM_MEMBERS = [
  "Pooja Iyer",
  "Sharath Krishnan",
  "Priya Menon",
  "Mei Lin",
  "James O'Connor",
  "Anna Kowalski",
  "Devon Walsh",
  "Ravi Subramanian",
] as const;

export type TimesheetStatus = "Draft" | "Submitted" | "Approved";

export interface TimesheetEntry {
  id: number;
  user_name: string;
  work_date: string;
  project: ProjectKey;
  task: string;
  hours: number;
  status: TimesheetStatus;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: number;
  project: ProjectKey;
  type: WorkItemType;
  title: string;
  description: string;
  assignee: string;
  state: WorkItemState;
  priority: Priority;
  tag: string;
  created_at: string;
  updated_at: string;
}

function getSql() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL (or POSTGRES_URL) is not set. Connect a Neon database in Vercel → Storage.",
    );
  }
  return neon(url);
}

let initialized = false;

export async function ensureSchema(): Promise<void> {
  if (initialized) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS tickets (
      id          SERIAL PRIMARY KEY,
      type        TEXT NOT NULL DEFAULT 'Task',
      title       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      assignee    TEXT NOT NULL DEFAULT 'Unassigned',
      state       TEXT NOT NULL DEFAULT 'Backlog',
      priority    INTEGER NOT NULL DEFAULT 2,
      tag         TEXT NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS project TEXT NOT NULL DEFAULT 'Platform'
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS timesheets (
      id          SERIAL PRIMARY KEY,
      user_name   TEXT NOT NULL,
      work_date   DATE NOT NULL,
      project     TEXT NOT NULL DEFAULT 'Platform',
      task        TEXT NOT NULL DEFAULT '',
      hours       NUMERIC(4,2) NOT NULL DEFAULT 0,
      status      TEXT NOT NULL DEFAULT 'Draft',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_timesheets_user_date
      ON timesheets (user_name, work_date)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS meta_flags (
      flag        TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  initialized = true;
}

const STALE_CLOSURES_V1 = [
  "Login page intermittently returns 500",
  "Server-side rendering for article preview",
  "Skip-to-content link not visible on focus",
  "Login form overflows viewport on iPhone SE (320px)",
  "Live region missing for async toast notifications",
  "PDF export drops footnotes in legal briefs",
  "WYSIWYG toolbar unreachable on iPad in portrait",
  "Publish-confirmation modal has no focus trap",
  "Sanctions screening: add UK OFSI list",
  "PEP match false-positive rate jumped after model refresh",
  "Risk indicator uses color-only encoding",
  "Sanctions filter sidebar covers content on mobile",
  "Migrate batch jobs from cron to Temporal",
  "Status dashboard uses color-only health indicators",
  "Incident command console overflows on phones",
];

async function applyStaleClosuresOnce(): Promise<void> {
  const sql = getSql();
  const flag = "stale_closures_v1";
  const seen = (await sql`SELECT 1 FROM meta_flags WHERE flag = ${flag}`) as unknown[];
  if (seen.length > 0) return;
  for (const title of STALE_CLOSURES_V1) {
    await sql`
      UPDATE tickets
         SET state = 'Done', updated_at = NOW()
       WHERE title = ${title} AND state <> 'Done'
    `;
  }
  await sql`INSERT INTO meta_flags (flag) VALUES (${flag}) ON CONFLICT DO NOTHING`;
}

export async function listTimesheetEntries(
  user: string,
  fromDate: string,
  toDate: string,
): Promise<TimesheetEntry[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, user_name, work_date::text AS work_date, project, task, hours,
           status, created_at, updated_at
    FROM timesheets
    WHERE user_name = ${user}
      AND work_date BETWEEN ${fromDate} AND ${toDate}
    ORDER BY work_date ASC, id ASC
  `) as TimesheetEntry[];
  return rows.map((r) => ({ ...r, hours: Number(r.hours) }));
}

export async function upsertTimesheetEntry(
  input: Partial<TimesheetEntry>,
): Promise<TimesheetEntry> {
  await ensureSchema();
  const sql = getSql();
  if (input.id) {
    const rows = (await sql`
      UPDATE timesheets
         SET project    = COALESCE(${input.project ?? null}, project),
             task       = COALESCE(${input.task ?? null}, task),
             hours      = COALESCE(${input.hours ?? null}, hours),
             status     = COALESCE(${input.status ?? null}, status),
             updated_at = NOW()
       WHERE id = ${input.id}
   RETURNING id, user_name, work_date::text AS work_date, project, task, hours,
             status, created_at, updated_at
    `) as TimesheetEntry[];
    const row = rows[0];
    return { ...row, hours: Number(row.hours) };
  }
  const {
    user_name = "Pooja Iyer",
    work_date = new Date().toISOString().slice(0, 10),
    project = "Platform",
    task = "",
    hours = 0,
    status = "Draft",
  } = input;
  const rows = (await sql`
    INSERT INTO timesheets (user_name, work_date, project, task, hours, status)
    VALUES (${user_name}, ${work_date}, ${project}, ${task}, ${hours}, ${status})
    RETURNING id, user_name, work_date::text AS work_date, project, task, hours,
              status, created_at, updated_at
  `) as TimesheetEntry[];
  const row = rows[0];
  return { ...row, hours: Number(row.hours) };
}

export async function deleteTimesheetEntry(id: number): Promise<boolean> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`DELETE FROM timesheets WHERE id = ${id} RETURNING id`) as { id: number }[];
  return rows.length > 0;
}

export async function setWeekStatus(
  user: string,
  fromDate: string,
  toDate: string,
  status: TimesheetStatus,
): Promise<number> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    UPDATE timesheets
       SET status = ${status}, updated_at = NOW()
     WHERE user_name = ${user}
       AND work_date BETWEEN ${fromDate} AND ${toDate}
 RETURNING id
  `) as { id: number }[];
  return rows.length;
}

export async function listTickets(project?: ProjectKey): Promise<Ticket[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = project
    ? ((await sql`
        SELECT id, project, type, title, description, assignee, state, priority,
               tag, created_at, updated_at
        FROM tickets
        WHERE project = ${project}
        ORDER BY priority ASC, id DESC
      `) as Ticket[])
    : ((await sql`
        SELECT id, project, type, title, description, assignee, state, priority,
               tag, created_at, updated_at
        FROM tickets
        ORDER BY priority ASC, id DESC
      `) as Ticket[]);
  return rows;
}

export async function createTicket(input: Partial<Ticket>): Promise<Ticket> {
  await ensureSchema();
  const sql = getSql();
  const {
    project = "Platform",
    type = "Task",
    title = "Untitled work item",
    description = "",
    assignee = "Unassigned",
    state = "Backlog",
    priority = 2,
    tag = "",
  } = input;
  const rows = (await sql`
    INSERT INTO tickets (project, type, title, description, assignee, state, priority, tag)
    VALUES (${project}, ${type}, ${title}, ${description}, ${assignee}, ${state}, ${priority}, ${tag})
    RETURNING id, project, type, title, description, assignee, state, priority, tag,
              created_at, updated_at
  `) as Ticket[];
  return rows[0];
}

export async function updateTicket(
  id: number,
  patch: Partial<Ticket>,
): Promise<Ticket | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    UPDATE tickets
       SET project     = COALESCE(${patch.project ?? null}, project),
           type        = COALESCE(${patch.type ?? null}, type),
           title       = COALESCE(${patch.title ?? null}, title),
           description = COALESCE(${patch.description ?? null}, description),
           assignee    = COALESCE(${patch.assignee ?? null}, assignee),
           state       = COALESCE(${patch.state ?? null}, state),
           priority    = COALESCE(${patch.priority ?? null}, priority),
           tag         = COALESCE(${patch.tag ?? null}, tag),
           updated_at  = NOW()
     WHERE id = ${id}
 RETURNING id, project, type, title, description, assignee, state, priority, tag,
           created_at, updated_at
  `) as Ticket[];
  return rows[0] ?? null;
}

export async function deleteTicket(id: number): Promise<boolean> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`DELETE FROM tickets WHERE id = ${id} RETURNING id`) as { id: number }[];
  return rows.length > 0;
}

export async function seedIfEmpty(): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  const existing = (await sql`SELECT title FROM tickets`) as { title: string }[];
  const existingTitles = new Set(existing.map((r) => r.title));
  const missing = SEED_TICKETS.filter((t) => !existingTitles.has(t.title!));
  for (const t of missing) {
    await createTicket(t);
  }
  await applyStaleClosuresOnce();
}

const SEED_TICKETS: Array<Partial<Ticket>> = [
  // ---------- Platform ----------
  { project: "Platform", type: "Bug", title: "Login page intermittently returns 500", description: "Customers report sporadic 500 errors on /auth/login during peak hours. Logs show DB pool exhaustion.", assignee: "Priya Menon", state: "In Progress", priority: 1, tag: "auth" },
  { project: "Platform", type: "User Story", title: "As an editor I want to schedule article publishing", description: "Editors should be able to set a future publish date/time on draft articles. Surfaces in the editorial calendar.", assignee: "James O'Connor", state: "Backlog", priority: 2, tag: "newsroom" },
  { project: "Platform", type: "Task", title: "Migrate search service to Node 20 runtime", description: "Bump base image and run perf regression against prod-like dataset.", assignee: "Ravi Subramanian", state: "Backlog", priority: 3, tag: "infra" },
  { project: "Platform", type: "Feature", title: "Server-side rendering for article preview", description: "Improve LCP on article preview pages by moving render to the edge.", assignee: "Mei Lin", state: "In Progress", priority: 2, tag: "performance" },
  { project: "Platform", type: "Task", title: "Adopt React 19 strict mode in admin app", description: "Audit effect cleanups, fix double-fire issues, ship behind flag.", assignee: "Devon Walsh", state: "Done", priority: 3, tag: "frontend" },
  // a11y
  { project: "Platform", type: "Bug", title: "Login button missing aria-label for screen readers", description: "The 'Sign in' button on /login is announced as 'unlabeled button' by VoiceOver and NVDA.", assignee: "Mei Lin", state: "Backlog", priority: 2, tag: "a11y" },
  { project: "Platform", type: "Bug", title: "Keyboard focus trap broken in user profile dropdown", description: "Tab key escapes the open dropdown and lands in the page footer. Should cycle within the menu.", assignee: "Devon Walsh", state: "Backlog", priority: 2, tag: "a11y" },
  { project: "Platform", type: "Bug", title: "Disabled button text fails WCAG AA color contrast", description: "Disabled buttons render at 2.8:1 contrast; need 3:1 minimum. Tokens audit needed across design system.", assignee: "Mei Lin", state: "Backlog", priority: 3, tag: "a11y" },
  { project: "Platform", type: "Bug", title: "Skip-to-content link not visible on focus", description: "Skip link exists in DOM but is permanently hidden, defeating its purpose for keyboard users.", assignee: "Devon Walsh", state: "In Progress", priority: 3, tag: "a11y" },
  // responsive
  { project: "Platform", type: "Bug", title: "Login form overflows viewport on iPhone SE (320px)", description: "Right edge of email/password inputs gets cut off. Reproducible on iOS Safari 16 at 320×568.", assignee: "Mei Lin", state: "In Progress", priority: 2, tag: "responsive" },
  { project: "Platform", type: "Bug", title: "Top navigation bar overlaps article content on iOS Safari", description: "When address bar collapses on scroll, sticky header eats first 56px of article.", assignee: "Devon Walsh", state: "Backlog", priority: 2, tag: "responsive" },
  { project: "Platform", type: "Bug", title: "Admin sidebar covers main content on tablets in portrait", description: "768px–1023px range: sidebar should collapse to hamburger but stays open at 240px wide.", assignee: "Priya Menon", state: "Backlog", priority: 3, tag: "responsive" },
  { project: "Platform", type: "Task", title: "Add Playwright a11y smoke tests with @axe-core", description: "Wire axe into our existing Playwright suite. Fail CI on serious/critical violations.", assignee: "Ravi Subramanian", state: "Backlog", priority: 3, tag: "a11y" },

  // ---------- Editorial ----------
  { project: "Editorial", type: "Bug", title: "PDF export drops footnotes in legal briefs", description: "Reported by editorial. Reproducible with brief IDs in attached comment.", assignee: "Mei Lin", state: "In Progress", priority: 2, tag: "export" },
  { project: "Editorial", type: "User Story", title: "Editor receives Slack alert when their draft is reviewed", description: "Send a Slack DM with deep link to the doc when reviewer status changes.", assignee: "Anna Kowalski", state: "Backlog", priority: 2, tag: "notifications" },
  { project: "Editorial", type: "Feature", title: "Inline citations from Westlaw connector", description: "Allow editors to drop a citation chip that resolves via the Westlaw search API.", assignee: "James O'Connor", state: "Backlog", priority: 2, tag: "citations" },
  { project: "Editorial", type: "Task", title: "Rewrite legacy markdown converter in Rust", description: "Old converter chokes on >5MB docs. Rewrite for streaming.", assignee: "Ravi Subramanian", state: "Done", priority: 3, tag: "tooling" },
  // a11y
  { project: "Editorial", type: "Bug", title: "Screen reader skips footnote markers in article preview", description: "Superscript footnote markers render with aria-hidden by accident. JAWS users miss them entirely.", assignee: "Mei Lin", state: "Backlog", priority: 1, tag: "a11y" },
  { project: "Editorial", type: "Bug", title: "Publish-confirmation modal has no focus trap", description: "Opening the confirm modal leaves keyboard focus on the underlying page. Users can tab outside.", assignee: "James O'Connor", state: "In Progress", priority: 2, tag: "a11y" },
  { project: "Editorial", type: "Bug", title: "Editor toolbar lacks keyboard shortcut announcements", description: "Bold/italic/link buttons have shortcuts but no aria-keyshortcuts attribute. Hidden from assistive tech.", assignee: "Mei Lin", state: "Backlog", priority: 3, tag: "a11y" },
  { project: "Editorial", type: "Bug", title: "Image alt-text field has no validation in upload modal", description: "Editors can save images with empty alt text. Add required-by-default with explicit 'decorative' opt-out.", assignee: "Anna Kowalski", state: "Backlog", priority: 2, tag: "a11y" },
  // responsive
  { project: "Editorial", type: "Bug", title: "WYSIWYG toolbar unreachable on iPad in portrait", description: "Toolbar overflows off-screen at 768×1024 with no horizontal scroll on the toolbar row.", assignee: "Mei Lin", state: "In Progress", priority: 1, tag: "responsive" },
  { project: "Editorial", type: "Bug", title: "Article preview forces horizontal scroll under 480px", description: "Tables in articles overflow viewport. Need responsive table wrapper or horizontal scroll on table itself.", assignee: "James O'Connor", state: "Backlog", priority: 2, tag: "responsive" },
  { project: "Editorial", type: "Bug", title: "Image upload modal not scrollable on mobile", description: "Modal exceeds viewport height on phones; submit button sits below the fold and can't be reached.", assignee: "Mei Lin", state: "Backlog", priority: 2, tag: "responsive" },
  { project: "Editorial", type: "Bug", title: "Comment thread sidebar pushes content off-screen on tablets", description: "Opening comments sidebar at 800px width covers the article column completely.", assignee: "Anna Kowalski", state: "Backlog", priority: 3, tag: "responsive" },
  { project: "Editorial", type: "Task", title: "Add Storybook viewport addon and responsive snapshots", description: "Snapshot key editor components at 320 / 768 / 1024 / 1440 to catch regressions.", assignee: "Devon Walsh", state: "Backlog", priority: 3, tag: "responsive" },

  // ---------- Compliance ----------
  { project: "Compliance", type: "Feature", title: "Sanctions screening: add UK OFSI list", description: "Add weekly ingestion from UK OFSI consolidated list into the sanctions screening pipeline.", assignee: "Anna Kowalski", state: "In Progress", priority: 1, tag: "sanctions" },
  { project: "Compliance", type: "Bug", title: "PEP match false-positive rate jumped after model refresh", description: "After last week's name-matching model refresh, PEP false positives doubled. Roll back or tune threshold.", assignee: "Devon Walsh", state: "In Progress", priority: 1, tag: "screening" },
  { project: "Compliance", type: "Task", title: "GDPR DPIA for new audit log retention", description: "Complete impact assessment before extending retention from 1y to 7y.", assignee: "Priya Menon", state: "Backlog", priority: 2, tag: "gdpr" },
  { project: "Compliance", type: "User Story", title: "Auditor wants to export full evidence pack for a case", description: "Single-click export of all linked evidence for an audit case as a signed ZIP.", assignee: "Mei Lin", state: "Backlog", priority: 3, tag: "audit" },
  // a11y
  { project: "Compliance", type: "Bug", title: "Sanctions search results table missing semantic headers", description: "Results table uses <div>s instead of <th>. Screen readers can't announce column relationships.", assignee: "Devon Walsh", state: "Backlog", priority: 2, tag: "a11y" },
  { project: "Compliance", type: "Bug", title: "Date picker in audit log not announceable by JAWS", description: "Calendar widget uses div-buttons with no role; JAWS reads it as 'blank, blank, blank'.", assignee: "Mei Lin", state: "Backlog", priority: 2, tag: "a11y" },
  { project: "Compliance", type: "Bug", title: "Risk indicator uses color-only encoding", description: "Red/amber/green dots have no text label or shape difference. Color-blind users can't distinguish.", assignee: "Anna Kowalski", state: "In Progress", priority: 1, tag: "a11y" },
  { project: "Compliance", type: "Bug", title: "Case detail page missing landmark roles", description: "No main/nav/aside landmarks. Screen reader users have no way to skip the long sidebar.", assignee: "Devon Walsh", state: "Backlog", priority: 3, tag: "a11y" },
  // responsive
  { project: "Compliance", type: "Bug", title: "Audit log table not responsive below 768px", description: "10-column table forces horizontal scroll. Should collapse to card view on small screens.", assignee: "Priya Menon", state: "Backlog", priority: 2, tag: "responsive" },
  { project: "Compliance", type: "Bug", title: "Sanctions filter sidebar covers content on mobile", description: "Opening filters on phones shows full-screen overlay with no close button visible above fold.", assignee: "Mei Lin", state: "In Progress", priority: 2, tag: "responsive" },
  { project: "Compliance", type: "Bug", title: "Case timeline overflows viewport on phones", description: "Timeline events render in a fixed 1200px-wide grid. Phones get an unusable horizontal scroll.", assignee: "James O'Connor", state: "Backlog", priority: 2, tag: "responsive" },
  { project: "Compliance", type: "Task", title: "Add VPAT documentation for sanctions module", description: "Required by US federal customers. Capture WCAG 2.1 AA conformance for the sanctions UI.", assignee: "Anna Kowalski", state: "Backlog", priority: 3, tag: "a11y" },

  // ---------- Infrastructure ----------
  { project: "Infrastructure", type: "Task", title: "Rotate prod API keys for market data connector", description: "Quarterly rotation. Coordinate with downstream consumers.", assignee: "Devon Walsh", state: "Done", priority: 2, tag: "security" },
  { project: "Infrastructure", type: "Feature", title: "Migrate batch jobs from cron to Temporal", description: "Phase 1: move 12 daily jobs. Phase 2: backfill workflows.", assignee: "Ravi Subramanian", state: "In Progress", priority: 2, tag: "platform" },
  { project: "Infrastructure", type: "Bug", title: "k8s pod-eviction storm on us-east-1 cluster", description: "Cluster autoscaler dropped 40 pods in 2 minutes. Suspect bad node-group config.", assignee: "Priya Menon", state: "Backlog", priority: 1, tag: "k8s" },
  { project: "Infrastructure", type: "Task", title: "Enable VPC flow logs in all prod accounts", description: "Required for SOC2 evidence collection.", assignee: "Anna Kowalski", state: "Backlog", priority: 3, tag: "security" },
  // a11y on internal admin tools
  { project: "Infrastructure", type: "Bug", title: "Internal admin panel buttons have no accessible names", description: "Icon-only buttons in the cluster console fail screen reader audit. Add aria-label everywhere.", assignee: "Devon Walsh", state: "Backlog", priority: 3, tag: "a11y" },
  { project: "Infrastructure", type: "Bug", title: "Status dashboard uses color-only health indicators", description: "Healthy/degraded/down use only red/yellow/green. Add iconography + text for color-blind operators.", assignee: "Mei Lin", state: "In Progress", priority: 2, tag: "a11y" },
  { project: "Infrastructure", type: "Bug", title: "Build pipeline graph not navigable by keyboard", description: "Operators can't tab between pipeline stage nodes. Mouse-only currently.", assignee: "Ravi Subramanian", state: "Backlog", priority: 3, tag: "a11y" },
  // responsive on internal tools
  { project: "Infrastructure", type: "Bug", title: "Grafana embeds break out of container on small screens", description: "Embedded dashboards force min-width:1200px; overflow not clipped and breaks page layout under 1024px.", assignee: "Devon Walsh", state: "Backlog", priority: 3, tag: "responsive" },
  { project: "Infrastructure", type: "Bug", title: "Pipeline graph not pinch-zoomable on touch devices", description: "On-call engineers on tablets can't zoom into the build DAG. Add touch-action and pinch handlers.", assignee: "Ravi Subramanian", state: "Backlog", priority: 3, tag: "responsive" },
  { project: "Infrastructure", type: "Bug", title: "Incident command console overflows on phones", description: "On-call view is desktop-only. Need a phone-friendly read-only mode for after-hours pages.", assignee: "Priya Menon", state: "In Progress", priority: 2, tag: "responsive" },
  { project: "Infrastructure", type: "Task", title: "Stand up Lighthouse CI for all internal tools", description: "Add Lighthouse accessibility + performance budgets to CI. Fail on regression.", assignee: "Devon Walsh", state: "Backlog", priority: 3, tag: "a11y" },
  { project: "Infrastructure", type: "Feature", title: "Adopt design tokens for high-contrast theme", description: "Allow users to switch the admin UI to a WCAG AAA high-contrast theme.", assignee: "Anna Kowalski", state: "Backlog", priority: 3, tag: "a11y" },

  // ---------- Platform — additional a11y / responsive ----------
  { project: "Platform", type: "Bug", title: "Form validation errors not announced to screen readers", description: "Inline errors render visually but lack aria-live / role=alert. NVDA users submit invalid forms repeatedly.", assignee: "Mei Lin", state: "Backlog", priority: 2, tag: "a11y" },
  { project: "Platform", type: "Bug", title: "Heading hierarchy skips H1 to H3 on profile page", description: "Profile sections use H3 directly under H1. Breaks screen-reader document outline navigation.", assignee: "Devon Walsh", state: "Backlog", priority: 3, tag: "a11y" },
  { project: "Platform", type: "Bug", title: "Tooltip content invisible to screen readers", description: "Tooltips rendered with CSS-only :hover; no aria-describedby. Assistive tech misses the content entirely.", assignee: "Mei Lin", state: "Backlog", priority: 2, tag: "a11y" },
  { project: "Platform", type: "Bug", title: "Live region missing for async toast notifications", description: "Success/error toasts appear visually but are never announced. Add role=status / role=alert by severity.", assignee: "Devon Walsh", state: "In Progress", priority: 2, tag: "a11y" },
  { project: "Platform", type: "Bug", title: "Mobile nav touch targets below 44×44px WCAG threshold", description: "Hamburger items measure 32×32. Below WCAG 2.5.5 minimum; mis-taps reported by mobile users.", assignee: "Priya Menon", state: "Backlog", priority: 2, tag: "responsive" },
  { project: "Platform", type: "Bug", title: "Modal close button hidden at 200% browser zoom", description: "Users zooming to 200% per WCAG 1.4.4 lose access to the close X. Modal becomes a focus trap with no exit.", assignee: "Mei Lin", state: "Backlog", priority: 1, tag: "responsive" },
  { project: "Platform", type: "Bug", title: "Date picker calendar wider than viewport on Galaxy Fold cover screen", description: "At 280px width the month grid overflows. Add a compact mode for ≤320px viewports.", assignee: "Devon Walsh", state: "Backlog", priority: 3, tag: "responsive" },
  { project: "Platform", type: "Bug", title: "App ignores prefers-reduced-motion for transitions", description: "Animations run regardless of OS-level reduced motion preference. Causes nausea for vestibular users.", assignee: "Mei Lin", state: "Backlog", priority: 2, tag: "a11y" },

  // ---------- Editorial — additional a11y / responsive ----------
  { project: "Editorial", type: "Bug", title: "Autosave status has no live region", description: "Editor autosaves every 5s but 'Saved at HH:MM' is not announced. Add polite live region.", assignee: "James O'Connor", state: "Backlog", priority: 3, tag: "a11y" },
  { project: "Editorial", type: "Bug", title: "Alt-text input on image upload has no visible label", description: "Placeholder-only labels disappear once typing starts; sighted users with cognitive disabilities lose context.", assignee: "Mei Lin", state: "Backlog", priority: 2, tag: "a11y" },
  { project: "Editorial", type: "Bug", title: "Tab order broken in editor right sidebar", description: "Tab jumps from metadata panel to publish button skipping reviewer and tag fields entirely.", assignee: "Anna Kowalski", state: "In Progress", priority: 2, tag: "a11y" },
  { project: "Editorial", type: "Bug", title: "Empty H2 headings inserted by paste-from-Word breaks outline", description: "Pasting from Word leaves empty H2 tags. Strip them server-side or warn editor.", assignee: "James O'Connor", state: "Backlog", priority: 3, tag: "a11y" },
  { project: "Editorial", type: "Bug", title: "Inline citation popover not announceable by screen reader", description: "Popover appears on hover/focus but lacks aria-expanded and role=dialog. SR users hear nothing.", assignee: "Mei Lin", state: "Backlog", priority: 2, tag: "a11y" },
  { project: "Editorial", type: "Bug", title: "Right-click context menu clips off-screen near viewport edges", description: "Context menu opens at cursor with no edge-detection. Half the menu is unreachable near the right edge.", assignee: "Devon Walsh", state: "Backlog", priority: 3, tag: "responsive" },
  { project: "Editorial", type: "Bug", title: "Comment popover clipped on landscape phones", description: "On iPhone 14 landscape, comment thread popover renders below the fold and can't scroll.", assignee: "James O'Connor", state: "In Progress", priority: 2, tag: "responsive" },
  { project: "Editorial", type: "Bug", title: "Editor layout breaks when window resized below 480px while open", description: "Resizing during an active edit session triggers layout thrash; sidebar overlaps editor canvas.", assignee: "Mei Lin", state: "Backlog", priority: 2, tag: "responsive" },
  { project: "Editorial", type: "Bug", title: "Print stylesheet missing — articles unreadable on paper", description: "No @media print rules. Sidebar, nav and modals all print and waste pages.", assignee: "Anna Kowalski", state: "Backlog", priority: 3, tag: "responsive" },

  // ---------- Compliance — additional a11y / responsive ----------
  { project: "Compliance", type: "Bug", title: "Required form fields not marked with aria-required", description: "Mandatory fields show * visually but lack aria-required. Forms feel unpredictable to SR users.", assignee: "Devon Walsh", state: "Backlog", priority: 2, tag: "a11y" },
  { project: "Compliance", type: "Bug", title: "Error messages not associated with inputs via aria-describedby", description: "Inline errors render below inputs but aren't linked. SR users hear errors out of context.", assignee: "Anna Kowalski", state: "Backlog", priority: 2, tag: "a11y" },
  { project: "Compliance", type: "Bug", title: "Inline help icons not keyboard-focusable", description: "Help (?) icons trigger tooltips on hover only. Keyboard and SR users have no way to read the help text.", assignee: "Mei Lin", state: "Backlog", priority: 3, tag: "a11y" },
  { project: "Compliance", type: "Bug", title: "Sticky table headers fall off when scrolled on mobile", description: "position:sticky on <th> breaks inside overflow:auto container under iOS Safari < 17.", assignee: "Priya Menon", state: "Backlog", priority: 2, tag: "responsive" },
  { project: "Compliance", type: "Bug", title: "Risk score gauge not rendered on retina displays", description: "Canvas gauge uses raw pixel coords; renders blurry on 2x DPR and disappears on 3x DPR.", assignee: "Devon Walsh", state: "In Progress", priority: 2, tag: "responsive" },
  { project: "Compliance", type: "Bug", title: "Filter chips wrap awkwardly causing layout shift", description: "When chips wrap to a second row, the results table jumps down. CLS spikes above 0.25.", assignee: "Anna Kowalski", state: "Backlog", priority: 3, tag: "responsive" },
  { project: "Compliance", type: "Bug", title: "Modal dialogs not labelled (no aria-labelledby)", description: "Sanctions match modals open with no accessible name. JAWS reads 'dialog' with no context.", assignee: "Devon Walsh", state: "Backlog", priority: 2, tag: "a11y" },

  // ---------- Infrastructure — additional a11y / responsive ----------
  { project: "Infrastructure", type: "Bug", title: "Log viewer has no live region for streaming entries", description: "New log lines render silently. Add aria-live=polite with debounced announcement for SR users.", assignee: "Ravi Subramanian", state: "Backlog", priority: 3, tag: "a11y" },
  { project: "Infrastructure", type: "Bug", title: "Dropdown menus close on mouseleave, breaking keyboard users", description: "Menus dismiss on mouseleave even when keyboard focus is inside. Frustrating for non-mouse users.", assignee: "Devon Walsh", state: "Backlog", priority: 2, tag: "a11y" },
  { project: "Infrastructure", type: "Bug", title: "App keyboard shortcuts conflict with NVDA browse-mode keys", description: "Single-letter shortcuts ('r' to rerun) collide with NVDA region nav. Require modifier.", assignee: "Mei Lin", state: "Backlog", priority: 2, tag: "a11y" },
  { project: "Infrastructure", type: "Bug", title: "Terminal output panel doesn't wrap on phones", description: "On-call view shows fixed 120-col output. Phones get horizontal scroll with no word wrap toggle.", assignee: "Devon Walsh", state: "Backlog", priority: 2, tag: "responsive" },
  { project: "Infrastructure", type: "Bug", title: "Alert configuration form unusable on landscape mobile", description: "Form layout assumes ≥768px height. Landscape phones see fields stacked off-screen.", assignee: "Priya Menon", state: "In Progress", priority: 2, tag: "responsive" },
  { project: "Infrastructure", type: "Bug", title: "SVG dependency graph illegible below 1024px width", description: "Node labels overflow at smaller widths. Add zoom controls or auto-collapse below threshold.", assignee: "Ravi Subramanian", state: "Backlog", priority: 3, tag: "responsive" },
  { project: "Infrastructure", type: "Bug", title: "Focus indicator missing on custom buttons in cluster console", description: ":focus-visible removed by global reset. Keyboard users have no visible focus anywhere.", assignee: "Mei Lin", state: "Backlog", priority: 1, tag: "a11y" },
  { project: "Infrastructure", type: "Bug", title: "Tree view uses div role-buttons with no aria-expanded", description: "Collapsible namespace tree. SR users don't know if a node is open or closed.", assignee: "Devon Walsh", state: "Backlog", priority: 2, tag: "a11y" },

  // ---------- Platform — general QA bugs ----------
  { project: "Platform", type: "Bug", title: "Email verification link expires after 5 minutes instead of 24 hours", description: "QA caught link TTL is mistakenly using EMAIL_OTP_TTL constant (300s) instead of EMAIL_VERIFY_TTL (86400s).", assignee: "Pooja Iyer", state: "In Progress", priority: 1, tag: "auth" },
  { project: "Platform", type: "Bug", title: "Profile photo upload silently fails for files larger than 2MB", description: "Upload returns 200 but image never appears. Server rejects >2MB silently; no error surfaced to user.", assignee: "Sharath Krishnan", state: "Backlog", priority: 2, tag: "upload" },
  { project: "Platform", type: "Bug", title: "Search returns stale results after a document is deleted", description: "Elasticsearch index not invalidated on delete. Deleted articles continue to appear for up to 60s.", assignee: "Pooja Iyer", state: "Backlog", priority: 2, tag: "search" },
  { project: "Platform", type: "Bug", title: "Password reset link sometimes targets the wrong user account", description: "Race condition in token generation: two simultaneous reset requests can swap tokens between users.", assignee: "Priya Menon", state: "In Progress", priority: 1, tag: "auth" },
  { project: "Platform", type: "Bug", title: "Concurrent logins for same user intermittently kill sessions", description: "Session store keyed on user_id only; second login wins. Should support N concurrent device sessions.", assignee: "Sharath Krishnan", state: "Backlog", priority: 2, tag: "auth" },
  { project: "Platform", type: "Bug", title: "API rate limiter returns 200 with empty body instead of 429", description: "Rate-limit middleware short-circuits the response before the status code is set. Clients can't retry properly.", assignee: "Mei Lin", state: "Backlog", priority: 2, tag: "api" },
  { project: "Platform", type: "Bug", title: "Pagination drops the last item when total count equals page size", description: "Off-by-one in offset/limit calculation when count % pageSize === 0. Last item missing on final page.", assignee: "Pooja Iyer", state: "In Progress", priority: 2, tag: "pagination" },
  { project: "Platform", type: "Bug", title: "Session timeout warning dialog never appears", description: "Warning was supposed to show 5 min before expiry. Listener never registered after React 18 upgrade.", assignee: "Devon Walsh", state: "Backlog", priority: 3, tag: "session" },
  { project: "Platform", type: "Bug", title: "Sort by 'updated date' is reversed in listing pages", description: "Asc/desc swapped after the Postgres migration. Most recent items appear at the bottom.", assignee: "Sharath Krishnan", state: "Backlog", priority: 3, tag: "sorting" },
  { project: "Platform", type: "Bug", title: "Logout button doesn't clear the in-memory user store", description: "User object remains in client state after logout; refresh required. Briefly leaks PII on shared devices.", assignee: "Pooja Iyer", state: "Backlog", priority: 1, tag: "auth" },

  // ---------- Editorial — general QA bugs ----------
  { project: "Editorial", type: "Bug", title: "Article slug auto-generation strips emoji to empty string causing 500", description: "Slugify treats emoji as separators; an emoji-only title produces empty slug and a unique-constraint 500.", assignee: "Sharath Krishnan", state: "In Progress", priority: 2, tag: "publishing" },
  { project: "Editorial", type: "Bug", title: "Drafts older than 30 days lose autosave history silently", description: "Retention job deletes autosave snapshots without warning. Editors lose recovery option without notification.", assignee: "Pooja Iyer", state: "Backlog", priority: 2, tag: "autosave" },
  { project: "Editorial", type: "Bug", title: "Editor reverts to plain text after copy/paste from another browser tab", description: "Cross-tab paste loses rich-text formatting. Reproducible on Chrome and Edge.", assignee: "James O'Connor", state: "Backlog", priority: 3, tag: "editor" },
  { project: "Editorial", type: "Bug", title: "Bulk publish action publishes only the first 50 of selected items", description: "Frontend hard-caps batch size at 50 without warning user. Remaining items silently skipped.", assignee: "Sharath Krishnan", state: "In Progress", priority: 1, tag: "publishing" },
  { project: "Editorial", type: "Bug", title: "Image rotation in editor loses EXIF orientation after re-upload", description: "ImageMagick strip-metadata flag mis-set in resize pipeline; portrait images come back rotated 90°.", assignee: "Mei Lin", state: "Backlog", priority: 2, tag: "media" },
  { project: "Editorial", type: "Bug", title: "Tag autocomplete returns cached results from the previous user", description: "Service worker cache key omits user ID. User A briefly sees User B's recent tags after login switch.", assignee: "Pooja Iyer", state: "Backlog", priority: 1, tag: "security" },
  { project: "Editorial", type: "Bug", title: "Article scheduling honors UTC instead of user's local timezone", description: "Editor sees 'Publish at 9am' but article goes live 5.5h later for IST users. Inverse for US Pacific.", assignee: "Anna Kowalski", state: "In Progress", priority: 1, tag: "scheduling" },
  { project: "Editorial", type: "Bug", title: "Comment notification emails arrive as plain text instead of HTML", description: "Template MIME type regressed after Mailgun adapter swap. Links not clickable in Outlook.", assignee: "Sharath Krishnan", state: "Backlog", priority: 3, tag: "notifications" },
  { project: "Editorial", type: "Bug", title: "Article preview opens in a popup blocked by Chrome's default settings", description: "window.open called outside a user gesture chain. Editors think preview is broken.", assignee: "Pooja Iyer", state: "Backlog", priority: 3, tag: "preview" },
  { project: "Editorial", type: "Bug", title: "Word count includes HTML tags when copied from external source", description: "Counter measures innerHTML length rather than textContent. Off by ~15% on rich-text articles.", assignee: "James O'Connor", state: "Backlog", priority: 3, tag: "editor" },

  // ---------- Compliance — general QA bugs ----------
  { project: "Compliance", type: "Bug", title: "CSV import treats commas inside quoted fields as separators", description: "Internal CSV parser doesn't handle quoting. Imports with addresses or names containing commas corrupt rows.", assignee: "Pooja Iyer", state: "In Progress", priority: 1, tag: "import" },
  { project: "Compliance", type: "Bug", title: "Sanctions hit reason text truncated to 100 chars in detail view", description: "DB stores 4000 chars but detail panel slices to 100 with no 'show more'. Critical context lost.", assignee: "Sharath Krishnan", state: "Backlog", priority: 2, tag: "screening" },
  { project: "Compliance", type: "Bug", title: "Date range filter accepts end date earlier than start date", description: "No validation. Returns empty result set with no explanation; users assume data is missing.", assignee: "Mei Lin", state: "Backlog", priority: 2, tag: "filters" },
  { project: "Compliance", type: "Bug", title: "Bulk approve action approves items outside the current selection", description: "Backend ignores selection IDs and approves all items matching the filter. Severe — escalated.", assignee: "Pooja Iyer", state: "In Progress", priority: 1, tag: "screening" },
  { project: "Compliance", type: "Bug", title: "Audit log timestamps display in server local time instead of UTC", description: "Display layer drops the timezone suffix; auditors in different regions see misaligned timestamps.", assignee: "Sharath Krishnan", state: "Backlog", priority: 2, tag: "audit" },
  { project: "Compliance", type: "Bug", title: "Sanctions report PDF export drops the watermark on page 2 onwards", description: "Watermark applied only to first page in the PDF generator template.", assignee: "Devon Walsh", state: "Backlog", priority: 3, tag: "export" },
  { project: "Compliance", type: "Bug", title: "Two-factor enrollment QR code renders blank in Firefox", description: "QR canvas blank on Firefox 130+. Works in Chrome and Safari. Library version mismatch suspected.", assignee: "Priya Menon", state: "Backlog", priority: 2, tag: "auth" },
  { project: "Compliance", type: "Bug", title: "Case search returns soft-deleted cases for admin users", description: "Admin role bypasses the soft-delete filter unintentionally. Should require explicit 'include deleted' flag.", assignee: "Pooja Iyer", state: "In Progress", priority: 2, tag: "search" },
  { project: "Compliance", type: "Bug", title: "Risk score recalculation doesn't fire when manual override removed", description: "Removing an override leaves the old overridden score until next overnight job. Should recompute live.", assignee: "Sharath Krishnan", state: "Backlog", priority: 2, tag: "screening" },
  { project: "Compliance", type: "Bug", title: "Sanctions list ingestion crashes on UTF-8 BOM in source file", description: "OFAC publishes file with leading BOM that breaks the streaming JSON parser.", assignee: "Anna Kowalski", state: "Backlog", priority: 1, tag: "sanctions" },

  // ---------- Infrastructure — general QA bugs ----------
  { project: "Infrastructure", type: "Bug", title: "Slack alert webhook retries forever on permanent 401 response", description: "Retry policy doesn't classify 401 as terminal. Channel renamed = endless retries until manual intervention.", assignee: "Sharath Krishnan", state: "In Progress", priority: 2, tag: "alerting" },
  { project: "Infrastructure", type: "Bug", title: "Pipeline trigger debounce window applied per-branch instead of per-commit", description: "Rapid commits on the same branch are debounced — last commit waits for window even with fresh SHA.", assignee: "Pooja Iyer", state: "Backlog", priority: 2, tag: "ci" },
  { project: "Infrastructure", type: "Bug", title: "Secrets manager UI flashes decrypted value briefly on initial load", description: "Value rendered in DOM before the 'reveal' click. ~80ms exposure window visible in dev tools.", assignee: "Devon Walsh", state: "In Progress", priority: 1, tag: "security" },
  { project: "Infrastructure", type: "Bug", title: "Build artifact cleanup job runs before retention window ends", description: "Cron expression off by one day: artifacts deleted on day 6 instead of day 7. Customer ticket attached.", assignee: "Sharath Krishnan", state: "Backlog", priority: 2, tag: "ci" },
  { project: "Infrastructure", type: "Bug", title: "SSH session terminal inserts extra whitespace into copy/paste output", description: "Terminal emulator adds trailing spaces to wrapped lines when copied. Breaks YAML and Python pastes.", assignee: "Pooja Iyer", state: "Backlog", priority: 3, tag: "terminal" },
  { project: "Infrastructure", type: "Bug", title: "Container registry GC skips multi-arch manifests during orphan check", description: "GC sees the index manifest as orphaned and deletes referenced arch-specific layers. Image pulls then 404.", assignee: "Ravi Subramanian", state: "Backlog", priority: 1, tag: "registry" },
  { project: "Infrastructure", type: "Bug", title: "Cost report shows previous month's data on first load", description: "Default date range falls back to last month if 'today' has no aggregated rows yet. Confusing on day 1.", assignee: "Sharath Krishnan", state: "Backlog", priority: 3, tag: "billing" },
  { project: "Infrastructure", type: "Bug", title: "Pipeline retry button replays original commit instead of current head", description: "'Retry' triggers a new run for the original SHA, ignoring intermediate fixes pushed since.", assignee: "Pooja Iyer", state: "In Progress", priority: 2, tag: "ci" },
  { project: "Infrastructure", type: "Bug", title: "Log search regex anchor `$` matches across multi-line log entries", description: "Multi-line flag enabled by default in our log search. `$` matches mid-message, returning wrong results.", assignee: "Devon Walsh", state: "Backlog", priority: 3, tag: "observability" },

  // ---------- Platform — round 2 ----------
  { project: "Platform", type: "Bug", title: "Memory leak in admin dashboard after extended use", description: "Heap snapshot shows growing Map of event listeners after navigating between tabs ~50 times. Tab eventually OOMs.", assignee: "Sharath Krishnan", state: "Backlog", priority: 2, tag: "performance" },
  { project: "Platform", type: "Bug", title: "Browser back button skips intermediate routes on SPA navigation", description: "router.push pushes two history entries per nav, so back jumps two routes at once.", assignee: "Pooja Iyer", state: "Backlog", priority: 3, tag: "routing" },
  { project: "Platform", type: "Bug", title: "Notification badge count never resets after marking all as read", description: "Server clears unread but badge cache in localStorage isn't invalidated. Badge sticks until logout.", assignee: "Mei Lin", state: "In Progress", priority: 2, tag: "notifications" },
  { project: "Platform", type: "Bug", title: "User locale falls back to en-US even when browser is set to en-GB", description: "Locale negotiation only matches exact tag. Dates and currency show wrong format for UK users.", assignee: "Sharath Krishnan", state: "Backlog", priority: 2, tag: "i18n" },
  { project: "Platform", type: "Bug", title: "Profile API returns 500 when display_name contains zero-width characters", description: "Validator regex chokes on U+200B and U+FEFF. Trim them before validation.", assignee: "Pooja Iyer", state: "Backlog", priority: 3, tag: "validation" },
  { project: "Platform", type: "Bug", title: "Login form submits twice on slow networks", description: "No disable-on-submit. Users double-click; backend rejects second with a generic 500 instead of 409.", assignee: "Devon Walsh", state: "In Progress", priority: 2, tag: "auth" },
  { project: "Platform", type: "Bug", title: "Avatar generator hashes email lowercase but compares case-sensitively", description: "Hash inconsistency: 'User@x.com' and 'user@x.com' get different gravatars.", assignee: "Pooja Iyer", state: "Backlog", priority: 4, tag: "ux" },
  { project: "Platform", type: "Bug", title: "JWT refresh races with API call, causing one request per session to 401", description: "Refresh interceptor doesn't queue concurrent requests; one slips through with stale token.", assignee: "Priya Menon", state: "In Progress", priority: 1, tag: "auth" },
  { project: "Platform", type: "Bug", title: "Tooltip stays open after the trigger button is removed from DOM", description: "Orphaned tooltips persist on route change. Causes layout to think element is still there.", assignee: "Sharath Krishnan", state: "Backlog", priority: 3, tag: "ui" },
  { project: "Platform", type: "Bug", title: "Feature flag toggle requires a page reload to take effect", description: "Flag context not re-evaluated on update event. Toggle in admin doesn't propagate to active sessions.", assignee: "Mei Lin", state: "Backlog", priority: 2, tag: "feature-flags" },

  // ---------- Editorial — round 2 ----------
  { project: "Editorial", type: "Bug", title: "Article preview embeds expire after 5 minutes silently", description: "Signed URL TTL too short. Preview link shared with reviewers becomes 403 with no error UI.", assignee: "Pooja Iyer", state: "Backlog", priority: 2, tag: "preview" },
  { project: "Editorial", type: "Bug", title: "Spell-checker flags every word as misspelled in Welsh and Irish", description: "Hunspell dictionary not bundled for cy/ga locales. Editor sees a sea of red squigglies.", assignee: "James O'Connor", state: "Backlog", priority: 3, tag: "i18n" },
  { project: "Editorial", type: "Bug", title: "Co-authoring cursor positions desync after a paragraph is deleted", description: "OT transform misses retain count after delete; remote cursor jumps to wrong line.", assignee: "Mei Lin", state: "In Progress", priority: 1, tag: "collaboration" },
  { project: "Editorial", type: "Bug", title: "Editor undo stack persists across articles in the same tab", description: "Undo history not cleared when switching articles. Ctrl+Z can leak content from a previous draft.", assignee: "Sharath Krishnan", state: "Backlog", priority: 1, tag: "security" },
  { project: "Editorial", type: "Bug", title: "Inline video embed shows placeholder forever on Firefox ESR", description: "Player polyfill skipped for Firefox ESR user-agent string; placeholder never replaced.", assignee: "Pooja Iyer", state: "Backlog", priority: 3, tag: "media" },
  { project: "Editorial", type: "Bug", title: "Bulk tag rename misses articles in 'Pending review' state", description: "Rename query filters out non-published articles. Pending drafts retain old tag name.", assignee: "Anna Kowalski", state: "Backlog", priority: 2, tag: "tags" },
  { project: "Editorial", type: "Bug", title: "Embedded tweet attribution missing after Twitter's API change", description: "oEmbed endpoint returns 200 with empty author; author chip renders blank.", assignee: "Sharath Krishnan", state: "Backlog", priority: 3, tag: "embeds" },
  { project: "Editorial", type: "Bug", title: "Article history diff shows whitespace-only changes as unchanged", description: "Diff library trims whitespace before comparison. Editors lose track of intentional spacing edits.", assignee: "Pooja Iyer", state: "Backlog", priority: 3, tag: "versioning" },
  { project: "Editorial", type: "Bug", title: "Outbox queue stalls when one article fails to publish", description: "Worker doesn't skip the failing item; entire queue blocks behind it for up to 30 min.", assignee: "Ravi Subramanian", state: "In Progress", priority: 1, tag: "publishing" },
  { project: "Editorial", type: "Bug", title: "Article-level analytics counter under-counts AMP page views", description: "AMP requests skip the JS beacon. Backend log aggregation runs hourly, so dashboard lags 1h.", assignee: "Sharath Krishnan", state: "Backlog", priority: 4, tag: "analytics" },

  // ---------- Compliance — round 2 ----------
  { project: "Compliance", type: "Bug", title: "Sanctions screening returns false negatives for Cyrillic-only names", description: "Name normalizer drops non-ASCII characters before fuzzy match. Russian names get past screening.", assignee: "Pooja Iyer", state: "In Progress", priority: 1, tag: "screening" },
  { project: "Compliance", type: "Bug", title: "Audit log export skips events older than 365 days even if retention is longer", description: "Hardcoded 365d window in export job. Long-retention customers get incomplete evidence.", assignee: "Anna Kowalski", state: "Backlog", priority: 1, tag: "audit" },
  { project: "Compliance", type: "Bug", title: "DOB picker on KYC form rejects valid 29-Feb leap-year dates", description: "Custom date validator uses simplified leap-year rule. Users born 29 Feb 2000 blocked.", assignee: "Sharath Krishnan", state: "Backlog", priority: 2, tag: "kyc" },
  { project: "Compliance", type: "Bug", title: "Case assignee dropdown shows deactivated users", description: "User picker queries the table without the active=true filter. Allows assignment to ex-employees.", assignee: "Mei Lin", state: "Backlog", priority: 2, tag: "case-management" },
  { project: "Compliance", type: "Bug", title: "Sanctions evidence PDF includes images with broken signed URLs", description: "PDF generated after URL TTL expires. Evidence pages show 'image not available' for half the entries.", assignee: "Devon Walsh", state: "In Progress", priority: 2, tag: "export" },
  { project: "Compliance", type: "Bug", title: "Currency conversion in transaction screening uses stale FX rate", description: "FX cache TTL too long (24h). High-volatility currencies cause threshold mis-triggers.", assignee: "Pooja Iyer", state: "Backlog", priority: 2, tag: "screening" },
  { project: "Compliance", type: "Bug", title: "Risk threshold slider snaps to 0 when slowly dragged below 0.1", description: "Input rounds aggressively to int below 1. Should preserve 2 decimals.", assignee: "Sharath Krishnan", state: "Backlog", priority: 4, tag: "ui" },
  { project: "Compliance", type: "Bug", title: "Match-against-prior-cases shows results from other tenants", description: "Tenant scoping missing in similarity-search index. Severe data-isolation issue. Escalated.", assignee: "Anna Kowalski", state: "In Progress", priority: 1, tag: "security" },
  { project: "Compliance", type: "Bug", title: "GDPR data subject deletion misses backup snapshots older than 7 days", description: "Backup retention not part of the delete job. Need to schedule snapshot anonymization to satisfy SAR.", assignee: "Priya Menon", state: "Backlog", priority: 1, tag: "gdpr" },
  { project: "Compliance", type: "Bug", title: "Bulk import progress bar stuck at 99% even after job completes", description: "Final batch's completion event lost; UI never advances. Refresh shows correct state.", assignee: "Pooja Iyer", state: "Backlog", priority: 3, tag: "import" },

  // ---------- Infrastructure — round 2 ----------
  { project: "Infrastructure", type: "Bug", title: "Kubernetes pod restart count silently resets after node drain", description: "Metrics scraper treats new pod as fresh. Long-term flap counts not tracked across drains.", assignee: "Ravi Subramanian", state: "Backlog", priority: 3, tag: "observability" },
  { project: "Infrastructure", type: "Bug", title: "PagerDuty integration sends ack but doesn't sync resolve back to alertmanager", description: "Webhook only handles ack events. Resolves require manual cleanup in alertmanager.", assignee: "Sharath Krishnan", state: "Backlog", priority: 2, tag: "alerting" },
  { project: "Infrastructure", type: "Bug", title: "Terraform plan in CI prints secret values when verbose mode is on", description: "Sensitive=true not honored under TF_LOG=DEBUG. Secrets leak into CI logs.", assignee: "Pooja Iyer", state: "In Progress", priority: 1, tag: "security" },
  { project: "Infrastructure", type: "Bug", title: "Disk usage graph double-counts loopback mounts on bastion hosts", description: "Same volume mounted twice; node_exporter reports both. Inflates disk usage by ~30%.", assignee: "Devon Walsh", state: "Backlog", priority: 3, tag: "observability" },
  { project: "Infrastructure", type: "Bug", title: "DNS resolver cache TTL ignored, hammering upstream every request", description: "Custom resolver missed an init flag; caching disabled. Upstream throttle warnings every 5 min.", assignee: "Ravi Subramanian", state: "In Progress", priority: 2, tag: "networking" },
  { project: "Infrastructure", type: "Bug", title: "Cron job concurrency lock not released after process crash", description: "Lock held in Redis with no TTL fallback. Crashed cron blocks next 4 runs.", assignee: "Sharath Krishnan", state: "Backlog", priority: 2, tag: "cron" },
  { project: "Infrastructure", type: "Bug", title: "S3 lifecycle rule deletes objects before downstream archive job finishes", description: "Lifecycle rule fires at 7 days but archive job has 8-day SLA. Resulting gap loses ~1% of data.", assignee: "Pooja Iyer", state: "Backlog", priority: 1, tag: "storage" },
  { project: "Infrastructure", type: "Bug", title: "Helm chart values.yaml schema check accepts unknown keys silently", description: "Typo in 'replicaCount' (extra 's') doesn't error; default value silently applied.", assignee: "Anna Kowalski", state: "Backlog", priority: 3, tag: "deploy" },
  { project: "Infrastructure", type: "Bug", title: "On-call rotation calendar shows wrong DST transition on Europe schedule", description: "Schedule library uses Europe/London but applies it to all European rotations. CET rotations off by 1h twice a year.", assignee: "Sharath Krishnan", state: "In Progress", priority: 2, tag: "oncall" },
  { project: "Infrastructure", type: "Bug", title: "Cluster autoscaler over-provisions during graceful shutdown of workload", description: "Pending pods during pod-eviction trigger scale-up that's no longer needed by the time nodes are ready.", assignee: "Priya Menon", state: "Backlog", priority: 3, tag: "k8s" },

  // ---------- Sprint 142 fresh intake ----------
  // Realtime / WebSocket
  { project: "Platform", type: "Bug", title: "WebSocket disconnect during rolling deploy not surfaced to client", description: "Sockets drop silently during canary swap. Clients show stale data for up to 60s before reconnecting.", assignee: "Pooja Iyer", state: "Backlog", priority: 1, tag: "realtime" },
  { project: "Platform", type: "Bug", title: "Realtime presence indicator stays 'online' after browser crash", description: "Heartbeat timeout too generous (90s). Other users see ghost-online indicators for ~1.5 minutes.", assignee: "Sharath Krishnan", state: "Backlog", priority: 3, tag: "realtime" },
  { project: "Editorial", type: "Bug", title: "Push notifications dropped when editor tab is backgrounded on iOS", description: "Safari throttles WebSocket events; co-author edits don't arrive until tab is foregrounded.", assignee: "Mei Lin", state: "Backlog", priority: 2, tag: "realtime" },

  // OAuth / SSO
  { project: "Platform", type: "Bug", title: "SSO callback URL strips query parameters causing wrong redirect", description: "Encoded redirect_uri loses its query string when decoded twice. Users land on home page instead of intended target.", assignee: "Priya Menon", state: "Backlog", priority: 1, tag: "sso" },
  { project: "Platform", type: "Bug", title: "SAML assertion replay protection not enforced", description: "Same assertion can be POSTed within the 5-min window. Missing in-memory nonce tracking. Security review flagged.", assignee: "Devon Walsh", state: "Backlog", priority: 1, tag: "security" },
  { project: "Platform", type: "Bug", title: "Microsoft Entra ID group claims not refreshed on next login", description: "Group changes upstream take up to 24h to reflect in app. Cache group claims with 15-min TTL.", assignee: "Pooja Iyer", state: "Backlog", priority: 2, tag: "sso" },

  // Webhooks
  { project: "Platform", type: "Bug", title: "Webhook signature verification accepts deprecated MD5", description: "Verifier accepts MD5 alongside SHA-256. Should reject MD5 outright; document migration window in changelog.", assignee: "Sharath Krishnan", state: "Backlog", priority: 1, tag: "webhooks" },
  { project: "Infrastructure", type: "Bug", title: "Webhook delivery retries don't preserve original timestamp", description: "Retries send the retry-attempt timestamp instead of the original event time. Downstream consumers see false 'now'.", assignee: "Devon Walsh", state: "Backlog", priority: 2, tag: "webhooks" },
  { project: "Infrastructure", type: "Bug", title: "Webhook payload schema version not negotiated", description: "Sender always sends v2; v1-only customers crash. Add Accept-Version header negotiation.", assignee: "Sharath Krishnan", state: "Backlog", priority: 2, tag: "webhooks" },

  // Search relevance
  { project: "Platform", type: "Bug", title: "Search ignores stop-words only for English, not for other locales", description: "French and Spanish search treats 'le', 'la', 'el' as significant tokens. Inflates noise in ranking.", assignee: "Pooja Iyer", state: "Backlog", priority: 3, tag: "search" },
  { project: "Editorial", type: "Bug", title: "Search ranking demotes recently-updated articles", description: "Boost-by-recency clause has wrong sign. Fresh edits sink to bottom of result list.", assignee: "James O'Connor", state: "Backlog", priority: 2, tag: "search" },
  { project: "Editorial", type: "Bug", title: "Boolean operators (AND/OR/NOT) silently ignored in search query", description: "Query parser strips operators because they conflict with Lucene reserved chars. Users expect Google-style boolean.", assignee: "Mei Lin", state: "Backlog", priority: 3, tag: "search" },

  // RBAC / Permissions
  { project: "Platform", type: "Bug", title: "Custom roles allow privilege escalation via team transfer", description: "Transferring a user between teams inherits the union of permissions instead of replacing. Critical security issue.", assignee: "Priya Menon", state: "Backlog", priority: 1, tag: "rbac" },
  { project: "Compliance", type: "Bug", title: "Role assignment audit log missing 'actor' info", description: "Audit row records who got the role but not who granted it. Required for SOC2 evidence.", assignee: "Anna Kowalski", state: "Backlog", priority: 2, tag: "audit" },
  { project: "Infrastructure", type: "Bug", title: "Service accounts inherit human-user permissions through OIDC link", description: "Service-account token issued via OIDC pulls user's group memberships. Should use separate scope.", assignee: "Devon Walsh", state: "Backlog", priority: 1, tag: "security" },

  // Background jobs / queues
  { project: "Infrastructure", type: "Bug", title: "Job queue persists serialized closures that fail to deserialize", description: "Workers crash on jobs enqueued by older binary versions. Need migration to JSON-only payloads.", assignee: "Ravi Subramanian", state: "Backlog", priority: 2, tag: "jobs" },
  { project: "Infrastructure", type: "Bug", title: "Dead-letter queue grows unbounded with no alerting", description: "DLQ has no max-size or alarm. Past incidents have grown to GBs before discovery.", assignee: "Pooja Iyer", state: "Backlog", priority: 2, tag: "jobs" },
  { project: "Infrastructure", type: "Bug", title: "Job retry exponential backoff caps at 1s due to int overflow", description: "Backoff calculation overflows after attempt 31. Effectively becomes a tight loop.", assignee: "Sharath Krishnan", state: "Backlog", priority: 2, tag: "jobs" },

  // File storage
  { project: "Editorial", type: "Bug", title: "S3 multi-part upload doesn't resume after network blip", description: "Frontend restarts the whole upload on any error. Large image uploads (>50MB) routinely fail on flaky wifi.", assignee: "Mei Lin", state: "Backlog", priority: 2, tag: "upload" },
  { project: "Compliance", type: "Bug", title: "Pre-signed URL TTL ignores forced clock skew", description: "Server clock 20s ahead of S3; pre-signed URLs effectively expire 20s early in test environments.", assignee: "Devon Walsh", state: "Backlog", priority: 3, tag: "storage" },
  { project: "Editorial", type: "Bug", title: "File download streams 'undefined' as filename on Safari", description: "Content-Disposition header parsing differs across Safari; filename becomes literal 'undefined'.", assignee: "James O'Connor", state: "Backlog", priority: 3, tag: "download" },

  // Caching layer
  { project: "Platform", type: "Bug", title: "Edge cache key includes session cookie causing miss-storms", description: "Cache-key bucketed per user. Effective hit rate ~3%. Strip session cookies from edge cache key.", assignee: "Pooja Iyer", state: "Backlog", priority: 1, tag: "performance" },
  { project: "Platform", type: "Bug", title: "Cache invalidation race overwrites fresh data with stale value", description: "Read-through cache races with concurrent writes. Need versioned writes or compare-and-set.", assignee: "Mei Lin", state: "Backlog", priority: 2, tag: "caching" },
  { project: "Infrastructure", type: "Bug", title: "ETag header dropped behind reverse proxy", description: "Nginx config strips ETag on 304 responses. Defeats client cache validation across the board.", assignee: "Ravi Subramanian", state: "Backlog", priority: 3, tag: "caching" },

  // Browser-specific
  { project: "Platform", type: "Bug", title: "Safari clears localStorage in private mode without warning", description: "App assumes persistent storage. Saved drafts vanish on tab close in Safari private windows.", assignee: "Sharath Krishnan", state: "Backlog", priority: 3, tag: "browser" },
  { project: "Editorial", type: "Bug", title: "Firefox 130 strict tracking protection breaks IndexedDB persistence", description: "Editor's local cache is wiped between sessions on Firefox 130+. Affects ~8% of editors.", assignee: "Pooja Iyer", state: "Backlog", priority: 2, tag: "browser" },
  { project: "Compliance", type: "Bug", title: "PDF preview fails to render in Edge with Acrobat extension installed", description: "Edge prefers Acrobat plug-in over built-in PDF viewer. Our embed fails silently.", assignee: "Anna Kowalski", state: "Backlog", priority: 3, tag: "browser" },

  // Performance
  { project: "Platform", type: "Bug", title: "N+1 queries on user permission check page", description: "Permission resolution fires per-row query; 200-row page issues 201 DB calls. Add bulk loader.", assignee: "Priya Menon", state: "Backlog", priority: 2, tag: "performance" },
  { project: "Editorial", type: "Bug", title: "Bundle includes 80kb of unused moment.js after date-fns migration", description: "Tree-shake should have removed moment but a single legacy import in deprecated module pulls it back.", assignee: "Devon Walsh", state: "Backlog", priority: 3, tag: "performance" },
  { project: "Platform", type: "Bug", title: "LCP regression after font subset change", description: "New font subset removes 'fi' ligature; layout shift after web-font swap pushes LCP element down.", assignee: "Mei Lin", state: "Backlog", priority: 2, tag: "performance" },
];

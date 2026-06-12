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
  initialized = true;
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
];

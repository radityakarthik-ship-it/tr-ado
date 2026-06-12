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
  const countRows = (await sql`SELECT COUNT(*)::int AS n FROM tickets`) as { n: number }[];
  const n = Number(countRows[0]?.n ?? 0);
  if (n > 0) return;
  const seed: Array<Partial<Ticket>> = [
    // Platform
    { project: "Platform", type: "Bug", title: "Login page intermittently returns 500", description: "Customers report sporadic 500 errors on /auth/login during peak hours. Logs show DB pool exhaustion.", assignee: "Priya Menon", state: "In Progress", priority: 1, tag: "auth" },
    { project: "Platform", type: "User Story", title: "As an editor I want to schedule article publishing", description: "Editors should be able to set a future publish date/time on draft articles. Surfaces in the editorial calendar.", assignee: "James O'Connor", state: "Backlog", priority: 2, tag: "newsroom" },
    { project: "Platform", type: "Task", title: "Migrate search service to Node 20 runtime", description: "Bump base image and run perf regression against prod-like dataset.", assignee: "Ravi Subramanian", state: "Backlog", priority: 3, tag: "infra" },
    { project: "Platform", type: "Feature", title: "Server-side rendering for article preview", description: "Improve LCP on article preview pages by moving render to the edge.", assignee: "Mei Lin", state: "In Progress", priority: 2, tag: "performance" },
    { project: "Platform", type: "Task", title: "Adopt React 19 strict mode in admin app", description: "Audit effect cleanups, fix double-fire issues, ship behind flag.", assignee: "Devon Walsh", state: "Done", priority: 3, tag: "frontend" },

    // Editorial
    { project: "Editorial", type: "Bug", title: "PDF export drops footnotes in legal briefs", description: "Reported by editorial. Reproducible with brief IDs in attached comment.", assignee: "Mei Lin", state: "In Progress", priority: 2, tag: "export" },
    { project: "Editorial", type: "User Story", title: "Editor receives Slack alert when their draft is reviewed", description: "Send a Slack DM with deep link to the doc when reviewer status changes.", assignee: "Anna Kowalski", state: "Backlog", priority: 2, tag: "notifications" },
    { project: "Editorial", type: "Feature", title: "Inline citations from Westlaw connector", description: "Allow editors to drop a citation chip that resolves via the Westlaw search API.", assignee: "James O'Connor", state: "Backlog", priority: 2, tag: "citations" },
    { project: "Editorial", type: "Task", title: "Rewrite legacy markdown converter in Rust", description: "Old converter chokes on >5MB docs. Rewrite for streaming.", assignee: "Ravi Subramanian", state: "Done", priority: 3, tag: "tooling" },

    // Compliance
    { project: "Compliance", type: "Feature", title: "Sanctions screening: add UK OFSI list", description: "Add weekly ingestion from UK OFSI consolidated list into the sanctions screening pipeline.", assignee: "Anna Kowalski", state: "In Progress", priority: 1, tag: "sanctions" },
    { project: "Compliance", type: "Bug", title: "PEP match false-positive rate jumped after model refresh", description: "After last week's name-matching model refresh, PEP false positives doubled. Roll back or tune threshold.", assignee: "Devon Walsh", state: "In Progress", priority: 1, tag: "screening" },
    { project: "Compliance", type: "Task", title: "GDPR DPIA for new audit log retention", description: "Complete impact assessment before extending retention from 1y to 7y.", assignee: "Priya Menon", state: "Backlog", priority: 2, tag: "gdpr" },
    { project: "Compliance", type: "User Story", title: "Auditor wants to export full evidence pack for a case", description: "Single-click export of all linked evidence for an audit case as a signed ZIP.", assignee: "Mei Lin", state: "Backlog", priority: 3, tag: "audit" },

    // Infrastructure
    { project: "Infrastructure", type: "Task", title: "Rotate prod API keys for market data connector", description: "Quarterly rotation. Coordinate with downstream consumers.", assignee: "Devon Walsh", state: "Done", priority: 2, tag: "security" },
    { project: "Infrastructure", type: "Feature", title: "Migrate batch jobs from cron to Temporal", description: "Phase 1: move 12 daily jobs. Phase 2: backfill workflows.", assignee: "Ravi Subramanian", state: "In Progress", priority: 2, tag: "platform" },
    { project: "Infrastructure", type: "Bug", title: "k8s pod-eviction storm on us-east-1 cluster", description: "Cluster autoscaler dropped 40 pods in 2 minutes. Suspect bad node-group config.", assignee: "Priya Menon", state: "Backlog", priority: 1, tag: "k8s" },
    { project: "Infrastructure", type: "Task", title: "Enable VPC flow logs in all prod accounts", description: "Required for SOC2 evidence collection.", assignee: "Anna Kowalski", state: "Backlog", priority: 3, tag: "security" },
  ];
  for (const t of seed) {
    await createTicket(t);
  }
}

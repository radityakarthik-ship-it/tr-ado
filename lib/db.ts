import { neon } from "@neondatabase/serverless";

export type WorkItemType = "Bug" | "Task" | "User Story" | "Feature";
export type WorkItemState = "Backlog" | "In Progress" | "Done";
export type Priority = 1 | 2 | 3 | 4;

export interface Ticket {
  id: number;
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
  initialized = true;
}

export async function listTickets(): Promise<Ticket[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, type, title, description, assignee, state, priority, tag,
           created_at, updated_at
    FROM tickets
    ORDER BY priority ASC, id DESC
  `) as Ticket[];
  return rows;
}

export async function createTicket(input: Partial<Ticket>): Promise<Ticket> {
  await ensureSchema();
  const sql = getSql();
  const {
    type = "Task",
    title = "Untitled work item",
    description = "",
    assignee = "Unassigned",
    state = "Backlog",
    priority = 2,
    tag = "",
  } = input;
  const rows = (await sql`
    INSERT INTO tickets (type, title, description, assignee, state, priority, tag)
    VALUES (${type}, ${title}, ${description}, ${assignee}, ${state}, ${priority}, ${tag})
    RETURNING id, type, title, description, assignee, state, priority, tag,
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
       SET type        = COALESCE(${patch.type ?? null}, type),
           title       = COALESCE(${patch.title ?? null}, title),
           description = COALESCE(${patch.description ?? null}, description),
           assignee    = COALESCE(${patch.assignee ?? null}, assignee),
           state       = COALESCE(${patch.state ?? null}, state),
           priority    = COALESCE(${patch.priority ?? null}, priority),
           tag         = COALESCE(${patch.tag ?? null}, tag),
           updated_at  = NOW()
     WHERE id = ${id}
 RETURNING id, type, title, description, assignee, state, priority, tag,
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
    {
      type: "Bug",
      title: "Login page intermittently returns 500",
      description:
        "Customers report sporadic 500 errors on /auth/login during peak hours. Logs show DB pool exhaustion.",
      assignee: "Priya Menon",
      state: "In Progress",
      priority: 1,
      tag: "platform",
    },
    {
      type: "User Story",
      title: "As an editor I want to schedule article publishing",
      description:
        "Editors should be able to set a future publish date/time on draft articles. Surfaces in the editorial calendar.",
      assignee: "James O'Connor",
      state: "Backlog",
      priority: 2,
      tag: "editorial",
    },
    {
      type: "Task",
      title: "Migrate search service to Node 20 runtime",
      description: "Bump base image and run perf regression against prod-like dataset.",
      assignee: "Ravi Subramanian",
      state: "Backlog",
      priority: 3,
      tag: "infra",
    },
    {
      type: "Feature",
      title: "Sanctions screening: add UK OFSI list",
      description:
        "Add weekly ingestion from UK OFSI consolidated list into the sanctions screening pipeline.",
      assignee: "Anna Kowalski",
      state: "In Progress",
      priority: 2,
      tag: "compliance",
    },
    {
      type: "Task",
      title: "Rotate prod API keys for market data connector",
      description: "Quarterly rotation. Coordinate with downstream consumers.",
      assignee: "Devon Walsh",
      state: "Done",
      priority: 2,
      tag: "security",
    },
    {
      type: "Bug",
      title: "PDF export drops footnotes in legal briefs",
      description:
        "Reported by editorial. Reproducible with brief IDs in attached comment.",
      assignee: "Mei Lin",
      state: "Backlog",
      priority: 2,
      tag: "editorial",
    },
  ];
  for (const t of seed) {
    await createTicket(t);
  }
}

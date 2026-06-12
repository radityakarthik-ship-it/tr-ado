# TR ADO

Browser-based ADO-style dashboard branded as TR ADO. Anyone with the
link sees the same Kanban board. Tickets are pushed via a secret admin API.

- **For you** — Vercel-hosted, free, no servers to run.
- **For recipients** — open a URL, see the board, click cards to read details.
- **Push tickets** — Claude (or you) calls a secret API endpoint; the new ticket
  appears for everyone on the next refresh.

---

## Deploy to Vercel — first time setup

You've already signed in to Vercel. Do these once:

### 1. Get the code onto Vercel

Easiest path is GitHub:

1. Create a new empty repo on github.com (e.g. `tr-devops`, private).
2. In this folder, run:
   ```powershell
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/tr-devops.git
   git push -u origin main
   ```
3. Open [vercel.com/new](https://vercel.com/new) → "Import Git Repository" →
   pick `tr-devops` → click **Deploy**.

   (The first deploy will fail because there's no database yet — that's fine,
   we fix it in step 2.)

### 2. Add a free Neon Postgres database

1. In the new Vercel project → **Storage** tab → **Create Database** → **Neon**
   → accept the defaults → **Create**.
2. Vercel automatically adds `DATABASE_URL` to the project's environment variables.

### 3. Add the admin secret

1. In the same project → **Settings** → **Environment Variables**.
2. Add a new variable:
   - Name: `ADMIN_SECRET`
   - Value: any long random string. Generate one with:
     ```powershell
     [Convert]::ToBase64String([byte[]](1..32 | ForEach-Object { Get-Random -Maximum 256 }))
     ```
3. Apply to **Production**, **Preview**, and **Development**.

### 4. Redeploy

In Vercel project → **Deployments** → top entry → **Redeploy**.

Once it goes green, your URL is shown at the top of the project page —
something like `tr-devops.vercel.app`. **That's the link you share.**

---

## Tell Claude the URL and secret

After the deploy is live, paste this into the chat with Claude:

> My TR DevOps site is at `https://<your-vercel-url>` and the admin secret is `<your-secret>`.

From then on you can say things like:

- "Push a P1 bug 'Market data connector dropping FX ticks' assigned to Priya Menon."
- "Move ticket #12 to Done."
- "Delete ticket #4."

Claude will run the admin API calls and the change shows up on the site within
seconds.

---

## Local dev

```powershell
copy .env.example .env.local
# paste your Neon DATABASE_URL and any ADMIN_SECRET into .env.local
npm install
npm run dev
```

Open http://localhost:3000.

---

## Admin API reference (for Claude or curl)

All endpoints require `Authorization: Bearer <ADMIN_SECRET>`.

| Method | Path | Body |
|---|---|---|
| POST   | `/api/tickets`      | `{ type, title, description, assignee, state, priority, tag }` |
| PATCH  | `/api/tickets/{id}` | any subset of the above fields |
| DELETE | `/api/tickets/{id}` | — |

- `type`: `Bug` \| `Task` \| `User Story` \| `Feature`
- `state`: `Backlog` \| `In Progress` \| `Done`
- `priority`: `1` (highest) — `4` (lowest)

Public:

| Method | Path | Body |
|---|---|---|
| GET | `/api/tickets` | — |

---

## Project layout

```
app/
  layout.tsx              page chrome + metadata
  page.tsx                dashboard (server-rendered)
  globals.css             Tailwind entrypoint
  api/tickets/route.ts    GET list, POST create (admin)
  api/tickets/[id]/route.ts  PATCH update, DELETE (admin)
components/
  Header.tsx              top nav with TR logo + product tabs
  Sidebar.tsx             Boards / Repos / Pipelines / etc.
  Board.tsx               three-column Kanban
  TicketCard.tsx          card on the board
  TicketDetail.tsx        right-side drawer when a card is clicked
lib/
  db.ts                   Neon Postgres helpers + seed data
  auth.ts                 bearer-token check
public/
  favicon.svg             orange TR favicon
```

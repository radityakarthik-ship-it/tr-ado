import { NextRequest, NextResponse } from "next/server";
import {
  deleteTimesheetEntry,
  listTimesheetEntries,
  setWeekStatus,
  TimesheetStatus,
  upsertTimesheetEntry,
} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const user = sp.get("user") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  if (!user || !from || !to) {
    return NextResponse.json(
      { error: "user, from, to required" },
      { status: 400 },
    );
  }
  const entries = await listTimesheetEntries(user, from, to);
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const entry = await upsertTimesheetEntry(body);
  return NextResponse.json({ entry }, { status: body.id ? 200 : 201 });
}

export async function DELETE(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const id = Number(sp.get("id"));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const ok = await deleteTimesheetEntry(id);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ deleted: id });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { user, from, to, status } = body as {
    user?: string;
    from?: string;
    to?: string;
    status?: TimesheetStatus;
  };
  if (!user || !from || !to || !status) {
    return NextResponse.json(
      { error: "user, from, to, status required" },
      { status: 400 },
    );
  }
  const updated = await setWeekStatus(user, from, to, status);
  return NextResponse.json({ updated });
}

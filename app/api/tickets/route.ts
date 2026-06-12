import { NextRequest, NextResponse } from "next/server";
import { createTicket, listTickets, seedIfEmpty } from "@/lib/db";
import { isAuthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await seedIfEmpty();
  const tickets = await listTickets();
  return NextResponse.json({ tickets });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const ticket = await createTicket(body);
  return NextResponse.json({ ticket }, { status: 201 });
}

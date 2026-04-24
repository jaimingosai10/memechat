import { db } from "@/db/client";
import { messages } from "@/db/schema";
import { broadcast } from "@/lib/broadcast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json(
    { error: "unauthorized" },
    {
      status: 401,
      headers: { "WWW-Authenticate": "Bearer" },
    },
  );
}

export async function POST(req: Request) {
  const expected = process.env.ADMIN_TOKEN;
  const auth = req.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  // If ADMIN_TOKEN is unset the switch is effectively disabled: every
  // request falls through to 401, matching the spec.
  if (!expected || !match) return unauthorized();

  const provided = match[1].trim();
  if (!constantTimeEqual(provided, expected)) return unauthorized();

  await db.delete(messages);

  broadcast("flush", { at: new Date().toISOString() });

  return Response.json({ ok: true }, { status: 200 });
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

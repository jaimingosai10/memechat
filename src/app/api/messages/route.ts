import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { messages } from "@/db/schema";
import { createMessageSchema } from "@/lib/validation";
import { broadcast } from "@/lib/broadcast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select()
    .from(messages)
    .orderBy(desc(messages.createdAt))
    .limit(200);
  rows.reverse();
  return Response.json(rows);
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = createMessageSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: "validation_failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { handle, imageUrl, topText, bottomText } = parsed.data;
  const [row] = await db
    .insert(messages)
    .values({
      handle,
      imageUrl,
      topText: topText ?? null,
      bottomText: bottomText ?? null,
    })
    .returning();

  broadcast("message", row);

  return Response.json(row, { status: 201 });
}

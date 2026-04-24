import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return json(
      { error: "expected multipart/form-data with a 'file' field" },
      400,
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "invalid multipart body" }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return json({ error: "missing 'file' field" }, 400);
  }

  if (file.size === 0) {
    return json({ error: "empty file" }, 400);
  }
  if (file.size > MAX_BYTES) {
    return json(
      { error: `file too large: max ${MAX_BYTES} bytes` },
      400,
    );
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return json(
      {
        error: "unsupported content-type",
        allowed: [...ALLOWED_TYPES],
      },
      400,
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return json(
      { error: "blob storage not configured" },
      503,
    );
  }

  const ext = extensionFor(file.type);
  const key = `memes/${crypto.randomUUID()}${ext}`;

  try {
    const blob = await put(key, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
    });
    return json({ url: blob.url, contentType: file.type, size: file.size }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "upload failed";
    return json({ error: "upload_failed", detail: message }, 500);
  }
}

function extensionFor(mime: string): string {
  switch (mime) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/gif":
      return ".gif";
    case "image/webp":
      return ".webp";
    default:
      return "";
  }
}

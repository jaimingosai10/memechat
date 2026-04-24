import { subscribe } from "@/lib/broadcast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEEPALIVE_MS = 25_000;

export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      safeEnqueue(`retry: 3000\n\n`);
      safeEnqueue(`event: hello\ndata: {"ok":true}\n\n`);

      const unsubscribe = subscribe(safeEnqueue);

      const keepalive = setInterval(() => {
        safeEnqueue(`: ping ${Date.now()}\n\n`);
      }, KEEPALIVE_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepalive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

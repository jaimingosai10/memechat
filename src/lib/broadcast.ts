// In-process SSE subscriber registry.
//
// NOTE (v0 limitation): this only works when every SSE client is pinned to the
// same Node process that handles POST /api/messages. On Vercel serverless this
// means a single function instance — if the platform scales to N instances,
// subscribers on instance A will not see broadcasts from instance B. Acceptable
// for v0; replace with Redis pub/sub or similar when we outgrow it.

type Subscriber = (payload: string) => void;

const globalForBus = globalThis as unknown as {
  _memechatSubscribers?: Set<Subscriber>;
};

function subscribers(): Set<Subscriber> {
  if (!globalForBus._memechatSubscribers) {
    globalForBus._memechatSubscribers = new Set();
  }
  return globalForBus._memechatSubscribers;
}

export function subscribe(fn: Subscriber): () => void {
  const set = subscribers();
  set.add(fn);
  return () => set.delete(fn);
}

export function broadcast(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const fn of subscribers()) {
    try {
      fn(payload);
    } catch {
      // If a subscriber throws, drop it silently; its stream already failed.
    }
  }
}

export function subscriberCount(): number {
  return subscribers().size;
}

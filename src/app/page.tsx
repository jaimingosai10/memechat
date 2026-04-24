"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, FormEvent } from "react";

type Message = {
  id: string;
  handle: string;
  imageUrl: string;
  topText: string | null;
  bottomText: string | null;
  createdAt: string;
};

type OptimisticMessage = Message & { pending?: boolean; failed?: boolean };

const HANDLE_KEY = "memechat.handle";
const MAX_CAPTION = 120;
const MAX_HANDLE = 40;

export default function Home() {
  const [handle, setHandle] = useState<string | null>(null);
  const [handleDraft, setHandleDraft] = useState("");
  const [messages, setMessages] = useState<OptimisticMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(HANDLE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe localStorage read
    if (stored) setHandle(stored);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/messages", { cache: "no-store" });
        if (!res.ok) throw new Error(`GET /api/messages -> ${res.status}`);
        const rows: Message[] = await res.json();
        if (!cancelled) setMessages(rows);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "failed to load");
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // EventSource reconnects automatically on drop; the browser respects the
    // server-sent `retry:` hint. We still guard against StrictMode remount.
    const es = new EventSource("/api/stream");

    es.addEventListener("message", (ev) => {
      try {
        const row = JSON.parse(ev.data) as Message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === row.id)) return prev;
          return [...prev, row];
        });
      } catch {
        // ignore malformed frames
      }
    });

    es.addEventListener("flush", () => {
      setMessages([]);
    });

    return () => es.close();
  }, []);

  const commitHandle = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = handleDraft.trim();
    if (!trimmed) return;
    const clipped = trimmed.slice(0, MAX_HANDLE);
    window.localStorage.setItem(HANDLE_KEY, clipped);
    setHandle(clipped);
  };

  const appendMessage = useCallback((msg: OptimisticMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const replaceMessage = useCallback(
    (tempId: string, next: OptimisticMessage | null) => {
      setMessages((prev) => {
        if (next === null) return prev.filter((m) => m.id !== tempId);
        // If SSE already delivered the real row, drop the tmp instead of
        // inserting a duplicate.
        const alreadyHasReal = prev.some((m) => m.id === next.id);
        if (alreadyHasReal) return prev.filter((m) => m.id !== tempId);
        return prev.map((m) => (m.id === tempId ? next : m));
      });
    },
    [],
  );

  const markFailed = useCallback((tempId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === tempId ? { ...m, pending: false, failed: true } : m,
      ),
    );
  }, []);

  if (!handle) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-neutral-100">
        <form
          onSubmit={commitHandle}
          className="w-full max-w-sm rounded-lg border border-neutral-800 bg-neutral-900 p-6 shadow-xl"
        >
          <h1 className="mb-2 text-2xl font-bold">Memechat</h1>
          <p className="mb-4 text-sm text-neutral-400">
            Pick a handle to start posting memes. Stored in your browser.
          </p>
          <label htmlFor="handle" className="mb-1 block text-sm font-medium">
            Handle
          </label>
          <input
            id="handle"
            autoFocus
            value={handleDraft}
            onChange={(e) => setHandleDraft(e.target.value)}
            maxLength={MAX_HANDLE}
            placeholder="e.g. doge_lord"
            className="mb-4 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={!handleDraft.trim()}
            className="w-full rounded bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-neutral-700"
          >
            Enter chat
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900 px-4 py-3">
        <h1 className="text-lg font-bold tracking-tight">Memechat</h1>
        <div className="flex items-center gap-3 text-sm text-neutral-400">
          <span>
            signed in as{" "}
            <span className="font-semibold text-neutral-200">{handle}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              window.localStorage.removeItem(HANDLE_KEY);
              setHandle(null);
              setHandleDraft("");
            }}
            className="rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-800"
          >
            change
          </button>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {!loaded && (
            <p className="text-center text-sm text-neutral-500">loading…</p>
          )}
          {loaded && loadError && (
            <p className="text-center text-sm text-red-400">
              failed to load backlog: {loadError}
            </p>
          )}
          {loaded && !loadError && messages.length === 0 && (
            <p className="text-center text-sm text-neutral-500">
              no memes yet — be the first.
            </p>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </div>
      </section>

      <Composer
        handle={handle}
        appendMessage={appendMessage}
        replaceMessage={replaceMessage}
        markFailed={markFailed}
      />
    </main>
  );
}

function MessageBubble({ message }: { message: OptimisticMessage }) {
  return (
    <article className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2 text-sm">
        <span className="font-semibold text-neutral-200">{message.handle}</span>
        <time className="text-xs text-neutral-500">
          {formatTime(message.createdAt)}
        </time>
        {message.pending && (
          <span className="text-xs text-neutral-500">sending…</span>
        )}
        {message.failed && <span className="text-xs text-red-400">failed</span>}
      </div>
      <MemeImage
        src={message.imageUrl}
        topText={message.topText}
        bottomText={message.bottomText}
        faded={message.pending}
      />
    </article>
  );
}

function MemeImage({
  src,
  topText,
  bottomText,
  faded,
}: {
  src: string;
  topText: string | null;
  bottomText: string | null;
  faded?: boolean;
}) {
  return (
    <div
      className={`relative w-fit max-w-full overflow-hidden rounded border border-neutral-800 bg-black ${
        faded ? "opacity-60" : ""
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={topText ?? bottomText ?? "meme"}
        className="block max-h-[70vh] w-auto max-w-full"
      />
      {topText && <CaptionOverlay text={topText} position="top" />}
      {bottomText && <CaptionOverlay text={bottomText} position="bottom" />}
    </div>
  );
}

function CaptionOverlay({
  text,
  position,
}: {
  text: string;
  position: "top" | "bottom";
}) {
  const pos = position === "top" ? "top-2" : "bottom-2";
  return (
    <div
      className={`pointer-events-none absolute left-1/2 ${pos} w-[95%] -translate-x-1/2 px-2 text-center`}
    >
      <span className="meme-caption">{text}</span>
    </div>
  );
}

function Composer({
  handle,
  appendMessage,
  replaceMessage,
  markFailed,
}: {
  handle: string;
  appendMessage: (m: OptimisticMessage) => void;
  replaceMessage: (id: string, m: OptimisticMessage | null) => void;
  markFailed: (id: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [topText, setTopText] = useState("");
  const [bottomText, setBottomText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0] ?? null;
    setFile(next);
    setError(null);
  };

  const onPaste = (e: ClipboardEvent<HTMLFormElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const pasted = item.getAsFile();
        if (pasted) {
          setFile(pasted);
          setError(null);
          e.preventDefault();
          return;
        }
      }
    }
  };

  const reset = () => {
    setFile(null);
    setTopText("");
    setBottomText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const canSend = !!file && !submitting;

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!file || submitting) return;
    setSubmitting(true);
    setError(null);

    const tempId = `tmp-${crypto.randomUUID()}`;
    const localUrl = URL.createObjectURL(file);
    const optimistic: OptimisticMessage = {
      id: tempId,
      handle,
      imageUrl: localUrl,
      topText: topText.trim() || null,
      bottomText: bottomText.trim() || null,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    appendMessage(optimistic);

    try {
      const form = new FormData();
      form.append("file", file);
      const upRes = await fetch("/api/uploads", { method: "POST", body: form });
      if (!upRes.ok) {
        const body = await upRes.json().catch(() => ({}));
        throw new Error(body.error ?? `upload failed (${upRes.status})`);
      }
      const { url } = (await upRes.json()) as { url: string };

      const msgRes = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle,
          imageUrl: url,
          topText: optimistic.topText,
          bottomText: optimistic.bottomText,
        }),
      });
      if (!msgRes.ok) {
        const body = await msgRes.json().catch(() => ({}));
        throw new Error(body.error ?? `send failed (${msgRes.status})`);
      }
      const row: Message = await msgRes.json();
      replaceMessage(tempId, row);
      URL.revokeObjectURL(localUrl);
      reset();
    } catch (err) {
      markFailed(tempId);
      setError(err instanceof Error ? err.message : "send failed");
    } finally {
      setSubmitting(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSend) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <form
      onSubmit={send}
      onPaste={onPaste}
      onKeyDown={onKeyDown}
      className="border-t border-neutral-800 bg-neutral-900 px-4 py-3"
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 flex-col gap-2">
            <input
              aria-label="top caption"
              value={topText}
              onChange={(e) => setTopText(e.target.value)}
              maxLength={MAX_CAPTION}
              placeholder="top caption"
              className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 uppercase outline-none focus:border-blue-500"
            />
            <input
              aria-label="bottom caption"
              value={bottomText}
              onChange={(e) => setBottomText(e.target.value)}
              maxLength={MAX_CAPTION}
              placeholder="bottom caption"
              className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 uppercase outline-none focus:border-blue-500"
            />
            <div className="flex items-center gap-2 text-sm">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={onFileChange}
                className="block w-full text-sm text-neutral-400 file:mr-3 file:rounded file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-neutral-200 hover:file:bg-neutral-700"
              />
              <span className="whitespace-nowrap text-xs text-neutral-500">
                or paste
              </span>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:w-48">
            <div className="relative h-32 overflow-hidden rounded border border-dashed border-neutral-700 bg-neutral-950">
              {previewUrl ? (
                <MemeImage
                  src={previewUrl}
                  topText={topText.trim() || null}
                  bottomText={bottomText.trim() || null}
                />
              ) : (
                <div className="flex h-full items-center justify-center px-2 text-center text-xs text-neutral-500">
                  preview appears here
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={!canSend}
              className="rounded bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-neutral-700"
            >
              {submitting ? "sending…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

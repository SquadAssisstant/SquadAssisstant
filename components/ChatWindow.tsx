"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import UploadDocumentsForm from "./UploadDocumentsForm";

type Role = "user" | "assistant";

export type Message = {
  role: Role;
  content: string;
};

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type ChatWindowProps = {
  endpoint: string; // e.g. "api/chat"
  emoji?: string;
  placeholder?: string;
  emptyStateComponent?: React.ReactNode;
};

export function ChatWindow({
  endpoint,
  emoji = "🤖",
  placeholder = "Type a message…",
  emptyStateComponent,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);

  const apiUrl = useMemo(() => (endpoint.startsWith("/") ? endpoint : `/${endpoint}`), [endpoint]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    // 1) append the user message
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setBusy(true);

    try {
      // IMPORTANT: build the payload from the latest known state
      // We can’t rely on `messages` right after setMessages() due to async state updates,
      // so we reconstruct by appending to the current `messages` snapshot.
      const payload: Message[] = [...messages, { role: "user", content: text }];

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: json?.error || `Error (${res.status}) from chat endpoint.` },
        ]);
        return;
      }

      const assistantText =
        json?.message ??
        json?.content ??
        json?.output_text ??
        json?.text ??
        (typeof json === "string" ? json : null) ??
        "OK.";

      // 2) append assistant message
      setMessages((prev) => [...prev, { role: "assistant", content: String(assistantText) }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: e?.message || "Network error." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-700/40 bg-black/20 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="text-lg">{emoji}</div>
          <div className="text-xs uppercase tracking-[0.22em] text-slate-300/80">Chat</div>
        </div>

        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="rounded-xl border border-slate-700/60 bg-black/40 px-3 py-1.5 text-[10px] uppercase tracking-widest text-slate-200/80 hover:border-fuchsia-400/40 hover:text-fuchsia-200/90 transition"
        >
          Upload
        </button>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        className="mt-2 flex-1 overflow-y-auto rounded-2xl border border-slate-700/40 bg-black/15 p-3"
      >
        {messages.length === 0 ? (
          emptyStateComponent ?? (
            <div className="rounded-2xl border border-slate-700/40 bg-black/30 p-4 text-sm text-slate-200/80">
              Ask anything about squads, heroes, gear, drone, overlord, and uploads.
            </div>
          )
        ) : (
          <div className="space-y-3">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={cn(
                  "max-w-[92%] rounded-2xl border px-3 py-2 text-sm leading-relaxed",
                  m.role === "user"
                    ? "ml-auto border-cyan-400/25 bg-cyan-950/15 text-cyan-50/90"
                    : "mr-auto border-fuchsia-500/20 bg-black/30 text-slate-100/85"
                )}
              >
                {m.content}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="mt-2 rounded-2xl border border-slate-700/40 bg-black/20 p-2">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder={placeholder}
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-700/60 bg-black/35 px-3 py-2 text-sm text-slate-100/90 outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || !input.trim()}
            className={cn(
              "rounded-xl border px-4 py-2 text-xs uppercase tracking-widest transition",
              busy || !input.trim()
                ? "border-slate-700/60 bg-black/40 text-slate-400/70"
                : "border-cyan-400/30 bg-cyan-950/20 text-cyan-200/90 hover:border-cyan-300/40"
            )}
          >
            {busy ? "…" : "Send"}
          </button>
        </div>

        <div className="mt-2 text-[10px] uppercase tracking-widest text-slate-400/70">
          Tip: press Enter to send • Shift+Enter for newline
        </div>
      </div>

      {/* Upload Modal */}
      {uploadOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setUploadOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div className="absolute left-1/2 top-16 w-[min(980px,calc(100vw-24px))] -translate-x-1/2">
            <div className="overflow-hidden rounded-3xl border border-fuchsia-500/25 bg-black/65 backdrop-blur-xl shadow-[0_0_60px_rgba(168,85,247,.14)]">
              <div className="flex items-center justify-between border-b border-slate-800/60 px-5 py-4">
                <div className="text-sm tracking-[0.25em] text-fuchsia-200/90">UPLOAD</div>
                <button
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  className="rounded-full border border-slate-700/60 bg-black/40 px-3 py-1 text-xs uppercase tracking-widest text-slate-200/80 hover:border-fuchsia-400/40 hover:text-fuchsia-200/90 transition"
                >
                  ✕
                </button>
              </div>

              <div className="p-5">
                <UploadDocumentsForm
                  maxFiles={20}
                  endpoint="/api/uploads/image"
                  onAllDone={(results) => {
                    const okCount = results.filter((r: any) => r.ok).length;
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: "assistant",
                        content: `Upload batch complete: ${okCount}/${results.length} succeeded.`,
                      },
                    ]);
                  }}
                />
              </div>

              <div className="flex items-center justify-end border-t border-slate-800/60 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  className="rounded-2xl border border-slate-700/60 bg-black/40 px-4 py-2 text-xs uppercase tracking-widest text-slate-200/80 hover:border-fuchsia-400/40 hover:text-fuchsia-200/90 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

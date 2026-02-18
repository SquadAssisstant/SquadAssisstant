"use client";

<<<<<<< HEAD
import React, { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Paperclip } from "lucide-react";

// IMPORTANT: UploadDocumentsForm is a DEFAULT export in your project
import UploadDocumentsForm from "./UploadDocumentsForm";

type Role = "user" | "assistant";

=======
import React, { useMemo, useState } from "react";

type Role = "user" | "assistant";

>>>>>>> 64bf71b (Fix build: chatwindow/langgraph/uploads)
export type Message = {
  role: Role;
  content: string;
};

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

<<<<<<< HEAD
/**
 * ChatLayout: tiny wrapper used by /langgraph and anywhere else.
 */
export function ChatLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full w-full flex-col">{children}</div>;
}

/**
 * ChatInput: used by ChatWindow and also imported by /langgraph.
 * - Supports BOTH `right` and `actions` (alias) so older/newer callers work.
 */
export function ChatInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
  right,
  actions,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  placeholder?: string;
  disabled?: boolean;
  right?: React.ReactNode;
  actions?: React.ReactNode; // alias used by some pages
}) {
  const trailing = actions ?? right;

  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2">
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder ?? "Type a message…"}
        disabled={disabled}
        rows={1}
        className={cn(
          "w-full resize-none rounded-2xl border border-slate-700/50 bg-black/40 px-3 py-2 text-sm text-slate-100",
          "placeholder:text-slate-400/70 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30",
          disabled && "opacity-60"
        )}
        onKeyDown={(e) => {
          // Enter submits, Shift+Enter newline
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
          }
        }}
      />
      {trailing}
    </form>
  );
}

export function ChatWindow({
  endpoint,
  emoji = "🤖",
  placeholder,
  emptyStateComponent,
}: {
  endpoint: string; // e.g. "api/chat" or "/api/chat"
=======
export function ChatWindow(props: {
  endpoint: string; // e.g. "api/chat"
>>>>>>> 64bf71b (Fix build: chatwindow/langgraph/uploads)
  emoji?: string;
  placeholder?: string;
  emptyStateComponent?: React.ReactNode;
}) {
  const { endpoint, emoji = "🤖", placeholder = "Type a message…", emptyStateComponent } = props;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
<<<<<<< HEAD
  const [isSending, setIsSending] = useState(false);

  // Upload dialog state (used by the Paperclip button)
  const [uploadOpen, setUploadOpen] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);

  const normalizedEndpoint = useMemo(() => {
    // allow "api/chat" or "/api/chat"
    if (!endpoint.startsWith("/")) return `/${endpoint}`;
    return endpoint;
  }, [endpoint]);

  useEffect(() => {
    // keep scrolled to bottom
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, isSending]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isSending) return;

    setInput("");
    setIsSending(true);

    // Add user message immediately
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      const res = await fetch(normalizedEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send full conversation so the backend can maintain context
=======
  const [isLoading, setIsLoading] = useState(false);

  const canSend = useMemo(() => input.trim().length > 0 && !isLoading, [input, isLoading]);

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    // push user message immediately
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch(endpoint.startsWith("/") ? endpoint : `/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
>>>>>>> 64bf71b (Fix build: chatwindow/langgraph/uploads)
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: text }],
        }),
      });

<<<<<<< HEAD
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = (data && (data.error || data.message)) || `Request failed (${res.status})`;
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${msg}` }]);
        return;
      }

      // Accept a few common shapes:
      // 1) { content: "..." }
      // 2) { message: "..." }
      // 3) { messages: [...], output: "..." }
      const assistantText =
        (data && (data.content || data.message || data.output)) ??
        (typeof data === "string" ? data : null) ??
        "OK.";

      setMessages((prev) => [...prev, { role: "assistant", content: String(assistantText) }]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Network error: ${e?.message ?? "unknown"}` },
      ]);
    } finally {
      setIsSending(false);
=======
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }

      // Support either { message: "..." } or OpenAI-style { content: "..." }
      const data = await res.json().catch(() => null);

      const assistantText =
        (data && typeof data === "object" && (data.message ?? data.content)) ||
        (typeof data === "string" ? data : "");

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: String(assistantText || "✅ Received (no message payload).") },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ Error: ${err?.message ?? String(err)}` },
      ]);
    } finally {
      setIsLoading(false);
>>>>>>> 64bf71b (Fix build: chatwindow/langgraph/uploads)
    }
  }

  return (
<<<<<<< HEAD
    <ChatLayout>
      {/* messages */}
      <div
        ref={listRef}
        className="flex-1 overflow-auto rounded-2xl border border-slate-800/60 bg-black/20 p-3"
      >
        {messages.length === 0 ? (
          emptyStateComponent ?? (
            <div className="rounded-2xl border border-slate-700/40 bg-black/30 p-4 text-sm text-slate-200/80">
              {emoji} Ask me anything about squads, heroes, drone, overlord, gear…
=======
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 overflow-auto rounded-2xl border border-slate-800/60 bg-black/30 p-3">
        {messages.length === 0 ? (
          emptyStateComponent ?? (
            <div className="text-sm text-slate-300/70">
              {emoji} Ready. Ask me anything about squads, heroes, gear, drone, or overlord.
>>>>>>> 64bf71b (Fix build: chatwindow/langgraph/uploads)
            </div>
          )
        ) : (
          <div className="space-y-3">
<<<<<<< HEAD
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={cn(
                  "rounded-2xl border p-3 text-sm",
                  m.role === "user"
                    ? "ml-auto w-[min(92%,640px)] border-cyan-400/20 bg-cyan-950/15 text-slate-100"
                    : "mr-auto w-[min(92%,640px)] border-fuchsia-500/20 bg-black/35 text-slate-100"
                )}
              >
                <div className="mb-1 text-[10px] uppercase tracking-widest text-slate-400/80">
                  {m.role === "user" ? "You" : "Assistant"}
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
              </div>
            ))}
            {isSending ? (
              <div className="mr-auto flex w-[min(92%,640px)] items-center gap-2 rounded-2xl border border-slate-700/50 bg-black/30 p-3 text-sm text-slate-200/80">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Thinking…
              </div>
=======
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-2xl border p-3 text-sm leading-relaxed",
                  m.role === "user"
                    ? "ml-auto max-w-[85%] border-cyan-400/25 bg-cyan-950/10 text-slate-100/90"
                    : "mr-auto max-w-[85%] border-fuchsia-500/20 bg-fuchsia-950/10 text-slate-100/90"
                )}
              >
                <div className="mb-1 text-[10px] uppercase tracking-widest text-slate-400/70">
                  {m.role === "user" ? "you" : "assistant"}
                </div>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            ))}
            {isLoading ? (
              <div className="text-xs text-slate-400/70">…thinking</div>
>>>>>>> 64bf71b (Fix build: chatwindow/langgraph/uploads)
            ) : null}
          </div>
        )}
      </div>

<<<<<<< HEAD
      {/* input row */}
      <div className="mt-2">
        <ChatInput
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
          }}
          placeholder={placeholder ?? "Type a message…"}
          disabled={isSending}
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className={cn(
                  "inline-flex items-center justify-center rounded-2xl border border-slate-700/60 bg-black/40 px-3 py-2",
                  "text-xs uppercase tracking-widest text-slate-200/80 hover:border-fuchsia-400/40 hover:text-fuchsia-200/90 transition"
                )}
                title="Upload screenshots"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <button
                type="submit"
                disabled={isSending || input.trim().length === 0}
                className={cn(
                  "rounded-2xl border border-cyan-400/30 bg-cyan-950/20 px-4 py-2",
                  "text-xs uppercase tracking-widest text-cyan-200/90 hover:border-cyan-300/40 transition",
                  (isSending || input.trim().length === 0) && "opacity-60"
                )}
              >
                Send
              </button>
            </div>
          }
        />
      </div>

      {/* Upload modal (simple overlay) */}
      {uploadOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setUploadOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div className="absolute left-1/2 top-16 w-[min(920px,calc(100vw-24px))] -translate-x-1/2">
            <div className="rounded-3xl border border-fuchsia-500/25 bg-black/60 backdrop-blur-xl shadow-[0_0_60px_rgba(168,85,247,.14)] overflow-hidden">
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
                <UploadDocumentsForm />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </ChatLayout>
=======
      <form onSubmit={sendMessage} className="mt-2 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-2xl border border-slate-700/60 bg-black/40 px-4 py-3 text-sm text-slate-100/90 outline-none focus:border-fuchsia-400/40"
        />
        <button
          type="submit"
          disabled={!canSend}
          className={cn(
            "rounded-2xl border px-4 py-3 text-xs uppercase tracking-widest transition",
            canSend
              ? "border-fuchsia-400/40 bg-fuchsia-950/15 text-fuchsia-200/90 hover:bg-fuchsia-950/25"
              : "border-slate-700/60 bg-black/30 text-slate-400/70"
          )}
        >
          Send
        </button>
      </form>
    </div>
>>>>>>> 64bf71b (Fix build: chatwindow/langgraph/uploads)
  );
}

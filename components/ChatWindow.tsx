"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { LoaderCircle, Paperclip } from "lucide-react";
import UploadDocumentsForm from "./UploadDocumentsForm";

type Role = "user" | "assistant";
export type Message = { role: Role; content: string };

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function ChatLayout({
  header,
  children,
  footer,
  className,
}: {
  header?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full flex-col", className)}>
      {header ? <div className="shrink-0">{header}</div> : null}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      {footer ? <div className="shrink-0">{footer}</div> : null}
    </div>
  );
}

/**
 * IMPORTANT:
 * langgraph/page.tsx expects DOM-event style handlers:
 *   onChange={(e) => setX(e.target.value)}
 *   onSubmit={(e) => { e.preventDefault(); ... }}
 */
export function ChatInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
  right,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  placeholder?: string;
  disabled?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="flex items-end gap-2"
    >
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
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            // submit the form
            (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
          }
        }}
      />
      {right}
    </form>
  );
}

export function ChatWindow({
  endpoint,
  emoji,
  placeholder,
  emptyStateComponent,
}: {
  endpoint: string; // e.g. "api/chat"
  emoji?: string;
  placeholder?: string;
  emptyStateComponent?: React.ReactNode;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollToEnd = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);

  const send = useCallback(async () => {
    if (!canSend) return;

    const userText = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setSending(true);

    try {
      const res = await fetch(endpoint.startsWith("/") ? endpoint : `/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // NOTE: we send last known messages + the new user message
        body: JSON.stringify({ messages: [...messages, { role: "user", content: userText }] }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }

      const data = await res.json().catch(() => null);
      const reply =
        (data && (data.content ?? data.message ?? data.output)) ||
        "Received, but no response payload was returned.";

      setMessages((prev) => [...prev, { role: "assistant", content: String(reply) }]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ Chat error: ${e?.message ?? "unknown error"}` },
      ]);
    } finally {
      setSending(false);
      setTimeout(scrollToEnd, 50);
    }
  }, [canSend, endpoint, input, messages, scrollToEnd]);

  return (
    <ChatLayout
      className="h-full"
      header={
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-300/70">
            <span className="text-base">{emoji ?? "💬"}</span>
            <span>chat</span>
          </div>

          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700/60 bg-black/40 px-3 py-1.5 text-xs text-slate-200/80 hover:border-fuchsia-400/40 hover:text-fuchsia-200/90 transition"
          >
            <Paperclip className="h-4 w-4" />
            Upload
          </button>
        </div>
      }
      footer={
        <div className="px-3 pb-3">
          <ChatInput
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            placeholder={placeholder ?? "Ask something…"}
            disabled={sending}
            right={
              <button
                type="submit"
                disabled={!canSend}
                className={cn(
                  "rounded-2xl border px-4 py-2 text-xs uppercase tracking-widest transition",
                  canSend
                    ? "border-cyan-400/30 bg-cyan-950/20 text-cyan-200/90 hover:border-cyan-300/40"
                    : "border-slate-700/50 bg-black/30 text-slate-500"
                )}
                title={sending ? "Sending…" : "Send"}
              >
                {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Send"}
              </button>
            }
          />
        </div>
      }
    >
      <div className="px-3 py-2 space-y-3">
        {messages.length === 0 ? (
          emptyStateComponent ?? (
            <div className="rounded-2xl border border-slate-700/40 bg-black/30 p-4 text-sm text-slate-200/80">
              Start a conversation.
            </div>
          )
        ) : null}

        {messages.map((m, idx) => (
          <div
            key={idx}
            className={cn(
              "max-w-[90%] rounded-2xl border px-3 py-2 text-sm leading-relaxed",
              m.role === "user"
                ? "ml-auto border-cyan-400/20 bg-cyan-950/15 text-cyan-100/90"
                : "mr-auto border-fuchsia-500/20 bg-black/30 text-slate-100/90"
            )}
          >
            {m.content}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {uploadOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setUploadOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div className="absolute left-1/2 top-16 w-[min(880px,calc(100vw-24px))] -translate-x-1/2">
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
  );
}

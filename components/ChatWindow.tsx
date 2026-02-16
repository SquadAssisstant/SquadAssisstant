"use client";

import React, { useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";

type Role = "user" | "assistant";

export type Message = {
  role: Role;
  content: string;
};

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Some template pages import these.
 * Keep them exported so builds don’t fail even if you don’t use them on Home.
 */
export function ChatLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full w-full flex-col">{children}</div>;
}

/**
 * Minimal generic input used by some template pages.
 * (Even if your Home doesn’t use it, exporting prevents build errors.)
 */
export function ChatInput(props: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const { value, onChange, onSend, placeholder, disabled } = props;
  return (
    <div className="mt-2 flex items-end gap-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Type a message…"}
        className="min-h-[44px] w-full resize-none rounded-2xl border border-slate-700/60 bg-black/40 p-3 text-sm text-slate-100/90 outline-none focus:border-fuchsia-400/50"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!!disabled || value.trim().length === 0}
        className={cn(
          "rounded-2xl border px-4 py-3 text-xs uppercase tracking-widest transition",
          !disabled && value.trim().length > 0
            ? "border-fuchsia-500/30 bg-fuchsia-950/20 text-fuchsia-200/90 hover:border-fuchsia-400/50"
            : "border-slate-700/60 bg-black/30 text-slate-400/60 cursor-not-allowed"
        )}
      >
        Send
      </button>
    </div>
  );
}

export function ChatWindow(props: {
  endpoint: string;
  emoji?: string;
  placeholder?: string;
  emptyStateComponent?: React.ReactNode;

  // Some template pages pass these; accept them so builds don’t fail.
  showIntermediateStepsToggle?: boolean;
  showIngestForm?: boolean;
}) {
  const { endpoint, emoji = "🤖", placeholder = "Type a message…", emptyStateComponent } = props;

  // ✅ HARD TYPE: prevents inference drifting
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  async function send() {
    if (!canSend) return;

    const trimmed = input.trim();

    // ✅ FORCE LITERAL TYPES (no widening)
    const userMsg: Message = { role: "user" as const, content: trimmed };

    // ✅ FUNCTIONAL UPDATE = prev is Message[] contextually
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(endpoint.startsWith("/") ? endpoint : `/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ✅ IMPORTANT: send the conversation INCLUDING the new user message
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });

      const data = await res.json().catch(() => null);

      const assistantText =
        (data && (data.content || data.message || data.text || data.answer)) ??
        (typeof data === "string" ? data : "") ??
        "";

      const assistantMsg: Message = {
        role: "assistant" as const,
        content: assistantText || "No response.",
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant" as const, content: `Error: ${e?.message ?? "request failed"}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ChatLayout>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2 text-sm text-slate-200/80">
          <span className="text-lg">{emoji}</span>
          <span className="tracking-wide">Chat</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto rounded-2xl border border-slate-800/60 bg-black/25 p-3">
        {messages.length === 0 ? (
          emptyStateComponent ?? <div className="text-sm text-slate-300/70">Ask something to get started.</div>
        ) : (
          <div className="space-y-3">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={cn(
                  "rounded-2xl border px-3 py-2 text-sm",
                  m.role === "user"
                    ? "ml-auto max-w-[85%] border-cyan-400/25 bg-cyan-950/15 text-cyan-100/90"
                    : "mr-auto max-w-[85%] border-fuchsia-500/20 bg-black/35 text-slate-100/90"
                )}
              >
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-300/70">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Thinking…
          </div>
        ) : null}
      </div>

      {/* Input */}
      <ChatInput value={input} onChange={setInput} onSend={send} placeholder={placeholder} disabled={!canSend} />
    </ChatLayout>
  );
}

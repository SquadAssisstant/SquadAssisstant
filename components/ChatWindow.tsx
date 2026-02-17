"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Role = "user" | "assistant";

export type Message = {
  role: Role;
  content: string;
};

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function ChatLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-full w-full flex flex-col">{children}</div>;
}

export function ChatInput(props: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const { value, onChange, onSubmit, disabled, placeholder } = props;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled) onSubmit();
      }}
      className="mt-2 flex items-center gap-2"
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Type a message…"}
        className={cn(
          "flex-1 rounded-2xl border border-slate-700/60 bg-black/40",
          "px-4 py-3 text-sm text-slate-100/90 outline-none",
          "placeholder:text-slate-500/80"
        )}
      />
      <button
        type="submit"
        disabled={!!disabled || value.trim().length === 0}
        className={cn(
          "rounded-2xl border border-fuchsia-400/40 bg-fuchsia-950/15",
          "px-4 py-3 text-xs uppercase tracking-widest text-fuchsia-200/90",
          "disabled:opacity-50"
        )}
      >
        Send
      </button>
    </form>
  );
}

export function ChatWindow(props: {
  endpoint: string;
  emoji?: string;
  placeholder?: string;
  emptyStateComponent?: React.ReactNode;
}) {
  const { endpoint, emoji = "🤖", placeholder, emptyStateComponent } = props;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const hasMessages = messages.length > 0;

  useEffect(() => {
    // keep scrolled to bottom on new messages
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, loading]);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    // optimistic append user message
    const nextUser: Message = { role: "user", content: text };
    setInput("");
    setMessages((prev) => [...prev, nextUser]);
    setLoading(true);

    try {
      // Send whole history (simple). Your /api/chat can ignore/handle as needed.
      const payload = { messages: [...messages, nextUser] };

      const res = await fetch(endpoint.startsWith("/") ? endpoint : `/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `Request failed (${res.status})`);
      }

      const data: any = await res.json().catch(() => ({}));

      // Accept common response shapes:
      // 1) { message: "..." }
      // 2) { reply: "..." }
      // 3) { content: "..." }
      // 4) { messages: [...] }  (we'll take last assistant)
      let reply = "";
      if (typeof data?.message === "string") reply = data.message;
      else if (typeof data?.reply === "string") reply = data.reply;
      else if (typeof data?.content === "string") reply = data.content;
      else if (Array.isArray(data?.messages)) {
        const last = [...data.messages].reverse().find((m: any) => m?.role === "assistant" && typeof m?.content === "string");
        reply = last?.content ?? "";
      }

      if (!reply) reply = "Got it.";

      const nextAssistant: Message = { role: "assistant", content: reply };
      setMessages((prev) => [...prev, nextAssistant]);
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : "Unknown error";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ Chat error: ${msg}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ChatLayout>
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400/80">
          <span className="text-base">{emoji}</span>
          <span>chat</span>
        </div>
        {loading ? (
          <div className="text-[10px] uppercase tracking-widest text-slate-400/70">thinking…</div>
        ) : null}
      </div>

      <div
        ref={listRef}
        className={cn(
          "flex-1 overflow-auto rounded-2xl border border-slate-800/60 bg-black/20",
          "p-3"
        )}
      >
        {!hasMessages ? (
          emptyStateComponent ?? (
            <div className="rounded-2xl border border-slate-700/40 bg-black/30 p-4 text-sm text-slate-200/80">
              Ask anything about the game systems.
            </div>
          )
        ) : (
          <div className="space-y-3">
            {messages.map((m, idx) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={idx}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    isUser
                      ? "ml-auto border border-cyan-400/25 bg-cyan-950/15 text-cyan-50/90"
                      : "mr-auto border border-fuchsia-500/20 bg-black/35 text-slate-100/90"
                  )}
                >
                  {m.content}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={send}
        disabled={!canSend}
        placeholder={placeholder}
      />
    </ChatLayout>
  );
}

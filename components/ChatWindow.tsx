"use client";

import React, { FormEvent, ReactNode, useMemo, useState } from "react";

type Role = "user" | "assistant";

export type Message = {
  role: Role;
  content: string;
};

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function ChatInput(props: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: FormEvent) => void;
  placeholder?: string;
  disabled?: boolean;
  right?: ReactNode;
}) {
  const { value, onChange, onSubmit, placeholder, disabled, right } = props;

  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2">
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder ?? "Type a message…"}
        disabled={disabled}
        rows={1}
        className={cn(
          "flex-1 resize-none rounded-2xl border border-slate-700/50 bg-black/35",
          "px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500/80",
          "focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30"
        )}
      />
      {right ? (
        <div className="flex items-center gap-2">{right}</div>
      ) : (
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className={cn(
            "rounded-2xl border border-cyan-400/25 bg-cyan-950/20 px-4 py-2",
            "text-xs uppercase tracking-widest text-cyan-200/90",
            "hover:border-cyan-300/40 transition",
            (disabled || !value.trim()) && "opacity-50 cursor-not-allowed"
          )}
        >
          Send
        </button>
      )}
    </form>
  );
}

export function ChatLayout(props: { children: ReactNode }) {
  return <div className="h-full w-full">{props.children}</div>;
}

export function ChatWindow({
  endpoint,
  emoji,
  placeholder,
  emptyStateComponent,
}: {
  endpoint: string; // "api/chat" or "/api/chat"
  emoji?: string;
  placeholder?: string;
  emptyStateComponent?: ReactNode;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  const resolvedEndpoint = useMemo(() => (endpoint.startsWith("/") ? endpoint : `/${endpoint}`), [endpoint]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setValue("");
    setLoading(true);

    try {
      const res = await fetch(resolvedEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "Request failed");
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${errText}` }]);
        return;
      }

      const data = await res.json().catch(() => null);
      const assistantText =
        (data && (data.output ?? data.text ?? data.message ?? data.answer)) || "OK (no message returned)";

      setMessages((prev) => [...prev, { role: "assistant", content: String(assistantText) }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${e?.message ?? "unknown"}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex-1 overflow-auto rounded-2xl border border-slate-800/50 bg-black/20 p-3">
        {messages.length === 0 ? (
          emptyStateComponent ?? (
            <div className="text-sm text-slate-400/80">
              {emoji ? <span className="mr-2">{emoji}</span> : null}
              Start a chat.
            </div>
          )
        ) : (
          <div className="space-y-3">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={cn(
                  "rounded-2xl border px-3 py-2 text-sm",
                  m.role === "user"
                    ? "ml-auto max-w-[85%] border-cyan-400/20 bg-cyan-950/10 text-slate-100"
                    : "mr-auto max-w-[85%] border-fuchsia-500/15 bg-fuchsia-950/10 text-slate-100"
                )}
              >
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ChatInput
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onSubmit={(e) => {
          e.preventDefault();
          send(value);
        }}
        placeholder={placeholder ?? "Ask about squads, heroes, gear, drone…"}
        disabled={loading}
        right={
          <button
            type="button"
            disabled={loading || !value.trim()}
            className={cn(
              "rounded-2xl border border-cyan-400/25 bg-cyan-950/20 px-4 py-2",
              "text-xs uppercase tracking-widest text-cyan-200/90 hover:border-cyan-300/40 transition",
              (loading || !value.trim()) && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => send(value)}
          >
            {loading ? "..." : "Send"}
          </button>
        }
      />
    </div>
  );
}

export default ChatWindow;

"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";

/**
 * IMPORTANT:
 * Some pages / backends may send roles that are not strictly "user" | "assistant".
 * To prevent TypeScript from blocking builds, we allow string here.
 * UI still treats only "user" as user; everything else renders as assistant.
 */
export type Role = "user" | "assistant" | string;

export type Message = {
  role: Role;
  content: string;
};

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/** Small helpers so older pages importing these don't break */
export function ChatLayout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex h-full flex-col", className)}>{children}</div>;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex items-end gap-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Type a message…"}
        rows={2}
        className={cn(
          "w-full resize-none rounded-2xl border border-slate-700/50 bg-black/40 px-3 py-2",
          "text-sm text-slate-100 placeholder:text-slate-500",
          "focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30"
        )}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!disabled) onSend();
          }
        }}
      />
      <button
        type="button"
        onClick={onSend}
        disabled={disabled}
        className={cn(
          "shrink-0 rounded-2xl border px-4 py-2 text-xs uppercase tracking-widest",
          disabled
            ? "border-slate-700/50 bg-black/30 text-slate-500"
            : "border-fuchsia-500/30 bg-black/40 text-fuchsia-200 hover:border-fuchsia-400/40 hover:text-fuchsia-100"
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

  /** Compatibility flags used in other template pages; safe to ignore */
  showIntermediateStepsToggle?: boolean;
  showIngestForm?: boolean;

  /** Optional */
  className?: string;
  initialMessages?: Message[];
}) {
  const {
    endpoint,
    emoji = "🤖",
    placeholder,
    emptyStateComponent,
    className,
    initialMessages,
  } = props;

  const [messages, setMessages] = useState<Message[]>(
    () => initialMessages ?? []
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const endpointUrl = useMemo(() => {
    if (!endpoint) return "/api/chat";
    return endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  }, [endpoint]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }, []);

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    scrollToBottom();

    try {
      const res = await fetch(endpointUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          // common patterns across different endpoints:
          messages: nextMessages,
          input: trimmed,
        }),
      });

      const data = await res.json().catch(() => ({}));

      // Try to normalize the response into a single assistant message:
      // supports many shapes depending on which backend route is used.
      const content =
        data?.content ??
        data?.message ??
        data?.output ??
        data?.text ??
        data?.answer ??
        (typeof data === "string" ? data : null);

      const assistantText =
        typeof content === "string" && content.length
          ? content
          : res.ok
          ? "(No response content returned.)"
          : data?.error
          ? String(data.error)
          : "Request failed.";

      setMessages((prev) => [...prev, { role: "assistant", content: assistantText }]);
      scrollToBottom();
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Network error: ${e?.message ?? "unknown"}` },
      ]);
      scrollToBottom();
    } finally {
      setLoading(false);
    }
  }, [endpointUrl, input, loading, messages, scrollToBottom]);

  return (
    <ChatLayout className={cn("h-full w-full", className)}>
      {/* Messages */}
      <div className="flex-1 overflow-auto rounded-2xl border border-slate-800/50 bg-black/20 p-3">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            {emptyStateComponent ?? (
              <div className="rounded-2xl border border-slate-700/40 bg-black/30 p-4 text-sm text-slate-300/70">
                <div className="text-lg">{emoji}</div>
                <div className="mt-2">Ask me anything about the game.</div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m, idx) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={idx}
                  className={cn(
                    "flex",
                    isUser ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl border px-3 py-2 text-sm leading-relaxed",
                      isUser
                        ? "border-fuchsia-500/25 bg-fuchsia-950/20 text-slate-100"
                        : "border-slate-700/50 bg-black/35 text-slate-100"
                    )}
                  >
                    {!isUser ? (
                      <div className="mb-1 text-[10px] uppercase tracking-widest text-slate-400/70">
                        {emoji} assistant
                      </div>
                    ) : (
                      <div className="mb-1 text-[10px] uppercase tracking-widest text-slate-400/70">
                        you
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="mt-2 rounded-2xl border border-slate-800/50 bg-black/25 p-2">
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={send}
          disabled={loading}
          placeholder={placeholder}
        />
        <div className="mt-2 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-widest text-slate-500/80">
            {endpointUrl}
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-300/70">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              thinking…
            </div>
          ) : null}
        </div>
      </div>
    </ChatLayout>
  );
}

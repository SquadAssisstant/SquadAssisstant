"use client";

import React, { useMemo, useState } from "react";
import { ArrowDown, LoaderCircle, Paperclip } from "lucide-react";
import { Checkbox } from "./ui/checkbox";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

import UploadDocumentsForm from "./UploadDocumentsForm";

type Role = "user" | "assistant";
export type Message = { role: Role; content: string };

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function ChatWindow(props: {
  endpoint: string;
  emoji?: string;
  placeholder?: string;
  emptyStateComponent?: React.ReactNode;
}) {
  const { endpoint, emoji = "🤖", placeholder = "Type a message…", emptyStateComponent } = props;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  async function send() {
    if (!canSend) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    const newMessages: Message[] = [...messages, userMsg];

    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(endpoint.startsWith("/") ? endpoint : `/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json().catch(() => null);

      // Normalize whatever your API returns into Message
      const assistantText =
        (data && (data.content || data.message || data.text || data.answer)) ??
        (typeof data === "string" ? data : "") ??
        "";

      const assistantMsg: Message = {
        role: "assistant",
        content: assistantText || "No response.",
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${e?.message ?? "request failed"}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2 text-sm text-slate-200/80">
          <span className="text-lg">{emoji}</span>
          <span className="tracking-wide">Chat</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Upload button */}
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700/60 bg-black/40 px-3 py-1.5 text-xs text-slate-200/80 hover:border-fuchsia-400/40 hover:text-fuchsia-200/90 transition"
                title="Upload images/documents"
              >
                <Paperclip className="h-4 w-4" />
                Upload
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-[min(900px,calc(100vw-24px))]">
              <DialogHeader>
                <DialogTitle>Upload</DialogTitle>
                <DialogDescription>
                  Upload up to your allowed max in one go. Use the dropdown to tell the system what you’re uploading.
                </DialogDescription>
              </DialogHeader>

              {/* IMPORTANT: UploadDocumentsForm is a DEFAULT export */}
              <UploadDocumentsForm />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto rounded-2xl border border-slate-800/60 bg-black/25 p-3">
        {messages.length === 0 ? (
          emptyStateComponent ?? (
            <div className="text-sm text-slate-300/70">
              Ask something to get started.
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
      <div className="mt-2 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="min-h-[44px] w-full resize-none rounded-2xl border border-slate-700/60 bg-black/40 p-3 text-sm text-slate-100/90 outline-none focus:border-fuchsia-400/50"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />

        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          className={cn(
            "rounded-2xl border px-4 py-3 text-xs uppercase tracking-widest transition",
            canSend
              ? "border-fuchsia-500/30 bg-fuchsia-950/20 text-fuchsia-200/90 hover:border-fuchsia-400/50"
              : "border-slate-700/60 bg-black/30 text-slate-400/60 cursor-not-allowed"
          )}
        >
          Send
        </button>
      </div>
    </div>
  );
}

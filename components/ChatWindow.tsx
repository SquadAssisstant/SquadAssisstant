"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, LoaderCircle, Paperclip } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import UploadDocumentsForm from "./UploadDocumentsForm"; // ✅ FIXED (default import)

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export function ChatWindow({
  endpoint,
  emoji,
  placeholder,
  emptyStateComponent,
}: {
  endpoint: string;
  emoji?: string;
  placeholder?: string;
  emptyStateComponent?: React.ReactNode;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [useRetriever, setUseRetriever] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim()) return;

    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, useRetriever }),
      });

      const data = await res.json();

      setMessages([
        ...newMessages,
        { role: "assistant", content: data.output ?? "No response." },
      ]);
    } catch (err) {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Error contacting server." },
      ]);
    }

    setLoading(false);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 p-3">
        {messages.length === 0 && emptyStateComponent}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-xl px-4 py-2 text-sm ${
              m.role === "assistant"
                ? "bg-slate-800 text-slate-100"
                : "bg-fuchsia-700 text-white ml-auto"
            } max-w-[85%]`}
          >
            {m.role === "assistant" && emoji ? (
              <span className="mr-2">{emoji}</span>
            ) : null}
            {m.content}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <LoaderCircle className="animate-spin h-4 w-4" />
            Thinking…
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Controls */}
      <div className="border-t border-slate-800 p-3 space-y-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Checkbox
            checked={useRetriever}
            onCheckedChange={(v) => setUseRetriever(Boolean(v))}
          />
          Use saved uploads in responses
        </div>

        <div className="flex items-center gap-2">
          {/* Upload Dialog */}
          <Dialog>
            <DialogTrigger asChild>
              <button className="p-2 rounded-xl border border-slate-700 hover:border-fuchsia-500 transition">
                <Paperclip className="h-4 w-4" />
              </button>
            </DialogTrigger>

            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Upload Game Screenshots</DialogTitle>
              </DialogHeader>

              {/* ✅ This now works correctly */}
              <UploadDocumentsForm />
            </DialogContent>
          </Dialog>

          {/* Input */}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={placeholder ?? "Ask something..."}
            className="flex-1 rounded-xl border border-slate-700 bg-black px-4 py-2 text-sm text-white outline-none focus:border-fuchsia-500"
          />

          <button
            onClick={sendMessage}
            disabled={loading}
            className="rounded-xl border border-fuchsia-500 bg-fuchsia-600 px-4 py-2 text-sm text-white hover:bg-fuchsia-700 transition disabled:opacity-50"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

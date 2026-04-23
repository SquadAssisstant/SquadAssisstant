"use client";

import React from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type MainChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
};

export function ChatMessage({ message }: { message: MainChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <div
      className={cx(
        "max-w-[92%] rounded-3xl border px-4 py-3 text-sm leading-6 shadow-sm",
        isUser
          ? "ml-auto border-emerald-400/25 bg-emerald-500/10 text-emerald-50"
          : isSystem
          ? "mx-auto border-amber-400/25 bg-amber-500/10 text-amber-100"
          : "mr-auto border-white/10 bg-white/5 text-white/85"
      )}
    >
      <div className="mb-1 text-[11px] uppercase tracking-[0.22em] text-white/40">
        {isUser ? "You" : isSystem ? "Special" : "SquadAssistant"}
      </div>
      <div className="whitespace-pre-wrap">{message.text}</div>
    </div>
  );
}

"use client";

import React, { useCallback, useMemo, useState } from "react";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessage, type MainChatMessage } from "@/components/chat/ChatMessage";

type ChatApiResponse = {
  ok?: boolean;
  answer?: string;
  error?: string;
  easter_egg?: {
    title: string;
    body: string;
  } | null;
  knowledge_saved_summary?: string[];
};

async function readFilesAsDataUrls(files: FileList | null): Promise<{ dataUrls: string[]; names: string[] }> {
  if (!files || !files.length) return { dataUrls: [], names: [] };

  const picked = Array.from(files).slice(0, 4);
  const results = await Promise.all(
    picked.map(
      (file) =>
        new Promise<{ dataUrl: string; name: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ dataUrl: String(reader.result || ""), name: file.name });
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
          reader.readAsDataURL(file);
        })
    )
  );

  return {
    dataUrls: results.map((r) => r.dataUrl).filter(Boolean),
    names: results.map((r) => r.name),
  };
}

export function MainChat() {
  const [messages, setMessages] = useState<MainChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text:
        "Main Chat is your central advisor. I can explain your saved data, help you choose the right optimizer settings, continue confusing analyzer or optimizer conversations, and learn from screenshots, downloaded images, and links without saving or exposing player, server, or alliance identifiers.",
    },
  ]);

  const [input, setInput] = useState("");
  const [attachmentLinks, setAttachmentLinks] = useState("");
  const [uploadIds, setUploadIds] = useState("");
  const [selectedImageDataUrls, setSelectedImageDataUrls] = useState<string[]>([]);
  const [selectedImageNames, setSelectedImageNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [easterEgg, setEasterEgg] = useState<{ title: string; body: string } | null>(null);

  const canSend = useMemo(() => {
    return Boolean(input.trim() || attachmentLinks.trim() || uploadIds.trim() || selectedImageDataUrls.length);
  }, [attachmentLinks, input, selectedImageDataUrls.length, uploadIds]);

  const handlePickImages = useCallback(async (files: FileList | null) => {
    try {
      const { dataUrls, names } = await readFilesAsDataUrls(files);
      setSelectedImageDataUrls(dataUrls);
      setSelectedImageNames(names);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const onSend = useCallback(async () => {
    if (!canSend || busy) return;

    const text = input.trim();
    const rawLinks = attachmentLinks
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    const parsedUploadIds = uploadIds
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v) && v > 0);

    const composedUserText =
      [
        text || null,
        rawLinks.length ? `Links: ${rawLinks.join(", ")}` : null,
        parsedUploadIds.length ? `Saved Upload IDs: ${parsedUploadIds.join(", ")}` : null,
        selectedImageNames.length ? `New Screenshots: ${selectedImageNames.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("\n\n") || "Analyze attached material.";

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text: composedUserText,
      },
    ]);

    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: text,
          links: rawLinks,
          upload_ids: parsedUploadIds,
          image_data_urls: selectedImageDataUrls,
          prior_messages: messages.slice(-6).map((m) => ({
            role: m.role,
            text: m.text,
          })),
          save_learnings: true,
        }),
      });

      const json = (await res.json().catch(() => null)) as ChatApiResponse | null;

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-error-${Date.now()}`,
            role: "assistant",
            text: json?.error ?? `Main chat failed (${res.status})`,
          },
        ]);
        return;
      }

      if (json?.easter_egg?.body) {
        setEasterEgg(json.easter_egg);
        setMessages((prev) => [
          ...prev,
          {
            id: `system-${Date.now()}`,
            role: "system",
            text: "Special shoutout unlocked.",
          },
        ]);
      } else {
        const savedNotes =
          json?.knowledge_saved_summary?.length
            ? `\n\nSaved knowledge:\n${json.knowledge_saved_summary.join("\n")}`
            : "";

        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            text: `${json?.answer ?? "No answer returned."}${savedNotes}`,
          },
        ]);
      }

      setInput("");
      setAttachmentLinks("");
      setUploadIds("");
      setSelectedImageDataUrls([]);
      setSelectedImageNames([]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-catch-${Date.now()}`,
          role: "assistant",
          text: e?.message ?? "Main chat failed",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }, [attachmentLinks, busy, canSend, input, messages, selectedImageDataUrls, selectedImageNames, uploadIds]);

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pb-4 md:px-6 md:pb-6">
        <div className="flex min-h-[calc(100vh-260px)] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-b from-[#0c1424] to-[#08101d]">
          <div className="border-b border-white/10 px-5 py-4 md:px-6">
            <div className="text-lg font-semibold text-white">Main Chat</div>
            <div className="mt-1 text-sm text-white/55">
              Central advisor for saved data, game questions, screenshot learning, downloaded images, and safe knowledge growth.
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
            </div>
          </div>

          <ChatInput
            value={input}
            onChange={setInput}
            onSend={onSend}
            disabled={busy}
            attachmentLinks={attachmentLinks}
            onAttachmentLinksChange={setAttachmentLinks}
            uploadIds={uploadIds}
            onUploadIdsChange={setUploadIds}
            onPickImages={handlePickImages}
            selectedImageNames={selectedImageNames}
          />
        </div>
      </div>

      {easterEgg ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-3xl rounded-[32px] border border-yellow-400/25 bg-[#0d1018] p-6 shadow-2xl md:p-10">
            <div className="text-center">
              <div className="text-xs uppercase tracking-[0.4em] text-yellow-300/65">{easterEgg.title}</div>
              <div
                className="mt-6 whitespace-pre-wrap text-center text-[24px] leading-[1.9] md:text-[32px]"
                style={{
                  color: "#e7c66b",
                  textShadow: "0 0 18px rgba(231,198,107,0.25)",
                  fontFamily: '"Brush Script MT","Lucida Handwriting","Apple Chancery","Segoe Script",cursive',
                }}
              >
                {easterEgg.body}
              </div>

              <button
                onClick={() => setEasterEgg(null)}
                className="mt-8 rounded-2xl border border-yellow-400/20 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-100 hover:bg-yellow-500/15"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

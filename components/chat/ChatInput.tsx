"use client";

import React from "react";

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  attachmentLinks: string;
  onAttachmentLinksChange: (value: string) => void;
  uploadIds: string;
  onUploadIdsChange: (value: string) => void;
  onPickImages: (files: FileList | null) => void;
  selectedImageNames: string[];
};

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  attachmentLinks,
  onAttachmentLinksChange,
  uploadIds,
  onUploadIdsChange,
  onPickImages,
  selectedImageNames,
}: ChatInputProps) {
  return (
    <div className="border-t border-white/10 bg-[#09111f]/95 px-3 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 md:px-5 md:pt-4">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={uploadIds}
            onChange={(e) => onUploadIdsChange(e.target.value)}
            placeholder="Saved upload IDs, comma separated"
            className="w-full rounded-2xl border border-white/15 bg-[#0a0f18] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
          />

          <input
            value={attachmentLinks}
            onChange={(e) => onAttachmentLinksChange(e.target.value)}
            placeholder="Image or video links, comma separated"
            className="w-full rounded-2xl border border-white/15 bg-[#0a0f18] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
          />

          <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-white/15 bg-[#0a0f18] px-4 py-3 text-sm text-white/80 hover:bg-white/5">
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => onPickImages(e.target.files)}
            />
            Add Screenshots
          </label>
        </div>

        {selectedImageNames.length ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs uppercase tracking-[0.22em] text-white/40">Selected Images</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedImageNames.map((name, idx) => (
                <span
                  key={`${name}-${idx}`}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex gap-3">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="Ask about your saved roster, optimizer settings, analyzer results, new screenshots, patch images, mechanics, and more..."
            rows={3}
            disabled={disabled}
            className="min-h-[76px] flex-1 resize-none rounded-3xl border border-white/15 bg-[#0a0f18] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 disabled:opacity-50"
          />

          <button
            onClick={onSend}
            disabled={disabled}
            type="button"
            className="self-end rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-5 py-3 text-sm text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-40"
          >
            {disabled ? "Thinking…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

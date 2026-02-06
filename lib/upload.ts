export function guessExtFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m === "image/jpeg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/heic" || m === "image/heif") return "heic";
  return "bin";
}

export function safePathSegment(s: string) {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

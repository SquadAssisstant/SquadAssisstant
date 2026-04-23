import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type KnowledgeEntryInput = {
  category: string;
  subject_key: string;
  title: string;
  content: string;
  confidence: number;
  source_upload_ids?: number[];
  source_links?: string[];
};

export function redactSensitiveGameIdentifiers(text: string) {
  let out = String(text || "");

  out = out.replace(/\b(server|svr|srv)\s*#?\s*\d+\b/gi, "[server redacted]");
  out = out.replace(/\balliance\s*[:\-]?\s*[A-Za-z0-9_\-\[\]]{2,}\b/gi, "[alliance redacted]");
  out = out.replace(/\bplayer\s*[:\-]?\s*[A-Za-z0-9_\-\[\]]{2,}\b/gi, "[player redacted]");

  return out;
}

export async function saveKnowledgeEntries(entries: KnowledgeEntryInput[]) {
  if (!entries.length) return { inserted: 0 };

  const sb: any = supabaseAdmin();

  const payload = entries.map((entry) => ({
    category: entry.category,
    subject_key: entry.subject_key,
    title: redactSensitiveGameIdentifiers(entry.title),
    content: redactSensitiveGameIdentifiers(entry.content),
    confidence: entry.confidence,
    source_upload_ids: entry.source_upload_ids ?? [],
    source_links: entry.source_links ?? [],
  }));

  const { error } = await sb.from("game_knowledge_entries").insert(payload);

  if (error) {
    throw new Error(error.message || "Failed to save knowledge entries");
  }

  return { inserted: payload.length };
}

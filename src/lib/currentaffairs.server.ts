import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";

import { createGoogleProvider, embedText, toVectorLiteral } from "./ai-gateway.server";
import { getSupabaseAdmin, loadChapterBySlug } from "./upsc.server";

const VISION = "gemini-2.5-flash";

function getProvider() {
  return createGoogleProvider();
}

const ExtractedNewsSchema = z.object({
  items: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
      topic: z.string().nullable().optional(),
      published_on: z.string().nullable().optional(),
    }),
  ),
});
export type ExtractedNews = z.infer<typeof ExtractedNewsSchema>["items"][number];

const INSTRUCTIONS = `You are an expert UPSC current-affairs editor. From this newspaper page (PDF, image, or text), extract every distinct news item likely to be UPSC-relevant (polity, governance, economy, IR, environment, S&T, schemes, judgments).
For each item output:
- title (short headline, 8-14 words)
- summary (3-5 crisp sentences: what happened, why, who is involved, UPSC angle if any)
- topic (short label linking to a syllabus area, e.g. "Parliament", "Governor", "Fundamental Rights", "Monetary Policy", "Judiciary")
- published_on (YYYY-MM-DD if visible in the paper's date; otherwise null)
Skip ads, weather, sports scores, and horoscopes. Do not invent dates.`;

export async function extractNewsFromMedia(opts: {
  mimeType: string;
  base64: string;
}): Promise<ExtractedNews[]> {
  const provider = getProvider();
  const isImage = opts.mimeType.startsWith("image/");
  const filePart = isImage
    ? { type: "image" as const, image: `data:${opts.mimeType};base64,${opts.base64}` }
    : { type: "file" as const, mediaType: opts.mimeType, data: opts.base64 };
  try {
    const { output } = await generateText({
      model: provider(VISION),
      output: Output.object({ schema: ExtractedNewsSchema }),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: INSTRUCTIONS },
            filePart,
          ],
        },
      ],
    });
    return output.items.filter((i) => i.title && i.summary);
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      try {
        return ExtractedNewsSchema.parse(JSON.parse(error.text ?? "{}")).items;
      } catch {
        return [];
      }
    }
    throw error;
  }
}

export async function extractNewsFromText(text: string): Promise<ExtractedNews[]> {
  const provider = getProvider();
  try {
    const { output } = await generateText({
      model: provider(VISION),
      output: Output.object({ schema: ExtractedNewsSchema }),
      prompt: `${INSTRUCTIONS}\n\nSource text:\n${text}`,
    });
    return output.items.filter((i) => i.title && i.summary);
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) return [];
    throw error;
  }
}

export async function insertNews(
  rows: ExtractedNews[],
  defaults: { source?: string; published_on?: string },
) {
  if (rows.length === 0) return { inserted: 0 };
  const sb = await getSupabaseAdmin();
  type Insert = {
    source: string;
    published_on: string | null;
    title: string;
    summary: string;
    topic: string | null;
    embedding: string | null;
  };
  const payload: Insert[] = [];
  for (const r of rows) {
    const text = `${r.title}\n${r.summary}${r.topic ? `\nTopic: ${r.topic}` : ""}`;
    let embedding: string | null = null;
    try {
      embedding = toVectorLiteral(await embedText(text));
    } catch {
      embedding = null;
    }
    payload.push({
      source: defaults.source ?? "Newspaper",
      published_on: r.published_on ?? defaults.published_on ?? null,
      title: r.title,
      summary: r.summary,
      topic: r.topic ?? null,
      embedding,
    });
  }
  const { data, error } = await sb.from("current_affairs").insert(payload as never).select("id");
  if (error) throw new Error(error.message);
  const insertedIds = (data ?? []).map((d) => d.id as string);
  let notified = 0;
  try {
    notified = await notifyMatchingChapters(insertedIds);
  } catch (e) {
    console.error("notifyMatchingChapters failed", e);
  }
  return { inserted: insertedIds.length, notified };
}

/**
 * For each newly inserted current-affairs item, find chapters the user is
 * currently studying or considered weak and, when the news embedding matches
 * the chapter content, insert a notification.
 */
async function notifyMatchingChapters(newsIds: string[]): Promise<number> {
  if (newsIds.length === 0) return 0;
  const sb = await getSupabaseAdmin();

  // 1. Fetch new news rows with embeddings.
  const { data: newsRows } = await sb
    .from("current_affairs")
    .select("id, embedding")
    .in("id", newsIds);
  const usable = (newsRows ?? []).filter((r) => r.embedding);
  if (usable.length === 0) return 0;

  // 2. Compute studying + weak chapter sets.
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const [attemptsRes, dueRes] = await Promise.all([
    sb.from("quiz_attempts").select("chapter_id, score, total, taken_at"),
    sb
      .from("revision_schedule")
      .select("chapter_id, due_at, done_at")
      .is("done_at", null),
  ]);
  const attempts = attemptsRes.data ?? [];
  const dueRows = dueRes.data ?? [];

  const studying = new Set<string>();
  for (const a of attempts) {
    if (a.taken_at && a.taken_at >= cutoff) studying.add(a.chapter_id);
  }
  for (const r of dueRows) studying.add(r.chapter_id);

  const totals = new Map<string, { c: number; t: number }>();
  for (const a of attempts) {
    const cur = totals.get(a.chapter_id) ?? { c: 0, t: 0 };
    cur.c += a.score ?? 0;
    cur.t += a.total ?? 0;
    totals.set(a.chapter_id, cur);
  }
  const weak = new Set<string>();
  for (const [id, v] of totals) {
    if (v.t > 0 && v.c / v.t < 0.7) weak.add(id);
  }

  const relevant = new Set<string>([...studying, ...weak]);
  if (relevant.size === 0) return 0;

  // 3. For each news item, match chapters and insert notifications
  //    (unique constraint prevents duplicates on repeat ingestion).
  type NotifRow = {
    current_affairs_id: string;
    chapter_id: string;
    reason: "studying" | "weak";
    similarity: number;
  };
  const rowsToInsert: NotifRow[] = [];
  for (const n of usable) {
    const { data: matches } = await sb.rpc("match_chapters_for_news", {
      query_embedding: n.embedding as unknown as string,
      match_threshold: 0.55,
      max_chapters: 6,
    });
    for (const m of (matches ?? []) as { chapter_id: string; similarity: number }[]) {
      if (!relevant.has(m.chapter_id)) continue;
      const reason: "studying" | "weak" = weak.has(m.chapter_id) ? "weak" : "studying";
      rowsToInsert.push({
        current_affairs_id: n.id as string,
        chapter_id: m.chapter_id,
        reason,
        similarity: m.similarity,
      });
    }
  }
  if (rowsToInsert.length === 0) return 0;
  const { data: inserted } = await sb
    .from("notifications")
    .upsert(rowsToInsert as never, { onConflict: "current_affairs_id,chapter_id", ignoreDuplicates: true })
    .select("id");
  return inserted?.length ?? 0;
}

export type RelatedNews = {
  id: string;
  title: string;
  summary: string;
  source: string;
  published_on: string | null;
  topic: string | null;
  similarity: number;
};

export async function findRelatedNewsForChapter(slug: string, limit = 5): Promise<RelatedNews[]> {
  const { chapter, chunks } = await loadChapterBySlug(slug);
  const text = `${chapter.title}\n${chunks
    .map((c) => `${c.heading ?? ""}\n${c.content}`)
    .join("\n\n")
    .slice(0, 6000)}`;
  let vec: number[];
  try {
    vec = await embedText(text);
  } catch {
    return [];
  }
  const sb = await getSupabaseAdmin();
  const { data, error } = await sb.rpc("match_current_affairs", {
    query_embedding: toVectorLiteral(vec) as unknown as string,
    match_count: limit,
  });
  if (error) return [];
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    summary: r.summary as string,
    source: (r.source as string) ?? "Newspaper",
    published_on: (r.published_on as string | null) ?? null,
    topic: (r.topic as string | null) ?? null,
    similarity: (r.similarity as number) ?? 0,
  }));
}
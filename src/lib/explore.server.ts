import { generateText } from "ai";

import { createGoogleProvider, embedText, toVectorLiteral } from "./ai-gateway.server";
import { getSupabaseAdmin } from "./upsc.server";

const MODEL = "gemini-2.5-flash";

function provider() {
  return createGoogleProvider();
}

export type Passage = {
  id: string;
  heading: string | null;
  content: string;
  page_start: number | null;
  page_end: number | null;
  chapterSlug: string | null;
  chapterTitle: string | null;
  bookTitle: string | null;
  isOfficial: boolean;
  similarity: number;
};

export type TopNews = {
  id: string;
  title: string;
  summary: string;
  source: string;
  published_on: string | null;
  topic: string | null;
  similarity: number;
  match?: MatchContext;
};

export type TopPyq = {
  id: string;
  question: string;
  year: number | null;
  topic: string | null;
  similarity: number;
  match?: MatchContext;
};

export type MatchContext = {
  reason: string;
  quote: string | null;
  articles: string[];
  ref: {
    chapterSlug: string | null;
    chapterTitle: string | null;
    bookTitle: string | null;
    heading: string | null;
    page_start: number | null;
    page_end: number | null;
  } | null;
  similarityPct: number;
};

const STOP = new Set([
  "the","a","an","of","and","or","to","in","on","for","with","is","are","was","were","be","by","as","at","from","that","this","these","those","it","its","who","whom","what","which","how","why","when","where","under","which","into","about","between","among","also","upsc",
]);

function keywords(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOP.has(w)),
    ),
  );
}

function extractArticles(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\bArticle\s+\d+[A-Z]?\b/gi)) out.add(m[0].replace(/\s+/g, " "));
  for (const m of text.matchAll(/\b(?:\d+(?:st|nd|rd|th))\s+Amendment\b/gi)) out.add(m[0]);
  for (const m of text.matchAll(/\bSchedule\s+[IVX]+\b/gi)) out.add(m[0]);
  return Array.from(out).slice(0, 5);
}

function pickQuote(passage: string, target: string): string | null {
  const sentences = passage
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 260);
  if (sentences.length === 0) return null;
  const kw = keywords(target);
  let best = sentences[0];
  let bestScore = -1;
  for (const s of sentences) {
    const low = s.toLowerCase();
    let score = 0;
    for (const k of kw) if (low.includes(k)) score += 2;
    if (/\bArticle\s+\d+/i.test(s)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return bestScore <= 0 ? sentences[0] : best;
}

function overlapWords(a: string, b: string): string[] {
  const kw = new Set(keywords(a));
  const shared: string[] = [];
  for (const w of keywords(b)) if (kw.has(w) && !shared.includes(w)) shared.push(w);
  return shared.slice(0, 4);
}

function buildMatch(
  target: string,
  similarity: number,
  passages: Passage[],
): MatchContext {
  const top = passages[0] ?? null;
  const body = passages.map((p) => `${p.heading ?? ""} ${p.content}`).join(" ");
  const articles = extractArticles(body);
  const shared = top ? overlapWords(target, `${top.heading ?? ""} ${top.content}`) : [];
  const parts: string[] = [];
  if (shared.length > 0) parts.push(`Shares "${shared.join(", ")}"`);
  if (articles.length > 0) parts.push(`references ${articles.slice(0, 2).join(", ")}`);
  if (top?.chapterTitle) parts.push(`same chapter as "${top.chapterTitle}"`);
  const reason =
    parts.length > 0
      ? parts.join(" · ")
      : `Semantic match (${Math.round(similarity * 100)}%)`;
  return {
    reason,
    quote: top ? pickQuote(top.content, target) : null,
    articles,
    ref: top
      ? {
          chapterSlug: top.chapterSlug,
          chapterTitle: top.chapterTitle,
          bookTitle: top.bookTitle,
          heading: top.heading,
          page_start: top.page_start,
          page_end: top.page_end,
        }
      : null,
    similarityPct: Math.round(similarity * 100),
  };
}

export async function exploreTopic(
  query: string,
  mode: "crisp" | "textbook",
  strict: boolean,
): Promise<{
  mode: "crisp" | "textbook";
  passages: Passage[];
  summary: string | null;
  topNews: TopNews | null;
  topPyq: TopPyq | null;
}> {
  const sb = await getSupabaseAdmin();
  let vec: number[];
  try {
    vec = await embedText(query);
  } catch {
    return { mode, passages: [], summary: null, topNews: null, topPyq: null };
  }
  const embedding = toVectorLiteral(vec) as unknown as string;

  const { data: chunkRows } = await sb.rpc("match_chunks", {
    query_embedding: embedding,
    match_count: 6,
    official_only: strict,
  });
  const passages: Passage[] = (chunkRows ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    heading: (r.heading as string | null) ?? null,
    content: r.content as string,
    page_start: (r.page_start as number | null) ?? null,
    page_end: (r.page_end as number | null) ?? null,
    chapterSlug: (r.chapter_slug as string | null) ?? null,
    chapterTitle: (r.chapter_title as string | null) ?? null,
    bookTitle: (r.book_title as string | null) ?? null,
    isOfficial: Boolean(r.is_official),
    similarity: (r.similarity as number) ?? 0,
  }));

  const [newsRes, pyqRes] = await Promise.all([
    sb.rpc("match_current_affairs", { query_embedding: embedding, match_count: 1 }),
    sb.rpc("match_pyqs", {
      query_embedding: embedding,
      match_count: 1,
      filter_subject: "Polity",
    }),
  ]);
  const nRow = (newsRes.data ?? [])[0] as Record<string, unknown> | undefined;
  const pRow = (pyqRes.data ?? [])[0] as Record<string, unknown> | undefined;
  const topNews: TopNews | null = nRow
    ? {
        id: nRow.id as string,
        title: nRow.title as string,
        summary: nRow.summary as string,
        source: (nRow.source as string) ?? "Newspaper",
        published_on: (nRow.published_on as string | null) ?? null,
        topic: (nRow.topic as string | null) ?? null,
        similarity: (nRow.similarity as number) ?? 0,
      }
    : null;
  const topPyq: TopPyq | null = pRow
    ? {
        id: pRow.id as string,
        question: pRow.question as string,
        year: (pRow.year as number | null) ?? null,
        topic: (pRow.topic as string | null) ?? null,
        similarity: (pRow.similarity as number) ?? 0,
      }
    : null;

  if (topNews) {
    topNews.match = buildMatch(
      `${topNews.title}. ${topNews.summary}`,
      topNews.similarity,
      passages,
    );
  }
  if (topPyq) {
    topPyq.match = buildMatch(topPyq.question, topPyq.similarity, passages);
  }

  let summary: string | null = null;
  if (mode === "crisp" && passages.length > 0) {
    const context = passages
      .map(
        (p, i) =>
          `[${i + 1}] ${p.bookTitle ?? "Source"} — ${p.chapterTitle ?? ""}${p.heading ? " · " + p.heading : ""}\n${p.content}`,
      )
      .join("\n\n");
    const { text } = await generateText({
      model: provider()(MODEL),
      system:
        "You are a UPSC Polity tutor. Write a crisp, high-yield revision note using ONLY the provided context. Use markdown bullets. Emphasise constitutional articles, amendments, exceptions, and landmark cases. Under 220 words. If context is insufficient, say so plainly.",
      prompt: `Topic: ${query}\n\nContext:\n${context}`,
    });
    summary = text;
  }

  return { mode, passages, summary, topNews, topPyq };
}
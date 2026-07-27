import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  extractPyqsFromMedia,
  extractPyqsFromText,
  findRelatedPyqsForChapter,
  insertPyqs,
} from "./pyq.server";
import { getSupabaseAdmin } from "./upsc.server";

export const uploadPyqFile = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        filename: z.string(),
        mimeType: z.string(),
        base64: z.string().min(10),
        source: z.string().optional(),
        year: z.number().int().optional(),
        subject: z.string().optional(),
        topic: z.string().optional(),
        chapterSlug: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const rows = await extractPyqsFromMedia({
      mimeType: data.mimeType,
      base64: data.base64,
      fallbackYear: data.year,
      fallbackTopic: data.topic,
    });
    if (rows.length === 0) return { inserted: 0, extracted: 0 };
    const { inserted } = await insertPyqs(rows, {
      source: data.source,
      year: data.year,
      subject: data.subject,
      topic: data.topic,
      chapterSlug: data.chapterSlug,
    });
    return { inserted, extracted: rows.length };
  });

export const uploadPyqText = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        text: z.string().min(20).max(50000),
        source: z.string().optional(),
        year: z.number().int().optional(),
        subject: z.string().optional(),
        topic: z.string().optional(),
        chapterSlug: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const rows = await extractPyqsFromText(data.text);
    if (rows.length === 0) return { inserted: 0, extracted: 0 };
    const { inserted } = await insertPyqs(rows, {
      source: data.source,
      year: data.year,
      subject: data.subject,
      topic: data.topic,
      chapterSlug: data.chapterSlug,
    });
    return { inserted, extracted: rows.length };
  });

export const listPyqLibrary = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await getSupabaseAdmin();
  const { data, error } = await sb
    .from("pyqs")
    .select("id, question, year, topic, difficulty, source, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const { count } = await sb.from("pyqs").select("id", { count: "exact", head: true });
  return { items: data ?? [], total: count ?? 0 };
});

export const relatedPyqs = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ slug: z.string(), limit: z.number().int().min(1).max(10).default(5) }).parse(data),
  )
  .handler(async ({ data }) => {
    const items = await findRelatedPyqsForChapter(data.slug, data.limit);
    return { items };
  });

export const chapterQuizMixed = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        slug: z.string(),
        count: z.number().int().min(1).max(10).default(10),
        pyqRatio: z.number().min(0).max(1).default(0.5),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { generateQuiz } = await import("./upsc.server");
    const desiredPyq = Math.round(data.count * data.pyqRatio);
    const pyqs = desiredPyq > 0 ? await findRelatedPyqsForChapter(data.slug, desiredPyq * 2) : [];
    const usablePyqs = pyqs.filter(
      (p) => p.correct_index !== null && (p.options?.length ?? 0) >= 3,
    );
    type MixedQ = {
      question: string;
      options: string[];
      correct_index: number;
      explanation: string;
      _source: "pyq" | "ai";
      _year: number | null;
    };
    const takenPyqs: MixedQ[] = usablePyqs.slice(0, desiredPyq).map((p) => ({
      question: p.question,
      options: p.options,
      correct_index: p.correct_index as number,
      explanation: p.explanation ?? (p.year ? `UPSC ${p.year}` : "Previous year question"),
      _source: "pyq",
      _year: p.year,
    }));
    const genCount = Math.max(0, data.count - takenPyqs.length);
    const generated = genCount > 0 ? await generateQuiz(data.slug, genCount) : { questions: [] };
    const genItems: MixedQ[] = generated.questions.map((q) => ({
      ...q,
      _source: "ai",
      _year: null,
    }));
    // Interleave
    const merged: MixedQ[] = [];
    const maxLen = Math.max(takenPyqs.length, genItems.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < takenPyqs.length) merged.push(takenPyqs[i]);
      if (i < genItems.length) merged.push(genItems[i]);
    }
    return { questions: merged.slice(0, data.count) };
  });

export const getWeakChapters = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await getSupabaseAdmin();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: chapters } = await sb.from("chapters").select("id, slug, title, order").order("order");
  const { data: attempts } = await sb
    .from("quiz_attempts")
    .select("chapter_id, score, total, taken_at")
    .gte("taken_at", weekAgo);
  const rows = (chapters ?? []).map((c) => {
    const a = (attempts ?? []).filter((x) => x.chapter_id === c.id);
    const q = a.reduce((s, x) => s + x.total, 0);
    const ok = a.reduce((s, x) => s + x.score, 0);
    const pct = q > 0 ? Math.round((100 * ok) / q) : null;
    return { slug: c.slug, title: c.title, attempts: a.length, questions: q, accuracyPct: pct };
  });
  const tested = rows.filter((r) => r.accuracyPct !== null) as Array<
    typeof rows[number] & { accuracyPct: number }
  >;
  tested.sort((a, b) => a.accuracyPct - b.accuracyPct);
  const weak = tested.filter((r) => r.accuracyPct < 70).slice(0, 5);
  return { weekly: tested, weak };
});
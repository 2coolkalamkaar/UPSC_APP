import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  evaluateMains,
  generateQuiz,
  getSupabaseAdmin,
  loadChapterBySlug,
  ragChapterAnswer,
  scheduleRevisions,
} from "./upsc.server";

export const listChapters = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await getSupabaseAdmin();
  const { data: chapters, error } = await sb
    .from("chapters")
    .select("id, slug, title, order")
    .order("order");
  if (error) throw new Error(error.message);
  const { data: attempts } = await sb
    .from("quiz_attempts")
    .select("chapter_id, score, total, taken_at");
  const { data: dueRows } = await sb
    .from("revision_schedule")
    .select("chapter_id, due_at")
    .is("done_at", null)
    .lte("due_at", new Date().toISOString());
  const dueMap = new Set((dueRows ?? []).map((r) => r.chapter_id));
  const testedMap = new Map<string, { attempts: number; bestPct: number }>();
  for (const a of attempts ?? []) {
    const cur = testedMap.get(a.chapter_id) ?? { attempts: 0, bestPct: 0 };
    cur.attempts += 1;
    const pct = a.total > 0 ? Math.round((100 * a.score) / a.total) : 0;
    if (pct > cur.bestPct) cur.bestPct = pct;
    testedMap.set(a.chapter_id, cur);
  }
  return (chapters ?? []).map((c) => ({
    ...c,
    dueForRevision: dueMap.has(c.id),
    attempts: testedMap.get(c.id)?.attempts ?? 0,
    bestPct: testedMap.get(c.id)?.bestPct ?? 0,
  }));
});

export const getChapter = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ slug: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { chapter, chunks } = await loadChapterBySlug(data.slug);
    return { chapter, chunks };
  });

export const askChapter = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        slug: z.string(),
        query: z.string().min(2).max(500),
        strict: z.boolean().optional().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data }) => ragChapterAnswer(data.slug, data.query, data.strict));

export const chapterQuiz = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        slug: z.string(),
        count: z.number().int().min(1).max(10).default(10),
        strict: z.boolean().optional().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data }) => generateQuiz(data.slug, data.count, data.strict));

const ResultSchema = z.object({
  question: z.string(),
  correct: z.boolean(),
  user_answer: z.number().nullable(),
  correct_answer: z.number(),
  explanation: z.string().optional(),
});

export const recordAttempt = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        chapterSlug: z.string(),
        mode: z.enum(["chapter", "revision"]).default("chapter"),
        results: z.array(ResultSchema).min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sb = await getSupabaseAdmin();
    const { chapter } = await loadChapterBySlug(data.chapterSlug);
    const score = data.results.filter((r) => r.correct).length;
    const total = data.results.length;
    const { data: attempt, error } = await sb
      .from("quiz_attempts")
      .insert({ chapter_id: chapter.id, score, total, mode: data.mode })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await sb.from("question_results").insert(
      data.results.map((r) => ({
        attempt_id: attempt.id,
        question: r.question,
        correct: r.correct,
        user_answer: r.user_answer,
        correct_answer: r.correct_answer,
        explanation: r.explanation ?? null,
      })),
    );
    if (data.mode === "chapter") {
      await scheduleRevisions(chapter.id);
    }
    return { attemptId: attempt.id, score, total };
  });

export const getDueRevisions = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await getSupabaseAdmin();
  const { data, error } = await sb
    .from("revision_schedule")
    .select("id, chapter_id, due_at, stage, chapters(slug, title)")
    .is("done_at", null)
    .lte("due_at", new Date().toISOString())
    .order("due_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const ch = r.chapters as unknown as { slug: string; title: string } | null;
    return {
      id: r.id,
      chapterSlug: ch?.slug ?? "",
      chapterTitle: ch?.title ?? "",
      stage: r.stage,
      dueAt: r.due_at,
    };
  });
});

export const getReviewQueue = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from("revision_schedule")
    .select("id, chapter_id, due_at, stage, chapters(slug, title)")
    .is("done_at", null)
    .order("due_at");
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((r) => {
    const ch = r.chapters as unknown as { slug: string; title: string } | null;
    return {
      id: r.id,
      chapterSlug: ch?.slug ?? "",
      chapterTitle: ch?.title ?? "",
      stage: r.stage as string,
      dueAt: r.due_at as string,
    };
  });
  const dueToday = rows.filter((r) => r.dueAt <= nowIso);

  // Per-chapter upcoming summary: next due date + count of pending reviews.
  type Upcoming = {
    chapterSlug: string;
    chapterTitle: string;
    nextDueAt: string;
    stage: string;
    pendingCount: number;
    overdue: boolean;
  };
  const byChapter = new Map<string, Upcoming>();
  for (const r of rows) {
    const existing = byChapter.get(r.chapterSlug);
    if (!existing) {
      byChapter.set(r.chapterSlug, {
        chapterSlug: r.chapterSlug,
        chapterTitle: r.chapterTitle,
        nextDueAt: r.dueAt,
        stage: r.stage,
        pendingCount: 1,
        overdue: r.dueAt <= nowIso,
      });
    } else {
      existing.pendingCount += 1;
      if (r.dueAt <= nowIso) existing.overdue = true;
    }
  }
  const perChapter = Array.from(byChapter.values()).sort((a, b) =>
    a.nextDueAt.localeCompare(b.nextDueAt),
  );
  return { dueToday, perChapter };
});

const DAILY_TARGET = 5;

export const dailyReviewQuiz = createServerFn({ method: "POST" }).handler(async () => {
  const sb = await getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from("revision_schedule")
    .select("id, chapter_id, due_at, stage, chapters(slug, title)")
    .is("done_at", null)
    .lte("due_at", nowIso)
    .order("due_at");
  if (error) throw new Error(error.message);
  const due = (data ?? []).map((r) => {
    const ch = r.chapters as unknown as { slug: string; title: string } | null;
    return {
      id: r.id as string,
      chapterSlug: ch?.slug ?? "",
      chapterTitle: ch?.title ?? "",
      stage: r.stage as string,
    };
  });
  if (due.length === 0) {
    return { items: [], scheduleIds: [] as string[] };
  }

  // Distribute 5 questions across due chapters, in due-date order.
  const chapters: typeof due = [];
  const seen = new Set<string>();
  for (const d of due) {
    if (!seen.has(d.chapterSlug)) {
      seen.add(d.chapterSlug);
      chapters.push(d);
    }
  }
  const perChapter = Math.max(1, Math.ceil(DAILY_TARGET / chapters.length));
  const items: {
    chapterSlug: string;
    chapterTitle: string;
    question: string;
    options: string[];
    correct_index: number;
    explanation: string;
  }[] = [];
  for (const c of chapters) {
    if (items.length >= DAILY_TARGET) break;
    const quiz = await generateQuiz(c.chapterSlug, perChapter);
    for (const q of quiz.questions) {
      if (items.length >= DAILY_TARGET) break;
      items.push({
        chapterSlug: c.chapterSlug,
        chapterTitle: c.chapterTitle,
        ...q,
      });
    }
  }
  return { items, scheduleIds: due.map((d) => d.id) };
});

const DailyResultSchema = z.object({
  chapterSlug: z.string(),
  question: z.string(),
  correct: z.boolean(),
  user_answer: z.number().nullable(),
  correct_answer: z.number(),
  explanation: z.string().optional(),
});

export const finishDailyReview = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        results: z.array(DailyResultSchema).min(1),
        scheduleIds: z.array(z.string()).default([]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sb = await getSupabaseAdmin();
    // Group by chapter, record one quiz_attempt per chapter.
    const byChapter = new Map<string, typeof data.results>();
    for (const r of data.results) {
      const arr = byChapter.get(r.chapterSlug) ?? [];
      arr.push(r);
      byChapter.set(r.chapterSlug, arr);
    }
    for (const [slug, results] of byChapter) {
      const { chapter } = await loadChapterBySlug(slug);
      const score = results.filter((r) => r.correct).length;
      const total = results.length;
      const { data: attempt, error } = await sb
        .from("quiz_attempts")
        .insert({ chapter_id: chapter.id, score, total, mode: "revision" })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await sb.from("question_results").insert(
        results.map((r) => ({
          attempt_id: attempt.id,
          question: r.question,
          correct: r.correct,
          user_answer: r.user_answer,
          correct_answer: r.correct_answer,
          explanation: r.explanation ?? null,
        })),
      );
    }
    if (data.scheduleIds.length > 0) {
      await sb
        .from("revision_schedule")
        .update({ done_at: new Date().toISOString() })
        .in("id", data.scheduleIds);
    }
    const score = data.results.filter((r) => r.correct).length;
    return { score, total: data.results.length };
  });

export const revisionMicroTest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ slug: z.string() }).parse(data))
  .handler(async ({ data }) => generateQuiz(data.slug, 5));

export const markRevisionDone = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const sb = await getSupabaseAdmin();
    await sb.from("revision_schedule").update({ done_at: new Date().toISOString() }).eq("id", data.id);
    return { ok: true };
  });

export const submitMains = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        question: z.string().min(5).max(500),
        answer: z.string().min(30).max(6000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const rubric = await evaluateMains(data.question, data.answer);
    const sb = await getSupabaseAdmin();
    await sb.from("mains_evaluations").insert({
      question: data.question,
      answer: data.answer,
      rubric_json: rubric,
      overall: rubric.overall,
    });
    return rubric;
  });

export const getAnalytics = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await getSupabaseAdmin();
  const { data: chapters } = await sb.from("chapters").select("id, slug, title, order").order("order");
  const { data: attempts } = await sb
    .from("quiz_attempts")
    .select("chapter_id, score, total, taken_at, mode");
  const { data: dueRows } = await sb
    .from("revision_schedule")
    .select("chapter_id, stage, due_at, done_at");
  const perChapter = (chapters ?? []).map((c) => {
    const cAttempts = (attempts ?? []).filter((a) => a.chapter_id === c.id);
    const totalQ = cAttempts.reduce((s, a) => s + a.total, 0);
    const totalC = cAttempts.reduce((s, a) => s + a.score, 0);
    const pct = totalQ > 0 ? Math.round((100 * totalC) / totalQ) : 0;
    const due = (dueRows ?? []).filter(
      (r) => r.chapter_id === c.id && !r.done_at && new Date(r.due_at) <= new Date(),
    ).length;
    return {
      slug: c.slug,
      title: c.title,
      attempts: cAttempts.length,
      accuracyPct: pct,
      dueRevisions: due,
    };
  });
  const totalAttempts = attempts?.length ?? 0;
  const totalMains = (await sb.from("mains_evaluations").select("id", { count: "exact", head: true }))
    .count ?? 0;
  return { perChapter, totalAttempts, totalMains };
});
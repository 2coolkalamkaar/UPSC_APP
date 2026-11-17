import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  evaluateMains,
  generateQuiz,
  getSupabaseAdmin,
  loadChapterBySlug,
  ragChapterAnswer,
  scheduleRevisions,
} from "./upsc.server";
import { generateModelAnswer, pickDailyMains } from "./mains.server";

export const listChapters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await getSupabaseAdmin();
    const { data: chapters, error } = await sb
      .from("chapters")
      .select("id, slug, title, order")
      .order("order");
    if (error) throw new Error(error.message);
    const { data: attempts } = await context.supabase
      .from("quiz_attempts")
      .select("chapter_id, score, total, taken_at");
    const { data: dueRows } = await context.supabase
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
  .validator((data: unknown) => z.object({ slug: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { chapter, chunks } = await loadChapterBySlug(data.slug);
    return { chapter, chunks };
  });

export const askChapter = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
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
  .validator((data: unknown) =>
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
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        chapterSlug: z.string(),
        mode: z.enum(["chapter", "revision"]).default("chapter"),
        results: z.array(ResultSchema).min(1),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const sb = await getSupabaseAdmin();
    const { chapter } = await loadChapterBySlug(data.chapterSlug);
    const score = data.results.filter((r) => r.correct).length;
    const total = data.results.length;
    const { data: attempt, error } = await sb
      .from("quiz_attempts")
      .insert({
        chapter_id: chapter.id,
        user_id: context.userId,
        score,
        total,
        mode: data.mode,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await sb.from("question_results").insert(
      data.results.map((r) => ({
        attempt_id: attempt.id,
        user_id: context.userId,
        question: r.question,
        correct: r.correct,
        user_answer: r.user_answer,
        correct_answer: r.correct_answer,
        explanation: r.explanation ?? null,
      })),
    );
    if (data.mode === "chapter") {
      await scheduleRevisions(chapter.id, context.userId);
    }
    return { attemptId: attempt.id, score, total };
  });

export const getDueRevisions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
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

export const getReviewQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const nowIso = new Date().toISOString();
    const { data, error } = await context.supabase
      .from("revision_schedule")
      .select("id, chapter_id, due_at, stage, chapters(slug, title)")
      .is("done_at", null)
      .order("due_at");
    if (error) throw new Error(error.message);
    const rows = (data ?? []).map((r) => {
      const ch = r.chapters as unknown as { slug: string; title: string } | null;
      return {
        id: r.id as string,
        chapterSlug: ch?.slug ?? "",
        chapterTitle: ch?.title ?? "",
        stage: r.stage as string,
        dueAt: r.due_at as string,
      };
    });
    const dueToday = rows.filter((r) => r.dueAt <= nowIso);

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

export const dailyReviewQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const nowIso = new Date().toISOString();
    const { data, error } = await context.supabase
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
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        results: z.array(DailyResultSchema).min(1),
        scheduleIds: z.array(z.string()).default([]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const sb = await getSupabaseAdmin();
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
        .insert({
          chapter_id: chapter.id,
          user_id: context.userId,
          score,
          total,
          mode: "revision",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await sb.from("question_results").insert(
        results.map((r) => ({
          attempt_id: attempt.id,
          user_id: context.userId,
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
  .validator((data: unknown) => z.object({ slug: z.string() }).parse(data))
  .handler(async ({ data }) => generateQuiz(data.slug, 5));

export const markRevisionDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("revision_schedule")
      .update({ done_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitMains = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        question: z.string().min(5).max(500),
        answer: z.string().min(30).max(6000),
        wordCount: z.number().int().min(0).optional(),
        durationSeconds: z.number().int().min(0).optional(),
        challengeDate: z.string().optional(),
        promptSource: z.enum(["custom", "daily"]).default("custom"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const [rubric, modelAnswer] = await Promise.all([
      evaluateMains(data.question, data.answer),
      generateModelAnswer(data.question, 250).catch(() => ""),
    ]);
    const sb = await getSupabaseAdmin();
    await sb.from("mains_evaluations").insert({
      user_id: context.userId,
      question: data.question,
      answer: data.answer,
      rubric_json: rubric,
      overall: rubric.overall,
      model_answer: modelAnswer || null,
      word_count: data.wordCount ?? null,
      duration_seconds: data.durationSeconds ?? null,
      challenge_date: data.challengeDate ?? null,
      prompt_source: data.promptSource,
    });
    return { rubric, modelAnswer };
  });

export const getDailyMainsChallenge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const pick = pickDailyMains(today);
    const { data: existing } = await context.supabase
      .from("mains_evaluations")
      .select("id, overall, model_answer, word_count, duration_seconds, created_at, rubric_json")
      .eq("challenge_date", today)
      .eq("prompt_source", "daily")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      date: today,
      question: pick.question,
      wordLimit: pick.wordLimit,
      minutes: pick.minutes,
      alreadyAttempted: !!existing,
      attempt: existing,
    };
  });

export const getMainsTrends = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("mains_evaluations")
      .select("id, question, overall, word_count, duration_seconds, prompt_source, created_at, rubric_json")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = (data ?? []).map((r) => ({
      id: r.id as string,
      question: r.question as string,
      overall: r.overall as number,
      wordCount: r.word_count as number | null,
      durationSeconds: r.duration_seconds as number | null,
      promptSource: r.prompt_source as string,
      createdAt: r.created_at as string,
      rubric: r.rubric_json as Record<string, { score: number; comment: string } | number | string>,
    }));
    const count = rows.length;
    const avg = count > 0 ? rows.reduce((s, r) => s + (r.overall ?? 0), 0) / count : 0;
    const best = count > 0 ? Math.max(...rows.map((r) => r.overall ?? 0)) : 0;
    const last5 = rows.slice(-5);
    const last5Avg = last5.length > 0 ? last5.reduce((s, r) => s + r.overall, 0) / last5.length : 0;
    return {
      rows,
      summary: {
        count,
        avg: Math.round(avg * 10) / 10,
        best,
        last5Avg: Math.round(last5Avg * 10) / 10,
      },
    };
  });

export const logChapterTime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({ slug: z.string(), seconds: z.number().int().min(1).max(3600) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { chapter } = await loadChapterBySlug(data.slug);
    const { error } = await context.supabase.from("study_sessions").insert({
      user_id: context.userId,
      chapter_id: chapter.id,
      seconds: data.seconds,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await getSupabaseAdmin();
    const { data: chapters } = await sb.from("chapters").select("id, slug, title, order").order("order");
    const { data: attempts } = await context.supabase
      .from("quiz_attempts")
      .select("chapter_id, score, total, taken_at, mode");
    const { data: dueRows } = await context.supabase
      .from("revision_schedule")
      .select("chapter_id, stage, due_at, done_at");
    const { data: timeRows } = await context.supabase
      .from("study_sessions")
      .select("chapter_id, seconds");
    const perChapter = (chapters ?? []).map((c) => {
      const cAttempts = (attempts ?? []).filter((a) => a.chapter_id === c.id);
      const totalQ = cAttempts.reduce((s, a) => s + a.total, 0);
      const totalC = cAttempts.reduce((s, a) => s + a.score, 0);
      const pct = totalQ > 0 ? Math.round((100 * totalC) / totalQ) : 0;
      const due = (dueRows ?? []).filter(
        (r) => r.chapter_id === c.id && !r.done_at && new Date(r.due_at) <= new Date(),
      ).length;
      const seconds = (timeRows ?? [])
        .filter((r) => r.chapter_id === c.id)
        .reduce((s, r) => s + (r.seconds ?? 0), 0);
      return {
        slug: c.slug,
        title: c.title,
        attempts: cAttempts.length,
        accuracyPct: pct,
        dueRevisions: due,
        timeSeconds: seconds,
      };
    });
    const totalAttempts = attempts?.length ?? 0;
    const totalMains = (await context.supabase.from("mains_evaluations").select("id", { count: "exact", head: true }))
      .count ?? 0;

    // Accuracy trend by day (last 30 days).
    const dayMs = 86400000;
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const days: string[] = [];
    for (let i = 29; i >= 0; i--) {
      days.push(new Date(today.getTime() - i * dayMs).toISOString().slice(0, 10));
    }
    const byDay = new Map<string, { correct: number; total: number }>();
    for (const a of attempts ?? []) {
      const k = (a.taken_at as string).slice(0, 10);
      const cur = byDay.get(k) ?? { correct: 0, total: 0 };
      cur.correct += a.score;
      cur.total += a.total;
      byDay.set(k, cur);
    }
    const accuracyTrend = days.map((d) => {
      const v = byDay.get(d);
      return {
        date: d,
        accuracyPct: v && v.total > 0 ? Math.round((100 * v.correct) / v.total) : null,
        questions: v?.total ?? 0,
      };
    });

    // Revision completion rate.
    const revTotal = (dueRows ?? []).length;
    const revDone = (dueRows ?? []).filter((r) => !!r.done_at).length;
    const revOverdue = (dueRows ?? []).filter(
      (r) => !r.done_at && new Date(r.due_at) <= today,
    ).length;
    const revUpcoming = (dueRows ?? []).filter(
      (r) => !r.done_at && new Date(r.due_at) > today,
    ).length;
    const revisionRatePct = revTotal > 0 ? Math.round((100 * revDone) / revTotal) : 0;

    const totalTimeSeconds = perChapter.reduce((s, c) => s + c.timeSeconds, 0);

    return {
      perChapter,
      totalAttempts,
      totalMains,
      accuracyTrend,
      revision: {
        total: revTotal,
        done: revDone,
        overdue: revOverdue,
        upcoming: revUpcoming,
        completionPct: revisionRatePct,
      },
      totalTimeSeconds,
      todayKey,
    };
  });

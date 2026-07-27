import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CalendarClock, Loader2, Play } from "lucide-react";
import { useState } from "react";

import { dailyReviewQuiz, finishDailyReview, getReviewQueue } from "@/lib/upsc.functions";

type QueueItem = Awaited<ReturnType<typeof dailyReviewQuiz>>["items"][number];

const queueQuery = queryOptions({
  queryKey: ["review-queue"],
  queryFn: () => getReviewQueue(),
});

export const Route = createFileRoute("/revision")({
  loader: ({ context }) => context.queryClient.ensureQueryData(queueQuery),
  component: Revision,
  head: () => ({
    meta: [
      { title: "Daily Review — Neeti" },
      { name: "description", content: "Today's 5-question spaced-repetition review queue." },
      { property: "og:title", content: "Daily Review — Neeti" },
      { property: "og:description", content: "One 5-question queue drawn from every chapter due today." },
    ],
  }),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
});

function formatRelative(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffDays = Math.round(diffMs / 86400000);
  if (diffDays <= -1) return `${-diffDays}d overdue`;
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  return `in ${diffDays}d`;
}

function Revision() {
  const { data: queue } = useSuspenseQuery(queueQuery);
  const router = useRouter();
  const gen = useServerFn(dailyReviewQuiz);
  const finish = useServerFn(finishDailyReview);

  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [scheduleIds, setScheduleIds] = useState<string[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [done, setDone] = useState<{ score: number; total: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function startQueue() {
    setStarted(true);
    setDone(null);
    setErr(null);
    setLoading(true);
    try {
      const q = await gen();
      setItems(q.items);
      setScheduleIds(q.scheduleIds);
      setAnswers(new Array(q.items.length).fill(null));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to generate queue.");
    } finally {
      setLoading(false);
    }
  }

  async function submitQueue() {
    const results = items.map((q, i) => ({
      chapterSlug: q.chapterSlug,
      question: q.question,
      correct: answers[i] === q.correct_index,
      user_answer: answers[i],
      correct_answer: q.correct_index,
      explanation: q.explanation,
    }));
    const res = await finish({ data: { results, scheduleIds } });
    setDone({ score: res.score, total: res.total });
    router.invalidate();
  }

  const dueCount = queue.dueToday.length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Home
          </Link>
          <div className="text-xs text-muted-foreground">Daily review</div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {!started && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Today's review queue</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              One 5-question quiz drawn from every chapter due today. Do it before the streak breaks.
            </p>

            <div className="mt-6 rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">
                    {dueCount === 0
                      ? "Nothing due today."
                      : `${dueCount} scheduled review${dueCount === 1 ? "" : "s"} across ${
                          new Set(queue.dueToday.map((d) => d.chapterSlug)).size
                        } chapter${new Set(queue.dueToday.map((d) => d.chapterSlug)).size === 1 ? "" : "s"}.`}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    5 questions · mixed chapters · marks all due reviews complete on submit
                  </div>
                </div>
                <button
                  onClick={startQueue}
                  disabled={dueCount === 0}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Play className="h-3 w-3" /> Start review
                </button>
              </div>
            </div>

            <section className="mt-10">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Upcoming reviews per chapter
              </h2>
              {queue.perChapter.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No reviews scheduled. Take a chapter test to seed the queue.
                </div>
              ) : (
                <ul className="mt-3 space-y-2">
                  {queue.perChapter.map((c) => (
                    <li
                      key={c.chapterSlug}
                      className="flex items-center justify-between rounded-md border border-border bg-card p-4"
                    >
                      <div>
                        <div className="text-sm font-medium">{c.chapterTitle}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <CalendarClock className="h-3 w-3" />
                          Next: stage {c.stage} · {formatRelative(c.nextDueAt)}
                          <span>·</span>
                          <span>
                            {c.pendingCount} pending review{c.pendingCount === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                      {c.overdue && (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                          Due
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {started && (
          <div>
            <button
              onClick={() => {
                setStarted(false);
                setItems([]);
                setAnswers([]);
                setDone(null);
                setErr(null);
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Back to queue
            </button>
            <h1 className="mt-2 text-xl font-semibold">Daily review · 5 questions</h1>

            {loading && (
              <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Generating today's queue…
              </div>
            )}
            {err && <div className="mt-6 text-sm text-destructive">{err}</div>}
            {done && (
              <div className="mt-6 rounded-md border border-border bg-card p-6 text-center">
                <div className="text-3xl font-semibold">
                  {done.score} / {done.total}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Reviews logged. Next revisions rescheduled automatically.
                </div>
              </div>
            )}
            {items.length > 0 && !done && (
              <div className="mt-6 space-y-6">
                {items.map((q, i) => (
                  <div key={i} className="rounded-md border border-border bg-card p-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Q{i + 1}</span>
                      <span>{q.chapterTitle}</span>
                    </div>
                    <div className="mt-1 text-sm font-medium">{q.question}</div>
                    <div className="mt-3 space-y-1">
                      {q.options.map((opt, oi) => (
                        <label
                          key={oi}
                          className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                            answers[i] === oi ? "border-primary bg-primary/5" : "border-border"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q${i}`}
                            checked={answers[i] === oi}
                            onChange={() => {
                              const next = [...answers];
                              next[i] = oi;
                              setAnswers(next);
                            }}
                            className="h-3 w-3"
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  onClick={submitQueue}
                  disabled={answers.some((a) => a === null)}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  Submit review
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
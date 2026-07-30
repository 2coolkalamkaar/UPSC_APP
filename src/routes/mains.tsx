import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Calendar, Loader2, PencilLine, Timer, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { getDailyMainsChallenge, getMainsTrends, submitMains } from "@/lib/upsc.functions";
import type { Rubric } from "@/lib/upsc.server";

const dailyQuery = queryOptions({
  queryKey: ["mains-daily"],
  queryFn: () => getDailyMainsChallenge(),
});
const trendsQuery = queryOptions({
  queryKey: ["mains-trends"],
  queryFn: () => getMainsTrends(),
});

export const Route = createFileRoute("/mains")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(dailyQuery),
      context.queryClient.ensureQueryData(trendsQuery),
    ]),
  component: Mains,
  head: () => ({
    meta: [
      { title: "Mains evaluator — Neeti" },
      { name: "description", content: "Get instant rubric-based feedback on UPSC Mains answers." },
      { property: "og:title", content: "Mains evaluator — Neeti" },
      { property: "og:description", content: "Paste an answer; get structured examiner-style feedback in seconds." },
    ],
  }),
});

const CRITERIA = ["introduction", "structure", "keywords", "articles", "conclusion"] as const;

function countWords(s: string) {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function formatSeconds(total: number) {
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = Math.floor(total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function Mains() {
  const submit = useServerFn(submitMains);
  const qc = useQueryClient();
  const { data: daily } = useSuspenseQuery(dailyQuery);
  const { data: trends } = useSuspenseQuery(trendsQuery);

  const [mode, setMode] = useState<"daily" | "custom">(daily.alreadyAttempted ? "custom" : "daily");
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Rubric | null>(null);
  const [modelAnswer, setModelAnswer] = useState<string | null>(null);

  // Timer for daily challenge.
  const targetSeconds = daily.minutes * 60;
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!running) return;
    tickRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [running]);

  const currentQuestion = mode === "daily" ? daily.question : q.trim();
  const wordLimit = mode === "daily" ? daily.wordLimit : null;
  const words = countWords(a);
  const overLimit = wordLimit != null && words > wordLimit;

  const timePct = Math.min(100, Math.round((100 * elapsed) / Math.max(1, targetSeconds)));
  const timeUp = elapsed >= targetSeconds;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "daily" && daily.alreadyAttempted) {
      setErr("You've already submitted today's daily challenge.");
      return;
    }
    setLoading(true);
    setErr(null);
    setResult(null);
    setModelAnswer(null);
    setRunning(false);
    try {
      const payload = {
        question: currentQuestion,
        answer: a.trim(),
        wordCount: words,
        durationSeconds: elapsed,
        promptSource: mode,
        challengeDate: mode === "daily" ? daily.date : undefined,
      } as const;
      const r = await submit({ data: payload });
      setResult(r.rubric);
      setModelAnswer(r.modelAnswer || null);
      qc.invalidateQueries({ queryKey: ["mains-daily"] });
      qc.invalidateQueries({ queryKey: ["mains-trends"] });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Failed.");
    } finally {
      setLoading(false);
    }
  }

  const trendChartData = useMemo(
    () =>
      trends.rows.map((r, i) => ({
        idx: i + 1,
        date: new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        Overall: r.overall,
      })),
    [trends.rows],
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Home
          </Link>
          <div className="text-xs text-muted-foreground">Mains evaluator</div>
        </div>
      </header>
      <main className="mx-auto grid max-w-4xl grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-[1fr_360px]">
        <form onSubmit={onSubmit}>
          <h1 className="text-2xl font-semibold tracking-tight">Mains answer feedback</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Instant, rubric-based examiner feedback with a model answer for comparison.
          </p>

          <div className="mt-5 inline-flex rounded-md border border-border bg-card p-1 text-xs">
            <button
              type="button"
              onClick={() => setMode("daily")}
              className={`inline-flex items-center gap-1 rounded px-3 py-1.5 ${mode === "daily" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              <Calendar className="h-3 w-3" /> Daily challenge
            </button>
            <button
              type="button"
              onClick={() => setMode("custom")}
              className={`inline-flex items-center gap-1 rounded px-3 py-1.5 ${mode === "custom" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              <PencilLine className="h-3 w-3" /> Custom question
            </button>
          </div>

          {mode === "daily" ? (
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
                <span>Today · {new Date(daily.date).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</span>
                <span>{daily.wordLimit} words · {daily.minutes} min</span>
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">{daily.question}</p>
              {daily.alreadyAttempted && (
                <p className="mt-2 text-[11px] text-emerald-600">
                  Already submitted today (score {daily.attempt?.overall}/10). Switch to Custom to write another.
                </p>
              )}
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setRunning((r) => !r)}
                  disabled={daily.alreadyAttempted}
                  className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1 text-xs disabled:opacity-50"
                >
                  <Timer className="h-3 w-3" /> {running ? "Pause" : elapsed === 0 ? "Start timer" : "Resume"}
                </button>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{formatSeconds(elapsed)}</span>
                    <span>{formatSeconds(targetSeconds)}</span>
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full ${timeUp ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${timePct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <label className="mt-6 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Question
              </label>
              <textarea
                value={q}
                onChange={(e) => setQ(e.target.value)}
                rows={2}
                placeholder="e.g. Discuss the role of the Speaker in ensuring the impartial functioning of the Lok Sabha."
                className="mt-1 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus:border-ring"
              />
            </>
          )}

          <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Your answer
          </label>
          <textarea
            value={a}
            onChange={(e) => setA(e.target.value)}
            rows={16}
            placeholder="Write your Mains answer here…"
            className="mt-1 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus:border-ring"
          />
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className={overLimit ? "text-destructive font-medium" : ""}>
              {words} word{words === 1 ? "" : "s"}
              {wordLimit != null ? ` / ${wordLimit}` : ""}
              {overLimit ? " · over limit" : ""}
            </span>
            {mode === "daily" && timeUp && !daily.alreadyAttempted && (
              <span className="text-destructive">Time is up — submit now.</span>
            )}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={
                loading ||
                a.trim().length < 30 ||
                (mode === "custom" && q.trim().length < 5) ||
                (mode === "daily" && daily.alreadyAttempted)
              }
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PencilLine className="h-4 w-4" />}
              Evaluate
            </button>
            {err && <div className="text-xs text-destructive">{err}</div>}
          </div>

          {modelAnswer && (
            <section className="mt-8 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">Model answer</h2>
                <span className="text-[11px] text-muted-foreground">Compare structure, keywords, articles</span>
              </div>
              <div className="prose prose-sm dark:prose-invert mt-3 max-w-none text-sm">
                <ReactMarkdown>{modelAnswer}</ReactMarkdown>
              </div>
            </section>
          )}
        </form>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <TrendingUp className="h-3 w-3" /> Score trend
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-semibold">{trends.summary.count}</div>
                <div className="text-[10px] text-muted-foreground">Attempts</div>
              </div>
              <div>
                <div className="text-lg font-semibold">{trends.summary.avg}</div>
                <div className="text-[10px] text-muted-foreground">Avg /10</div>
              </div>
              <div>
                <div className="text-lg font-semibold">{trends.summary.best}</div>
                <div className="text-[10px] text-muted-foreground">Best /10</div>
              </div>
            </div>
            {trendChartData.length >= 2 ? (
              <div className="mt-3 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} width={22} />
                    <Tooltip />
                    <Line type="monotone" dataKey="Overall" stroke="var(--primary)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Submit at least two answers to see your trend.
              </p>
            )}
            <div className="mt-3 text-[11px] text-muted-foreground">
              Last 5 avg: <span className="font-medium text-foreground">{trends.summary.last5Avg}</span>
            </div>
          </div>

          {!result && !loading && (
            <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-xs text-muted-foreground">
              Feedback will appear here.
            </div>
          )}
          {loading && (
            <div className="mt-4 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
              <Loader2 className="mb-2 h-4 w-4 animate-spin" /> Grading your answer…
            </div>
          )}
          {result && (
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Overall</div>
              <div className="mt-1 text-4xl font-semibold">
                {result.overall}
                <span className="text-base text-muted-foreground">/10</span>
              </div>
              <p className="mt-2 text-xs text-foreground/80">{result.summary}</p>
              <div className="mt-4 space-y-3">
                {CRITERIA.map((k) => (
                  <div key={k}>
                    <div className="flex items-center justify-between text-xs">
                      <div className="font-medium capitalize">{k}</div>
                      <div className="text-muted-foreground">{result[k].score}/10</div>
                    </div>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${result[k].score * 10}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{result[k].comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
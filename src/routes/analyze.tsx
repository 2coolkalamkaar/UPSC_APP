import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { getAnalytics } from "@/lib/upsc.functions";
import { getWeakChapters } from "@/lib/pyq.functions";

const analyticsQuery = queryOptions({
  queryKey: ["analytics"],
  queryFn: () => getAnalytics(),
});

const weakQuery = queryOptions({
  queryKey: ["weak-chapters"],
  queryFn: () => getWeakChapters(),
});

export const Route = createFileRoute("/analyze")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(analyticsQuery),
      context.queryClient.ensureQueryData(weakQuery),
    ]),
  component: Analyze,
  head: () => ({
    meta: [
      { title: "Analyze — Neeti" },
      { name: "description", content: "Per-chapter accuracy and revision status." },
      { property: "og:title", content: "Analyze — Neeti" },
      { property: "og:description", content: "See where Polity is weakest and what revision is due." },
    ],
  }),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
});

function Analyze() {
  const { data } = useSuspenseQuery(analyticsQuery);
  const { data: weekly } = useSuspenseQuery(weakQuery);
  const chartData = data.perChapter.map((c) => ({
    name: c.title.length > 18 ? c.title.slice(0, 16) + "…" : c.title,
    slug: c.slug,
    Accuracy: c.accuracyPct,
  }));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Home
          </Link>
          <div className="text-xs text-muted-foreground">Analyze</div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Your Polity, in numbers</h1>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Quiz attempts" value={data.totalAttempts} />
          <Stat label="Mains evaluated" value={data.totalMains} />
          <Stat
            label="Chapters covered"
            value={data.perChapter.filter((c) => c.attempts > 0).length}
          />
        </div>

        <section className="mt-8 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Accuracy by chapter</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="Accuracy" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Weekly review — weak areas</h2>
          <p className="text-xs text-muted-foreground">Last 7 days across chapter and revision quizzes.</p>
          {weekly.weekly.length === 0 ? (
            <div className="mt-3 text-xs text-muted-foreground">No attempts this week yet.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {weekly.weekly.map((c) => (
                <div key={c.slug} className="flex items-center justify-between text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {c.questions} question{c.questions === 1 ? "" : "s"} · {c.attempts} attempt
                      {c.attempts === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${c.accuracyPct < 50 ? "bg-destructive" : c.accuracyPct < 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${c.accuracyPct}%` }}
                      />
                    </div>
                    <div className="w-10 text-right text-sm font-semibold">{c.accuracyPct}%</div>
                  </div>
                </div>
              ))}
              {weekly.weak.length > 0 && (
                <div className="mt-4 rounded-md bg-amber-500/10 p-3 text-xs">
                  <div className="font-medium text-amber-700 dark:text-amber-400">Practice recommendation</div>
                  <div className="mt-1 text-foreground/80">
                    Focus this week on:{" "}
                    {weekly.weak.map((w, i) => (
                      <span key={w.slug}>
                        <Link to="/read/$chapter" params={{ chapter: w.slug }} className="underline">
                          {w.title}
                        </Link>
                        {i < weekly.weak.length - 1 ? ", " : ""}
                      </span>
                    ))}
                    .
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-medium">Per-chapter detail</h2>
          <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
            {data.perChapter.map((c) => (
              <div key={c.slug} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.attempts} attempt{c.attempts === 1 ? "" : "s"}
                    {c.dueRevisions > 0 ? ` · ${c.dueRevisions} revision${c.dueRevisions === 1 ? "" : "s"} due` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold">
                    {c.attempts > 0 ? `${c.accuracyPct}%` : "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
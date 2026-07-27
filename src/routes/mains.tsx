import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, PencilLine } from "lucide-react";
import { useState } from "react";

import { submitMains } from "@/lib/upsc.functions";
import type { Rubric } from "@/lib/upsc.server";

export const Route = createFileRoute("/mains")({
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

function Mains() {
  const submit = useServerFn(submitMains);
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Rubric | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      const r = await submit({ data: { question: q.trim(), answer: a.trim() } });
      setResult(r);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Failed.");
    } finally {
      setLoading(false);
    }
  }

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
            Paste the question and your answer. The evaluator checks Introduction, Structure, Keywords,
            Constitutional Articles, and Conclusion.
          </p>
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
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={loading || q.trim().length < 5 || a.trim().length < 30}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PencilLine className="h-4 w-4" />}
              Evaluate
            </button>
            {err && <div className="text-xs text-destructive">{err}</div>}
          </div>
        </form>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          {!result && !loading && (
            <div className="rounded-lg border border-dashed border-border p-6 text-xs text-muted-foreground">
              Feedback will appear here.
            </div>
          )}
          {loading && (
            <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
              <Loader2 className="mb-2 h-4 w-4 animate-spin" /> Grading your answer…
            </div>
          )}
          {result && (
            <div className="rounded-lg border border-border bg-card p-4">
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
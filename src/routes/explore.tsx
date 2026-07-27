import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BookOpen,
  Gavel,
  Info,
  Loader2,
  Newspaper,
  Search,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";

import { useStrictMode } from "@/hooks/useStrictMode";
import { searchTopic } from "@/lib/explore.functions";

type Result = Awaited<ReturnType<typeof searchTopic>>;

export const Route = createFileRoute("/explore")({
  component: Explore,
  head: () => ({
    meta: [
      { title: "Explore topics — Neeti" },
      {
        name: "description",
        content:
          "Search any UPSC Polity topic. Toggle a crisp revision summary or the exact textbook passages, with the single most relevant judgment and news pinned alongside.",
      },
      { property: "og:title", content: "Explore topics — Neeti" },
      {
        property: "og:description",
        content:
          "Topic-first search with Crisp Summary and Strict Textbook modes, plus a distraction-free context sidebar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Explore() {
  const search = useServerFn(searchTopic);
  const [strict, setStrict] = useStrictMode();
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"crisp" | "textbook">("crisp");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Result | null>(null);
  const [activeQuery, setActiveQuery] = useState("");

  async function run(nextMode: "crisp" | "textbook", nextQuery?: string) {
    const query = (nextQuery ?? q).trim();
    if (!query) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await search({ data: { query, mode: nextMode, strict } });
      setData(res);
      setActiveQuery(query);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void run(mode);
  }

  function switchMode(next: "crisp" | "textbook") {
    setMode(next);
    if (activeQuery) void run(next, activeQuery);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Home
          </Link>
          <button
            onClick={() => setStrict(!strict)}
            aria-pressed={strict}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${strict ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            <Shield className="h-3 w-3" /> Strict
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-3xl font-semibold tracking-tight">Explore a topic</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Search any concept — e.g. <em>Anti-Defection Law</em> or{" "}
          <em>Ordinance Making Power of President</em>. Pick your intent: crisp revision or the exact
          textbook.
        </p>

        <form onSubmit={submit} className="mt-6 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a topic…"
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2.5 text-sm outline-none focus:border-ring"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !q.trim()}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </form>

        <div className="mt-4 inline-flex overflow-hidden rounded-md border border-border text-xs">
          <button
            onClick={() => switchMode("crisp")}
            className={`flex items-center gap-1 px-3 py-1.5 ${mode === "crisp" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
          >
            <Zap className="h-3 w-3" /> Crisp Summary
          </button>
          <button
            onClick={() => switchMode("textbook")}
            className={`flex items-center gap-1 px-3 py-1.5 ${mode === "textbook" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
          >
            <BookOpen className="h-3 w-3" /> Strict Textbook
          </button>
        </div>

        {err && <div className="mt-4 text-sm text-destructive">{err}</div>}

        {loading && !data && (
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching your library…
          </div>
        )}

        {data && (
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">
            <div>
              {data.passages.length === 0 && (
                <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
                  No matching passages yet. Upload a book at{" "}
                  <Link to="/books" className="underline">
                    /books
                  </Link>{" "}
                  or try a broader query.
                </div>
              )}

              {data.mode === "crisp" && data.summary && (
                <div className="rounded-lg border border-border bg-card p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                    <Sparkles className="h-3.5 w-3.5" /> Crisp summary
                  </div>
                  <div className="prose prose-sm mt-3 max-w-none text-[14px] leading-relaxed">
                    <ReactMarkdown>{data.summary}</ReactMarkdown>
                  </div>
                  {data.passages.length > 0 && (
                    <div className="mt-4 border-t border-border pt-3 text-[11px] uppercase tracking-wide text-muted-foreground">
                      Sourced from{" "}
                      {Array.from(new Set(data.passages.map((p) => p.bookTitle).filter(Boolean))).join(
                        " · ",
                      ) || "your library"}
                    </div>
                  )}
                </div>
              )}

              {data.mode === "textbook" && (
                <div className="space-y-4">
                  {data.passages.map((p) => (
                    <article key={p.id} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {p.bookTitle && <span>{p.bookTitle}</span>}
                        {p.chapterTitle && <span>· {p.chapterTitle}</span>}
                        {p.isOfficial && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-primary">
                            <Shield className="h-2.5 w-2.5" /> Official
                          </span>
                        )}
                        {p.page_start && (
                          <span className="ml-auto">
                            p. {p.page_start}
                            {p.page_end && p.page_end !== p.page_start ? `–${p.page_end}` : ""}
                          </span>
                        )}
                      </div>
                      {p.heading && (
                        <h3 className="mt-2 text-sm font-semibold">{p.heading}</h3>
                      )}
                      <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-foreground/90">
                        {p.content}
                      </p>
                      {p.chapterSlug && (
                        <Link
                          to="/read/$chapter"
                          params={{ chapter: p.chapterSlug }}
                          className="mt-3 inline-block text-[11px] font-medium text-primary hover:underline"
                        >
                          Open chapter →
                        </Link>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Context, not noise
              </div>
              <ContextCard
                icon={<Gavel className="h-3.5 w-3.5 text-primary" />}
                label="Most relevant precedent"
              >
                {data.topPyq ? (
                  <>
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {data.topPyq.year && <span>UPSC {data.topPyq.year}</span>}
                      {data.topPyq.topic && <span>· {data.topPyq.topic}</span>}
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed">{data.topPyq.question}</p>
                    <WhyMatched match={data.topPyq.match} />
                  </>
                ) : (
                  <Empty text="No matching PYQ yet. Upload some at /pyq." />
                )}
              </ContextCard>
              <ContextCard
                icon={<Newspaper className="h-3.5 w-3.5 text-primary" />}
                label="Most relevant recent event"
              >
                {data.topNews ? (
                  <>
                    <div className="flex flex-wrap items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <span>{data.topNews.source}</span>
                      {data.topNews.published_on && <span>· {data.topNews.published_on}</span>}
                      {data.topNews.topic && <span>· {data.topNews.topic}</span>}
                    </div>
                    <div className="mt-2 text-[13px] font-medium leading-snug">
                      {data.topNews.title}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-foreground/80">
                      {data.topNews.summary}
                    </p>
                    <WhyMatched match={data.topNews.match} />
                  </>
                ) : (
                  <Empty text="No matching news yet. Upload the paper at /newspaper." />
                )}
              </ContextCard>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function ContextCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium">
        {icon}
        {label}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-xs text-muted-foreground">{text}</div>;
}

type Match = NonNullable<Result["topPyq"]>["match"];

function WhyMatched({ match }: { match: Match }) {
  if (!match) return null;
  return (
    <div className="mt-3 rounded-md border border-dashed border-border bg-muted/30 p-2.5">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Info className="h-3 w-3" /> Why this was matched
        <span className="ml-auto font-normal normal-case tracking-normal">
          {match.similarityPct}% similar
        </span>
      </div>
      <div className="mt-1.5 text-[11px] leading-relaxed text-foreground/80">{match.reason}</div>
      {match.quote && (
        <blockquote className="mt-2 border-l-2 border-primary/40 pl-2 text-[11px] italic leading-relaxed text-foreground/80">
          “{match.quote}”
        </blockquote>
      )}
      {(match.articles.length > 0 || match.ref) && (
        <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
          {match.articles.map((a) => (
            <span
              key={a}
              className="rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-primary"
            >
              {a}
            </span>
          ))}
          {match.ref?.page_start && (
            <span className="rounded-full border border-border px-1.5 py-0.5 text-muted-foreground">
              p. {match.ref.page_start}
              {match.ref.page_end && match.ref.page_end !== match.ref.page_start
                ? `–${match.ref.page_end}`
                : ""}
            </span>
          )}
          {match.ref?.chapterTitle && (
            <span className="rounded-full border border-border px-1.5 py-0.5 text-muted-foreground">
              {match.ref.chapterTitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
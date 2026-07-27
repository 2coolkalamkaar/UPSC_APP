import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BookOpen, Loader2, Newspaper, Send, Sparkles, ClipboardCheck, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

import { askChapter, getChapter } from "@/lib/upsc.functions";
import { relatedNews } from "@/lib/currentaffairs.functions";
import { getBookPdfUrl, getChapterBookInfo } from "@/lib/books.functions";
import { useStrictMode } from "@/hooks/useStrictMode";

const chapterQuery = (slug: string) =>
  queryOptions({
    queryKey: ["chapter", slug],
    queryFn: () => getChapter({ data: { slug } }),
  });

const bookInfoQuery = (slug: string) =>
  queryOptions({
    queryKey: ["chapter-book", slug],
    queryFn: () => getChapterBookInfo({ data: { slug } }),
  });

export const Route = createFileRoute("/read/$chapter")({
  loader: ({ context, params }) => {
    context.queryClient.ensureQueryData(chapterQuery(params.chapter));
    context.queryClient.ensureQueryData(bookInfoQuery(params.chapter));
  },
  component: ReadChapter,
  head: ({ params }) => ({
    meta: [
      { title: `Read: ${params.chapter} — Neeti` },
      { name: "description", content: `Read and ask questions about ${params.chapter} for UPSC Polity.` },
      { property: "og:title", content: `Read: ${params.chapter} — Neeti` },
      { property: "og:description", content: `AI-tutored study of ${params.chapter}.` },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">Failed: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8">Chapter not found.</div>,
});

function ReadChapter() {
  const { chapter } = Route.useParams();
  const { data } = useSuspenseQuery(chapterQuery(chapter));
  const { data: bookInfo } = useSuspenseQuery(bookInfoQuery(chapter));
  const ask = useServerFn(askChapter);
  const fetchNews = useServerFn(relatedNews);
  const getUrl = useServerFn(getBookPdfUrl);
  const [strict] = useStrictMode();
  const [mode, setMode] = useState<"text" | "pdf">("text");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [news, setNews] = useState<
    | null
    | Array<{
        id: string;
        title: string;
        summary: string;
        source: string;
        published_on: string | null;
        topic: string | null;
      }>
  >(null);
  const [newsLoading, setNewsLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setNewsLoading(true);
    fetchNews({ data: { slug: chapter, limit: 5 } })
      .then((r) => {
        if (alive) setNews(r.items);
      })
      .catch(() => {
        if (alive) setNews([]);
      })
      .finally(() => {
        if (alive) setNewsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [chapter, fetchNews]);

  useEffect(() => {
    if (mode !== "pdf" || !bookInfo.book?.hasPdf || pdfUrl) return;
    setPdfLoading(true);
    const firstPage = data.chunks.find((c) => c.page_start)?.page_start ?? undefined;
    getUrl({ data: { id: bookInfo.book.id, page: firstPage } })
      .then((r) => setPdfUrl(r.url))
      .finally(() => setPdfLoading(false));
  }, [mode, bookInfo.book, data.chunks, pdfUrl, getUrl]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setErr(null);
    setAnswer(null);
    try {
      const res = await ask({ data: { slug: chapter, query: q.trim(), strict } });
      setAnswer(res.answer);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to answer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> All chapters
          </Link>
          <div className="flex items-center gap-2">
            {strict && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                <Shield className="h-2.5 w-2.5" /> Strict
              </span>
            )}
            <Link
              to="/test/$chapter"
              params={{ chapter }}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <ClipboardCheck className="h-3 w-3" /> Test my knowledge
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-4xl grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-[1fr_320px]">
        <article>
          <div className="text-xs text-muted-foreground">Chapter {data.chapter.order}</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{data.chapter.title}</h1>

          {bookInfo.book && (
            <div className="mt-4 inline-flex overflow-hidden rounded-md border border-border text-xs">
              <button
                onClick={() => setMode("text")}
                className={`px-3 py-1.5 ${mode === "text" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
              >
                <BookOpen className="mr-1 inline h-3 w-3" /> Embedded text
              </button>
              {bookInfo.book.hasPdf && (
                <button
                  onClick={() => setMode("pdf")}
                  className={`px-3 py-1.5 ${mode === "pdf" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
                >
                  Original book PDF
                </button>
              )}
            </div>
          )}

          {mode === "text" && (
            <div className="mt-6 space-y-6">
              {data.chunks.map((c) => (
                <section key={c.id}>
                  <div className="mb-1 flex items-baseline justify-between">
                    {c.heading ? (
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        {c.heading}
                      </h2>
                    ) : (
                      <span />
                    )}
                    {bookInfo.book?.hasPdf && c.page_start && (
                      <button
                        onClick={async () => {
                          const { url } = await getUrl({
                            data: { id: bookInfo.book!.id, page: c.page_start ?? undefined },
                          });
                          if (url) window.open(url, "_blank", "noopener");
                        }}
                        className="text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
                      >
                        p. {c.page_start}
                        {c.page_end && c.page_end !== c.page_start ? `–${c.page_end}` : ""} ↗
                      </button>
                    )}
                  </div>
                  <p className="text-[15px] leading-relaxed text-foreground/90">{c.content}</p>
                </section>
              ))}
            </div>
          )}
          {mode === "pdf" && (
            <div className="mt-6">
              {pdfLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading PDF…
                </div>
              )}
              {pdfUrl && (
                <iframe
                  title={`${bookInfo.book?.title ?? "Book"} PDF`}
                  src={pdfUrl}
                  className="h-[80vh] w-full rounded-md border border-border"
                />
              )}
              {!pdfLoading && !pdfUrl && (
                <div className="text-xs text-muted-foreground">PDF unavailable.</div>
              )}
            </div>
          )}
        </article>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" /> Ask this chapter
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Answers come strictly from the chapter above.
            </p>
            <form onSubmit={submit} className="mt-3 flex gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="e.g. Who decides if a Bill is a Money Bill?"
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
              <button
                type="submit"
                disabled={loading || !q.trim()}
                className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
            {err && <div className="mt-3 text-xs text-destructive">{err}</div>}
            {answer && (
              <div className="prose prose-sm mt-4 max-w-none rounded-md bg-muted/40 p-3 text-[13px] leading-relaxed">
                <ReactMarkdown>{answer}</ReactMarkdown>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Newspaper className="h-4 w-4 text-primary" /> In the news
              </div>
              <Link to="/newspaper" className="text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground">
                Add
              </Link>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Current-affairs items linked to this chapter.
            </p>
            {newsLoading && (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Matching…
              </div>
            )}
            {!newsLoading && news && news.length === 0 && (
              <div className="mt-3 text-xs text-muted-foreground">
                No related news yet. Upload today's newspaper to see linked items here.
              </div>
            )}
            {!newsLoading && news && news.length > 0 && (
              <ul className="mt-3 space-y-3">
                {news.map((n) => (
                  <li key={n.id} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
                    <div className="flex flex-wrap items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <span>{n.source}</span>
                      {n.published_on && <span>· {n.published_on}</span>}
                      {n.topic && <span>· {n.topic}</span>}
                    </div>
                    <div className="mt-1 text-[13px] font-medium leading-snug">{n.title}</div>
                    <div className="mt-1 text-xs leading-relaxed text-foreground/80">{n.summary}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
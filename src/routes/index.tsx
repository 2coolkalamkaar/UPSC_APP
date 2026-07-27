import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, ClipboardCheck, PencilLine, BarChart3, Bell, Repeat, Library, Newspaper, Shield, Search } from "lucide-react";

import { listChapters } from "@/lib/upsc.functions";
import { unreadNotificationCount } from "@/lib/notifications.functions";
import { useStrictMode } from "@/hooks/useStrictMode";

const chaptersQuery = queryOptions({
  queryKey: ["chapters"],
  queryFn: () => listChapters(),
});

const unreadQuery = queryOptions({
  queryKey: ["notifications", "unread"],
  queryFn: () => unreadNotificationCount(),
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(chaptersQuery);
    context.queryClient.ensureQueryData(unreadQuery);
  },
  component: Home,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">Failed to load chapters: {error.message}</div>
  ),
});

function Home() {
  const { data: chapters } = useSuspenseQuery(chaptersQuery);
  const { data: unreadData } = useSuspenseQuery(unreadQuery);
  const dueCount = chapters.filter((c) => c.dueForRevision).length;
  const unread = unreadData.unread;
  const [strict, setStrict] = useStrictMode();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-lg font-semibold tracking-tight">Neeti</div>
            <div className="text-xs text-muted-foreground">UPSC Polity, AI-tutored</div>
          </div>
          <nav className="flex gap-4 text-sm">
            <Link to="/explore" className="text-muted-foreground hover:text-foreground">
              Explore
            </Link>
            <Link to="/revision" className="text-muted-foreground hover:text-foreground">
              Revision
            </Link>
            <Link to="/books" className="text-muted-foreground hover:text-foreground">
              Books
            </Link>
            <Link to="/pyq" className="text-muted-foreground hover:text-foreground">
              PYQs
            </Link>
            <Link to="/newspaper" className="text-muted-foreground hover:text-foreground">
              Newspaper
            </Link>
            <Link to="/mains" className="text-muted-foreground hover:text-foreground">
              Mains
            </Link>
            <Link to="/analyze" className="text-muted-foreground hover:text-foreground">
              Analyze
            </Link>
            <button
              onClick={() => setStrict(!strict)}
              aria-pressed={strict}
              title={strict ? "Strict Mode ON — only official books" : "Strict Mode OFF"}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${strict ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              <Shield className="h-3 w-3" /> Strict
            </button>
            <Link
              to="/notifications"
              className="relative inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Indian Polity</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          One book. One workflow. Read a chapter, test yourself, and let spaced repetition bring it back
          before you forget it.
        </p>

        {dueCount > 0 && (
          <Link
            to="/revision"
            className="mt-6 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm transition-colors hover:bg-primary/10"
          >
            <span className="flex items-center gap-2 font-medium">
              <Repeat className="h-4 w-4" />
              {dueCount} chapter{dueCount === 1 ? "" : "s"} due for revision today
            </span>
            <span className="text-primary">Start →</span>
          </Link>
        )}

        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Chapters
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {chapters.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Chapter {c.order}</div>
                    <div className="mt-0.5 font-medium">{c.title}</div>
                  </div>
                  {c.dueForRevision && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Due
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  {c.attempts > 0 ? (
                    <span>
                      Best: {c.bestPct}% · {c.attempts} attempt{c.attempts === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span>Not yet tested</span>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <Link
                    to="/read/$chapter"
                    params={{ chapter: c.slug }}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <BookOpen className="h-3 w-3" /> Read
                  </Link>
                  <Link
                    to="/test/$chapter"
                    params={{ chapter: c.slug }}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    <ClipboardCheck className="h-3 w-3" /> Test
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            to="/explore"
            icon={<Search className="h-4 w-4" />}
            title="Explore topics"
            desc="Search any topic. Toggle Crisp Summary or Strict Textbook, with pinned precedent and news."
          />
          <FeatureCard
            to="/books"
            icon={<Library className="h-4 w-4" />}
            title="Books library"
            desc="Upload Laxmikanth or any PDF; auto-chunked into chapters. Toggle Strict Mode to search only official books."
          />
          <FeatureCard
            to="/revision"
            icon={<Repeat className="h-4 w-4" />}
            title="Daily revision"
            desc="5-question micro-tests at 3, 7, and 14 days after each chapter."
          />
          <FeatureCard
            to="/pyq"
            icon={<Library className="h-4 w-4" />}
            title="PYQ library"
            desc="Upload PDFs or photos; AI extracts and maps them to chapters."
          />
          <FeatureCard
            to="/newspaper"
            icon={<Newspaper className="h-4 w-4" />}
            title="Newspaper"
            desc="Upload today's paper; get current-affairs linked to each chapter."
          />
          <FeatureCard
            to="/mains"
            icon={<PencilLine className="h-4 w-4" />}
            title="Mains evaluator"
            desc="Paste a written answer; get rubric feedback in seconds."
          />
          <FeatureCard
            to="/analyze"
            icon={<BarChart3 className="h-4 w-4" />}
            title="Analyze"
            desc="See per-chapter accuracy and what you owe your future self."
          />
        </section>
      </main>
    </div>
  );
}

function FeatureCard({
  to,
  icon,
  title,
  desc,
}: {
  to: "/revision" | "/mains" | "/analyze" | "/pyq" | "/newspaper" | "/books" | "/explore";
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
    </Link>
  );
}

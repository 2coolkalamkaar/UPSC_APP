import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BellRing, BookOpen, CheckCheck, Newspaper } from "lucide-react";

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications.functions";

const notificationsQuery = queryOptions({
  queryKey: ["notifications"],
  queryFn: () => listNotifications(),
});

export const Route = createFileRoute("/notifications")({
  loader: ({ context }) => context.queryClient.ensureQueryData(notificationsQuery),
  head: () => ({
    meta: [
      { title: "Notifications — Neeti" },
      {
        name: "description",
        content:
          "Alerts when newly uploaded newspaper items match chapters you are studying or your weak areas.",
      },
      { property: "og:title", content: "Notifications — Neeti" },
      {
        property: "og:description",
        content: "Current-affairs alerts linked to your active study and weak chapters.",
      },
    ],
  }),
  component: NotificationsPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">Failed to load notifications: {error.message}</div>
  ),
});

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.round(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}

function NotificationsPage() {
  const { data } = useSuspenseQuery(notificationsQuery);
  const qc = useQueryClient();
  const router = useRouter();
  const markOne = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);

  const readMut = useMutation({
    mutationFn: (id: string) => markOne({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      router.invalidate();
    },
  });
  const readAllMut = useMutation({
    mutationFn: () => markAll(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      router.invalidate();
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <div className="text-sm font-medium">Notifications</div>
          <button
            onClick={() => readAllMut.mutate()}
            disabled={readAllMut.isPending || data.unread === 0}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            <CheckCheck className="h-3 w-3" /> Mark all read
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-primary" />
          <h1 className="text-xl font-semibold tracking-tight">
            {data.unread > 0 ? `${data.unread} new match${data.unread === 1 ? "" : "es"}` : "You're all caught up"}
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Alerts fire when a newspaper upload contains news that maps to a chapter you're actively
          studying or a weak area (accuracy below 70%).
        </p>

        {data.items.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No notifications yet. Upload a newspaper on the{" "}
            <Link to="/newspaper" className="text-primary underline">Newspaper</Link> page to get started.
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {data.items.map((n) => (
              <li
                key={n.id}
                className={`rounded-lg border p-4 transition-colors ${
                  n.readAt
                    ? "border-border bg-card"
                    : "border-primary/30 bg-primary/5"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                          n.reason === "weak"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {n.reason === "weak" ? "Weak area" : "Currently studying"}
                      </span>
                      {n.chapter && (
                        <span className="inline-flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {n.chapter.title}
                        </span>
                      )}
                      <span>· {(n.similarity * 100).toFixed(0)}% match</span>
                      <span>· {timeAgo(n.createdAt)}</span>
                    </div>
                    {n.news ? (
                      <>
                        <div className="mt-1.5 flex items-start gap-1.5 text-sm font-medium">
                          <Newspaper className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          {n.news.title}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{n.news.summary}</p>
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          {n.news.source}
                          {n.news.published_on ? ` · ${n.news.published_on}` : ""}
                          {n.news.topic ? ` · ${n.news.topic}` : ""}
                        </div>
                      </>
                    ) : (
                      <div className="mt-1 text-sm text-muted-foreground">News item removed.</div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {n.chapter && (
                    <Link
                      to="/read/$chapter"
                      params={{ chapter: n.chapter.slug }}
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <BookOpen className="h-3 w-3" /> Open chapter
                    </Link>
                  )}
                  {!n.readAt && (
                    <button
                      onClick={() => readMut.mutate(n.id)}
                      disabled={readMut.isPending}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
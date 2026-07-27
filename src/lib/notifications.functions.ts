import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getSupabaseAdmin } from "./upsc.server";

export type NotificationItem = {
  id: string;
  reason: "studying" | "weak";
  similarity: number;
  createdAt: string;
  readAt: string | null;
  chapter: { slug: string; title: string } | null;
  news: {
    id: string;
    title: string;
    summary: string;
    topic: string | null;
    source: string;
    published_on: string | null;
  } | null;
};

export const listNotifications = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ items: NotificationItem[]; unread: number }> => {
    const sb = await getSupabaseAdmin();
    const { data, error } = await sb
      .from("notifications")
      .select(
        "id, reason, similarity, created_at, read_at, chapters(slug, title), current_affairs(id, title, summary, topic, source, published_on)",
      )
      .order("created_at", { ascending: false })
      .limit(80);
    if (error) throw new Error(error.message);
    const items: NotificationItem[] = (data ?? []).map((r) => {
      const ch = r.chapters as unknown as { slug: string; title: string } | null;
      const n = r.current_affairs as unknown as NotificationItem["news"];
      return {
        id: r.id as string,
        reason: (r.reason as "studying" | "weak") ?? "studying",
        similarity: (r.similarity as number) ?? 0,
        createdAt: r.created_at as string,
        readAt: (r.read_at as string | null) ?? null,
        chapter: ch,
        news: n,
      };
    });
    const unread = items.filter((i) => !i.readAt).length;
    return { items, unread };
  },
);

export const unreadNotificationCount = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await getSupabaseAdmin();
  const { count } = await sb
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return { unread: count ?? 0 };
});

export const markNotificationRead = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const sb = await getSupabaseAdmin();
    await sb
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" }).handler(async () => {
  const sb = await getSupabaseAdmin();
  await sb
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  return { ok: true };
});
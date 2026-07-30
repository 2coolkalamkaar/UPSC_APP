import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: NotificationItem[]; unread: number }> => {
    const sb = await getSupabaseAdmin();
    const { data, error } = await sb
      .from("notifications")
      .select(
        "id, reason, similarity, created_at, read_at, chapters(slug, title), current_affairs(id, title, summary, topic, source, published_on)",
      )
      .eq("user_id", context.userId)
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
  });

export const unreadNotificationCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count } = await context.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("read_at", null);
    return { unread: count ?? 0 };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

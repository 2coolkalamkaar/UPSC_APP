import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  extractNewsFromMedia,
  extractNewsFromText,
  findRelatedNewsForChapter,
  insertNews,
} from "./currentaffairs.server";
import { getSupabaseAdmin } from "./upsc.server";

export const uploadNewspaperFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        filename: z.string(),
        mimeType: z.string(),
        base64: z.string().min(10),
        source: z.string().optional(),
        published_on: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const rows = await extractNewsFromMedia({ mimeType: data.mimeType, base64: data.base64 });
    if (rows.length === 0) return { inserted: 0, extracted: 0 };
    const { inserted, notified } = await insertNews(rows, {
      source: data.source,
      published_on: data.published_on,
      userId: context.userId,
    });
    return { inserted, extracted: rows.length, notified };
  });

export const uploadNewspaperText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        text: z.string().min(20).max(50000),
        source: z.string().optional(),
        published_on: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const rows = await extractNewsFromText(data.text);
    if (rows.length === 0) return { inserted: 0, extracted: 0 };
    const { inserted, notified } = await insertNews(rows, {
      source: data.source,
      published_on: data.published_on,
      userId: context.userId,
    });
    return { inserted, extracted: rows.length, notified };
  });

export const listCurrentAffairs = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await getSupabaseAdmin();
  const { data, error } = await sb
    .from("current_affairs")
    .select("id, title, summary, source, published_on, topic, created_at")
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);
  const { count } = await sb.from("current_affairs").select("id", { count: "exact", head: true });
  return { items: data ?? [], total: count ?? 0 };
});

export const relatedNews = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ slug: z.string(), limit: z.number().int().min(1).max(10).default(5) }).parse(data),
  )
  .handler(async ({ data }) => {
    const items = await findRelatedNewsForChapter(data.slug, data.limit);
    return { items };
  });
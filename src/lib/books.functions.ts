import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { signBookUrl, uploadBookAndIngest } from "./books.server";
import { getSupabaseAdmin } from "./upsc.server";

export const listBooks = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await getSupabaseAdmin();
  const { data: books, error } = await sb
    .from("books")
    .select("id, title, author, is_official, storage_path, mime_type, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const bookIds = (books ?? []).map((b) => b.id as string);
  if (bookIds.length === 0) return [];
  const { data: chapters } = await sb
    .from("chapters")
    .select("id, book_id")
    .in("book_id", bookIds);
  const counts = new Map<string, number>();
  for (const c of chapters ?? []) {
    const bid = c.book_id as string | null;
    if (!bid) continue;
    counts.set(bid, (counts.get(bid) ?? 0) + 1);
  }
  return (books ?? []).map((b) => ({
    id: b.id as string,
    title: b.title as string,
    author: (b.author as string | null) ?? null,
    isOfficial: b.is_official as boolean,
    hasPdf: Boolean(b.storage_path),
    mimeType: (b.mime_type as string | null) ?? null,
    createdAt: b.created_at as string,
    chapterCount: counts.get(b.id as string) ?? 0,
  }));
});

export const uploadBook = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        title: z.string().min(2).max(200),
        author: z.string().max(200).optional().nullable(),
        isOfficial: z.boolean().default(false),
        filename: z.string().max(200).optional(),
        mimeType: z.string().max(120).optional(),
        base64: z.string().optional(),
        text: z.string().max(200_000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => uploadBookAndIngest(data));

export const setBookOfficial = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ id: z.string(), isOfficial: z.boolean() }).parse(data),
  )
  .handler(async ({ data }) => {
    const sb = await getSupabaseAdmin();
    const { error } = await sb
      .from("books")
      .update({ is_official: data.isOfficial })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBook = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const sb = await getSupabaseAdmin();
    const { data: b } = await sb
      .from("books")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (b?.storage_path) {
      await sb.storage.from("books").remove([b.storage_path]);
    }
    // Chapters/chunks cascade via ON DELETE SET NULL — cleanup manually.
    const { data: chapters } = await sb.from("chapters").select("id").eq("book_id", data.id);
    const chIds = (chapters ?? []).map((c) => c.id as string);
    if (chIds.length > 0) {
      await sb.from("chunks").delete().in("chapter_id", chIds);
      await sb.from("chapters").delete().in("id", chIds);
    }
    await sb.from("books").delete().eq("id", data.id);
    return { ok: true };
  });

export const getBookPdfUrl = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ id: z.string(), page: z.number().int().optional() }).parse(data),
  )
  .handler(async ({ data }) => ({ url: await signBookUrl(data.id, data.page) }));

export const getChapterBookInfo = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ slug: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const sb = await getSupabaseAdmin();
    const { data: chapter } = await sb
      .from("chapters")
      .select("id, book_id, books(id, title, author, storage_path)")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!chapter?.book_id) return { book: null };
    const b = chapter.books as unknown as {
      id: string;
      title: string;
      author: string | null;
      storage_path: string | null;
    } | null;
    if (!b) return { book: null };
    return {
      book: {
        id: b.id,
        title: b.title,
        author: b.author,
        hasPdf: Boolean(b.storage_path),
      },
    };
  });
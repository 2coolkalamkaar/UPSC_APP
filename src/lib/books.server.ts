import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";

import { createGoogleProvider, embedText, toVectorLiteral } from "./ai-gateway.server";
import { getSupabaseAdmin } from "./upsc.server";

const MODEL = "gemini-2.5-flash";

function getProvider() {
  return createGoogleProvider();
}

const BookSchema = z.object({
  sections: z.array(
    z.object({
      title: z.string(),
      page_start: z.number().nullable().optional(),
      page_end: z.number().nullable().optional(),
      chunks: z.array(
        z.object({
          heading: z.string().nullable().optional(),
          content: z.string(),
          page_start: z.number().nullable().optional(),
          page_end: z.number().nullable().optional(),
        }),
      ),
    }),
  ),
});
export type ParsedBook = z.infer<typeof BookSchema>;

const INSTRUCTIONS = `You are converting a UPSC-prep textbook (e.g. Laxmikanth Polity) into a structured knowledge base.
Detect the book's chapters/sections from headings and the table of contents.
For each section produce:
- title: the chapter heading exactly as it appears
- page_start / page_end: page numbers in the source PDF (integers), or null if not visible
- chunks: 3-10 sub-sections of that chapter. Each chunk has:
  - heading: sub-heading if any, else null
  - content: clean, faithful excerpt of the chapter body (200-450 words). Preserve article numbers, definitions, and lists verbatim.
  - page_start / page_end: page numbers for that chunk if determinable, else null

Rules:
- Preserve the author's exact wording for definitions, article numbers, and enumerated lists. Do not paraphrase them.
- Skip forewords, indexes, and blank pages.
- If the document is huge, cover as many chapters as you can from the start; do not fabricate content.`;

import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

async function extractFromFile(mimeType: string, base64: string): Promise<ParsedBook> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY is not set.");
  
  const fm = new GoogleAIFileManager(apiKey);
  const ai = new GoogleGenerativeAI(apiKey);
  
  const tempPath = path.join(os.tmpdir(), `upload-${Date.now()}.tmp`);
  fs.writeFileSync(tempPath, Buffer.from(base64, "base64"));
  
  let uploadedFile: any;
  try {
    uploadedFile = await fm.uploadFile(tempPath, { mimeType });
  } finally {
    try { fs.unlinkSync(tempPath); } catch (e) {}
  }
  
  try {
    const model = ai.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        responseMimeType: "application/json",
      }
    });
    
    // Convert zod schema to JSON schema manually or rely on AI SDK's parsing if we can't.
    // For pure @google/generative-ai, we can ask for JSON matching our schema in the prompt.
    const prompt = `${INSTRUCTIONS}

Return a valid JSON object matching this schema:
{
  "sections": [
    {
      "title": "string",
      "page_start": 0,
      "page_end": 0,
      "chunks": [
        {
          "heading": "string",
          "content": "string",
          "page_start": 0,
          "page_end": 0
        }
      ]
    }
  ]
}`;

    const res = await model.generateContent([
      prompt,
      { fileData: { fileUri: uploadedFile.file.uri, mimeType: uploadedFile.file.mimeType } }
    ]);
    
    const text = res.response.text();
    // Clean up markdown code blocks if any
    const jsonStr = text.replace(/^```json/m, "").replace(/```$/m, "").trim();
    return BookSchema.parse(JSON.parse(jsonStr));
  } catch (error: any) {
    console.error("Gemini File Extraction Error:", error);
    try {
      return BookSchema.parse(JSON.parse(error.text ?? "{}"));
    } catch {
      return { sections: [] };
    }
  }
}

async function extractFromText(text: string): Promise<ParsedBook> {
  const provider = getProvider();
  try {
    const { output } = await generateText({
      model: provider(MODEL),
      output: Output.object({ schema: BookSchema }),
      prompt: `${INSTRUCTIONS}\n\nSource text:\n${text.slice(0, 60000)}`,
    });
    return output;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) return { sections: [] };
    throw error;
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function uploadBookAndIngest(input: {
  title: string;
  author?: string | null;
  isOfficial: boolean;
  filename?: string;
  mimeType?: string;
  base64?: string;
  text?: string;
}): Promise<{ bookId: string; sections: number; chunks: number; storagePath: string | null }> {
  const sb = await getSupabaseAdmin();
  let storagePath: string | null = null;
  let mimeType: string | null = input.mimeType ?? null;
  let parsed: ParsedBook;

  if (input.base64 && input.mimeType) {
    // Upload the raw file to storage first.
    const buf = Uint8Array.from(atob(input.base64), (c) => c.charCodeAt(0));
    const safeName = (input.filename ?? "book").replace(/[^A-Za-z0-9._-]+/g, "_");
    const path = `${Date.now()}-${safeName}`;
    const { error: upErr } = await sb.storage.from("books").upload(path, buf, {
      contentType: input.mimeType,
      upsert: false,
    });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);
    storagePath = path;
    parsed = await extractFromFile(input.mimeType, input.base64);
  } else if (input.text && input.text.trim().length > 0) {
    parsed = await extractFromText(input.text);
  } else {
    throw new Error("Provide a file or text");
  }

  // Insert the book row.
  const { data: book, error: bErr } = await sb
    .from("books")
    .insert({
      title: input.title,
      author: input.author ?? null,
      is_official: input.isOfficial,
      storage_path: storagePath,
      mime_type: mimeType,
    })
    .select("id")
    .single();
  if (bErr || !book) throw new Error(`Book insert failed: ${bErr?.message}`);
  const bookId = book.id as string;

  // Determine starting `order` (append to existing chapters).
  const { data: last } = await sb
    .from("chapters")
    .select("order")
    .order("order", { ascending: false })
    .limit(1);
  let nextOrder = ((last?.[0]?.order as number | undefined) ?? 0) + 1;

  let chunkCount = 0;
  for (const s of parsed.sections) {
    const cleanTitle = s.title.trim().slice(0, 200);
    if (!cleanTitle || s.chunks.length === 0) continue;
    // Ensure unique slug per book.
    const baseSlug = slugify(cleanTitle) || `chapter-${nextOrder}`;
    let slug = `${baseSlug}-${bookId.slice(0, 6)}`;
    // Insert chapter.
    const { data: chap, error: cErr } = await sb
      .from("chapters")
      .insert({ slug, title: cleanTitle, order: nextOrder, book_id: bookId })
      .select("id")
      .single();
    if (cErr || !chap) continue;
    nextOrder += 1;
    const rawChunks = s.chunks.filter((c) => c.content && c.content.trim().length > 20);
    if (rawChunks.length === 0) continue;

    const chunkRows = await Promise.all(
      rawChunks.map(async (c) => {
        const textToEmbed = c.content.trim();
        const vec = await embedText(textToEmbed);
        return {
          chapter_id: chap.id as string,
          book_id: bookId,
          heading: c.heading?.trim() || null,
          content: textToEmbed,
          page_start: c.page_start ?? s.page_start ?? null,
          page_end: c.page_end ?? s.page_end ?? null,
          embedding: toVectorLiteral(vec) as unknown as string,
        };
      })
    );

    const { error: chErr } = await sb.from("chunks").insert(chunkRows as never);
    if (!chErr) chunkCount += chunkRows.length;
  }

  return {
    bookId,
    sections: parsed.sections.length,
    chunks: chunkCount,
    storagePath,
  };
}

export async function signBookUrl(bookId: string, page?: number): Promise<string | null> {
  const sb = await getSupabaseAdmin();
  const { data: book } = await sb
    .from("books")
    .select("storage_path")
    .eq("id", bookId)
    .maybeSingle();
  if (!book?.storage_path) return null;
  const { data, error } = await sb.storage
    .from("books")
    .createSignedUrl(book.storage_path, 60 * 60);
  if (error || !data?.signedUrl) return null;
  return page ? `${data.signedUrl}#page=${page}` : data.signedUrl;
}
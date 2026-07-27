import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";

import { createGoogleProvider, embedText, toVectorLiteral } from "./ai-gateway.server";
import { getSupabaseAdmin, loadChapterBySlug } from "./upsc.server";

const VISION = "gemini-2.5-flash";

function getProvider() {
  return createGoogleProvider();
}

const ExtractedPyqSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()).default([]),
      correct_index: z.number().nullable().optional(),
      explanation: z.string().nullable().optional(),
      year: z.number().nullable().optional(),
      topic: z.string().nullable().optional(),
      difficulty: z.string().nullable().optional(),
    }),
  ),
});
export type ExtractedPyq = z.infer<typeof ExtractedPyqSchema>["questions"][number];

export async function extractPyqsFromMedia(opts: {
  mimeType: string;
  base64: string;
  fallbackYear?: number;
  fallbackTopic?: string;
}): Promise<ExtractedPyq[]> {
  const provider = getProvider();
  const isImage = opts.mimeType.startsWith("image/");
  const filePart = isImage
    ? {
        type: "image" as const,
        image: `data:${opts.mimeType};base64,${opts.base64}`,
      }
    : {
        type: "file" as const,
        mediaType: opts.mimeType,
        data: opts.base64,
      };
  const instructions = `You are an expert UPSC content extractor. Read this UPSC previous-year question paper (PDF or image) and output every multiple-choice question you can find.
For each question, provide:
- question text (concise, preserve "Consider the following statements" style if present)
- options (typically 4)
- correct_index (0-based) if the answer key is visible; otherwise null
- explanation if visible; otherwise null
- year (integer, e.g. 2022) if visible; otherwise null
- topic (short, e.g. "Fundamental Rights", "Parliament") — infer if not stated
- difficulty ("Easy" | "Medium" | "Hard") — best guess
Ignore instructions, page numbers, and non-question text.`;
  try {
    const { output } = await generateText({
      model: provider(VISION),
      output: Output.object({ schema: ExtractedPyqSchema }),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: instructions },
            filePart,
          ],
        },
      ],
    });
    return output.questions.filter((q) => q.options.length >= 2);
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      try {
        const parsed = ExtractedPyqSchema.parse(JSON.parse(error.text ?? "{}"));
        return parsed.questions.filter((q) => q.options.length >= 2);
      } catch {
        return [];
      }
    }
    throw error;
  }
}

export async function extractPyqsFromText(text: string): Promise<ExtractedPyq[]> {
  const provider = getProvider();
  try {
    const { output } = await generateText({
      model: provider(VISION),
      output: Output.object({ schema: ExtractedPyqSchema }),
      prompt: `Extract UPSC MCQs from the text below. For each question output question, options, correct_index (0-based, null if unknown), explanation (nullable), year (nullable int), topic (short label), difficulty (Easy|Medium|Hard).\n\nText:\n${text}`,
    });
    return output.questions.filter((q) => q.options.length >= 2);
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) return [];
    throw error;
  }
}

export async function insertPyqs(
  rows: ExtractedPyq[],
  defaults: { source?: string; subject?: string; year?: number; topic?: string; chapterSlug?: string },
) {
  if (rows.length === 0) return { inserted: 0 };
  const sb = await getSupabaseAdmin();
  let chapterId: string | null = null;
  if (defaults.chapterSlug) {
    try {
      const { chapter } = await loadChapterBySlug(defaults.chapterSlug);
      chapterId = chapter.id;
    } catch {
      chapterId = null;
    }
  }
  type PyqInsert = {
    source: string;
    subject: string;
    year: number | null;
    topic: string | null;
    difficulty: string | null;
    question: string;
    options: string[];
    correct_index: number | null;
    explanation: string | null;
    chapter_id: string | null;
    embedding: string | null;
  };
  const payload: PyqInsert[] = [];
  for (const r of rows) {
    const text = `${r.question}\n${r.options.join(" | ")}`;
    let embedding: string | null = null;
    try {
      embedding = toVectorLiteral(await embedText(text));
    } catch {
      embedding = null;
    }
    payload.push({
      source: defaults.source ?? "UPSC_Prelims",
      subject: defaults.subject ?? "Polity",
      year: r.year ?? defaults.year ?? null,
      topic: r.topic ?? defaults.topic ?? null,
      difficulty: r.difficulty ?? null,
      question: r.question,
      options: r.options,
      correct_index: r.correct_index ?? null,
      explanation: r.explanation ?? null,
      chapter_id: chapterId,
      embedding,
    });
  }
  const { error, data } = await sb.from("pyqs").insert(payload as never).select("id");
  if (error) throw new Error(error.message);
  return { inserted: data?.length ?? 0 };
}

export type RelatedPyq = {
  id: string;
  question: string;
  options: string[];
  correct_index: number | null;
  explanation: string | null;
  year: number | null;
  topic: string | null;
  difficulty: string | null;
  source: string;
  similarity: number;
};

export async function findRelatedPyqsForChapter(slug: string, limit = 5): Promise<RelatedPyq[]> {
  const { chapter, chunks } = await loadChapterBySlug(slug);
  const text = `${chapter.title}\n${chunks
    .map((c) => `${c.heading ?? ""}\n${c.content}`)
    .join("\n\n")
    .slice(0, 6000)}`;
  let vec: number[];
  try {
    vec = await embedText(text);
  } catch {
    return [];
  }
  const sb = await getSupabaseAdmin();
  const { data, error } = await sb.rpc("match_pyqs", {
    query_embedding: toVectorLiteral(vec) as unknown as string,
    match_count: limit,
    filter_subject: "Polity",
  });
  if (error) return [];
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    question: r.question as string,
    options: (r.options as string[]) ?? [],
    correct_index: (r.correct_index as number | null) ?? null,
    explanation: (r.explanation as string | null) ?? null,
    year: (r.year as number | null) ?? null,
    topic: (r.topic as string | null) ?? null,
    difficulty: (r.difficulty as string | null) ?? null,
    source: (r.source as string) ?? "UPSC",
    similarity: (r.similarity as number) ?? 0,
  }));
}
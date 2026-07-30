import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";

import { createGoogleProvider } from "./ai-gateway.server";

const FAST = "gemini-2.5-flash";
const HEAVY = "gemini-2.5-flash"; // Use flash for JSON gen too — reliable + fast

function getProvider() {
  return createGoogleProvider();
}

export async function getSupabaseAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function loadChapterBySlug(slug: string) {
  const sb = await getSupabaseAdmin();
  const { data: chapter, error } = await sb
    .from("chapters")
    .select("id, slug, title, order, book_id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!chapter) throw new Error(`Chapter not found: ${slug}`);
  const { data: chunks, error: cerr } = await sb
    .from("chunks")
    .select("id, heading, content, page_start, page_end, book_id")
    .eq("chapter_id", chapter.id);
  if (cerr) throw new Error(cerr.message);
  return { chapter, chunks: chunks ?? [] };
}

function chunksAsContext(chunks: { heading: string | null; content: string }[]) {
  return chunks
    .map((c) => (c.heading ? `## ${c.heading}\n${c.content}` : c.content))
    .join("\n\n");
}

async function filterStrict<T extends { book_id: string | null }>(chunks: T[]): Promise<T[]> {
  const sb = await getSupabaseAdmin();
  const { data: official } = await sb.from("books").select("id").eq("is_official", true);
  const ids = new Set((official ?? []).map((b) => b.id as string));
  const filtered = chunks.filter((c) => c.book_id && ids.has(c.book_id));
  return filtered.length > 0 ? filtered : chunks;
}

export async function ragChapterAnswer(slug: string, query: string, strict = false) {
  const { chapter, chunks: allChunks } = await loadChapterBySlug(slug);
  const chunks = strict ? await filterStrict(allChunks) : allChunks;
  const context = chunksAsContext(chunks);
  const provider = getProvider();
  const { text } = await generateText({
    model: provider(FAST),
    system:
      `You are a UPSC Polity tutor. Answer strictly using the provided textbook context. If the answer is not present, say so plainly. Be concise (under 180 words), use bullet points where helpful, and quote article numbers where relevant.${strict ? " Strict Mode is ON: only cite the official textbook context provided." : ""}`,
    prompt: `Chapter: ${chapter.title}\n\nContext:\n${context}\n\nQuestion: ${query}`,
  });
  return { answer: text };
}

const QuizSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()),
      correct_index: z.number(),
      explanation: z.string(),
    }),
  ),
});
export type Quiz = z.infer<typeof QuizSchema>;

function normalizeQuiz(raw: unknown, count: number): Quiz {
  const parsed = QuizSchema.safeParse(raw);
  if (!parsed.success) return { questions: [] };
  const clamped = parsed.data.questions
    .filter((q) => q.options.length >= 3 && q.correct_index >= 0 && q.correct_index < q.options.length)
    .slice(0, count);
  return { questions: clamped };
}

export async function generateQuiz(slug: string, count: number, strict = false): Promise<Quiz> {
  const { chapter, chunks: allChunks } = await loadChapterBySlug(slug);
  const chunks = strict ? await filterStrict(allChunks) : allChunks;
  const context = chunksAsContext(chunks);
  const provider = getProvider();
  const prompt = `Generate exactly ${count} multiple-choice questions for UPSC Prelims from the chapter "${chapter.title}".
Use ONLY facts present in the context. Each question must have exactly 4 options. Set correct_index (0-3). Provide a one-sentence explanation citing the constitutional article or fact.

Context:
${context}`;
  try {
    const { output } = await generateText({
      model: provider(HEAVY),
      output: Output.object({
        schema: QuizSchema,
      }),
      prompt,
    });
    return normalizeQuiz(output, count);
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      try {
        return normalizeQuiz(JSON.parse(error.text ?? "{}"), count);
      } catch {
        return { questions: [] };
      }
    }
    throw error;
  }
}

const RubricSchema = z.object({
  introduction: z.object({ score: z.number(), comment: z.string() }),
  structure: z.object({ score: z.number(), comment: z.string() }),
  keywords: z.object({ score: z.number(), comment: z.string() }),
  articles: z.object({ score: z.number(), comment: z.string() }),
  conclusion: z.object({ score: z.number(), comment: z.string() }),
  overall: z.number(),
  summary: z.string(),
});
export type Rubric = z.infer<typeof RubricSchema>;

export async function evaluateMains(question: string, answer: string): Promise<Rubric> {
  const provider = getProvider();
  const prompt = `You are a UPSC Mains examiner. Evaluate the following answer against the strict rubric.
Each of introduction, structure, keywords, articles, conclusion is scored 0-10. overall is 0-10.
Provide one crisp sentence per criterion. summary is 2 sentences of overall guidance.

Question: ${question}

Candidate answer:
${answer}`;
  try {
    const { output } = await generateText({
      model: provider(HEAVY),
      output: Output.object({ schema: RubricSchema }),
      prompt,
    });
    // Clamp scores 0-10
    const clamp = (n: number) => Math.max(0, Math.min(10, Math.round(n)));
    output.overall = clamp(output.overall);
    for (const k of ["introduction", "structure", "keywords", "articles", "conclusion"] as const) {
      output[k].score = clamp(output[k].score);
    }
    return output;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new Error("The evaluator returned malformed feedback. Try again.");
    }
    throw error;
  }
}

export async function scheduleRevisions(chapterId: string, userId: string) {
  const sb = await getSupabaseAdmin();
  const now = Date.now();
  const rows = [
    { chapter_id: chapterId, user_id: userId, due_at: new Date(now + 3 * 86400000).toISOString(), stage: "3d" },
    { chapter_id: chapterId, user_id: userId, due_at: new Date(now + 7 * 86400000).toISOString(), stage: "7d" },
    { chapter_id: chapterId, user_id: userId, due_at: new Date(now + 14 * 86400000).toISOString(), stage: "14d" },
  ];
  await sb.from("revision_schedule").insert(rows);
}
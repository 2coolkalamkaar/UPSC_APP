import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * Returns a Google AI provider instance using GOOGLE_API_KEY.
 * Replaces the Lovable AI Gateway with direct Google AI Studio access.
 */
export function createGoogleProvider() {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("Missing GOOGLE_API_KEY — get one free at https://aistudio.google.com/apikey");
  return createGoogleGenerativeAI({ apiKey: key });
}

/**
 * Embed a string using Google's text-embedding-004 model.
 * Returns a 768-dimensional vector.
 * NOTE: Google's text-embedding-004 is 768-dim, but the DB schema uses vector(3072).
 * We pad with zeros to match the DB column. You can re-migrate to vector(768) for efficiency.
 */
export async function embedText(text: string): Promise<number[]> {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("Missing GOOGLE_API_KEY");
  const google = createGoogleGenerativeAI({ apiKey: key });

  const embeddingModel = google.textEmbeddingModel("text-embedding-004");
  const { embedding } = await embeddingModel.doEmbed({ values: [text] });
  const vec = embedding[0];

  // The DB column is vector(3072). text-embedding-004 returns 768 dims.
  // Pad to 3072 to avoid schema mismatch until we run the re-migration.
  if (vec.length < 3072) {
    const padded = new Array(3072).fill(0);
    for (let i = 0; i < vec.length; i++) padded[i] = vec[i];
    return padded;
  }
  return vec;
}

export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
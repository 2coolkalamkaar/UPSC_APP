import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { pipeline, env } from '@xenova/transformers';

// Cache transformers locally
env.cacheDir = './.cache/transformers';

// Singleton instance of the extraction pipeline
let extractorPromise: Promise<any> | null = null;
function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return extractorPromise;
}

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
 * Embed a string using the local Xenova/all-MiniLM-L6-v2 ONNX model.
 * Returns a 384-dimensional vector.
 * 100% free, local, and zero API calls.
 */
export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  // output.data is a Float32Array, convert it to a standard JS array
  const vec = Array.from(output.data);
  return vec as number[];
}

export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
import { generateText } from "ai";

import { createGoogleProvider } from "./ai-gateway.server";

const MODEL = "gemini-2.5-flash";

function getProvider() {
  return createGoogleProvider();
}

// Curated pool of UPSC Polity Mains-style prompts. A deterministic
// question-of-the-day is picked based on the current date.
export const DAILY_MAINS_POOL: { question: string; wordLimit: number; minutes: number }[] = [
  { question: "Discuss the significance of the Preamble as the key to interpreting the Indian Constitution.", wordLimit: 250, minutes: 15 },
  { question: "Examine the role of the Speaker of the Lok Sabha in ensuring the impartial functioning of the House.", wordLimit: 250, minutes: 15 },
  { question: "Critically evaluate the doctrine of Basic Structure in the light of major Supreme Court judgments.", wordLimit: 250, minutes: 15 },
  { question: "Analyse the role of the Governor in Centre-State relations with recent examples.", wordLimit: 250, minutes: 15 },
  { question: "Discuss the tension between Fundamental Rights and Directive Principles of State Policy.", wordLimit: 250, minutes: 15 },
  { question: "Examine the effectiveness of Anti-Defection Law in curbing political defections in India.", wordLimit: 250, minutes: 15 },
  { question: "Assess the constitutional position of the President of India as a nominal executive.", wordLimit: 250, minutes: 15 },
  { question: "Discuss the powers and limitations of the Election Commission of India in ensuring free and fair elections.", wordLimit: 250, minutes: 15 },
  { question: "Evaluate the role of Finance Commission in promoting cooperative federalism.", wordLimit: 250, minutes: 15 },
  { question: "Discuss the significance of the 73rd and 74th Constitutional Amendments in democratic decentralisation.", wordLimit: 250, minutes: 15 },
  { question: "Examine the scope and limitations of judicial review in India.", wordLimit: 250, minutes: 15 },
  { question: "Analyse the impact of Emergency provisions on the federal character of the Constitution.", wordLimit: 250, minutes: 15 },
  { question: "Discuss the role of Parliamentary Committees in strengthening legislative oversight.", wordLimit: 250, minutes: 15 },
  { question: "Critically evaluate the office of the Attorney General of India.", wordLimit: 250, minutes: 15 },
  { question: "Discuss the challenges before the CAG in ensuring financial accountability.", wordLimit: 250, minutes: 15 },
];

export function pickDailyMains(dateIso: string) {
  // Deterministic: day-of-year modulo pool length.
  const d = new Date(dateIso + "T00:00:00Z");
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((d.getTime() - start) / 86400000);
  const idx = ((dayOfYear % DAILY_MAINS_POOL.length) + DAILY_MAINS_POOL.length) % DAILY_MAINS_POOL.length;
  return { ...DAILY_MAINS_POOL[idx], index: idx };
}

export async function generateModelAnswer(question: string, wordLimit: number): Promise<string> {
  const provider = getProvider();
  const { text } = await generateText({
    model: provider(MODEL),
    system:
      "You are a senior UPSC Mains examiner writing a benchmark model answer for Indian Polity. Use a crisp introduction, a well-structured body with sub-headings and short bullets, cite specific constitutional Articles, amendments and landmark cases, and end with a forward-looking conclusion.",
    prompt: `Write a model UPSC Mains answer for the following question in about ${wordLimit} words. Keep it factually accurate and India-specific.\n\nQuestion: ${question}`,
  });
  return text.trim();
}

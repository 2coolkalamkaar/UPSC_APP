import { generateText } from "ai";
import { createGoogleProvider } from "./src/lib/ai-gateway.server";

async function main() {
  const provider = createGoogleProvider();
  try {
    console.log("Trying gemini-2.5-flash...");
    const res1 = await generateText({
      model: provider("gemini-2.5-flash"),
      prompt: "hi"
    });
    console.log("2.5 worked!");
  } catch (e: any) {
    console.error("2.5 Error:", e.message);
  }

  try {
    console.log("Trying gemini-1.5-flash...");
    const res2 = await generateText({
      model: provider("gemini-1.5-flash"),
      prompt: "hi"
    });
    console.log("1.5 worked!");
  } catch (e: any) {
    console.error("1.5 Error:", e.message);
  }
}
main();

import { generateText } from "ai";
import { createGoogleProvider } from "./src/lib/ai-gateway.server";

async function main() {
  const provider = createGoogleProvider();
  try {
    const res = await generateText({
      model: provider("gemini-2.5-flash"),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "what is this?" },
            { type: "file", mimeType: "application/pdf", data: Buffer.from("dummy").toString("base64") }
          ]
        }
      ]
    });
    console.log("Success");
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}
main();

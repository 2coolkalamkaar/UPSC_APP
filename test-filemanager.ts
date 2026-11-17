import { GoogleAIFileManager } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("No API key");
  
  const fm = new GoogleAIFileManager(apiKey);
  const ai = new GoogleGenerativeAI(apiKey);
  
  fs.writeFileSync("dummy.txt", "Hello world");
  
  try {
    const upload = await fm.uploadFile("dummy.txt", { mimeType: "text/plain" });
    console.log("Uploaded:", upload.file.uri);
    
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const res = await model.generateContent([
      "what is in this file?",
      { fileData: { fileUri: upload.file.uri, mimeType: upload.file.mimeType } }
    ]);
    console.log("Result:", res.response.text());
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}
main();

import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/transcribe", async (req: Request, res: Response) => {
    try {
      const { apiKey, provider, audioBase64, mimeType } = req.body;

      if (!apiKey || !provider || !audioBase64) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const audioBuffer = Buffer.from(audioBase64, "base64");

      const ext = mimeType?.includes("webm") ? "webm" : mimeType?.includes("mp4") ? "mp4" : "m4a";
      const contentType = mimeType || "audio/m4a";

      const model = provider === "groq" ? "whisper-large-v3-turbo" : "whisper-1";
      const baseUrl = provider === "groq"
        ? "https://api.groq.com/openai/v1"
        : "https://api.openai.com/v1";

      const boundary = "----FormBoundary" + Date.now().toString(16);

      const parts: Buffer[] = [];
      const addField = (name: string, value: string) => {
        parts.push(Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
        ));
      };

      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="recording.${ext}"\r\nContent-Type: ${contentType}\r\n\r\n`
      ));
      parts.push(audioBuffer);
      parts.push(Buffer.from("\r\n"));

      addField("model", model);
      addField("response_format", "text");

      parts.push(Buffer.from(`--${boundary}--\r\n`));

      const body = Buffer.concat(parts);

      const response = await fetch(`${baseUrl}/audio/transcriptions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: errText });
      }

      const text = await response.text();
      res.json({ text: text.trim() });
    } catch (err: any) {
      console.error("Transcription proxy error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  app.post("/api/polish", async (req: Request, res: Response) => {
    try {
      const { apiKey, provider, text } = req.body;

      if (!apiKey || !text) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const baseUrl = provider === "groq"
        ? "https://api.groq.com/openai/v1"
        : "https://api.openai.com/v1";
      const model = provider === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o-mini";

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "You are a text editor. Fix any transcription errors, add proper punctuation, capitalize sentences, and format the text naturally. Do NOT change the meaning or add new content. Return ONLY the corrected text with no explanation.",
            },
            { role: "user", content: text },
          ],
          temperature: 0.1,
          max_tokens: 2048,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: errText });
      }

      const data = await response.json() as any;
      const polished = data.choices?.[0]?.message?.content?.trim() || text;
      res.json({ text: polished });
    } catch (err: any) {
      console.error("Polish proxy error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

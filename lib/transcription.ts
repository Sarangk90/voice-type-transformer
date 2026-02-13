import { Provider } from "./api-keys";

export async function transcribeAudio(
  audioUri: string,
  apiKey: string,
  provider: Provider
): Promise<string> {
  const formData = new FormData();

  const fileExtension = audioUri.split(".").pop() || "m4a";
  const mimeType = fileExtension === "webm" ? "audio/webm" : "audio/m4a";

  formData.append("file", {
    uri: audioUri,
    type: mimeType,
    name: `recording.${fileExtension}`,
  } as any);

  formData.append("model", "whisper-1");
  formData.append("response_format", "text");

  const baseUrl =
    provider === "groq"
      ? "https://api.groq.com/openai/v1"
      : "https://api.openai.com/v1";

  if (provider === "groq") {
    formData.delete("model");
    formData.append("model", "whisper-large-v3-turbo");
  }

  const response = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Transcription failed: ${response.status} - ${errorText}`);
  }

  const text = await response.text();
  return text.trim();
}

export async function polishTranscript(
  rawText: string,
  apiKey: string,
  provider: Provider
): Promise<string> {
  const baseUrl =
    provider === "groq"
      ? "https://api.groq.com/openai/v1"
      : "https://api.openai.com/v1";

  const model =
    provider === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o-mini";

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
        {
          role: "user",
          content: rawText,
        },
      ],
      temperature: 0.1,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM processing failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || rawText;
}

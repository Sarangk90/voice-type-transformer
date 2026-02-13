import { Platform } from "react-native";
import { Provider } from "./api-keys";
import { getApiUrl } from "./query-client";

async function blobToBase64(blobUrl: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  const mimeType = blob.type || "audio/webm";

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      resolve({ base64, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function transcribeAudio(
  audioUri: string,
  apiKey: string,
  provider: Provider
): Promise<string> {
  if (Platform.OS === "web") {
    return transcribeViaProxy(audioUri, apiKey, provider);
  }
  return transcribeDirect(audioUri, apiKey, provider);
}

async function transcribeViaProxy(
  audioUri: string,
  apiKey: string,
  provider: Provider
): Promise<string> {
  const { base64, mimeType } = await blobToBase64(audioUri);
  const apiUrl = getApiUrl();

  const response = await fetch(new URL("/api/transcribe", apiUrl).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, provider, audioBase64: base64, mimeType }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(parseErrorMessage(response.status, data.error));
  }

  const data = await response.json();
  return data.text;
}

async function transcribeDirect(
  audioUri: string,
  apiKey: string,
  provider: Provider
): Promise<string> {
  const formData = new FormData();

  const fileExtension = audioUri.split(".").pop() || "m4a";
  const mimeType = fileExtension === "webm" ? "audio/webm"
    : fileExtension === "mp4" ? "audio/mp4"
    : "audio/m4a";

  formData.append("file", {
    uri: audioUri,
    type: mimeType,
    name: `recording.${fileExtension}`,
  } as any);

  const model = provider === "groq" ? "whisper-large-v3-turbo" : "whisper-1";
  formData.append("model", model);
  formData.append("response_format", "text");

  const baseUrl = provider === "groq"
    ? "https://api.groq.com/openai/v1"
    : "https://api.openai.com/v1";

  const response = await globalThis.fetch(`${baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(parseErrorMessage(response.status, errorText));
  }

  const text = await response.text();
  return text.trim();
}

export async function polishTranscript(
  rawText: string,
  apiKey: string,
  provider: Provider
): Promise<string> {
  if (Platform.OS === "web") {
    return polishViaProxy(rawText, apiKey, provider);
  }
  return polishDirect(rawText, apiKey, provider);
}

async function polishViaProxy(
  rawText: string,
  apiKey: string,
  provider: Provider
): Promise<string> {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(new URL("/api/polish", apiUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, provider, text: rawText }),
    });

    if (!response.ok) {
      console.warn("Polish proxy failed, returning raw text");
      return rawText;
    }

    const data = await response.json();
    return data.text || rawText;
  } catch {
    return rawText;
  }
}

async function polishDirect(
  rawText: string,
  apiKey: string,
  provider: Provider
): Promise<string> {
  const baseUrl = provider === "groq"
    ? "https://api.groq.com/openai/v1"
    : "https://api.openai.com/v1";
  const model = provider === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o-mini";

  try {
    const response = await globalThis.fetch(`${baseUrl}/chat/completions`, {
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
          { role: "user", content: rawText },
        ],
        temperature: 0.1,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      console.warn("LLM polish failed, returning raw text");
      return rawText;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || rawText;
  } catch {
    return rawText;
  }
}

function parseErrorMessage(status: number, errorText: string): string {
  if (status === 401) {
    return "Invalid API key. Please check your key in Settings.";
  }
  if (status === 429) {
    return "Rate limit exceeded. Please wait a moment and try again.";
  }
  if (status === 413) {
    return "Recording is too long. Try a shorter recording.";
  }
  return `Transcription failed (${status}): ${errorText}`;
}

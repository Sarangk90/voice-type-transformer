import { Platform } from "react-native";
import { Provider } from "./api-keys";
import { getApiUrl } from "./query-client";

const TRANSCRIBE_TIMEOUT_MS = 60000;
const POLISH_TIMEOUT_MS = 30000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms / 1000} seconds. Check your internet connection and try again.`));
    }, ms);
    promise
      .then((val) => { clearTimeout(timer); resolve(val); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

export async function transcribeAudio(
  audioUri: string,
  apiKey: string,
  provider: Provider
): Promise<string> {
  if (Platform.OS === "web") {
    return withTimeout(
      transcribeWeb(audioUri, apiKey, provider),
      TRANSCRIBE_TIMEOUT_MS,
      "Transcription"
    );
  }
  return withTimeout(
    transcribeNative(audioUri, apiKey, provider),
    TRANSCRIBE_TIMEOUT_MS,
    "Transcription"
  );
}

async function transcribeNative(
  audioUri: string,
  apiKey: string,
  provider: Provider
): Promise<string> {
  const formData = new FormData();

  const fileExtension = audioUri.split(".").pop() || "m4a";
  const mimeType = fileExtension === "webm" ? "audio/webm"
    : fileExtension === "mp4" ? "audio/mp4"
    : fileExtension === "caf" ? "audio/x-caf"
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
    let errorDetail = "";
    try {
      const errBody = await response.text();
      const parsed = JSON.parse(errBody);
      errorDetail = parsed?.error?.message || errBody;
    } catch {
      errorDetail = `HTTP ${response.status}`;
    }
    throw new Error(parseErrorMessage(response.status, errorDetail));
  }

  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("No speech detected. Please speak clearly and try again.");
  }
  return trimmed;
}

async function transcribeWeb(
  audioUri: string,
  apiKey: string,
  provider: Provider
): Promise<string> {
  const blobResponse = await fetch(audioUri);
  const blob = await blobResponse.blob();
  const mimeType = blob.type || "audio/webm";

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const b64 = dataUrl.split(",")[1];
      if (!b64) {
        reject(new Error("Failed to convert audio. Please try again."));
        return;
      }
      resolve(b64);
    };
    reader.onerror = () => reject(new Error("Failed to read audio. Please try again."));
    reader.readAsDataURL(blob);
  });

  const apiUrl = getApiUrl();

  const response = await fetch(new URL("/api/transcribe", apiUrl).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, provider, audioBase64: base64, mimeType }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const errMsg = data?.error || `Server error (${response.status})`;
    throw new Error(parseErrorMessage(response.status, errMsg));
  }

  const data = await response.json();
  const text = data.text?.trim();
  if (!text) {
    throw new Error("No speech detected. Please speak clearly and try again.");
  }
  return text;
}

export async function polishTranscript(
  rawText: string,
  apiKey: string,
  provider: Provider
): Promise<string> {
  if (Platform.OS === "web") {
    return withTimeout(
      polishWeb(rawText, apiKey, provider),
      POLISH_TIMEOUT_MS,
      "Text polishing"
    );
  }
  return withTimeout(
    polishNative(rawText, apiKey, provider),
    POLISH_TIMEOUT_MS,
    "Text polishing"
  );
}

async function polishNative(
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
      return rawText;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || rawText;
  } catch {
    return rawText;
  }
}

async function polishWeb(
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
      return rawText;
    }

    const data = await response.json();
    return data.text || rawText;
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
  if (status === 400) {
    if (errorText.toLowerCase().includes("audio")) {
      return "Audio format not supported. Please try recording again.";
    }
    return errorText;
  }
  return `Transcription failed (${status}): ${errorText}`;
}

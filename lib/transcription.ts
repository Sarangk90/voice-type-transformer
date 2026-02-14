import { Platform } from "react-native";
import { Provider } from "./api-keys";
import { getApiUrl } from "./query-client";

const TRANSCRIBE_TIMEOUT_MS = 60000;
const POLISH_TIMEOUT_MS = 30000;

export async function transcribeAudio(
  audioUri: string,
  apiKey: string,
  provider: Provider
): Promise<string> {
  if (Platform.OS === "web") {
    return transcribeWeb(audioUri, apiKey, provider);
  }
  return transcribeNative(audioUri, apiKey, provider);
}

function transcribeNative(
  audioUri: string,
  apiKey: string,
  provider: Provider
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Transcription timed out. Check your internet connection and try again."));
    }, TRANSCRIBE_TIMEOUT_MS);

    try {
      const formData = new FormData();

      const fileExtension = audioUri.split(".").pop()?.split("?")[0] || "m4a";
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

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${baseUrl}/audio/transcriptions`);
      xhr.setRequestHeader("Authorization", `Bearer ${apiKey}`);

      xhr.onload = () => {
        clearTimeout(timeout);
        if (xhr.status >= 200 && xhr.status < 300) {
          const text = (xhr.responseText || "").trim();
          if (!text) {
            reject(new Error("No speech detected. Please speak clearly and try again."));
          } else {
            resolve(text);
          }
        } else {
          let detail = "";
          try {
            const parsed = JSON.parse(xhr.responseText);
            detail = parsed?.error?.message || xhr.responseText;
          } catch {
            detail = xhr.responseText || `HTTP ${xhr.status}`;
          }
          reject(new Error(parseErrorMessage(xhr.status, detail)));
        }
      };

      xhr.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Network error while transcribing. Please check your internet connection."));
      };

      xhr.ontimeout = () => {
        clearTimeout(timeout);
        reject(new Error("Transcription request timed out. Please try again."));
      };

      xhr.send(formData);
    } catch (err: any) {
      clearTimeout(timeout);
      reject(new Error(`Failed to prepare audio: ${err.message}`));
    }
  });
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
    return polishWeb(rawText, apiKey, provider);
  }
  return polishNative(rawText, apiKey, provider);
}

function polishNative(
  rawText: string,
  apiKey: string,
  provider: Provider
): Promise<string> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(rawText);
    }, POLISH_TIMEOUT_MS);

    try {
      const baseUrl = provider === "groq"
        ? "https://api.groq.com/openai/v1"
        : "https://api.openai.com/v1";
      const model = provider === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o-mini";

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${baseUrl}/chat/completions`);
      xhr.setRequestHeader("Authorization", `Bearer ${apiKey}`);
      xhr.setRequestHeader("Content-Type", "application/json");

      xhr.onload = () => {
        clearTimeout(timeout);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            const polished = data.choices?.[0]?.message?.content?.trim();
            resolve(polished || rawText);
          } catch {
            resolve(rawText);
          }
        } else {
          resolve(rawText);
        }
      };

      xhr.onerror = () => {
        clearTimeout(timeout);
        resolve(rawText);
      };

      xhr.send(JSON.stringify({
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
      }));
    } catch {
      clearTimeout(timeout);
      resolve(rawText);
    }
  });
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

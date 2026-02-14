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

async function audioToBase64(audioUri: string): Promise<{ base64: string; mimeType: string }> {
  if (Platform.OS === "web") {
    const response = await fetch(audioUri);
    const blob = await response.blob();
    const mimeType = blob.type || "audio/webm";

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        if (!base64) {
          reject(new Error("Failed to convert audio recording. Please try again."));
          return;
        }
        resolve({ base64, mimeType });
      };
      reader.onerror = () => reject(new Error("Failed to read audio recording. Please try again."));
      reader.readAsDataURL(blob);
    });
  }

  const LegacyFS = require("expo-file-system/legacy") as typeof import("expo-file-system/legacy");
  const base64 = await LegacyFS.readAsStringAsync(audioUri, {
    encoding: LegacyFS.EncodingType.Base64,
  });

  const ext = audioUri.split(".").pop()?.toLowerCase() || "m4a";
  const mimeType = ext === "webm" ? "audio/webm"
    : ext === "mp4" ? "audio/mp4"
    : ext === "caf" ? "audio/x-caf"
    : "audio/m4a";

  return { base64, mimeType };
}

export async function transcribeAudio(
  audioUri: string,
  apiKey: string,
  provider: Provider
): Promise<string> {
  return withTimeout(
    transcribeViaProxy(audioUri, apiKey, provider),
    TRANSCRIBE_TIMEOUT_MS,
    "Transcription"
  );
}

async function transcribeViaProxy(
  audioUri: string,
  apiKey: string,
  provider: Provider
): Promise<string> {
  const { base64, mimeType } = await audioToBase64(audioUri);
  const apiUrl = getApiUrl();

  console.log(`[transcribe] Sending to proxy: provider=${provider}, mimeType=${mimeType}, base64Length=${base64.length}`);

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
  return withTimeout(
    polishViaProxy(rawText, apiKey, provider),
    POLISH_TIMEOUT_MS,
    "Text polishing"
  );
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
      console.warn("Polish failed, returning raw text");
      return rawText;
    }

    const data = await response.json();
    return data.text || rawText;
  } catch (err) {
    console.warn("Polish error, returning raw text:", err);
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
  if (status === 500) {
    return `Server error: ${errorText}`;
  }
  return `Transcription failed: ${errorText}`;
}

import { Platform } from "react-native";
import { Provider } from "./api-keys";

const TRANSCRIBE_TIMEOUT_MS = 60000;
const POLISH_TIMEOUT_MS = 30000;

function getBackendBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN || "";
  const hostWithoutPort = domain.replace(/:\d+$/, "");
  return `https://${hostWithoutPort}`;
}

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

async function transcribeNative(
  audioUri: string,
  apiKey: string,
  provider: Provider
): Promise<string> {
  let base64: string;
  try {
    const LegacyFS = require("expo-file-system/legacy");
    base64 = await LegacyFS.readAsStringAsync(audioUri, {
      encoding: LegacyFS.EncodingType.Base64,
    });
  } catch (fsErr: any) {
    throw new Error(`Could not read audio file: ${fsErr.message}`);
  }

  if (!base64 || base64.length < 100) {
    throw new Error("Recording was too short or empty. Please try again.");
  }

  const fileExtension = audioUri.split(".").pop()?.split("?")[0] || "m4a";
  const mimeType = fileExtension === "webm" ? "audio/webm"
    : fileExtension === "mp4" ? "audio/mp4"
    : fileExtension === "caf" ? "audio/x-caf"
    : "audio/m4a";

  const baseUrl = getBackendBaseUrl();
  const fetchUrl = `${baseUrl}/api/transcribe`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);

  try {
    const response = await fetch(fetchUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        provider,
        audioBase64: base64,
        mimeType,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

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
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("Transcription timed out. Check your internet connection and try again.");
    }
    throw err;
  }
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

  const baseUrl = getBackendBaseUrl();

  const response = await fetch(`${baseUrl}/api/transcribe`, {
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

async function polishNative(
  rawText: string,
  apiKey: string,
  provider: Provider
): Promise<string> {
  try {
    const baseUrl = getBackendBaseUrl();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), POLISH_TIMEOUT_MS);

    const response = await fetch(`${baseUrl}/api/polish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, provider, text: rawText }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return rawText;
    }

    const data = await response.json();
    return data.text || rawText;
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
    const baseUrl = getBackendBaseUrl();
    const response = await fetch(`${baseUrl}/api/polish`, {
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

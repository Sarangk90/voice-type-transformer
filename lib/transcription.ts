import { Platform } from "react-native";
import { fetch as expoFetch } from "expo/fetch";
import { Provider } from "./api-keys";

const TRANSCRIBE_TIMEOUT_MS = 60000;
const POLISH_TIMEOUT_MS = 30000;

function getBackendBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN || "";
  return `https://${domain}`;
}

function getApiEndpoint(provider: Provider): string {
  return provider === "groq"
    ? "https://api.groq.com/openai/v1"
    : "https://api.openai.com/v1";
}

function getWhisperModel(provider: Provider): string {
  return provider === "groq" ? "whisper-large-v3-turbo" : "whisper-1";
}

function getChatModel(provider: Provider): string {
  return provider === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o-mini";
}

function base64ToUint8Array(base64: string): Uint8Array {
  let padded = base64;
  const remainder = padded.length % 4;
  if (remainder === 2) padded += "==";
  else if (remainder === 3) padded += "=";

  const binaryString = atob(padded);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
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

  const audioBytes = base64ToUint8Array(base64);

  const boundary = "----ExpoFormBoundary" + Date.now().toString(36);
  const model = getWhisperModel(provider);

  const parts: (string | Uint8Array)[] = [];

  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="recording.${fileExtension}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  parts.push(audioBytes);
  parts.push("\r\n");

  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${model}\r\n`
  );

  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\ntext\r\n`
  );

  parts.push(`--${boundary}--\r\n`);

  const encoder = new TextEncoder();
  let totalLength = 0;
  const buffers: Uint8Array[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      const encoded = encoder.encode(part);
      buffers.push(encoded);
      totalLength += encoded.length;
    } else {
      buffers.push(part);
      totalLength += part.length;
    }
  }

  const body = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    body.set(buf, offset);
    offset += buf.length;
  }

  const apiBase = getApiEndpoint(provider);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);

  try {
    const response = await expoFetch(`${apiBase}/audio/transcriptions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      let errMsg = `API error (${response.status})`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson?.error?.message || errMsg;
      } catch {
        if (errText) errMsg = errText;
      }
      throw new Error(parseErrorMessage(response.status, errMsg));
    }

    const text = (await response.text()).trim();
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

  const response = await expoFetch(`${baseUrl}/api/transcribe`, {
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
    const apiBase = getApiEndpoint(provider);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), POLISH_TIMEOUT_MS);

    const response = await expoFetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getChatModel(provider),
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
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return rawText;
    }

    const data = await response.json();
    return (data as any).choices?.[0]?.message?.content?.trim() || rawText;
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
    const response = await expoFetch(`${baseUrl}/api/polish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, provider, text: rawText }),
    });

    if (!response.ok) {
      return rawText;
    }

    const data = await response.json();
    return (data as any).text || rawText;
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

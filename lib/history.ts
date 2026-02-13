import AsyncStorage from "@react-native-async-storage/async-storage";

const HISTORY_KEY = "voicetype_history";

export interface TranscriptionEntry {
  id: string;
  rawText: string;
  polishedText: string;
  timestamp: number;
  duration: number;
  provider: string;
}

export async function getHistory(): Promise<TranscriptionEntry[]> {
  const data = await AsyncStorage.getItem(HISTORY_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function saveToHistory(entry: TranscriptionEntry) {
  const history = await getHistory();
  history.unshift(entry);
  if (history.length > 100) history.pop();
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export async function deleteFromHistory(id: string) {
  const history = await getHistory();
  const filtered = history.filter((e) => e.id !== id);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
}

export async function clearHistory() {
  await AsyncStorage.removeItem(HISTORY_KEY);
}

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const OPENAI_KEY = "voicetype_openai_key";
const GROQ_KEY = "voicetype_groq_key";
const PROVIDER_KEY = "voicetype_provider";

async function setItem(key: string, value: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export type Provider = "openai" | "groq";

export async function saveOpenAIKey(key: string) {
  await setItem(OPENAI_KEY, key);
}

export async function saveGroqKey(key: string) {
  await setItem(GROQ_KEY, key);
}

export async function getOpenAIKey(): Promise<string | null> {
  return getItem(OPENAI_KEY);
}

export async function getGroqKey(): Promise<string | null> {
  return getItem(GROQ_KEY);
}

export async function deleteOpenAIKey() {
  await deleteItem(OPENAI_KEY);
}

export async function deleteGroqKey() {
  await deleteItem(GROQ_KEY);
}

export async function saveProvider(provider: Provider) {
  await setItem(PROVIDER_KEY, provider);
}

export async function getProvider(): Promise<Provider> {
  const val = await getItem(PROVIDER_KEY);
  return (val as Provider) || "openai";
}

export async function getActiveApiKey(): Promise<{ key: string; provider: Provider } | null> {
  const provider = await getProvider();
  const key = provider === "openai" ? await getOpenAIKey() : await getGroqKey();
  if (!key) return null;
  return { key, provider };
}

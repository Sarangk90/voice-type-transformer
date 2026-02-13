import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import {
  getOpenAIKey,
  getGroqKey,
  saveOpenAIKey,
  saveGroqKey,
  deleteOpenAIKey,
  deleteGroqKey,
  getProvider,
  saveProvider,
  Provider,
} from "@/lib/api-keys";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [openaiKey, setOpenaiKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [provider, setProvider] = useState<Provider>("openai");
  const [showOpenai, setShowOpenai] = useState(false);
  const [showGroq, setShowGroq] = useState(false);
  const [saved, setSaved] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  useFocusEffect(
    useCallback(() => {
      loadKeys();
    }, [])
  );

  const loadKeys = async () => {
    const oKey = await getOpenAIKey();
    const gKey = await getGroqKey();
    const prov = await getProvider();
    if (oKey) setOpenaiKey(oKey);
    if (gKey) setGroqKey(gKey);
    setProvider(prov);
  };

  const handleSaveOpenAI = async () => {
    if (openaiKey.trim()) {
      await saveOpenAIKey(openaiKey.trim());
    } else {
      await deleteOpenAIKey();
    }
    flashSaved();
  };

  const handleSaveGroq = async () => {
    if (groqKey.trim()) {
      await saveGroqKey(groqKey.trim());
    } else {
      await deleteGroqKey();
    }
    flashSaved();
  };

  const handleProviderChange = async (p: Provider) => {
    setProvider(p);
    await saveProvider(p);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const flashSaved = () => {
    setSaved(true);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setTimeout(() => setSaved(false), 1500);
  };

  const maskKey = (key: string) => {
    if (!key) return "";
    if (key.length <= 8) return "****";
    return key.slice(0, 4) + "..." + key.slice(-4);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + webTopInset },
        ]}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.primary} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          {saved && (
            <View style={styles.savedBadge}>
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              <Text style={styles.savedText}>Saved</Text>
            </View>
          )}
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + webBottomInset + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Settings</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transcription Provider</Text>
            <View style={styles.providerRow}>
              <Pressable
                onPress={() => handleProviderChange("openai")}
                style={[
                  styles.providerOption,
                  provider === "openai" && styles.providerActive,
                ]}
              >
                <View style={styles.providerIcon}>
                  <Ionicons
                    name="flash"
                    size={20}
                    color={provider === "openai" ? Colors.primary : Colors.textSecondary}
                  />
                </View>
                <Text
                  style={[
                    styles.providerLabel,
                    provider === "openai" && styles.providerLabelActive,
                  ]}
                >
                  OpenAI
                </Text>
                {provider === "openai" && (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                )}
              </Pressable>

              <Pressable
                onPress={() => handleProviderChange("groq")}
                style={[
                  styles.providerOption,
                  provider === "groq" && styles.providerActive,
                ]}
              >
                <View style={styles.providerIcon}>
                  <Ionicons
                    name="rocket"
                    size={20}
                    color={provider === "groq" ? Colors.secondary : Colors.textSecondary}
                  />
                </View>
                <Text
                  style={[
                    styles.providerLabel,
                    provider === "groq" && styles.providerLabelActive,
                  ]}
                >
                  Groq
                </Text>
                {provider === "groq" && (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.secondary} />
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>OpenAI API Key</Text>
            <Text style={styles.sectionDesc}>
              Used for Whisper transcription and GPT text polishing
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={showOpenai ? openaiKey : maskKey(openaiKey)}
                onChangeText={setOpenaiKey}
                placeholder="sk-..."
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showOpenai}
                onFocus={() => setShowOpenai(true)}
                onBlur={() => setShowOpenai(false)}
              />
              <Pressable
                onPress={handleSaveOpenAI}
                style={({ pressed }) => [
                  styles.saveBtn,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Groq API Key</Text>
            <Text style={styles.sectionDesc}>
              Faster transcription with Whisper Large V3 and Llama 3.3
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={showGroq ? groqKey : maskKey(groqKey)}
                onChangeText={setGroqKey}
                placeholder="gsk_..."
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showGroq}
                onFocus={() => setShowGroq(true)}
                onBlur={() => setShowGroq(false)}
              />
              <Pressable
                onPress={handleSaveGroq}
                style={({ pressed }) => [
                  styles.saveBtn,
                  { backgroundColor: Colors.secondary, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How it works</Text>
            <View style={styles.stepsList}>
              <StepItem
                number={1}
                icon="mic"
                text="Record your voice using the microphone"
              />
              <StepItem
                number={2}
                icon="cloud-upload-outline"
                text="Audio is sent to Whisper API for transcription"
              />
              <StepItem
                number={3}
                icon="sparkles"
                text="LLM polishes the text with punctuation and formatting"
              />
              <StepItem
                number={4}
                icon="copy-outline"
                text="Copy the polished text and paste it anywhere"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Privacy</Text>
            <View style={styles.privacyCard}>
              <Ionicons name="shield-checkmark" size={22} color={Colors.accent} />
              <Text style={styles.privacyText}>
                Your API keys are stored securely on your device. Audio is sent
                directly to OpenAI or Groq for transcription and is not stored
                by this app.
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function StepItem({
  number,
  icon,
  text,
}: {
  number: number;
  icon: string;
  text: string;
}) {
  return (
    <View style={stepStyles.container}>
      <View style={stepStyles.iconContainer}>
        <Ionicons name={icon as any} size={18} color={Colors.primary} />
      </View>
      <Text style={stepStyles.text}>{text}</Text>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 122, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 20,
  },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  backText: {
    fontSize: 17,
    fontFamily: "Inter_400Regular",
    color: Colors.primary,
    marginLeft: 2,
  },
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  savedText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 28,
  },
  title: {
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 4,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
  },
  sectionDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  providerRow: {
    gap: 8,
  },
  providerOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
  },
  providerActive: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(0, 122, 255, 0.04)",
  },
  providerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  providerLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  providerLabelActive: {
    color: Colors.primary,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepsList: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 2,
  },
  privacyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});

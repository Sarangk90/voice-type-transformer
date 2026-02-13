import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  Dimensions,
} from "react-native";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import * as Crypto from "expo-crypto";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
  FadeOut,
  SlideInDown,
} from "react-native-reanimated";

import Colors from "@/constants/colors";
import RecordButton from "@/components/RecordButton";
import WaveformVisualizer from "@/components/WaveformVisualizer";
import TranscriptCard from "@/components/TranscriptCard";
import { getActiveApiKey } from "@/lib/api-keys";
import { transcribeAudio, polishTranscript } from "@/lib/transcription";
import { saveToHistory } from "@/lib/history";

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function RecordScreen() {
  const insets = useSafeAreaInsets();
  const [isRecording, setIsRecording] = useState(false);
  const [rawText, setRawText] = useState("");
  const [polishedText, setPolishedText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [copied, setCopied] = useState(false);
  const [autoCopied, setAutoCopied] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bgOpacity = useSharedValue(0);

  const checkApiKey = useCallback(async () => {
    const result = await getActiveApiKey();
    setHasApiKey(!!result);
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkApiKey();
    }, [checkApiKey])
  );

  useEffect(() => {
    bgOpacity.value = withTiming(isRecording ? 1 : 0, { duration: 400 });
  }, [isRecording]);

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
  }));

  const startRecording = async () => {
    const keyData = await getActiveApiKey();
    if (!keyData) {
      Alert.alert(
        "API Key Required",
        "Please add your OpenAI or Groq API key in Settings to start transcribing.",
        [
          { text: "Cancel", style: "cancel" as const },
          { text: "Open Settings", onPress: () => router.push("/settings") },
        ]
      );
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Microphone Access", "Microphone permission is needed to record audio.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recordingOptions = Platform.OS === "web"
        ? {
            isMeteringEnabled: true,
            android: {
              extension: ".m4a",
              outputFormat: Audio.AndroidOutputFormat.MPEG_4,
              audioEncoder: Audio.AndroidAudioEncoder.AAC,
              sampleRate: 44100,
              numberOfChannels: 1,
              bitRate: 128000,
            },
            ios: {
              extension: ".m4a",
              audioQuality: Audio.IOSAudioQuality.HIGH,
              outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
              sampleRate: 44100,
              numberOfChannels: 1,
              bitRate: 128000,
            },
            web: {
              mimeType: "audio/webm;codecs=opus",
              bitsPerSecond: 128000,
            },
          }
        : Audio.RecordingOptionsPresets.HIGH_QUALITY;

      const { recording } = await Audio.Recording.createAsync(recordingOptions);

      recordingRef.current = recording;
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setRawText("");
      setPolishedText("");
      setCopied(false);
      setAutoCopied(false);
      setRecordingDuration(0);

      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      timerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err) {
      console.error("Failed to start recording:", err);
      Alert.alert("Error", "Failed to start recording. Please try again.");
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsRecording(false);
    const duration = (Date.now() - startTimeRef.current) / 1000;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        Alert.alert("Error", "No recording found.");
        return;
      }

      if (duration < 0.5) {
        Alert.alert("Too Short", "Recording was too short. Please try again.");
        return;
      }

      const keyData = await getActiveApiKey();
      if (!keyData) return;

      setIsProcessing(true);
      setProcessingStep("Transcribing audio...");

      const raw = await transcribeAudio(uri, keyData.key, keyData.provider);
      setRawText(raw);

      setProcessingStep("Polishing text...");
      const polished = await polishTranscript(raw, keyData.key, keyData.provider);
      setPolishedText(polished);

      setIsProcessing(false);
      setProcessingStep("");

      await Clipboard.setStringAsync(polished);
      setAutoCopied(true);
      setCopied(true);

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setTimeout(() => {
        setCopied(false);
      }, 3000);

      await saveToHistory({
        id: Crypto.randomUUID(),
        rawText: raw,
        polishedText: polished,
        timestamp: Date.now(),
        duration,
        provider: keyData.provider,
      });
    } catch (err: any) {
      setIsProcessing(false);
      setProcessingStep("");
      console.error("Processing error:", err);
      Alert.alert("Error", err.message || "Something went wrong.");
    }
  };

  const handleRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleCopy = async () => {
    const text = polishedText || rawText;
    if (!text) return;
    await Clipboard.setStringAsync(text);
    setCopied(true);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setRawText("");
    setPolishedText("");
    setCopied(false);
    setAutoCopied(false);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const showTranscript = !!(rawText || polishedText || isProcessing);

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.recordingBg, bgStyle]}
        pointerEvents="none"
      />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.push("/history")}
          style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="time-outline" size={24} color={Colors.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          {isRecording ? (
            <Animated.View
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(300)}
              style={styles.timerContainer}
            >
              <View style={styles.liveDot} />
              <Text style={styles.timerText}>{formatTimer(recordingDuration)}</Text>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)}>
              {autoCopied && !isProcessing && (
                <View style={styles.autoCopiedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.accent} />
                  <Text style={styles.autoCopiedText}>Copied to clipboard</Text>
                </View>
              )}
            </Animated.View>
          )}
        </View>

        <Pressable
          onPress={() => router.push("/settings")}
          style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="settings-outline" size={24} color={Colors.text} />
        </Pressable>
      </View>

      <View style={styles.body}>
        {!isRecording && !showTranscript && (
          <Animated.View entering={FadeIn.duration(500)} style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="mic" size={40} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Tap to Record</Text>
            <Text style={styles.emptySubtitle}>
              Speak and your text is automatically{"\n"}copied to your clipboard
            </Text>
          </Animated.View>
        )}

        {(isRecording || isProcessing) && !polishedText && (
          <View style={styles.waveformArea}>
            <WaveformVisualizer isRecording={isRecording} barCount={35} />
            {isRecording && <Text style={styles.recordingLabel}>Listening...</Text>}
          </View>
        )}

        {showTranscript && (
          <TranscriptCard
            rawText={rawText}
            polishedText={polishedText}
            isProcessing={isProcessing}
            processingStep={processingStep}
            onCopy={handleCopy}
            onClear={handleClear}
            copied={copied}
          />
        )}
      </View>

      <Animated.View
        entering={SlideInDown.duration(400).springify()}
        style={[styles.keyboardPanel, { paddingBottom: insets.bottom + webBottomInset + 8 }]}
      >
        <View style={styles.keyboardHandle} />

        <View style={styles.keyboardContent}>
          <View style={styles.keyboardSide}>
            {showTranscript && !isRecording && !isProcessing && (
              <Pressable
                onPress={handleClear}
                style={({ pressed }) => [styles.keyboardAction, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons name="refresh" size={22} color={Colors.textSecondary} />
                <Text style={styles.keyboardActionLabel}>New</Text>
              </Pressable>
            )}
          </View>

          <RecordButton isRecording={isRecording} onPress={handleRecord} disabled={isProcessing} />

          <View style={styles.keyboardSide}>
            {showTranscript && !isRecording && !isProcessing && (
              <Pressable
                onPress={handleCopy}
                style={({ pressed }) => [styles.keyboardAction, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons
                  name={copied ? "checkmark-circle" : "clipboard-outline"}
                  size={22}
                  color={copied ? Colors.accent : Colors.primary}
                />
                <Text
                  style={[
                    styles.keyboardActionLabel,
                    { color: copied ? Colors.accent : Colors.primary },
                  ]}
                >
                  {copied ? "Done" : "Copy"}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        <Text style={styles.keyboardHint}>
          {isRecording
            ? "Tap to stop recording"
            : isProcessing
            ? "Processing your voice..."
            : "Text is auto-copied when ready"}
        </Text>
      </Animated.View>

      {hasApiKey === false && !isRecording && !showTranscript && (
        <Animated.View entering={FadeIn.delay(500)} style={styles.setupBanner}>
          <Pressable
            onPress={() => router.push("/settings")}
            style={({ pressed }) => [styles.setupContent, { opacity: pressed ? 0.9 : 1 }]}
          >
            <Ionicons name="key-outline" size={18} color={Colors.primary} />
            <Text style={styles.setupText}>Add your API key to get started</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  recordingBg: {
    backgroundColor: "rgba(52, 199, 89, 0.04)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 44,
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accentRed,
  },
  timerText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accentRed,
    fontVariant: ["tabular-nums"],
  },
  autoCopiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(52, 199, 89, 0.1)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  autoCopiedText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.accent,
  },
  body: {
    flex: 1,
    justifyContent: "center",
    gap: 24,
  },
  emptyState: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0, 122, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  waveformArea: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 20,
  },
  recordingLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.accent,
  },
  keyboardPanel: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  keyboardHandle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.textTertiary,
    alignSelf: "center",
    marginBottom: 12,
  },
  keyboardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 24,
  },
  keyboardSide: {
    width: 60,
    alignItems: "center",
  },
  keyboardAction: {
    alignItems: "center",
    gap: 4,
    padding: 8,
  },
  keyboardActionLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  keyboardHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  setupBanner: {
    position: "absolute",
    bottom: 220,
    left: 20,
    right: 20,
  },
  setupContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  setupText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
});

import React from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

interface TranscriptCardProps {
  rawText: string;
  polishedText: string;
  isProcessing: boolean;
  processingStep: string;
  onCopy: () => void;
  onClear: () => void;
  copied: boolean;
}

export default function TranscriptCard({
  rawText,
  polishedText,
  isProcessing,
  processingStep,
  onCopy,
  onClear,
  copied,
}: TranscriptCardProps) {
  const displayText = polishedText || rawText;

  if (!displayText && !isProcessing) return null;

  return (
    <View style={styles.container}>
      {isProcessing && (
        <View style={styles.processingRow}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.processingText}>{processingStep}</Text>
        </View>
      )}

      {!!displayText && (
        <>
          <Text style={styles.transcript} selectable>
            {displayText}
          </Text>

          {rawText && polishedText && rawText !== polishedText && (
            <Pressable
              style={styles.rawToggle}
              onPress={() => {}}
            >
              <Text style={styles.rawLabel}>Original</Text>
              <Text style={styles.rawText} numberOfLines={2}>
                {rawText}
              </Text>
            </Pressable>
          )}

          <View style={styles.actions}>
            <Pressable
              onPress={onCopy}
              style={({ pressed }) => [
                styles.actionButton,
                styles.copyButton,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons
                name={copied ? "checkmark" : "copy-outline"}
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.copyButtonText}>
                {copied ? "Copied" : "Copy"}
              </Text>
            </Pressable>

            <Pressable
              onPress={onClear}
              style={({ pressed }) => [
                styles.actionButton,
                styles.clearButton,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="close" size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  processingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  processingText: {
    fontSize: 14,
    color: Colors.primary,
    fontFamily: "Inter_500Medium",
  },
  transcript: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
  },
  rawToggle: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  rawLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  rawText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  copyButton: {
    backgroundColor: Colors.primary,
  },
  copyButtonText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
  },
  clearButton: {
    backgroundColor: Colors.background,
  },
});

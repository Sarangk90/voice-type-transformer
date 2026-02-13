import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { TranscriptionEntry } from "@/lib/history";

interface HistoryItemProps {
  entry: TranscriptionEntry;
  onPress: () => void;
  onDelete: () => void;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function HistoryItem({ entry, onPress, onDelete }: HistoryItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: pressed ? Colors.background : Colors.surface },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.text} numberOfLines={2}>
          {entry.polishedText || entry.rawText}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>{formatTime(entry.timestamp)}</Text>
          <View style={styles.dot} />
          <Text style={styles.metaText}>{formatDuration(entry.duration)}</Text>
          <View style={styles.dot} />
          <Text style={styles.metaText}>{entry.provider.toUpperCase()}</Text>
        </View>
      </View>
      <Pressable
        onPress={onDelete}
        hitSlop={12}
        style={({ pressed }) => [
          styles.deleteBtn,
          { opacity: pressed ? 0.5 : 1 },
        ]}
      >
        <Ionicons name="trash-outline" size={18} color={Colors.textTertiary} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  content: {
    flex: 1,
    gap: 6,
  },
  text: {
    fontSize: 15,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textTertiary,
  },
  deleteBtn: {
    padding: 8,
  },
});

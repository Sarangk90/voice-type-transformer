import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import Colors from "@/constants/colors";
import HistoryItem from "@/components/HistoryItem";
import {
  getHistory,
  deleteFromHistory,
  clearHistory,
  TranscriptionEntry,
} from "@/lib/history";

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<TranscriptionEntry[]>([]);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const loadHistory = async () => {
    const data = await getHistory();
    setEntries(data);
  };

  const handleDelete = async (id: string) => {
    await deleteFromHistory(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleCopy = async (entry: TranscriptionEntry) => {
    await Clipboard.setStringAsync(entry.polishedText || entry.rawText);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    Alert.alert("Copied", "Text copied to clipboard.");
  };

  const handleClearAll = () => {
    Alert.alert(
      "Clear History",
      "Are you sure you want to delete all transcriptions?",
      [
        { text: "Cancel", style: "cancel" as const },
        {
          text: "Clear All",
          style: "destructive" as const,
          onPress: async () => {
            await clearHistory();
            setEntries([]);
          },
        },
      ]
    );
  };

  return (
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

        {entries.length > 0 && (
          <Pressable
            onPress={handleClearAll}
            style={({ pressed }) => [
              styles.clearBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={styles.clearText}>Clear All</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.title}>History</Text>

      {entries.length === 0 ? (
        <Animated.View entering={FadeIn.delay(200)} style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="document-text-outline" size={36} color={Colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>No transcriptions yet</Text>
          <Text style={styles.emptySubtitle}>
            Your transcription history will appear here
          </Text>
        </Animated.View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <HistoryItem
              entry={item}
              onPress={() => handleCopy(item)}
              onDelete={() => handleDelete(item.id)}
            />
          )}
          contentContainerStyle={{
            paddingBottom: insets.bottom + webBottomInset + 20,
          }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={entries.length > 0}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.accentRed,
  },
  title: {
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingBottom: 100,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
  },
});

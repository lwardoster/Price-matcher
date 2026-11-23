import AsyncStorage from "@react-native-async-storage/async-storage";

const RECENTS_KEY = "recentSearches";
const STORE_KEY = "currentStore";

export async function loadRecents(): Promise<string[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(RECENTS_KEY)) ?? "[]");
  } catch {
    return [];
  }
}

export async function addRecent(query: string, existing: string[]): Promise<string[]> {
  const next = [query, ...existing.filter((q) => q.toLowerCase() !== query.toLowerCase())].slice(0, 10);
  await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next)).catch(() => {});
  return next;
}

export async function clearRecents() {
  await AsyncStorage.removeItem(RECENTS_KEY).catch(() => {});
}

export async function loadCurrentStore(): Promise<string | null> {
  return AsyncStorage.getItem(STORE_KEY).catch(() => null);
}

export async function saveCurrentStore(store: string | null) {
  if (store) await AsyncStorage.setItem(STORE_KEY, store).catch(() => {});
  else await AsyncStorage.removeItem(STORE_KEY).catch(() => {});
}

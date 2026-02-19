/** Svelte store for SOQL query history */

import { writable, get } from "svelte/store";

export interface HistoryEntry {
  query: string;
  timestamp: number;
  rowCount: number;
  duration: number;
  error?: string;
}

const MAX_HISTORY = 50;
const STORAGE_KEY = "sfdt_query_history";

export const queryHistory = writable<HistoryEntry[]>([]);

/** Load history from chrome.storage.local */
export async function loadHistory(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    if (result[STORAGE_KEY]) {
      queryHistory.set(result[STORAGE_KEY]);
    }
  } catch {
    // Ignore storage errors
  }
}

/** Add a query to history */
export async function addToHistory(entry: HistoryEntry): Promise<void> {
  queryHistory.update((history) => {
    // Remove duplicate if exists
    const filtered = history.filter(
      (h) => h.query.trim() !== entry.query.trim()
    );
    // Add to front, limit size
    const updated = [entry, ...filtered].slice(0, MAX_HISTORY);
    // Persist
    chrome.storage.local.set({ [STORAGE_KEY]: updated }).catch(() => {});
    return updated;
  });
}

/** Clear all history */
export async function clearHistory(): Promise<void> {
  queryHistory.set([]);
  await chrome.storage.local.remove(STORAGE_KEY);
}

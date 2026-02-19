/** Svelte store for Salesforce connection state */

import { writable, derived } from "svelte/store";
import type { SfConnection } from "../../lib/sfApi";

export const connection = writable<SfConnection | null>(null);
export const connectionError = writable<string | null>(null);
export const isConnecting = writable(false);

export const isConnected = derived(connection, ($conn) => $conn !== null);

export const orgName = derived(connection, ($conn) => {
  if (!$conn) return "";
  try {
    const url = new URL($conn.instanceUrl);
    return url.hostname.split(".")[0];
  } catch {
    return $conn.instanceUrl;
  }
});

/** Fetch connection from background service worker */
export async function refreshConnection(): Promise<void> {
  isConnecting.set(true);
  connectionError.set(null);

  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_CONNECTION" });

    if (response?.error) {
      connectionError.set(response.error);
      connection.set(null);
    } else if (response?.connection) {
      connection.set(response.connection);
    }
  } catch (err: any) {
    connectionError.set(err.message || "Failed to connect");
    connection.set(null);
  } finally {
    isConnecting.set(false);
  }
}

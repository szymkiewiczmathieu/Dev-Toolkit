/** Svelte store for cached Salesforce metadata (objects, fields) */

import { writable, get } from "svelte/store";
import type { SfConnection, DescribeResult } from "../../lib/sfApi";
import { describeGlobal, describeSObject } from "../../lib/sfApi";

export interface ObjectInfo {
  name: string;
  label: string;
  custom: boolean;
  queryable: boolean;
}

const CACHE_KEY = "sfdt_metadata_cache";
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export const objectList = writable<ObjectInfo[]>([]);
export const objectDescribeCache = writable<Record<string, DescribeResult>>({});
export const isLoadingMetadata = writable(false);

/** Load all queryable SObjects */
export async function loadObjects(conn: SfConnection): Promise<void> {
  // Try cache first
  try {
    const cached = await chrome.storage.local.get(CACHE_KEY);
    if (cached[CACHE_KEY] && Date.now() - cached[CACHE_KEY].timestamp < CACHE_TTL) {
      objectList.set(cached[CACHE_KEY].objects);
      return;
    }
  } catch {}

  isLoadingMetadata.set(true);
  try {
    const result = await describeGlobal(conn);
    const objects: ObjectInfo[] = result.sobjects
      .filter((s) => s.queryable)
      .map((s) => ({
        name: s.name,
        label: s.label,
        custom: s.custom,
        queryable: s.queryable,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    objectList.set(objects);

    // Cache
    await chrome.storage.local.set({
      [CACHE_KEY]: { objects, timestamp: Date.now() },
    });
  } catch (err) {
    console.error("Failed to load objects:", err);
  } finally {
    isLoadingMetadata.set(false);
  }
}

/** Describe a specific SObject (with caching) */
export async function loadObjectDescribe(
  conn: SfConnection,
  objectName: string
): Promise<DescribeResult | null> {
  const cache = get(objectDescribeCache);
  if (cache[objectName]) return cache[objectName];

  try {
    const result = await describeSObject(conn, objectName);
    objectDescribeCache.update((c) => ({ ...c, [objectName]: result }));
    return result;
  } catch (err) {
    console.error(`Failed to describe ${objectName}:`, err);
    return null;
  }
}

/** Clear metadata cache */
export async function clearMetadataCache(): Promise<void> {
  objectList.set([]);
  objectDescribeCache.set({});
  await chrome.storage.local.remove(CACHE_KEY);
}

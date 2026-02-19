/** Svelte store for Field Inspector state */

import { writable } from "svelte/store";

export interface InspectedField {
  apiName: string;
  objectName: string;
  fieldLabel: string;
}

/** The currently inspected field - set by App.svelte when FIELD_CLICKED is received */
export const inspectedField = writable<InspectedField | null>(null);

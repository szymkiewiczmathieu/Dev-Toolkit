/** Translation API - fetches field labels in different languages via SOAP API */

/**
 * Get field labels for a specific object in a given locale.
 * Uses SOAP API describeSObject with LocaleOptions header.
 * Returns a map of fieldApiName -> translatedLabel.
 */
export async function getFieldLabelsForLocale(
  objectName: string,
  locale: string
): Promise<Record<string, string>> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "SF_SOAP_DESCRIBE",
      objectName,
      locale,
    });

    if (response?.error) return {};
    return response?.data || {};
  } catch {
    return {};
  }
}

export interface FieldTranslations {
  en?: string;
  es?: string;
}

/**
 * Get translations for a specific field in EN and ES.
 */
export async function getFieldTranslations(
  objectName: string,
  fieldApiName: string
): Promise<FieldTranslations> {
  const [enLabels, esLabels] = await Promise.all([
    getFieldLabelsForLocale(objectName, "en_US"),
    getFieldLabelsForLocale(objectName, "es"),
  ]);

  const result: FieldTranslations = {};
  if (enLabels[fieldApiName]) result.en = enLabels[fieldApiName];
  if (esLabels[fieldApiName]) result.es = esLabels[fieldApiName];
  return result;
}

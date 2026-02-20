/** Translation API - fetches field labels and picklist values in different languages via SOAP API */

interface SoapDescribeResult {
  fieldLabels: Record<string, string>;
  picklistValues: Record<string, { value: string; label: string }[]>;
}

/**
 * Get field labels and picklist values for a specific object in a given locale.
 * Uses SOAP API describeSObject with LocaleOptions header.
 */
export async function getDescribeForLocale(
  objectName: string,
  locale: string
): Promise<SoapDescribeResult> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "SF_SOAP_DESCRIBE",
      objectName,
      locale,
    });

    if (response?.error) return { fieldLabels: {}, picklistValues: {} };
    return response?.data || { fieldLabels: {}, picklistValues: {} };
  } catch {
    return { fieldLabels: {}, picklistValues: {} };
  }
}

/** Backward-compatible: get just field labels for a locale */
export async function getFieldLabelsForLocale(
  objectName: string,
  locale: string
): Promise<Record<string, string>> {
  const result = await getDescribeForLocale(objectName, locale);
  return result.fieldLabels;
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
  const [enData, esData] = await Promise.all([
    getDescribeForLocale(objectName, "en_US"),
    getDescribeForLocale(objectName, "es"),
  ]);

  const result: FieldTranslations = {};
  if (enData.fieldLabels[fieldApiName]) result.en = enData.fieldLabels[fieldApiName];
  if (esData.fieldLabels[fieldApiName]) result.es = esData.fieldLabels[fieldApiName];
  return result;
}

export interface PicklistValueTranslation {
  value: string;
  fr: string;
  en: string;
  es: string;
}

/**
 * Get picklist value translations for a specific field in FR, EN and ES.
 * Returns an array of { value, fr, en, es } for each active picklist value.
 */
export async function getPicklistTranslations(
  objectName: string,
  fieldApiName: string
): Promise<PicklistValueTranslation[]> {
  const [frData, enData, esData] = await Promise.all([
    getDescribeForLocale(objectName, "fr"),
    getDescribeForLocale(objectName, "en_US"),
    getDescribeForLocale(objectName, "es"),
  ]);

  const frValues = frData.picklistValues[fieldApiName] || [];
  const enValues = enData.picklistValues[fieldApiName] || [];
  const esValues = esData.picklistValues[fieldApiName] || [];

  // Build lookup maps by API value
  const enMap = new Map(enValues.map((v) => [v.value, v.label]));
  const esMap = new Map(esValues.map((v) => [v.value, v.label]));

  return frValues.map((fv) => ({
    value: fv.value,
    fr: fv.label,
    en: enMap.get(fv.value) || "",
    es: esMap.get(fv.value) || "",
  }));
}

// --- Metadata Deploy: Save translations ---

const LOCALE_TO_SUFFIX: Record<string, string> = {
  en: "en_US",
  es: "es",
};

interface TranslationToSave {
  label?: string;
  picklistValues?: { masterLabel: string; translation: string }[];
}

/**
 * Build a CustomObjectTranslation XML (mdapi format) with embedded field translations.
 * The SOAP Metadata API uses the mdapi format, NOT the sfdx source format.
 * Field translations go INSIDE <fields> elements, not as separate files.
 */
function buildObjectTranslationXml(
  fieldApiName: string,
  data: TranslationToSave
): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<CustomObjectTranslation xmlns="http://soap.sforce.com/2006/04/metadata">\n`;
  xml += `    <fields>\n`;
  if (data.label) {
    xml += `        <label>${escapeXml(data.label)}</label>\n`;
  }
  xml += `        <name>${fieldApiName}</name>\n`;
  if (data.picklistValues) {
    for (const pv of data.picklistValues) {
      xml += `        <picklistValues>\n`;
      xml += `            <masterLabel>${escapeXml(pv.masterLabel)}</masterLabel>\n`;
      xml += `            <translation>${escapeXml(pv.translation)}</translation>\n`;
      xml += `        </picklistValues>\n`;
    }
  }
  xml += `    </fields>\n`;
  xml += `</CustomObjectTranslation>\n`;
  return xml;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build package.xml for a fieldTranslation deploy.
 */
function buildPackageXml(objectName: string, locale: string): string {
  const suffix = LOCALE_TO_SUFFIX[locale] || locale;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>${objectName}-${suffix}</members>
        <name>CustomObjectTranslation</name>
    </types>
    <version>62.0</version>
</Package>
`;
}

// --- Minimal ZIP builder (no external dependency) ---
// Salesforce Metadata API requires explicit directory entries in the ZIP.

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function textToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function writeU16(arr: Uint8Array, offset: number, val: number) {
  arr[offset] = val & 0xFF;
  arr[offset + 1] = (val >> 8) & 0xFF;
}

function writeU32(arr: Uint8Array, offset: number, val: number) {
  arr[offset] = val & 0xFF;
  arr[offset + 1] = (val >> 8) & 0xFF;
  arr[offset + 2] = (val >> 16) & 0xFF;
  arr[offset + 3] = (val >> 24) & 0xFF;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function buildZip(entries: ZipEntry[]): Uint8Array {
  const localHeaders: Uint8Array[] = [];
  const centralEntries: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = textToBytes(entry.name);
    const isDir = entry.name.endsWith("/");
    const data = isDir ? new Uint8Array(0) : entry.data;
    const crc = isDir ? 0 : crc32(data);

    // Local file header (30 bytes + name + data)
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    writeU32(local, 0, 0x04034B50);  // signature
    writeU16(local, 4, 20);          // version needed (2.0)
    writeU16(local, 6, 0);           // flags
    writeU16(local, 8, 0);           // compression: STORE
    writeU16(local, 10, 0);          // mod time
    writeU16(local, 12, 0);          // mod date
    writeU32(local, 14, crc);        // crc32
    writeU32(local, 18, data.length); // compressed size
    writeU32(local, 22, data.length); // uncompressed size
    writeU16(local, 26, nameBytes.length); // name length
    writeU16(local, 28, 0);          // extra length
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    localHeaders.push(local);

    // Central directory entry (46 bytes + name)
    const central = new Uint8Array(46 + nameBytes.length);
    writeU32(central, 0, 0x02014B50); // signature
    writeU16(central, 4, 20);         // version made by
    writeU16(central, 6, 20);         // version needed
    writeU16(central, 8, 0);          // flags
    writeU16(central, 10, 0);         // compression: STORE
    writeU16(central, 12, 0);         // mod time
    writeU16(central, 14, 0);         // mod date
    writeU32(central, 16, crc);       // crc32
    writeU32(central, 20, data.length); // compressed size
    writeU32(central, 24, data.length); // uncompressed size
    writeU16(central, 28, nameBytes.length); // name length
    writeU16(central, 30, 0);         // extra length
    writeU16(central, 32, 0);         // comment length
    writeU16(central, 34, 0);         // disk number
    writeU16(central, 36, 0);         // internal attrs
    writeU32(central, 38, isDir ? 0x10 : 0); // external attrs (0x10 = directory)
    writeU32(central, 42, offset);    // local header offset
    central.set(nameBytes, 46);
    centralEntries.push(central);

    offset += local.length;
  }

  // End of central directory
  const centralSize = centralEntries.reduce((s, e) => s + e.length, 0);
  const eocd = new Uint8Array(22);
  writeU32(eocd, 0, 0x06054B50);           // signature
  writeU16(eocd, 4, 0);                     // disk number
  writeU16(eocd, 6, 0);                     // central dir disk
  writeU16(eocd, 8, entries.length);         // entries on this disk
  writeU16(eocd, 10, entries.length);        // total entries
  writeU32(eocd, 12, centralSize);           // central dir size
  writeU32(eocd, 16, offset);               // central dir offset
  writeU16(eocd, 20, 0);                    // comment length

  // Concatenate all parts
  const totalSize = offset + centralSize + 22;
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const h of localHeaders) { result.set(h, pos); pos += h.length; }
  for (const c of centralEntries) { result.set(c, pos); pos += c.length; }
  result.set(eocd, pos);

  return result;
}

/**
 * Create a base64-encoded ZIP for Metadata API deploy (mdapi format).
 *
 * MDAPI format for CustomObjectTranslation:
 * - File goes FLAT in objectTranslations/ (no subdirectory)
 * - Suffix is .objectTranslation (NOT .objectTranslation-meta.xml)
 * - Field translations are embedded as <fields> elements inside the XML
 */
function createDeployZip(
  objectName: string,
  fieldApiName: string,
  locale: string,
  data: TranslationToSave
): string {
  const suffix = LOCALE_TO_SUFFIX[locale] || locale;
  const objectTranslationXml = buildObjectTranslationXml(fieldApiName, data);
  const packageXml = buildPackageXml(objectName, locale);

  const memberName = `${objectName}-${suffix}`;

  const entries: ZipEntry[] = [
    { name: "objectTranslations/", data: new Uint8Array(0) },
    { name: `objectTranslations/${memberName}.objectTranslation`, data: textToBytes(objectTranslationXml) },
    { name: "package.xml", data: textToBytes(packageXml) },
  ];

  const zipped = buildZip(entries);

  // Convert to base64
  const chunks: string[] = [];
  const chunkSize = 8192;
  for (let i = 0; i < zipped.length; i += chunkSize) {
    const slice = zipped.subarray(i, Math.min(i + chunkSize, zipped.length));
    chunks.push(String.fromCharCode(...slice));
  }
  return btoa(chunks.join(""));
}

export interface DeployResult {
  success: boolean;
  error?: string;
}

/**
 * Deploy a field label translation to a Salesforce org.
 */
export async function saveFieldLabelTranslation(
  objectName: string,
  fieldApiName: string,
  locale: string,
  label: string,
  picklistValues?: { masterLabel: string; translation: string }[]
): Promise<DeployResult> {
  try {
    const data: TranslationToSave = { label };
    if (picklistValues?.length) {
      data.picklistValues = picklistValues;
    }

    const zipBase64 = createDeployZip(objectName, fieldApiName, locale, data);

    // Start deploy
    const deployResponse = await chrome.runtime.sendMessage({
      type: "SF_METADATA_DEPLOY",
      zipBase64,
    });

    if (deployResponse?.error) {
      return { success: false, error: deployResponse.error };
    }

    const deployId = deployResponse?.data?.deployId;
    if (!deployId) {
      return { success: false, error: "No deploy ID returned" };
    }

    // Poll for deploy status
    let attempts = 0;
    while (attempts < 30) {
      await new Promise((r) => setTimeout(r, 2000));
      attempts++;

      const statusResponse = await chrome.runtime.sendMessage({
        type: "SF_DEPLOY_STATUS",
        deployId,
      });

      if (statusResponse?.error) {
        return { success: false, error: statusResponse.error };
      }

      const status = statusResponse?.data;
      if (status?.done) {
        if (status.success) {
          return { success: true };
        }
        return { success: false, error: status.errorMessage || "Deploy failed" };
      }
    }

    return { success: false, error: "Deploy timed out" };
  } catch (e: any) {
    return { success: false, error: e.message || "Unknown error" };
  }
}

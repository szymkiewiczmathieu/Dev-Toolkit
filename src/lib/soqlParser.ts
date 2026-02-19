/** Simple SOQL parser for autocomplete context detection */

export type SoqlContext =
  | { type: "select_fields"; objectName: string | null }
  | { type: "from_object" }
  | { type: "where_field"; objectName: string | null }
  | { type: "order_field"; objectName: string | null }
  | { type: "unknown" };

/** Detect the current SOQL context based on cursor position */
export function detectContext(soql: string, cursorPos: number): SoqlContext {
  const textBefore = soql.substring(0, cursorPos).toUpperCase();

  // Extract FROM object
  const fromMatch = soql.match(/\bFROM\s+(\w+)/i);
  const objectName = fromMatch ? fromMatch[1] : null;

  // After FROM keyword -> suggest object names
  if (/\bFROM\s+\w*$/.test(textBefore)) {
    return { type: "from_object" };
  }

  // After WHERE keyword -> suggest fields
  if (/\bWHERE\s+\w*$/.test(textBefore) || /\bAND\s+\w*$/.test(textBefore) || /\bOR\s+\w*$/.test(textBefore)) {
    return { type: "where_field", objectName };
  }

  // After ORDER BY -> suggest fields
  if (/\bORDER\s+BY\s+\w*$/.test(textBefore)) {
    return { type: "order_field", objectName };
  }

  // After SELECT -> suggest fields
  if (/\bSELECT\s+/.test(textBefore) && !/\bFROM\b/.test(textBefore)) {
    return { type: "select_fields", objectName };
  }

  // Between SELECT and FROM -> suggest fields
  if (/\bSELECT\b/.test(textBefore) && /\bFROM\b/.test(soql.toUpperCase())) {
    const selectEnd = textBefore.lastIndexOf("SELECT");
    const fromStart = soql.toUpperCase().indexOf("FROM");
    if (cursorPos > selectEnd && cursorPos <= fromStart) {
      return { type: "select_fields", objectName };
    }
  }

  return { type: "unknown" };
}

/** SOQL keywords for highlighting */
export const SOQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "AND", "OR", "NOT",
  "IN", "LIKE", "ORDER", "BY", "ASC", "DESC",
  "LIMIT", "OFFSET", "GROUP", "HAVING", "COUNT",
  "SUM", "AVG", "MIN", "MAX", "NULLS", "FIRST", "LAST",
  "WITH", "SECURITY_ENFORCED", "SYSTEM_MODE", "USER_MODE",
  "FOR", "UPDATE", "VIEW", "REFERENCE", "TYPEOF",
  "WHEN", "THEN", "ELSE", "END", "USING", "SCOPE",
  "YESTERDAY", "TODAY", "TOMORROW", "LAST_WEEK", "THIS_WEEK",
  "NEXT_WEEK", "LAST_MONTH", "THIS_MONTH", "NEXT_MONTH",
  "LAST_YEAR", "THIS_YEAR", "NEXT_YEAR",
  "LAST_N_DAYS", "NEXT_N_DAYS", "LAST_N_WEEKS", "NEXT_N_WEEKS",
  "LAST_N_MONTHS", "NEXT_N_MONTHS", "LAST_N_YEARS", "NEXT_N_YEARS",
  "TRUE", "FALSE", "NULL",
  "INCLUDES", "EXCLUDES", "ABOVE", "BELOW",
  "DISTANCE", "GEOLOCATION",
];

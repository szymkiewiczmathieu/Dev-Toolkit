/** Salesforce Tooling API client - routed through background service worker */

import type { SfConnection } from "./sfApi";

const API_VERSION = "v62.0";

/**
 * Route a Tooling API call through the background service worker.
 */
async function toolingFetch(
  conn: SfConnection,
  path: string
): Promise<unknown> {
  const fullPath = `/services/data/${conn.apiVersion || API_VERSION}/tooling${path}`;

  const response = await chrome.runtime.sendMessage({
    type: "SF_API_REQUEST",
    path: fullPath,
    method: "GET",
  });

  if (response?.error) {
    throw new Error(response.error);
  }

  return response?.data;
}

/** Run a Tooling API SOQL query */
export async function toolingQuery(
  conn: SfConnection,
  soql: string
): Promise<{ totalSize: number; records: Record<string, unknown>[] }> {
  return toolingFetch(
    conn,
    `/query/?q=${encodeURIComponent(soql)}`
  ) as Promise<{ totalSize: number; records: Record<string, unknown>[] }>;
}

export interface CustomFieldDef {
  Id: string;
  DeveloperName: string;
  TableEnumOrId: string;
  FullName: string;
  Metadata: {
    label: string;
    type: string;
    length: number;
    description: string;
    inlineHelpText: string;
    required: boolean;
  };
}

/** Get custom field definition via Tooling API (includes master label) */
export async function getCustomFieldDef(
  conn: SfConnection,
  objectName: string,
  fieldDeveloperName: string
): Promise<CustomFieldDef | null> {
  try {
    const soql = `SELECT Id, DeveloperName, FullName, TableEnumOrId, Metadata FROM CustomField WHERE DeveloperName = '${fieldDeveloperName}' AND TableEnumOrId = '${objectName}' LIMIT 1`;
    const result = await toolingQuery(conn, soql);
    if (result.records.length > 0) {
      return result.records[0] as unknown as CustomFieldDef;
    }
    return null;
  } catch {
    return null;
  }
}

/** Get field definition info (works for standard + custom fields) */
export async function getFieldDefinition(
  conn: SfConnection,
  objectName: string,
  fieldName: string
): Promise<Record<string, unknown> | null> {
  try {
    const soql = `SELECT QualifiedApiName, DurableId, Label, Description, InlineHelpText, DataType, IsCompound, IsFieldHistoryTracked, IsIndexed, BusinessOwnerId, BusinessStatus, SecurityClassification, ComplianceGroup FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = '${objectName}' AND QualifiedApiName = '${fieldName}' LIMIT 1`;
    const result = await toolingQuery(conn, soql);
    if (result.records.length > 0) {
      return result.records[0];
    }
    return null;
  } catch {
    return null;
  }
}

/** Search for Apex Classes */
export async function searchApexClasses(
  conn: SfConnection,
  search: string
): Promise<{ Id: string; Name: string; Status: string }[]> {
  const soql = `SELECT Id, Name, Status FROM ApexClass WHERE Name LIKE '%${search.replace(/'/g, "\\'")}%' ORDER BY Name LIMIT 20`;
  const result = await toolingQuery(conn, soql);
  return result.records as any[];
}

/** Search for Flows */
export async function searchFlows(
  conn: SfConnection,
  search: string
): Promise<{ Id: string; MasterLabel: string; ProcessType: string }[]> {
  const soql = `SELECT Id, MasterLabel, ProcessType FROM FlowDefinition WHERE MasterLabel LIKE '%${search.replace(/'/g, "\\'")}%' ORDER BY MasterLabel LIMIT 20`;
  const result = await toolingQuery(conn, soql);
  return result.records as any[];
}

/** Salesforce REST API client - all calls routed through background service worker */

export interface SfConnection {
  instanceUrl: string;
  sessionId: string;
  apiVersion: string;
}

export interface QueryResult {
  totalSize: number;
  done: boolean;
  records: Record<string, unknown>[];
  nextRecordsUrl?: string;
}

export interface DescribeResult {
  name: string;
  label: string;
  fields: FieldDescribe[];
  recordTypeInfos: {
    name: string;
    recordTypeId: string;
    developerName: string;
    available: boolean;
    active: boolean;
    master: boolean;
    defaultRecordTypeMapping: boolean;
  }[];
}

export interface FieldDescribe {
  name: string;
  label: string;
  type: string;
  length: number;
  precision: number;
  scale: number;
  picklistValues: { label: string; value: string; active: boolean }[];
  referenceTo: string[];
  relationshipName: string | null;
  inlineHelpText: string | null;
  nillable: boolean;
  updateable: boolean;
  createable: boolean;
  custom: boolean;
  calculated: boolean;
  formulaTreatNullNumberAsZero: boolean;
}

export interface SObjectListResult {
  sobjects: {
    name: string;
    label: string;
    custom: boolean;
    queryable: boolean;
    keyPrefix: string | null;
  }[];
}

const API_VERSION = "v62.0";

/**
 * Route an API call through the background service worker.
 * The background finds the correct session ID and instance URL
 * from cookies, ensuring the domain matches.
 */
async function sfFetch(
  conn: SfConnection,
  path: string,
  options: { method?: string; body?: string } = {}
): Promise<unknown> {
  const fullPath = `/services/data/${conn.apiVersion || API_VERSION}${path}`;

  const response = await chrome.runtime.sendMessage({
    type: "SF_API_REQUEST",
    path: fullPath,
    method: options.method || "GET",
    body: options.body || undefined,
  });

  if (response?.error) {
    throw new Error(response.error);
  }

  return response?.data;
}

/** Run a SOQL query */
export async function query(
  conn: SfConnection,
  soql: string
): Promise<QueryResult> {
  return sfFetch(
    conn,
    `/query/?q=${encodeURIComponent(soql)}`
  ) as Promise<QueryResult>;
}

/** Get next page of query results */
export async function queryMore(
  conn: SfConnection,
  nextRecordsUrl: string
): Promise<QueryResult> {
  const response = await chrome.runtime.sendMessage({
    type: "SF_API_REQUEST",
    path: nextRecordsUrl,
    method: "GET",
  });

  if (response?.error) {
    throw new Error(response.error);
  }

  return response?.data as QueryResult;
}

/** Describe an SObject (fields, record types, etc.) */
export async function describeSObject(
  conn: SfConnection,
  sobjectName: string
): Promise<DescribeResult> {
  return sfFetch(
    conn,
    `/sobjects/${sobjectName}/describe`
  ) as Promise<DescribeResult>;
}

/** List all SObjects in the org */
export async function describeGlobal(
  conn: SfConnection
): Promise<SObjectListResult> {
  return sfFetch(conn, `/sobjects/`) as Promise<SObjectListResult>;
}

/** Get limits info */
export async function getLimits(
  conn: SfConnection
): Promise<Record<string, { Max: number; Remaining: number }>> {
  return sfFetch(conn, `/limits/`) as Promise<
    Record<string, { Max: number; Remaining: number }>
  >;
}

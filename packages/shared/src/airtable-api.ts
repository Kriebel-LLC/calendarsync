// Airtable Web API client
// Documentation: https://airtable.com/developers/web/api

const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

// Rate limiting: 5 requests per second per base
const RATE_LIMIT_DELAY_MS = 200; // 200ms between requests = 5 req/sec

export interface AirtableBase {
  id: string;
  name: string;
  permissionLevel: "none" | "read" | "comment" | "edit" | "create";
}

export interface AirtableBasesResponse {
  bases: AirtableBase[];
  offset?: string;
}

export interface AirtableTable {
  id: string;
  name: string;
  description?: string;
  primaryFieldId: string;
  fields: AirtableField[];
}

export interface AirtableField {
  id: string;
  name: string;
  type: AirtableFieldType;
  description?: string;
  options?: Record<string, unknown>;
}

export type AirtableFieldType =
  | "singleLineText"
  | "email"
  | "url"
  | "multilineText"
  | "number"
  | "percent"
  | "currency"
  | "singleSelect"
  | "multipleSelects"
  | "singleCollaborator"
  | "multipleCollaborators"
  | "multipleRecordLinks"
  | "date"
  | "dateTime"
  | "phoneNumber"
  | "multipleAttachments"
  | "checkbox"
  | "formula"
  | "createdTime"
  | "rollup"
  | "count"
  | "lookup"
  | "multipleLookupValues"
  | "autoNumber"
  | "barcode"
  | "rating"
  | "richText"
  | "duration"
  | "lastModifiedTime"
  | "button"
  | "createdBy"
  | "lastModifiedBy"
  | "externalSyncSource";

export interface AirtableTablesResponse {
  tables: AirtableTable[];
}

export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

export interface AirtableRecordsResponse {
  records: AirtableRecord[];
  offset?: string;
}

export interface AirtableCreateRecordRequest {
  fields: Record<string, unknown>;
  typecast?: boolean;
}

export interface AirtableUpdateRecordRequest {
  id: string;
  fields: Record<string, unknown>;
  typecast?: boolean;
}

export interface AirtableCreateFieldRequest {
  name: string;
  type: AirtableFieldType;
  description?: string;
  options?: Record<string, unknown>;
}

// Helper function to handle rate limiting
async function rateLimitedFetch(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      // Rate limited - wait and retry
      const retryAfter = response.headers.get("Retry-After");
      const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : RATE_LIMIT_DELAY_MS * (attempt + 1) * 2;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      continue;
    }

    return response;
  }

  throw new Error("Rate limit exceeded after retries");
}

// List all bases the user has access to
export async function listBases(accessToken: string): Promise<AirtableBase[]> {
  const bases: AirtableBase[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    if (offset) {
      params.set("offset", offset);
    }

    const url = `${AIRTABLE_API_BASE}/meta/bases${params.toString() ? `?${params}` : ""}`;
    const response = await rateLimitedFetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list bases: ${response.statusText}`);
    }

    const data: AirtableBasesResponse = await response.json();
    bases.push(...data.bases);
    offset = data.offset;
  } while (offset);

  return bases;
}

// Get base schema (tables and fields)
export async function getBaseSchema(
  accessToken: string,
  baseId: string
): Promise<AirtableTable[]> {
  const response = await rateLimitedFetch(
    `${AIRTABLE_API_BASE}/meta/bases/${baseId}/tables`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get base schema: ${response.statusText}`);
  }

  const data: AirtableTablesResponse = await response.json();
  return data.tables;
}

// List records from a table
export async function listRecords(
  accessToken: string,
  baseId: string,
  tableIdOrName: string,
  options?: {
    fields?: string[];
    filterByFormula?: string;
    maxRecords?: number;
    pageSize?: number;
    offset?: string;
  }
): Promise<AirtableRecordsResponse> {
  const params = new URLSearchParams();
  if (options?.fields) {
    options.fields.forEach((field) => params.append("fields[]", field));
  }
  if (options?.filterByFormula) {
    params.set("filterByFormula", options.filterByFormula);
  }
  if (options?.maxRecords) {
    params.set("maxRecords", options.maxRecords.toString());
  }
  if (options?.pageSize) {
    params.set("pageSize", options.pageSize.toString());
  }
  if (options?.offset) {
    params.set("offset", options.offset);
  }

  const url = `${AIRTABLE_API_BASE}/${baseId}/${encodeURIComponent(tableIdOrName)}${params.toString() ? `?${params}` : ""}`;
  const response = await rateLimitedFetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list records: ${response.statusText}`);
  }

  return response.json();
}

// Create records in a table (max 10 records per request)
export async function createRecords(
  accessToken: string,
  baseId: string,
  tableIdOrName: string,
  records: AirtableCreateRecordRequest[]
): Promise<AirtableRecord[]> {
  // Airtable limits to 10 records per request
  const BATCH_SIZE = 10;
  const createdRecords: AirtableRecord[] = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    const response = await rateLimitedFetch(
      `${AIRTABLE_API_BASE}/${baseId}/${encodeURIComponent(tableIdOrName)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          records: batch,
          typecast: true, // Automatically convert strings to appropriate types
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create records: ${error}`);
    }

    const data: AirtableRecordsResponse = await response.json();
    createdRecords.push(...data.records);

    // Rate limit between batches
    if (i + BATCH_SIZE < records.length) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
    }
  }

  return createdRecords;
}

// Update records in a table (max 10 records per request)
export async function updateRecords(
  accessToken: string,
  baseId: string,
  tableIdOrName: string,
  records: AirtableUpdateRecordRequest[]
): Promise<AirtableRecord[]> {
  const BATCH_SIZE = 10;
  const updatedRecords: AirtableRecord[] = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    const response = await rateLimitedFetch(
      `${AIRTABLE_API_BASE}/${baseId}/${encodeURIComponent(tableIdOrName)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          records: batch.map((r) => ({
            id: r.id,
            fields: r.fields,
          })),
          typecast: true,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update records: ${error}`);
    }

    const data: AirtableRecordsResponse = await response.json();
    updatedRecords.push(...data.records);

    if (i + BATCH_SIZE < records.length) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
    }
  }

  return updatedRecords;
}

// Delete records from a table (max 10 records per request)
export async function deleteRecords(
  accessToken: string,
  baseId: string,
  tableIdOrName: string,
  recordIds: string[]
): Promise<void> {
  const BATCH_SIZE = 10;

  for (let i = 0; i < recordIds.length; i += BATCH_SIZE) {
    const batch = recordIds.slice(i, i + BATCH_SIZE);
    const params = new URLSearchParams();
    batch.forEach((id) => params.append("records[]", id));

    const response = await rateLimitedFetch(
      `${AIRTABLE_API_BASE}/${baseId}/${encodeURIComponent(tableIdOrName)}?${params}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete records: ${error}`);
    }

    if (i + BATCH_SIZE < recordIds.length) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
    }
  }
}

// Create a field in a table
export async function createField(
  accessToken: string,
  baseId: string,
  tableIdOrName: string,
  field: AirtableCreateFieldRequest
): Promise<AirtableField> {
  const response = await rateLimitedFetch(
    `${AIRTABLE_API_BASE}/meta/bases/${baseId}/tables/${encodeURIComponent(tableIdOrName)}/fields`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(field),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create field: ${error}`);
  }

  return response.json();
}

// Calendar event field definitions for Airtable
export const CALENDAR_EVENT_FIELDS: AirtableCreateFieldRequest[] = [
  { name: "Event Title", type: "singleLineText" },
  { name: "Start", type: "dateTime", options: { timeZone: "utc", dateFormat: { name: "iso" } } },
  { name: "End", type: "dateTime", options: { timeZone: "utc", dateFormat: { name: "iso" } } },
  { name: "Duration (minutes)", type: "number", options: { precision: 0 } },
  { name: "Calendar", type: "singleSelect" },
  { name: "Description", type: "multilineText" },
  { name: "Location", type: "singleLineText" },
  { name: "Attendees", type: "multipleSelects" },
  { name: "Status", type: "singleSelect", options: { choices: [
    { name: "confirmed" },
    { name: "tentative" },
    { name: "cancelled" },
  ] } },
  { name: "Event ID", type: "singleLineText", description: "Google Calendar event ID for sync tracking" },
];

// Check if a table has the required calendar event fields
export function hasRequiredFields(
  tableFields: AirtableField[],
  requiredFieldNames: string[]
): { hasAll: boolean; missing: string[] } {
  const existingNames = new Set(tableFields.map((f) => f.name.toLowerCase()));
  const missing = requiredFieldNames.filter(
    (name) => !existingNames.has(name.toLowerCase())
  );
  return {
    hasAll: missing.length === 0,
    missing,
  };
}

// Initialize a table with calendar event fields
export async function initializeTableForCalendarSync(
  accessToken: string,
  baseId: string,
  tableId: string,
  existingFields: AirtableField[]
): Promise<void> {
  const existingNames = new Set(existingFields.map((f) => f.name.toLowerCase()));

  for (const fieldDef of CALENDAR_EVENT_FIELDS) {
    if (!existingNames.has(fieldDef.name.toLowerCase())) {
      try {
        await createField(accessToken, baseId, tableId, fieldDef);
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
      } catch (error) {
        // Field might already exist with different casing, continue
        console.warn(`Could not create field ${fieldDef.name}:`, error);
      }
    }
  }
}

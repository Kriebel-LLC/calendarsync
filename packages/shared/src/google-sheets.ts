// Google Sheets API v4 client

export interface GoogleSpreadsheet {
  spreadsheetId: string;
  properties: {
    title: string;
  };
  sheets: GoogleSheet[];
}

export interface GoogleSheet {
  properties: {
    sheetId: number;
    title: string;
    index: number;
  };
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export interface GoogleDriveFilesResponse {
  files: GoogleDriveFile[];
  nextPageToken?: string;
}

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3/files";

// Headers for calendar events in the spreadsheet
export const EVENT_HEADERS = [
  "Event Title",
  "Start Time",
  "End Time",
  "Duration (minutes)",
  "Calendar Name",
  "Description",
  "Location",
  "Attendees",
  "Status",
  "Event ID", // Hidden column for tracking
] as const;

export async function listSpreadsheets(accessToken: string): Promise<GoogleDriveFile[]> {
  const spreadsheets: GoogleDriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: "mimeType='application/vnd.google-apps.spreadsheet'",
      fields: "files(id,name,mimeType),nextPageToken",
      pageSize: "100",
    });
    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const response = await fetch(`${DRIVE_API_BASE}?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list spreadsheets: ${response.statusText}`);
    }

    const data: GoogleDriveFilesResponse = await response.json();
    spreadsheets.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return spreadsheets;
}

export async function getSpreadsheet(
  accessToken: string,
  spreadsheetId: string
): Promise<GoogleSpreadsheet> {
  const response = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}?fields=spreadsheetId,properties.title,sheets.properties`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get spreadsheet: ${response.statusText}`);
  }

  return response.json();
}

export async function createSpreadsheet(
  accessToken: string,
  title: string
): Promise<GoogleSpreadsheet> {
  const response = await fetch(SHEETS_API_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        {
          properties: {
            title: "Calendar Events",
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create spreadsheet: ${response.statusText}`);
  }

  return response.json();
}

export interface SheetValues {
  range: string;
  majorDimension: "ROWS" | "COLUMNS";
  values: string[][];
}

export async function getSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string
): Promise<SheetValues | null> {
  const response = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to get sheet values: ${response.statusText}`);
  }

  return response.json();
}

export async function appendSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: string[][]
): Promise<{ updates: { updatedRows: number; updatedRange: string } }> {
  const response = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to append values: ${response.statusText}`);
  }

  return response.json();
}

export async function updateSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: string[][]
): Promise<void> {
  const response = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to update values: ${response.statusText}`);
  }
}

export async function clearSheetRow(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  rowNumber: number
): Promise<void> {
  const range = `${sheetName}!A${rowNumber}:${String.fromCharCode(64 + EVENT_HEADERS.length)}${rowNumber}`;
  const response = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to clear row: ${response.statusText}`);
  }
}

export async function batchUpdateSheetValues(
  accessToken: string,
  spreadsheetId: string,
  updates: Array<{ range: string; values: string[][] }>
): Promise<void> {
  const response = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data: updates,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to batch update values: ${response.statusText}`);
  }
}

export async function initializeSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string
): Promise<void> {
  // Check if header row exists
  const range = `${sheetName}!A1:${String.fromCharCode(64 + EVENT_HEADERS.length)}1`;
  const existing = await getSheetValues(accessToken, spreadsheetId, range);

  if (!existing?.values?.length) {
    // Add header row
    await updateSheetValues(accessToken, spreadsheetId, range, [EVENT_HEADERS as unknown as string[]]);
  }
}

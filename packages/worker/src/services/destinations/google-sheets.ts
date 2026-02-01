import { CalendarEvent } from "../google-calendar";
import {
  DestinationAdapter,
  DestinationPushResult,
  EventRow,
  transformEventToRow,
  EVENT_ROW_HEADERS,
} from "./types";

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

interface SheetData {
  values: (string | number | boolean)[][];
}

export class GoogleSheetsAdapter implements DestinationAdapter {
  private accessToken: string;
  private spreadsheetId: string;
  private sheetName: string;
  private existingEventIds: Map<string, number> = new Map(); // eventId -> row number

  constructor(
    accessToken: string,
    spreadsheetId: string,
    sheetName = "Events"
  ) {
    this.accessToken = accessToken;
    this.spreadsheetId = spreadsheetId;
    this.sheetName = sheetName;
  }

  private async fetchWithAuth(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    return fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  }

  private eventRowToArray(row: EventRow): (string | number | boolean)[] {
    return [
      row.eventId,
      row.title,
      row.description,
      row.location,
      row.startTime,
      row.endTime,
      row.isAllDay,
      row.duration,
      row.organizer,
      row.attendees,
      row.status,
      row.created,
      row.updated,
    ];
  }

  async initialize(): Promise<void> {
    // Read existing data to build index of eventIds to row numbers
    const range = `${this.sheetName}!A:A`;
    const url = `${SHEETS_API_BASE}/${
      this.spreadsheetId
    }/values/${encodeURIComponent(range)}`;
    const response = await this.fetchWithAuth(url);

    if (response.status === 400) {
      // Sheet might not exist, try to create it
      await this.ensureSheetExists();
      return;
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to read sheet: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as SheetData;
    const values = data.values || [];

    // Skip header row (index 0), map eventId to row number (1-indexed for Sheets)
    for (let i = 1; i < values.length; i++) {
      const eventId = values[i][0];
      if (eventId && typeof eventId === "string") {
        this.existingEventIds.set(eventId, i + 1); // Sheets rows are 1-indexed
      }
    }
  }

  private async ensureSheetExists(): Promise<void> {
    // Get spreadsheet info to check if sheet exists
    const infoUrl = `${SHEETS_API_BASE}/${this.spreadsheetId}`;
    const infoResponse = await this.fetchWithAuth(infoUrl);

    if (!infoResponse.ok) {
      const error = await infoResponse.text();
      throw new Error(
        `Failed to get spreadsheet info: ${infoResponse.status} - ${error}`
      );
    }

    const spreadsheet = (await infoResponse.json()) as {
      sheets: Array<{ properties: { title: string; sheetId: number } }>;
    };

    const sheetExists = spreadsheet.sheets.some(
      (s) => s.properties.title === this.sheetName
    );

    if (!sheetExists) {
      // Create the sheet
      const createResponse = await this.fetchWithAuth(
        `${SHEETS_API_BASE}/${this.spreadsheetId}:batchUpdate`,
        {
          method: "POST",
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: {
                    title: this.sheetName,
                  },
                },
              },
            ],
          }),
        }
      );

      if (!createResponse.ok) {
        const error = await createResponse.text();
        throw new Error(
          `Failed to create sheet: ${createResponse.status} - ${error}`
        );
      }
    }

    // Add headers to the first row
    await this.writeHeaders();
  }

  private async writeHeaders(): Promise<void> {
    const range = `${this.sheetName}!A1:M1`;
    const url = `${SHEETS_API_BASE}/${
      this.spreadsheetId
    }/values/${encodeURIComponent(range)}?valueInputOption=RAW`;

    const response = await this.fetchWithAuth(url, {
      method: "PUT",
      body: JSON.stringify({
        values: [EVENT_ROW_HEADERS],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to write headers: ${response.status} - ${error}`);
    }
  }

  async pushEvents(events: CalendarEvent[]): Promise<DestinationPushResult> {
    await this.initialize();

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    const rowsToAppend: (string | number | boolean)[][] = [];
    const rowsToUpdate: Array<{
      range: string;
      values: (string | number | boolean)[][];
    }> = [];

    for (const event of events) {
      try {
        const row = transformEventToRow(event);
        const rowArray = this.eventRowToArray(row);

        const existingRowNum = this.existingEventIds.get(event.id);
        if (existingRowNum) {
          // Update existing row
          rowsToUpdate.push({
            range: `${this.sheetName}!A${existingRowNum}:M${existingRowNum}`,
            values: [rowArray],
          });
          updated++;
        } else {
          // Append new row
          rowsToAppend.push(rowArray);
          created++;
        }
      } catch (error) {
        errors.push(`Failed to process event ${event.id}: ${error}`);
      }
    }

    // Batch update existing rows
    if (rowsToUpdate.length > 0) {
      const batchUpdateUrl = `${SHEETS_API_BASE}/${this.spreadsheetId}/values:batchUpdate`;
      const updateResponse = await this.fetchWithAuth(batchUpdateUrl, {
        method: "POST",
        body: JSON.stringify({
          valueInputOption: "RAW",
          data: rowsToUpdate,
        }),
      });

      if (!updateResponse.ok) {
        const error = await updateResponse.text();
        errors.push(`Failed to batch update rows: ${error}`);
        updated = 0;
      }
    }

    // Append new rows
    if (rowsToAppend.length > 0) {
      const appendUrl = `${SHEETS_API_BASE}/${
        this.spreadsheetId
      }/values/${encodeURIComponent(
        this.sheetName
      )}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
      const appendResponse = await this.fetchWithAuth(appendUrl, {
        method: "POST",
        body: JSON.stringify({
          values: rowsToAppend,
        }),
      });

      if (!appendResponse.ok) {
        const error = await appendResponse.text();
        errors.push(`Failed to append rows: ${error}`);
        created = 0;
      }
    }

    return { created, updated, errors };
  }

  async deleteEvents(eventIds: string[]): Promise<number> {
    await this.initialize();

    // Find row numbers for events to delete
    const rowsToDelete: number[] = [];
    for (const eventId of eventIds) {
      const rowNum = this.existingEventIds.get(eventId);
      if (rowNum) {
        rowsToDelete.push(rowNum);
      }
    }

    if (rowsToDelete.length === 0) {
      return 0;
    }

    // Sort in descending order to delete from bottom to top
    // (to avoid row number shifts affecting subsequent deletes)
    rowsToDelete.sort((a, b) => b - a);

    // Get sheet ID
    const infoUrl = `${SHEETS_API_BASE}/${this.spreadsheetId}`;
    const infoResponse = await this.fetchWithAuth(infoUrl);

    if (!infoResponse.ok) {
      throw new Error("Failed to get spreadsheet info for deletion");
    }

    const spreadsheet = (await infoResponse.json()) as {
      sheets: Array<{ properties: { title: string; sheetId: number } }>;
    };

    const sheet = spreadsheet.sheets.find(
      (s) => s.properties.title === this.sheetName
    );
    if (!sheet) {
      return 0;
    }

    const sheetId = sheet.properties.sheetId;

    // Create delete requests for each row
    const deleteRequests = rowsToDelete.map((rowNum) => ({
      deleteDimension: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: rowNum - 1, // 0-indexed
          endIndex: rowNum, // exclusive
        },
      },
    }));

    const batchUrl = `${SHEETS_API_BASE}/${this.spreadsheetId}:batchUpdate`;
    const response = await this.fetchWithAuth(batchUrl, {
      method: "POST",
      body: JSON.stringify({
        requests: deleteRequests,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete rows: ${response.status} - ${error}`);
    }

    return rowsToDelete.length;
  }
}

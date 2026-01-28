export const FINICOM_API_KEY_PROPERTY_KEY = "finicomApiKey";

export function getStoredAPIKey() {
  const apiKey = PropertiesService.getDocumentProperties().getProperty(
    FINICOM_API_KEY_PROPERTY_KEY
  );

  if (!apiKey) {
    throw new Error("API key is required");
  }

  return apiKey;
}

export function formatDatetimeString(datetime: string): string | null {
  if (!datetime) return null;
  const date = new Date(datetime);
  const timeZone =
    SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  return Utilities.formatDate(date, timeZone, "yyyy/MM/dd HH:mm:ss");
}

export function validateIncludeHeaders(includeHeaders: boolean): void {
  if (typeof includeHeaders !== "boolean") {
    throw new Error("includeHeaders must be a true or false");
  }
}

export function validateAccountId(accountId: string): void {
  if (!accountId || typeof accountId !== "string" || accountId.trim() === "") {
    throw new Error("Account ID is required and must be a non-empty string");
  }
}

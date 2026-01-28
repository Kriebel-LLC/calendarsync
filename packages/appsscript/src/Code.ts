// NOTE: exports in this file are not imported anywhere, but are essential for Webpack to bundle correctly
// without exports, these are viewed as effectively "not included" and not bundled correctly
// Export any top-level functions that the Apps Script needs to run

const MENU_NAME = "Finicom";
const ENABLED_EXTENSION_FUNCTION_NAME = "enableExtension";

export function onOpen(e?: GoogleAppsScript.Events.SheetsOnOpen) {
  const ui = SpreadsheetApp.getUi();

  // Extensions start "Installed" but are not enabled until any script is run manually
  // Because of this, the AuthMode is NONE, in which no services (UrlFetch, PropertiesService, etc.) are available
  if (e && e.authMode === ScriptApp.AuthMode.NONE) {
    ui.createMenu(MENU_NAME)
      .addItem("Use this Add-On", ENABLED_EXTENSION_FUNCTION_NAME)
      .addToUi();
    return;
  }

  // After the extension is enabled, show the appropriate menu based on API key status
  createMainMenu();
}

function createMainMenu() {}

// Function that gets called when user enables the extension
export function enableExtension() {}

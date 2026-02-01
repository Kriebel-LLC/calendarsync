#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Path to the next-firebase-auth-edge package.json (check multiple possible locations)
const possiblePaths = [
  path.join(__dirname, "../node_modules/next-firebase-auth-edge/package.json"),
  path.join(
    __dirname,
    "../../../node_modules/next-firebase-auth-edge/package.json"
  ),
];

let packageJsonPath = null;
for (const possiblePath of possiblePaths) {
  if (fs.existsSync(possiblePath)) {
    packageJsonPath = possiblePath;
    break;
  }
}

try {
  if (packageJsonPath && fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    // Fix the exports configuration
    if (
      packageJson.exports &&
      packageJson.exports["."] &&
      packageJson.exports["."].workerd
    ) {
      console.log("Patching next-firebase-auth-edge package.json exports...");

      // Change the workerd export from "./browser/index.js" to "./lib/index.js"
      packageJson.exports["."].workerd = "./lib/index.js";

      // Write the fixed package.json back
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

      console.log("Successfully patched next-firebase-auth-edge package.json");
    } else {
      console.log(
        "No workerd export found in next-firebase-auth-edge package.json"
      );
    }
  } else {
    console.log("next-firebase-auth-edge package.json not found");
  }
} catch (error) {
  console.error("Error patching next-firebase-auth-edge:", error);
  process.exit(1);
}

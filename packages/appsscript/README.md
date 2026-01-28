# appsscript

Basic Google Appsscript package

## Setup

**Deployment:** This Google Apps Script needs to be deployed to your Google Account. You can use `clasp` (Google Apps Script Command Line Interface) for deployment.

## Development

*   Written in TypeScript.
*   Uses `webpack` to bundle the code for Google Apps Script.
*   Uses `clasp` to manage deployments to Google Apps Script.

To build:

```bash
yarn build
```

To deploy (after configuring `.clasp.json`):

```bash
yarn deploy
```

# Privacy Policy — SF Dev Toolkit

**Last updated:** February 20, 2026

## Overview

SF Dev Toolkit is a Chrome extension that provides developer tools for Salesforce. It operates entirely within your browser and does **not** collect, store, or transmit any personal data to external servers.

## Data Collection

**SF Dev Toolkit does NOT collect any data.** Specifically:

- No personal information is collected
- No usage analytics or telemetry is sent
- No cookies are created or tracked by the extension
- No data is shared with third parties

## How the Extension Works

- The extension reads your existing Salesforce session cookie (`sid`) solely to authenticate API calls to **your own** Salesforce org
- All API calls (REST, SOAP, Tooling) go directly from your browser to your Salesforce instance (`*.salesforce.com` / `*.force.com`)
- Query history is stored locally in Chrome's `storage` API and never leaves your browser
- No data passes through any intermediary server

## Permissions Explained

| Permission | Purpose |
|------------|---------|
| `activeTab` | Detect the active Salesforce tab for field inspection |
| `sidePanel` | Display the extension UI as a side panel |
| `storage` | Store session info and query history locally |
| `cookies` | Read the Salesforce session cookie for API authentication |
| Host permissions | Make API calls directly to your Salesforce org |

## Open Source

This extension is fully open source. You can review the complete source code at:
https://github.com/szymkiewiczmathieu/Dev-Toolkit

## Contact

If you have questions about this privacy policy, contact:
**Mathieu Szymkiewicz** — szymkiewiczmathieu@gmail.com

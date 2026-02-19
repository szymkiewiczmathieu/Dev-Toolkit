# SF Dev Toolkit

A Chrome extension built for Salesforce developers and admins. Run SOQL queries, inspect field metadata, get translations, and navigate Setup pages — all from a side panel without leaving your org.

## Features

### SOQL Runner
- Write and execute SOQL queries directly from the side panel
- Object and field autocomplete suggestions
- Results displayed in a sortable, scrollable table
- Query history with one-click replay
- Execution time tracking

### Field Inspector
- Click any field on a Salesforce record page to inspect it
- See API name, type, length, required, unique, formula, and more
- View **translations** (FR / EN / ES) fetched live via SOAP API
- See which Record Types use each picklist value
- Custom field metadata (description, help text) via Tooling API
- Toggle inspect mode on/off with a single click

### Quick Navigation
- Fuzzy-search Setup pages, Apex classes, and Flows
- Keyboard shortcut: `Ctrl+Shift+K` (or `Cmd+Shift+K` on Mac)
- Instantly jump to any Setup page without navigating menus
- Live search across 100+ Setup page shortcuts

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI Framework | [Svelte 5](https://svelte.dev) (runes) + TypeScript |
| Extension | Chrome Manifest V3 (service worker, side panel, content scripts) |
| Build | [Vite](https://vitejs.dev) + [@crxjs/vite-plugin](https://crxjs.dev/vite-plugin) |
| Salesforce APIs | REST API, Tooling API, SOAP API (describeSObject with LocaleOptions) |
| Search | [Fuse.js](https://www.fusejs.io/) for fuzzy matching |

## Installation

### From source

```bash
# Clone the repository
git clone https://github.com/szymkiewiczmathieu/Dev-Toolkit.git
cd Dev-Toolkit

# Install dependencies
npm install

# Build the extension
npm run build
```

### Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist/` folder

### Development

```bash
# Start dev server with hot reload
npm run dev
```

Then load the `dist/` folder as an unpacked extension. Changes rebuild automatically.

## Usage

1. Navigate to any Salesforce org in Chrome
2. Click the **SKZ** icon in the toolbar to open the side panel
3. The extension auto-detects your Salesforce session (no login required)

### SOQL Runner
- Type a query and press `Ctrl+Enter` to run
- Use `Tab` to accept autocomplete suggestions

### Field Inspector
- Click the **Toggle Inspector** button
- Click any field on the Salesforce page
- Field details and translations appear in the side panel

### Quick Nav
- Press `Ctrl+Shift+K` or click the Quick Nav tab
- Start typing to search Setup pages, Apex classes, or Flows
- Press `Enter` to navigate

## Permissions

The extension requires these Chrome permissions:

| Permission | Why |
|------------|-----|
| `activeTab` | Access the current Salesforce tab |
| `sidePanel` | Display the toolkit as a side panel |
| `storage` | Store session info and preferences |
| `cookies` | Read Salesforce session cookies for API authentication |

Host permissions are limited to `*.salesforce.com` and `*.force.com` domains.

## Project Structure

```
src/
├── background/        # Service worker (API proxy, session management)
├── content/           # Content scripts (field detection, highlighting)
├── lib/               # Shared libraries (sfApi, toolingApi, translationApi)
└── sidepanel/         # Side panel UI
    ├── components/    # Svelte components (SoqlRunner, FieldInspector, QuickNav)
    └── stores/        # Svelte stores (connection, metadata, inspector)
```

## Author

**Mathieu Szymkiewicz** — [szymkiewiczmathieu@gmail.com](mailto:szymkiewiczmathieu@gmail.com)

## License

MIT

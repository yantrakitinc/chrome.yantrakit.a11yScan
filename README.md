# A11y Scan — Chrome Extension

A comprehensive, free accessibility audit toolkit for Chrome. Powered by [axe-core](https://github.com/dequelabs/axe-core).

## Features

1. **Automated WCAG 2.2 AA scanning** — powered by axe-core, checks all automatable success criteria
2. **Visual overlay** — highlights accessibility issues directly on the page
3. **Tab order visualization** — numbered overlay and auto-play movie mode
4. **Focus gap detection** — flags visible interactive elements missing from the tab order
5. **Multi-viewport scanning** — tests at mobile, tablet, and desktop sizes
6. **Full site crawl** — scans every page on your site via background tab navigation
7. **Authenticated scanning** — uses your active browser session, no credentials stored
8. **Auth-gated URL tagging** — declare which URLs require login so the crawler handles auth explicitly and warns on unexpected redirects
9. **Observer Mode** — a scan preset that auto-scans every page you navigate to and logs manual scans with timestamps in the Observer tab. Compare page states over time
10. **Report generation** — exportable PDF, HTML, and JSON reports, all generated client-side
11. **Remote rule updates** — fetches configuration from a public JSON endpoint

## Privacy

A11y Scan runs **entirely in your browser**. No data is sent to any server. Observer Mode stores scan history in `chrome.storage.local` — nothing leaves your machine. The only external request is an optional fetch of a public JSON configuration file for rule updates.

## Developer Setup (Load Unpacked)

### Prerequisites

1. [Node.js](https://nodejs.org/) 18+
2. [pnpm](https://pnpm.io/) (`npm install -g pnpm`)

### Install, Build, Load

```bash
# 1. Clone and install
git clone https://github.com/yantrakitinc/chrome.yantrakit.a11yScan.git
cd chrome.yantrakit.a11yScan/extension
pnpm install

# 2. Build the extension
pnpm build          # production build → dist/
# OR
pnpm dev            # watch mode → rebuilds on file change
```

```
# 3. Load in Chrome
```

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `extension/dist` folder
5. The A11y Scan icon appears in your toolbar — click it to open the side panel

### Rebuild After Changes

If you used `pnpm dev` (watch mode), the `dist/` folder updates automatically on save. After the rebuild:

1. Go to `chrome://extensions`
2. Click the **reload** icon (circular arrow) on the A11y Scan card
3. Close and reopen the side panel to pick up changes

If you used `pnpm build`, run it again after making changes, then reload the extension.

### TypeScript Check

```bash
pnpm typecheck       # runs tsc --noEmit
```

### Run Tests

```bash
pnpm test            # interactive watch mode
pnpm test --run      # single run (CI-friendly)
```

### Project Structure

```
extension/
├── src/
│   ├── background/       # Service worker (crawl, observer, message routing)
│   │   ├── index.ts      # Message router + tabs.onUpdated listener
│   │   ├── crawl.ts      # Site crawl engine (depth-first with backtracking)
│   │   ├── observer.ts   # Observer Mode core (passive background scanning)
│   │   └── multi-viewport.ts
│   ├── content/          # Content script (axe-core injection, overlays)
│   │   └── index.ts
│   ├── shared/           # Shared types and utilities
│   │   ├── test-config.ts     # iTestConfig schema, validation, defaults
│   │   ├── observer-types.ts  # Observer Mode types and defaults
│   │   ├── messages.ts        # Message type union
│   │   └── ...
│   ├── sidepanel/        # Side panel UI
│   │   ├── sidepanel.html
│   │   ├── sidepanel.ts       # Main entry point
│   │   ├── observer-history.ts # History tab UI
│   │   ├── observer-settings.ts # Observer settings in config panel
│   │   ├── config-panel.ts    # Gear-icon config panel
│   │   └── ...
│   └── manifest.json
├── dist/                 # Build output (load this folder as unpacked)
├── vitest.config.ts
└── package.json
```

## Tech Stack

1. Chrome Extension (Manifest V3)
2. axe-core (MPL-2.0)
3. TypeScript
4. Webpack
5. Tailwind CSS v4
6. Vitest

## License

MIT

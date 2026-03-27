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
8. **Report generation** — exportable PDF, HTML, and JSON reports, all generated client-side
9. **Scan history** — before/after comparison to track improvements over time
10. **Remote rule updates** — fetches configuration from a public JSON endpoint

## Privacy

A11y Scan runs **entirely in your browser**. No data is sent to any server. The only external request is an optional fetch of a public JSON configuration file for rule updates.

## Tech Stack

1. Chrome Extension (Manifest V3)
2. axe-core (MPL-2.0)
3. TypeScript

## License

MIT

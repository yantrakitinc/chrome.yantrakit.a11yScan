# F12 — Report export

## Purpose
Export scan results in 4 formats: JSON, HTML (standalone styled report), PDF (via window.open + print), Copy-to-clipboard JSON.

## Source of truth
[F12-report-export.md](../../legacy/features/F12-report-export.md)

## Acceptance criteria

- [ ] export-json button downloads `A11y-Scan-Report-<domain>-<datestamp>.json`
- [ ] export-html button downloads styled HTML report with embedded CSS
- [ ] export-pdf button opens print window with HTML report; calls win.print() after 500ms
- [ ] export-copy button writes JSON to navigator.clipboard.writeText
- [ ] Copy success: button text flips to "Copied!" for 2s
- [ ] Copy failure: button text flips to "Copy failed" for 2s
- [ ] PDF popup-blocked: button text flips to "Popup blocked" for 3s
- [ ] All exports include: scan, manualReview, ariaWidgets, tabOrder, focusGaps, viewportAnalysis (if MV ran), crawlResults (if crawl ran)
- [ ] Export buttons disabled when no scan result (no single-page scan AND no crawl results)
- [ ] HTML export renders with --ds-* CSS variables AS HARDCODED VALUES (reports.ts uses literal hex; tested)

## Verification mechanism
`e2e/verify-feature-f12-report-export.ts` — scan fixture, click each export button, assert (a) URL.createObjectURL called for JSON/HTML, (b) window.open called for PDF, (c) navigator.clipboard.writeText called for Copy. Capture exported file content for sanity.

## Structural gaps
- Real PDF rendering quality NOT verified (depends on Chrome's print engine + user's printer settings).
- HTML report visual style NOT pixel-tested — only structure + content.

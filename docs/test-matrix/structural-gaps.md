# Structural Verification Gaps

Paths that **cannot** be directly verified via unit tests + Puppeteer e2e harness. Each gap lists: what can't be tested, why, the indirect mechanism used, and explicit acknowledgement that this path is verified-via-proxy.

When asked "is this 100% verified?", the answer is always: "Verified except the gaps in this file."

## Gap 1 — `chrome.scripting.executeScript({ func })` bodies in background

**Files:** `src/background/crawl.ts` lines 148-158 (auth credential filling), 431-444 (link collection)

**Why:** Functions passed via `chrome.scripting.executeScript({ func: ... })` execute in the inspected page tab's process, NOT in the test process. v8 coverage cannot observe their bodies; they don't appear in the coverage report.

**Indirect mechanism:** End-to-end crawl tests assert the OUTPUTS of these functions — link counts, populated form fields — without instrumenting their internal lines.

**Acknowledgement:** These bodies are NOT 100% directly verifiable. Verified-via-proxy only.

## Gap 2 — DevTools panel registration (`src/devtools/devtools.ts`)

**Files:** `src/devtools/devtools.ts` (14 lines, registers the Elements-panel sidebar pane via `chrome.devtools.panels.elements.createSidebarPane`)

**Why:** Pure DevTools-host registration. Cannot run without a real DevTools panel session, which Puppeteer cannot drive (DevTools opens in a separate Chrome window with its own protocol).

**Indirect mechanism:** Manual screenshot + smoke test on every release. The panel's HTML rendering (`src/devtools/panel.ts`) IS unit-tested at 90% branch coverage.

**Acknowledgement:** The registration code path is verified-via-build only (it compiles + builds; never executed in test).

## Gap 3 — Real screen reader announcement

**Files:** Anything that reaches `speechSynthesis.speak(utterance)` in `src/sidepanel/sr-tab/playback.ts`.

**Why:** Real TTS audio output requires NVDA / VoiceOver / JAWS hooked into Chrome's accessibility tree. Puppeteer cannot capture audio.

**Indirect mechanism:** Verify the `SpeechSynthesisUtterance` text content + rate via spy in unit tests + Puppeteer-captured `speechSynthesis.speak` invocations. Validates the input to TTS, not the actual audio output.

**Acknowledgement:** Audio output is NOT verified. Only the text-to-be-spoken is verified.

## Gap 4 — Native keyboard hardware Tab traversal

**Files:** Tests that simulate Tab key navigation (`KeyboardEvent({ key: "Tab" })`) — synthetic events do not invoke Chrome's native focus-traversal algorithm.

**Why:** Native `Tab` traversal in real Chrome respects flagged behavior, accessibility tree, and platform conventions that synthetic `KeyboardEvent` does not trigger.

**Indirect mechanism:** Use `Tab` synthetic events to simulate the user intent + assert `document.activeElement` after. Approximate, not equivalent to real hardware Tab.

**Acknowledgement:** Hardware Tab traversal is NOT 100% reproducible from Puppeteer. Tests are best-effort approximations.

## Gap 5 — Cross-origin iframes

**Files:** Anything that runs in or interacts with cross-origin iframes (e.g., scanning a page that embeds an iframe).

**Why:** Chrome's same-origin policy prevents content scripts in the parent tab from reaching into cross-origin iframes. Puppeteer can't follow the boundary either without explicit per-frame setup.

**Indirect mechanism:** Test fixtures use same-origin iframes only. Cross-origin behavior is verified manually.

**Acknowledgement:** Cross-origin iframe behavior is NOT verified by automated tests.

## Gap 6 — Real Chrome AI (Chrome Built-in Gemini Nano)

**Files:** `src/sidepanel/ai-tab.ts` — calls `self.ai.languageModel.create()` and `.prompt()`.

**Why:** Chrome built-in AI requires a flag-enabled Chrome and a downloaded Gemini Nano model. Most Puppeteer Chrome installs don't have it; even if they did, the responses are non-deterministic.

**Indirect mechanism:** Stub `self.ai.languageModel` in tests with a deterministic mock. Real AI integration is verified manually.

**Acknowledgement:** Real AI responses are NOT verified by automated tests.

## Gap 7 — Vercel deploy / production build

**Files:** Anything that depends on production-build-only behavior (minification, source maps, production-only env vars).

**Why:** Tests run against `pnpm build` (production build) but the harness loads it locally. Real production deployment via Vercel could differ.

**Indirect mechanism:** Manual smoke test on staging URL after each Vercel deploy.

**Acknowledgement:** Vercel-specific deployment behavior is NOT verified by automated tests.

## Gap 8 — Real-user accessibility (assistive tech testing)

**Files:** Any feature claiming WCAG conformance.

**Why:** WCAG conformance requires testing with real users using real assistive technology — screen readers, switch devices, voice control, keyboard-only operation. Automated tests catch about 30-40% of WCAG issues at best.

**Indirect mechanism:** axe-core scans + manual testing checklist. Real-user testing happens during periodic accessibility audits.

**Acknowledgement:** "Passes axe-core" ≠ "accessible". Real-user a11y is NOT verified by this harness.

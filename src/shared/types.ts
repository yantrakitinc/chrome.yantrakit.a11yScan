/**
 * Core type definitions for A11y Scan extension.
 * Source of truth: /extension/docs/features/F01-single-page-scan.md
 */

/* ═══════════════════════════════════════════════════════════════════
   Scan Results (F01)
   ═══════════════════════════════════════════════════════════════════ */

export interface iViolationNode {
  selector: string;
  html: string;
  failureSummary: string;
}

export interface iViolation {
  id: string;
  impact: "critical" | "serious" | "moderate" | "minor";
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: iViolationNode[];
  /** WCAG criteria IDs mapped from axe tags, e.g. ["1.4.3"] */
  wcagCriteria?: string[];
}

export interface iPass {
  id: string;
  description: string;
  tags: string[];
  nodes: { selector: string; html: string }[];
  wcagCriteria?: string[];
}

export interface iIncomplete {
  id: string;
  description: string;
  tags: string[];
  nodes: { selector: string; html: string; message: string }[];
  wcagCriteria?: string[];
}

export interface iScanSummary {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  passes: number;
  incomplete: number;
}

export interface iPageElements {
  hasVideo: boolean;
  hasAudio: boolean;
  hasForms: boolean;
  hasImages: boolean;
  hasLinks: boolean;
  hasHeadings: boolean;
  hasIframes: boolean;
  hasTables: boolean;
  hasAnimation: boolean;
  hasAutoplay: boolean;
  hasDragDrop: boolean;
  hasTimeLimited: boolean;
}

export interface iScanResult {
  url: string;
  timestamp: string;
  violations: iViolation[];
  passes: iPass[];
  incomplete: iIncomplete[];
  summary: iScanSummary;
  pageElements: iPageElements;
  scanDurationMs: number;
}

/* ═══════════════════════════════════════════════════════════════════
   Multi-Viewport (F02)
   ═══════════════════════════════════════════════════════════════════ */

export interface iViewportViolation extends iViolation {
  viewports: number[];
}

export interface iMultiViewportResult {
  viewports: number[];
  perViewport: Record<number, iScanResult>;
  shared: iViolation[];
  viewportSpecific: iViewportViolation[];
}

/* ═══════════════════════════════════════════════════════════════════
   Site Crawl (F03)
   ═══════════════════════════════════════════════════════════════════ */

export interface iPageRule {
  pattern: string;
  waitType: "login" | "interaction" | "deferred-content";
  description: string;
}

export interface iGatedUrls {
  mode: "none" | "list" | "prefix" | "regex";
  patterns: string[];
}

export interface iCrawlAuth {
  loginUrl: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  username: string;
  password: string;
  gatedUrls?: iGatedUrls;
}

export interface iCrawlOptions {
  mode: "follow" | "urllist";
  timeout: number;
  scanTimeout: number;
  delay: number;
  scope: string;
  urlList: string[];
  pageRules: iPageRule[];
  auth?: iCrawlAuth;
}

export type iCrawlStatus = "idle" | "crawling" | "paused" | "wait" | "complete";

export interface iCrawlState {
  status: iCrawlStatus;
  startedAt: string;
  pagesVisited: number;
  pagesTotal: number;
  currentUrl: string;
  results: Record<string, iScanResult>;
  failed: Record<string, string>;
  queue: string[];
  visited: string[];
}

/* ═══════════════════════════════════════════════════════════════════
   Observer Mode (F04)
   ═══════════════════════════════════════════════════════════════════ */

export interface iObserverSettings {
  includeDomains: string[];
  excludeDomains: string[];
  throttleSeconds: number;
  maxHistoryEntries: number;
}

export interface iObserverState {
  enabled: boolean;
  settings: iObserverSettings;
}

export interface iObserverEntry {
  id: string;
  url: string;
  title: string;
  timestamp: string;
  source: "auto" | "manual";
  violations: iViolation[];
  passes: iPass[];
  violationCount: number;
  viewportBucket?: string;
}

export const OBSERVER_STORAGE_KEYS = {
  state: "observer_state",
  history: "observer_history",
} as const;

export const DEFAULT_OBSERVER_SETTINGS: iObserverSettings = {
  includeDomains: ["*"],
  excludeDomains: [],
  throttleSeconds: 30,
  maxHistoryEntries: 500,
};

/* ═══════════════════════════════════════════════════════════════════
   ARIA Validation (F10)
   ═══════════════════════════════════════════════════════════════════ */

export interface iAriaCheck {
  name: string;
  pass: boolean;
  message: string;
}

export interface iAriaWidget {
  role: string;
  selector: string;
  label: string;
  html: string;
  checks: iAriaCheck[];
  passCount: number;
  failCount: number;
}

/* ═══════════════════════════════════════════════════════════════════
   Screen Reader (F15)
   ═══════════════════════════════════════════════════════════════════ */

export type iNameSource = "aria-label" | "aria-labelledby" | "alt" | "label" | "title" | "contents" | "sr-only";

export interface iScreenReaderElement {
  index: number;
  selector: string;
  accessibleName: string;
  nameSource: iNameSource;
  role: string;
  states: string[];
  level?: number;
  childCount?: number;
}

/* ═══════════════════════════════════════════════════════════════════
   Keyboard (F16)
   ═══════════════════════════════════════════════════════════════════ */

export interface iTabOrderElement {
  index: number;
  selector: string;
  role: string;
  accessibleName: string;
  tabindex: number | null;
  hasFocusIndicator: boolean;
}

export interface iFocusGap {
  selector: string;
  role: string;
  reason: string;
}

export interface iFocusIndicator {
  selector: string;
  hasIndicator: boolean;
  indicatorType?: string;
}

export interface iKeyboardTrap {
  selector: string;
  description: string;
}

export interface iSkipLink {
  selector: string;
  target: string;
  targetExists: boolean;
}

export interface iKeyboardAnalysis {
  tabOrder: iTabOrderElement[];
  focusGaps: iFocusGap[];
  focusIndicators: iFocusIndicator[];
  keyboardTraps: iKeyboardTrap[];
  skipLinks: iSkipLink[];
}

/* ═══════════════════════════════════════════════════════════════════
   Accessibility Inspector (F20)
   ═══════════════════════════════════════════════════════════════════ */

export interface iInspectorData {
  selector: string;
  role: string;
  accessibleName: string;
  ariaAttributes: Record<string, string>;
  tabindex: number | null;
  isFocusable: boolean;
  violations: { ruleId: string; impact: string; message: string }[];
}

/* ═══════════════════════════════════════════════════════════════════
   Enriched Context (F12)
   ═══════════════════════════════════════════════════════════════════ */

export interface iDomContext {
  parentSelector: string;
  parentTagName: string;
  siblingSelectors: string[];
  nearestLandmark: string;
  nearestHeading: string;
}

export interface iCssContext {
  color: string;
  backgroundColor: string;
  fontSize: string;
  display: string;
  visibility: string;
  position: string;
}

export interface iFrameworkHints {
  detected: string | null;
  componentName: string | null;
  testId: string | null;
}

export interface iFilePathGuess {
  source: string;
  guess: string;
}

export interface iEnrichedContext {
  dom: iDomContext;
  css: iCssContext;
  framework: iFrameworkHints;
  filePathGuesses: iFilePathGuess[];
}

/* ═══════════════════════════════════════════════════════════════════
   Test Configuration (F13)
   ═══════════════════════════════════════════════════════════════════ */

export interface iMockEndpoint {
  urlPattern: string;
  method?: string;
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export interface iTestConfig {
  wcag?: {
    version?: "2.0" | "2.1" | "2.2";
    level?: "A" | "AA" | "AAA";
  };
  viewports?: number[];
  timing?: {
    scanTimeout?: number;
    pageLoadTimeout?: number;
    delayBetweenPages?: number;
  };
  auth?: iCrawlAuth;
  rules?: {
    include?: string[];
    exclude?: string[];
  };
  enrichment?: {
    domContext?: boolean;
    cssContext?: boolean;
    frameworkHints?: boolean;
    filePathGuess?: boolean;
  };
  pageRules?: iPageRule[];
  mocks?: iMockEndpoint[];
  crawl?: {
    mode?: "follow" | "urllist";
    scope?: string;
    urlList?: string[];
  };
  heuristics?: {
    enabled?: boolean;
    exclude?: number[];
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Remote Config
   ═══════════════════════════════════════════════════════════════════ */

export interface iRuleConfig {
  enabled: boolean;
}

export interface iRemoteConfig {
  version: string;
  wcagVersion: string;
  wcagLevel: string;
  rules: Record<string, iRuleConfig>;
  scanOptions: {
    resultTypes: string[];
  };
  heuristics?: {
    enabled?: boolean;
    exclude?: number[];
  };
}

/* ═══════════════════════════════════════════════════════════════════
   AI Chat (F17)
   ═══════════════════════════════════════════════════════════════════ */

export interface iChatMessage {
  role: "user" | "ai";
  content: string;
  timestamp: string;
}

export interface iChatConversation {
  id: string;
  title: string;
  createdAt: string;
  messages: iChatMessage[];
}

/* ═══════════════════════════════════════════════════════════════════
   Manual Review (F09)
   ═══════════════════════════════════════════════════════════════════ */

export type iManualReviewStatus = "pass" | "fail" | "na" | null;

export interface iManualReviewState {
  /** WCAG criterion ID → status */
  criteria: Record<string, iManualReviewStatus>;
}

/* ═══════════════════════════════════════════════════════════════════
   Report Export (F12)
   ═══════════════════════════════════════════════════════════════════ */

export interface iJsonReport {
  metadata: {
    url: string;
    title: string;
    timestamp: string;
    wcagVersion: string;
    wcagLevel: string;
    toolVersion: string;
    scanDurationMs: number;
  };
  summary: {
    violationCount: number;
    passCount: number;
    incompleteCount: number;
    passRate: number;
  };
  violations: iViolation[];
  passes: iPass[];
  incomplete: iIncomplete[];
  manualReview?: {
    reviewed: number;
    total: number;
    criteria: { id: string; name: string; status: "pass" | "fail" | "na" | null }[];
  };
  ariaWidgets?: iAriaWidget[];
  tabOrder?: iTabOrderElement[];
  focusGaps?: iFocusGap[];
  enrichedContext?: Record<string, iEnrichedContext>;
  crawl?: {
    pagesScanned: number;
    pagesFailed: number;
    results: Record<string, iScanResult>;
  };
  viewportAnalysis?: iMultiViewportResult;
}

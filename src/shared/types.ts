/**
 * Axe-core result types used throughout the extension.
 */

export interface iViolationNode {
  target: string[];
  html: string;
  failureSummary: string;
}

export interface iViolation {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: iViolationNode[];
}

export interface iScanSummary {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  passes: number;
  incomplete: number;
  inapplicable: number;
}

export interface iScanResult {
  url: string;
  timestamp: string;
  violations: iViolation[];
  passes: number;
  incomplete: number;
  inapplicable: number;
  summary: iScanSummary;
}

/** Enriched DOM context for a violation node. */
export interface iDomContext {
  parentSelector: string;
  parentTagName: string;
  siblingSelectors: string[];
  nearestLandmark: string;
  nearestHeading: string;
}

/** Enriched CSS computed styles for a violation node. */
export interface iCssContext {
  color: string;
  backgroundColor: string;
  fontSize: string;
  display: string;
  visibility: string;
  position: string;
}

/** Framework detection hints. */
export interface iFrameworkHints {
  detected: string | null;
  componentName: string | null;
  testId: string | null;
}

/** File path guesses from class names and attributes. */
export interface iFilePathGuess {
  source: string;
  guess: string;
}

/** Full enriched context collected per violation node. */
export interface iEnrichedContext {
  dom: iDomContext;
  css: iCssContext;
  framework: iFrameworkHints;
  filePathGuesses: iFilePathGuess[];
}

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
}

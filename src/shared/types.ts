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

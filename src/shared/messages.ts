import type { iScanResult, iRemoteConfig } from './types';

/**
 * Discriminated union of all messages passed between extension components.
 * Side panel ↔ Background ↔ Content script.
 */
export type iMessage =
  | { type: 'SCAN_REQUEST' }
  | { type: 'RUN_SCAN'; payload: { config: iRemoteConfig } }
  | { type: 'SCAN_RESULT'; payload: iScanResult }
  | { type: 'SCAN_ERROR'; payload: { message: string } }
  | { type: 'SCAN_PROGRESS'; payload: { status: string } }
  | { type: 'FORCE_CONFIG_UPDATE' }
  | { type: 'CONFIG_UPDATED'; payload: { version: string } };

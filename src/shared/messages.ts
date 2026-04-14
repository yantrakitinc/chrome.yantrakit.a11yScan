import type { iScanResult, iRemoteConfig } from './types';
import type { iObserverScanResult, iObserverSettings, iObserverState } from './observer-types';

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
  | { type: 'CONFIG_UPDATED'; payload: { version: string } }
  // Observer Mode
  | { type: 'OBSERVER_ENABLE' }
  | { type: 'OBSERVER_DISABLE' }
  | { type: 'OBSERVER_GET_STATE' }
  | { type: 'OBSERVER_STATE'; payload: iObserverState }
  | { type: 'OBSERVER_UPDATE_SETTINGS'; payload: Partial<iObserverSettings> }
  | { type: 'OBSERVER_GET_HISTORY' }
  | { type: 'OBSERVER_HISTORY'; payload: iObserverScanResult[] }
  | { type: 'OBSERVER_CLEAR_HISTORY' }
  | { type: 'OBSERVER_EXPORT_HISTORY' }
  | { type: 'OBSERVER_SCAN_COMPLETE'; entry: iObserverScanResult };

import { describe, it, expect } from 'vitest';
import {
  WCAG_CRITERIA,
  filterCriteria,
  axeRuleToWcag,
  isCriterionRelevant,
} from '../wcag-mapping';

describe('WCAG_CRITERIA', () => {
  it('contains 55 criteria for WCAG 2.2 AA', () => {
    const aa = filterCriteria('2.2', 'AA');
    expect(aa.length).toBe(55);
  });

  it('contains only Level A criteria when filtering for A', () => {
    const a = filterCriteria('2.2', 'A');
    expect(a.every((c) => c.level === 'A')).toBe(true);
  });

  it('contains A and AA criteria when filtering for AA', () => {
    const aa = filterCriteria('2.2', 'AA');
    const levels = new Set(aa.map((c) => c.level));
    expect(levels).toEqual(new Set(['A', 'AA']));
  });

  it('filters by WCAG version correctly', () => {
    const v20 = filterCriteria('2.0', 'AA');
    const v21 = filterCriteria('2.1', 'AA');
    const v22 = filterCriteria('2.2', 'AA');

    expect(v20.length).toBeLessThan(v21.length);
    expect(v21.length).toBeLessThan(v22.length);
  });

  it('does not include 2.2-only criteria in 2.1', () => {
    const v21 = filterCriteria('2.1', 'AA');
    const v21Ids = v21.map((c) => c.id);
    expect(v21Ids).not.toContain('2.4.11');
    expect(v21Ids).not.toContain('2.5.7');
    expect(v21Ids).not.toContain('3.2.6');
  });

  it('every criterion has required fields', () => {
    for (const c of WCAG_CRITERIA) {
      expect(c.id).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(['A', 'AA', 'AAA']).toContain(c.level);
      expect(c.principle).toBeTruthy();
      expect(Array.isArray(c.axeRules)).toBe(true);
      expect(['full', 'partial', 'manual']).toContain(c.automation);
      expect(c.manualCheck).toBeTruthy();
      expect(c.versions.length).toBeGreaterThan(0);
    }
  });
});

describe('axeRuleToWcag', () => {
  it('maps image-alt to 1.1.1', () => {
    const criteria = axeRuleToWcag('image-alt');
    expect(criteria.some((c) => c.id === '1.1.1')).toBe(true);
  });

  it('maps color-contrast to 1.4.3', () => {
    const criteria = axeRuleToWcag('color-contrast');
    expect(criteria.some((c) => c.id === '1.4.3')).toBe(true);
  });

  it('maps html-has-lang to 3.1.1', () => {
    const criteria = axeRuleToWcag('html-has-lang');
    expect(criteria.some((c) => c.id === '3.1.1')).toBe(true);
  });

  it('maps button-name to 4.1.2', () => {
    const criteria = axeRuleToWcag('button-name');
    expect(criteria.some((c) => c.id === '4.1.2')).toBe(true);
  });

  it('returns empty array for unknown rule', () => {
    expect(axeRuleToWcag('nonexistent-rule')).toEqual([]);
  });
});

describe('isCriterionRelevant', () => {
  it('returns true when no relevantWhen is specified', () => {
    const criterion = WCAG_CRITERIA.find((c) => c.id === '1.3.2')!;
    expect(criterion.relevantWhen).toBeUndefined();
    expect(isCriterionRelevant(criterion, {})).toBe(true);
  });

  it('returns true when matching page element exists', () => {
    const criterion = WCAG_CRITERIA.find((c) => c.id === '1.2.1')!;
    expect(isCriterionRelevant(criterion, { hasAudio: true, hasVideo: false })).toBe(true);
  });

  it('returns false when no matching page elements exist', () => {
    const criterion = WCAG_CRITERIA.find((c) => c.id === '1.2.1')!;
    expect(isCriterionRelevant(criterion, { hasAudio: false, hasVideo: false })).toBe(false);
  });

  it('returns false for video criteria when page has no video', () => {
    const criterion = WCAG_CRITERIA.find((c) => c.id === '1.2.4')!;
    expect(isCriterionRelevant(criterion, { hasVideo: false })).toBe(false);
  });

  it('returns true for form criteria when page has forms', () => {
    const criterion = WCAG_CRITERIA.find((c) => c.id === '3.3.1')!;
    expect(isCriterionRelevant(criterion, { hasForms: true })).toBe(true);
  });
});

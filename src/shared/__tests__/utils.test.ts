import { describe, it, expect } from 'vitest';
import { criterionSlug } from '../utils';

describe('criterionSlug', () => {
  it('converts "1.1.1" + "Non-text Content" to "1-1-1-non-text-content"', () => {
    expect(criterionSlug('1.1.1', 'Non-text Content')).toBe('1-1-1-non-text-content');
  });

  it('converts "1.4.3" + "Contrast (Minimum)" to "1-4-3-contrast-minimum"', () => {
    expect(criterionSlug('1.4.3', 'Contrast (Minimum)')).toBe('1-4-3-contrast-minimum');
  });

  it('converts "2.4.4" + "Link Purpose (In Context)" to "2-4-4-link-purpose-in-context"', () => {
    expect(criterionSlug('2.4.4', 'Link Purpose (In Context)')).toBe('2-4-4-link-purpose-in-context');
  });

  it('converts "4.1.2" + "Name, Role, Value" to "4-1-2-name-role-value"', () => {
    expect(criterionSlug('4.1.2', 'Name, Role, Value')).toBe('4-1-2-name-role-value');
  });

  it('handles empty name by returning just the ID part', () => {
    expect(criterionSlug('1.1.1', '')).toBe('1-1-1-');
  });

  it('strips special characters from name', () => {
    expect(criterionSlug('3.3.8', 'Accessible Authentication (Minimum)')).toBe(
      '3-3-8-accessible-authentication-minimum'
    );
  });

  it('collapses consecutive special characters into a single hyphen', () => {
    expect(criterionSlug('1.2.3', 'Audio Description or Media Alternative (Prerecorded)')).toBe(
      '1-2-3-audio-description-or-media-alternative-prerecorded'
    );
  });

  it('strips leading and trailing hyphens from name portion', () => {
    expect(criterionSlug('2.5.8', '(Target Size)')).toBe('2-5-8-target-size');
  });

  it('handles name with numbers', () => {
    expect(criterionSlug('2.2.1', 'Timing 2x Adjustable')).toBe('2-2-1-timing-2x-adjustable');
  });

  it('handles ID with two-digit sub-parts', () => {
    expect(criterionSlug('1.4.12', 'Text Spacing')).toBe('1-4-12-text-spacing');
  });
});

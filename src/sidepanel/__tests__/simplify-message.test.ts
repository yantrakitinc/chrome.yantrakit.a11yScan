import { describe, it, expect } from 'vitest';
import { simplifyMessage } from '../render-results';

describe('simplifyMessage', () => {
  it('simplifies color contrast messages', () => {
    const input =
      'Fix any of the following:\n Element has insufficient color contrast of 2.53 (foreground color: #9f9fa9, background color: #fbfbfb, font size: 12.0pt (16px), font weight: bold). Expected contrast ratio of 4.5:1';
    expect(simplifyMessage(input)).toBe('Contrast 2.53:1 (needs 4.5:1). Text #9f9fa9 on #fbfbfb');
  });

  it('simplifies missing alt attribute message', () => {
    const input = 'Fix any of the following:\n Element does not have an alt attribute';
    expect(simplifyMessage(input)).toBe('Missing alt attribute');
  });

  it('simplifies alt attribute not present message', () => {
    const input = "Fix any of the following:\n Element's alt attribute is not present";
    expect(simplifyMessage(input)).toBe('Missing alt attribute');
  });

  it('simplifies missing form label (implicit or explicit)', () => {
    const input =
      'Fix all of the following:\n Form element does not have an implicit or explicit label';
    expect(simplifyMessage(input)).toBe('Missing form label');
  });

  it('simplifies missing form label (generic)', () => {
    const input = 'Fix any of the following:\n Form element does not have a visible label';
    expect(simplifyMessage(input)).toBe('Missing form label');
  });

  it('simplifies heading order invalid message', () => {
    const input = 'Fix any of the following:\n Heading order invalid';
    expect(simplifyMessage(input)).toBe('Heading level skipped');
  });

  it('simplifies heading levels should only increase by one', () => {
    const input =
      'Fix any of the following:\n Heading levels should only increase by one';
    expect(simplifyMessage(input)).toBe('Heading level skipped');
  });

  it('strips "Fix any of the following" prefix for unrecognized messages', () => {
    const input = 'Fix any of the following:\n Some random message';
    expect(simplifyMessage(input)).toBe('Some random message');
  });

  it('strips "Fix all of the following" prefix for unrecognized messages', () => {
    const input = 'Fix all of the following:\n Another random message';
    expect(simplifyMessage(input)).toBe('Another random message');
  });

  it('returns empty string for empty input', () => {
    expect(simplifyMessage('')).toBe('');
  });

  it('returns string as-is when no prefix is present', () => {
    expect(simplifyMessage('No prefix here')).toBe('No prefix here');
  });

  it('handles color contrast with different ratio values', () => {
    const input =
      'Fix any of the following:\n Element has insufficient color contrast of 1.07 (foreground color: #ffffff, background color: #f0f0f0, font size: 14.0pt (18.7px), font weight: normal). Expected contrast ratio of 3:1';
    expect(simplifyMessage(input)).toBe('Contrast 1.07:1 (needs 3:1). Text #ffffff on #f0f0f0');
  });
});

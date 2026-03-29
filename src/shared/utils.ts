/**
 * Shared utility functions for the A11y Scan extension.
 */

/**
 * Builds a URL-friendly slug from a WCAG criterion ID and name.
 * Example: criterionSlug("1.1.1", "Non-text Content") => "1-1-1-non-text-content"
 */
export function criterionSlug(id: string, name: string): string {
  return id.replace(/\./g, '-') + '-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

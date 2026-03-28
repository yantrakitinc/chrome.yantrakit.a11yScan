export interface iWcagCriterion {
  id: string;
  name: string;
  level: 'A' | 'AA' | 'AAA';
  principle: string;
  axeRules: string[];
  automation: 'full' | 'partial' | 'manual';
  manualCheck: string;
  versions: ('2.0' | '2.1' | '2.2')[];
  relevantWhen?: string[];
}

/**
 * Checks if a manual criterion is likely relevant based on detected page elements.
 * If relevantWhen is undefined, the criterion is always relevant.
 */
export function isCriterionRelevant(
  criterion: iWcagCriterion,
  pageElements: Record<string, boolean>
): boolean {
  if (!criterion.relevantWhen || criterion.relevantWhen.length === 0) return true;
  return criterion.relevantWhen.some((key) => pageElements[key] === true);
}

export const WCAG_CRITERIA: iWcagCriterion[] = [
  // Principle 1: Perceivable
  { id: '1.1.1', name: 'Non-text Content', level: 'A', principle: 'Perceivable', axeRules: ['image-alt', 'input-image-alt', 'object-alt', 'role-img-alt', 'svg-img-alt', 'area-alt'], automation: 'partial', manualCheck: 'Verify alt text accurately describes image content. Check decorative images have empty alt.', versions: ['2.0', '2.1', '2.2'] },
  { id: '1.2.1', name: 'Audio-only and Video-only (Prerecorded)', level: 'A', principle: 'Perceivable', axeRules: [], automation: 'manual', manualCheck: 'Verify prerecorded audio has a transcript. Verify prerecorded video-only has audio description or text alternative.', versions: ['2.0', '2.1', '2.2'], relevantWhen: ['hasAudio', 'hasVideo'] },
  { id: '1.2.2', name: 'Captions (Prerecorded)', level: 'A', principle: 'Perceivable', axeRules: ['video-caption'], automation: 'partial', manualCheck: 'Verify captions are accurate, synchronized, and include speaker identification and sound effects.', versions: ['2.0', '2.1', '2.2'] },
  { id: '1.2.3', name: 'Audio Description or Media Alternative (Prerecorded)', level: 'A', principle: 'Perceivable', axeRules: [], automation: 'manual', manualCheck: 'Verify video has audio description or full text transcript covering visual content.', versions: ['2.0', '2.1', '2.2'], relevantWhen: ['hasVideo'] },
  { id: '1.2.4', name: 'Captions (Live)', level: 'AA', principle: 'Perceivable', axeRules: [], automation: 'manual', manualCheck: 'Verify live video streams have real-time captions.', versions: ['2.0', '2.1', '2.2'], relevantWhen: ['hasVideo'] },
  { id: '1.2.5', name: 'Audio Description (Prerecorded)', level: 'AA', principle: 'Perceivable', axeRules: [], automation: 'manual', manualCheck: 'Verify prerecorded video has audio description for visual-only information.', versions: ['2.0', '2.1', '2.2'], relevantWhen: ['hasVideo'] },
  { id: '1.3.1', name: 'Info and Relationships', level: 'A', principle: 'Perceivable', axeRules: ['aria-required-children', 'aria-required-parent', 'definition-list', 'dlitem', 'list', 'listitem', 'td-headers-attr', 'th-has-data-cells', 'heading-order'], automation: 'partial', manualCheck: 'Verify information conveyed through presentation is also available programmatically. Check headings, lists, and tables use proper semantic markup.', versions: ['2.0', '2.1', '2.2'] },
  { id: '1.3.2', name: 'Meaningful Sequence', level: 'A', principle: 'Perceivable', axeRules: [], automation: 'manual', manualCheck: 'Verify DOM order matches visual reading order. Check CSS reordering does not break logical sequence.', versions: ['2.0', '2.1', '2.2'] },
  { id: '1.3.3', name: 'Sensory Characteristics', level: 'A', principle: 'Perceivable', axeRules: [], automation: 'manual', manualCheck: 'Verify instructions do not rely solely on shape, size, visual location, orientation, or sound.', versions: ['2.0', '2.1', '2.2'] },
  { id: '1.3.4', name: 'Orientation', level: 'AA', principle: 'Perceivable', axeRules: ['css-orientation-lock'], automation: 'partial', manualCheck: 'Verify content is not restricted to a single display orientation unless essential.', versions: ['2.1', '2.2'] },
  { id: '1.3.5', name: 'Identify Input Purpose', level: 'AA', principle: 'Perceivable', axeRules: ['autocomplete-valid'], automation: 'partial', manualCheck: 'Verify input fields collecting personal data have appropriate autocomplete attributes.', versions: ['2.1', '2.2'] },
  { id: '1.4.1', name: 'Use of Color', level: 'A', principle: 'Perceivable', axeRules: ['link-in-text-block'], automation: 'partial', manualCheck: 'Verify color is not the only visual means of conveying information, indicating actions, or distinguishing elements.', versions: ['2.0', '2.1', '2.2'] },
  { id: '1.4.2', name: 'Audio Control', level: 'A', principle: 'Perceivable', axeRules: ['no-autoplay-audio'], automation: 'partial', manualCheck: 'Verify auto-playing audio lasting >3 seconds has pause, stop, or volume controls.', versions: ['2.0', '2.1', '2.2'] },
  { id: '1.4.3', name: 'Contrast (Minimum)', level: 'AA', principle: 'Perceivable', axeRules: ['color-contrast'], automation: 'partial', manualCheck: 'Verify text contrast is 4.5:1 for normal text, 3:1 for large text. Check text over images and gradients manually.', versions: ['2.0', '2.1', '2.2'] },
  { id: '1.4.4', name: 'Resize Text', level: 'AA', principle: 'Perceivable', axeRules: ['meta-viewport'], automation: 'partial', manualCheck: 'Verify text can be resized up to 200% without loss of content or functionality.', versions: ['2.0', '2.1', '2.2'] },
  { id: '1.4.5', name: 'Images of Text', level: 'AA', principle: 'Perceivable', axeRules: [], automation: 'manual', manualCheck: 'Verify text is used instead of images of text, except for logos or where presentation is essential.', versions: ['2.0', '2.1', '2.2'], relevantWhen: ['hasImages'] },
  { id: '1.4.10', name: 'Reflow', level: 'AA', principle: 'Perceivable', axeRules: [], automation: 'manual', manualCheck: 'Verify content reflows at 320px width (400% zoom) without horizontal scrolling.', versions: ['2.1', '2.2'] },
  { id: '1.4.11', name: 'Non-text Contrast', level: 'AA', principle: 'Perceivable', axeRules: [], automation: 'manual', manualCheck: 'Verify UI components and graphical objects have at least 3:1 contrast ratio against adjacent colors.', versions: ['2.1', '2.2'] },
  { id: '1.4.12', name: 'Text Spacing', level: 'AA', principle: 'Perceivable', axeRules: ['avoid-inline-spacing'], automation: 'partial', manualCheck: 'Verify content does not break when text spacing is increased (line-height 1.5x, letter-spacing 0.12em, word-spacing 0.16em, paragraph-spacing 2x).', versions: ['2.1', '2.2'] },
  { id: '1.4.13', name: 'Content on Hover or Focus', level: 'AA', principle: 'Perceivable', axeRules: [], automation: 'manual', manualCheck: 'Verify hover/focus content is dismissible, hoverable, and persistent.', versions: ['2.1', '2.2'] },

  // Principle 2: Operable
  { id: '2.1.1', name: 'Keyboard', level: 'A', principle: 'Operable', axeRules: ['scrollable-region-focusable', 'server-side-image-map'], automation: 'partial', manualCheck: 'Verify all functionality is operable through keyboard alone.', versions: ['2.0', '2.1', '2.2'] },
  { id: '2.1.2', name: 'No Keyboard Trap', level: 'A', principle: 'Operable', axeRules: [], automation: 'manual', manualCheck: 'Verify focus can be moved away from every component using keyboard only.', versions: ['2.0', '2.1', '2.2'] },
  { id: '2.1.4', name: 'Character Key Shortcuts', level: 'A', principle: 'Operable', axeRules: [], automation: 'manual', manualCheck: 'Verify single character key shortcuts can be turned off, remapped, or are only active on focus.', versions: ['2.1', '2.2'] },
  { id: '2.2.1', name: 'Timing Adjustable', level: 'A', principle: 'Operable', axeRules: ['meta-refresh'], automation: 'partial', manualCheck: 'Verify time limits can be turned off, adjusted, or extended.', versions: ['2.0', '2.1', '2.2'] },
  { id: '2.2.2', name: 'Pause, Stop, Hide', level: 'A', principle: 'Operable', axeRules: ['blink', 'marquee'], automation: 'partial', manualCheck: 'Verify moving, blinking, or auto-updating content can be paused, stopped, or hidden.', versions: ['2.0', '2.1', '2.2'] },
  { id: '2.3.1', name: 'Three Flashes or Below Threshold', level: 'A', principle: 'Operable', axeRules: [], automation: 'manual', manualCheck: 'Verify no content flashes more than 3 times per second.', versions: ['2.0', '2.1', '2.2'], relevantWhen: ['hasAnimation', 'hasVideo'] },
  { id: '2.4.1', name: 'Bypass Blocks', level: 'A', principle: 'Operable', axeRules: ['bypass', 'landmark-one-main', 'region'], automation: 'partial', manualCheck: 'Verify a mechanism exists to bypass repeated content blocks (skip link, landmarks).', versions: ['2.0', '2.1', '2.2'] },
  { id: '2.4.2', name: 'Page Titled', level: 'A', principle: 'Operable', axeRules: ['document-title'], automation: 'full', manualCheck: 'Verify page has a descriptive title.', versions: ['2.0', '2.1', '2.2'] },
  { id: '2.4.3', name: 'Focus Order', level: 'A', principle: 'Operable', axeRules: [], automation: 'manual', manualCheck: 'Verify focus order preserves meaning and operability. Tab through entire page.', versions: ['2.0', '2.1', '2.2'] },
  { id: '2.4.4', name: 'Link Purpose (In Context)', level: 'A', principle: 'Operable', axeRules: ['link-name', 'area-alt'], automation: 'partial', manualCheck: 'Verify link text describes the purpose of each link, in context of surrounding text.', versions: ['2.0', '2.1', '2.2'] },
  { id: '2.4.5', name: 'Multiple Ways', level: 'AA', principle: 'Operable', axeRules: [], automation: 'manual', manualCheck: 'Verify more than one way to locate a page (sitemap, search, navigation, links).', versions: ['2.0', '2.1', '2.2'] },
  { id: '2.4.6', name: 'Headings and Labels', level: 'AA', principle: 'Operable', axeRules: ['empty-heading'], automation: 'partial', manualCheck: 'Verify headings and labels describe their topic or purpose. Check for empty or non-descriptive headings.', versions: ['2.0', '2.1', '2.2'] },
  { id: '2.4.7', name: 'Focus Visible', level: 'AA', principle: 'Operable', axeRules: [], automation: 'manual', manualCheck: 'Verify keyboard focus indicator is visible on all interactive elements.', versions: ['2.0', '2.1', '2.2'] },
  { id: '2.4.11', name: 'Focus Not Obscured (Minimum)', level: 'AA', principle: 'Operable', axeRules: [], automation: 'manual', manualCheck: 'Verify focused element is not entirely hidden by other content (sticky headers, modals).', versions: ['2.2'] },
  { id: '2.5.1', name: 'Pointer Gestures', level: 'A', principle: 'Operable', axeRules: [], automation: 'manual', manualCheck: 'Verify multipoint or path-based gestures have single-pointer alternatives.', versions: ['2.1', '2.2'] },
  { id: '2.5.2', name: 'Pointer Cancellation', level: 'A', principle: 'Operable', axeRules: [], automation: 'manual', manualCheck: 'Verify actions use up-event, can be aborted, or can be undone.', versions: ['2.1', '2.2'] },
  { id: '2.5.3', name: 'Label in Name', level: 'A', principle: 'Operable', axeRules: ['label-content-name-mismatch'], automation: 'partial', manualCheck: 'Verify visible label text is included in the accessible name.', versions: ['2.1', '2.2'] },
  { id: '2.5.4', name: 'Motion Actuation', level: 'A', principle: 'Operable', axeRules: [], automation: 'manual', manualCheck: 'Verify motion-triggered functions have UI alternatives and can be disabled.', versions: ['2.1', '2.2'] },
  { id: '2.5.7', name: 'Dragging Movements', level: 'AA', principle: 'Operable', axeRules: [], automation: 'manual', manualCheck: 'Verify drag operations have single-pointer alternatives (click, tap).', versions: ['2.2'], relevantWhen: ['hasDragDrop'] },
  { id: '2.5.8', name: 'Target Size (Minimum)', level: 'AA', principle: 'Operable', axeRules: ['target-size'], automation: 'partial', manualCheck: 'Verify interactive targets are at least 24x24 CSS pixels or have sufficient spacing.', versions: ['2.2'] },

  // Principle 3: Understandable
  { id: '3.1.1', name: 'Language of Page', level: 'A', principle: 'Understandable', axeRules: ['html-has-lang', 'html-lang-valid', 'html-xml-lang-mismatch'], automation: 'full', manualCheck: 'Verify lang attribute matches the primary language of the page.', versions: ['2.0', '2.1', '2.2'] },
  { id: '3.1.2', name: 'Language of Parts', level: 'AA', principle: 'Understandable', axeRules: ['valid-lang'], automation: 'partial', manualCheck: 'Verify content in a different language has a lang attribute on the containing element.', versions: ['2.0', '2.1', '2.2'] },
  { id: '3.2.1', name: 'On Focus', level: 'A', principle: 'Understandable', axeRules: [], automation: 'manual', manualCheck: 'Verify focusing an element does not trigger unexpected context changes.', versions: ['2.0', '2.1', '2.2'] },
  { id: '3.2.2', name: 'On Input', level: 'A', principle: 'Understandable', axeRules: [], automation: 'manual', manualCheck: 'Verify changing a form control does not trigger unexpected context changes without advance notice.', versions: ['2.0', '2.1', '2.2'], relevantWhen: ['hasForms'] },
  { id: '3.2.3', name: 'Consistent Navigation', level: 'AA', principle: 'Understandable', axeRules: [], automation: 'manual', manualCheck: 'Verify navigation menus appear in the same relative order across pages.', versions: ['2.0', '2.1', '2.2'] },
  { id: '3.2.4', name: 'Consistent Identification', level: 'AA', principle: 'Understandable', axeRules: [], automation: 'manual', manualCheck: 'Verify components with same function are identified consistently across pages.', versions: ['2.0', '2.1', '2.2'] },
  { id: '3.2.6', name: 'Consistent Help', level: 'A', principle: 'Understandable', axeRules: [], automation: 'manual', manualCheck: 'Verify help mechanisms appear in consistent locations across pages.', versions: ['2.2'] },
  { id: '3.3.1', name: 'Error Identification', level: 'A', principle: 'Understandable', axeRules: [], automation: 'manual', manualCheck: 'Verify input errors are identified in text and described to the user.', versions: ['2.0', '2.1', '2.2'], relevantWhen: ['hasForms'] },
  { id: '3.3.2', name: 'Labels or Instructions', level: 'A', principle: 'Understandable', axeRules: ['label', 'form-field-multiple-labels'], automation: 'partial', manualCheck: 'Verify form fields have descriptive labels and instructions when needed.', versions: ['2.0', '2.1', '2.2'] },
  { id: '3.3.3', name: 'Error Suggestion', level: 'AA', principle: 'Understandable', axeRules: [], automation: 'manual', manualCheck: 'Verify error messages suggest corrections when possible.', versions: ['2.0', '2.1', '2.2'], relevantWhen: ['hasForms'] },
  { id: '3.3.4', name: 'Error Prevention (Legal, Financial, Data)', level: 'AA', principle: 'Understandable', axeRules: [], automation: 'manual', manualCheck: 'Verify legal/financial submissions are reversible, verified, or confirmable.', versions: ['2.0', '2.1', '2.2'], relevantWhen: ['hasForms'] },
  { id: '3.3.7', name: 'Redundant Entry', level: 'A', principle: 'Understandable', axeRules: [], automation: 'manual', manualCheck: 'Verify previously entered information is auto-populated or available for selection.', versions: ['2.2'], relevantWhen: ['hasForms'] },
  { id: '3.3.8', name: 'Accessible Authentication (Minimum)', level: 'AA', principle: 'Understandable', axeRules: [], automation: 'manual', manualCheck: 'Verify login does not require cognitive function tests without alternatives.', versions: ['2.2'], relevantWhen: ['hasForms'] },

  // Principle 4: Robust
  { id: '4.1.2', name: 'Name, Role, Value', level: 'A', principle: 'Robust', axeRules: ['aria-allowed-attr', 'aria-command-name', 'aria-hidden-body', 'aria-hidden-focus', 'aria-input-field-name', 'aria-prohibited-attr', 'aria-required-attr', 'aria-roles', 'aria-toggle-field-name', 'aria-valid-attr-value', 'aria-valid-attr', 'button-name', 'frame-title', 'input-button-name', 'label', 'link-name', 'nested-interactive', 'select-name'], automation: 'partial', manualCheck: 'Verify all UI components have accessible names, roles, and states that can be programmatically determined.', versions: ['2.0', '2.1', '2.2'] },
  { id: '4.1.3', name: 'Status Messages', level: 'AA', principle: 'Robust', axeRules: [], automation: 'manual', manualCheck: 'Verify status messages use role="status", role="alert", or aria-live regions.', versions: ['2.1', '2.2'] },
];

/**
 * Filters WCAG criteria by version and level.
 */
export function filterCriteria(
  version: '2.0' | '2.1' | '2.2',
  level: 'A' | 'AA' | 'AAA'
): iWcagCriterion[] {
  const levels: string[] = ['A'];
  if (level === 'AA' || level === 'AAA') levels.push('AA');
  if (level === 'AAA') levels.push('AAA');

  return WCAG_CRITERIA.filter(
    (c) => c.versions.includes(version) && levels.includes(c.level)
  );
}

/**
 * Maps an axe-core rule ID to the WCAG criteria it tests.
 */
export function axeRuleToWcag(ruleId: string): iWcagCriterion[] {
  return WCAG_CRITERIA.filter((c) => c.axeRules.includes(ruleId));
}

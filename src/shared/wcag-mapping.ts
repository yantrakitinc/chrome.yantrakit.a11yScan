/**
 * WCAG criteria database with axe-core rule mappings.
 * Source of truth: /extension/docs/features/F09-manual-review.md
 * See also: /docs/WCAG-AXE-MAPPING.md
 */

export type iAutomation = "full" | "partial" | "manual";

export interface iWcagCriterion {
  id: string;
  name: string;
  level: "A" | "AA" | "AAA";
  principle: "perceivable" | "operable" | "understandable" | "robust";
  automation: iAutomation;
  axeRules: string[];
  manualCheck: string;
  versions: string[];
  relevantWhen?: keyof import("./types").iPageElements;
}

/**
 * Complete WCAG 2.2 criteria database.
 * 55 criteria with automation type partial or manual are used for manual review (F09).
 * 2 criteria with automation type full are handled entirely by axe-core.
 */
export const WCAG_CRITERIA: iWcagCriterion[] = [
  // ── Perceivable ──
  { id: "1.1.1", name: "Non-text Content", level: "A", principle: "perceivable", automation: "partial", axeRules: ["image-alt", "input-image-alt", "object-alt", "svg-img-alt", "role-img-alt", "area-alt"], manualCheck: "Verify alt text accurately describes image content. Check decorative images have empty alt.", versions: ["2.0", "2.1", "2.2"] },
  { id: "1.2.1", name: "Audio-only and Video-only (Prerecorded)", level: "A", principle: "perceivable", automation: "manual", axeRules: [], manualCheck: "Verify prerecorded audio has a transcript. Verify prerecorded video-only has audio description or text alternative.", versions: ["2.0", "2.1", "2.2"], relevantWhen: "hasAudio" },
  { id: "1.2.2", name: "Captions (Prerecorded)", level: "A", principle: "perceivable", automation: "partial", axeRules: ["video-caption"], manualCheck: "Verify captions are accurate, synchronized, and include speaker identification and sound effects.", versions: ["2.0", "2.1", "2.2"] },
  { id: "1.2.3", name: "Audio Description or Media Alternative", level: "A", principle: "perceivable", automation: "manual", axeRules: [], manualCheck: "Verify video has audio description or full text transcript covering visual content.", versions: ["2.0", "2.1", "2.2"], relevantWhen: "hasVideo" },
  { id: "1.2.4", name: "Captions (Live)", level: "AA", principle: "perceivable", automation: "manual", axeRules: [], manualCheck: "Verify live video streams have real-time captions.", versions: ["2.0", "2.1", "2.2"], relevantWhen: "hasVideo" },
  { id: "1.2.5", name: "Audio Description (Prerecorded)", level: "AA", principle: "perceivable", automation: "manual", axeRules: [], manualCheck: "Verify prerecorded video has audio description for visual-only information.", versions: ["2.0", "2.1", "2.2"], relevantWhen: "hasVideo" },
  { id: "1.3.1", name: "Info and Relationships", level: "A", principle: "perceivable", automation: "partial", axeRules: ["aria-required-parent", "aria-required-children", "definition-list", "dlitem", "list", "listitem", "table-fake-caption", "td-has-header", "th-has-data-cells", "label"], manualCheck: "Verify information conveyed through presentation is also available programmatically.", versions: ["2.0", "2.1", "2.2"] },
  { id: "1.3.2", name: "Meaningful Sequence", level: "A", principle: "perceivable", automation: "manual", axeRules: [], manualCheck: "Verify DOM order matches visual reading order.", versions: ["2.0", "2.1", "2.2"] },
  { id: "1.3.3", name: "Sensory Characteristics", level: "A", principle: "perceivable", automation: "manual", axeRules: [], manualCheck: "Verify instructions do not rely solely on shape, size, visual location, orientation, or sound.", versions: ["2.0", "2.1", "2.2"] },
  { id: "1.3.4", name: "Orientation", level: "AA", principle: "perceivable", automation: "partial", axeRules: ["css-orientation-lock"], manualCheck: "Verify content is not restricted to a single display orientation.", versions: ["2.1", "2.2"] },
  { id: "1.3.5", name: "Identify Input Purpose", level: "AA", principle: "perceivable", automation: "partial", axeRules: ["autocomplete-valid"], manualCheck: "Verify input fields collecting personal data have appropriate autocomplete attributes.", versions: ["2.1", "2.2"] },
  { id: "1.4.1", name: "Use of Color", level: "A", principle: "perceivable", automation: "partial", axeRules: [], manualCheck: "Verify color is not the only visual means of conveying information.", versions: ["2.0", "2.1", "2.2"] },
  { id: "1.4.2", name: "Audio Control", level: "A", principle: "perceivable", automation: "partial", axeRules: ["no-autoplay-audio"], manualCheck: "Verify auto-playing audio lasting >3 seconds has pause, stop, or volume controls.", versions: ["2.0", "2.1", "2.2"] },
  { id: "1.4.3", name: "Contrast (Minimum)", level: "AA", principle: "perceivable", automation: "partial", axeRules: ["color-contrast"], manualCheck: "Verify text contrast is 4.5:1 for normal text, 3:1 for large text.", versions: ["2.0", "2.1", "2.2"] },
  { id: "1.4.4", name: "Resize Text", level: "AA", principle: "perceivable", automation: "partial", axeRules: ["meta-viewport"], manualCheck: "Verify text can be resized up to 200% without loss of content or functionality.", versions: ["2.0", "2.1", "2.2"] },
  { id: "1.4.5", name: "Images of Text", level: "AA", principle: "perceivable", automation: "manual", axeRules: [], manualCheck: "Verify text is used instead of images of text, except for logos.", versions: ["2.0", "2.1", "2.2"], relevantWhen: "hasImages" },
  { id: "1.4.10", name: "Reflow", level: "AA", principle: "perceivable", automation: "manual", axeRules: [], manualCheck: "Verify content reflows at 320px width without horizontal scrolling.", versions: ["2.1", "2.2"] },
  { id: "1.4.11", name: "Non-text Contrast", level: "AA", principle: "perceivable", automation: "manual", axeRules: [], manualCheck: "Verify UI components and graphical objects have at least 3:1 contrast ratio.", versions: ["2.1", "2.2"] },
  { id: "1.4.12", name: "Text Spacing", level: "AA", principle: "perceivable", automation: "partial", axeRules: ["avoid-inline-spacing"], manualCheck: "Verify content does not break when text spacing is increased.", versions: ["2.1", "2.2"] },
  { id: "1.4.13", name: "Content on Hover or Focus", level: "AA", principle: "perceivable", automation: "manual", axeRules: [], manualCheck: "Verify hover/focus content is dismissible, hoverable, and persistent.", versions: ["2.1", "2.2"] },

  // ── Operable ──
  { id: "2.1.1", name: "Keyboard", level: "A", principle: "operable", automation: "partial", axeRules: ["scrollable-region-focusable"], manualCheck: "Verify all functionality is operable through keyboard alone.", versions: ["2.0", "2.1", "2.2"] },
  { id: "2.1.2", name: "No Keyboard Trap", level: "A", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify focus can be moved away from every component using keyboard only.", versions: ["2.0", "2.1", "2.2"] },
  { id: "2.1.4", name: "Character Key Shortcuts", level: "A", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify single character key shortcuts can be turned off, remapped, or are only active on focus.", versions: ["2.1", "2.2"] },
  { id: "2.2.1", name: "Timing Adjustable", level: "A", principle: "operable", automation: "partial", axeRules: ["meta-refresh"], manualCheck: "Verify time limits can be turned off, adjusted, or extended.", versions: ["2.0", "2.1", "2.2"] },
  { id: "2.2.2", name: "Pause, Stop, Hide", level: "A", principle: "operable", automation: "partial", axeRules: ["marquee"], manualCheck: "Verify moving, blinking, or auto-updating content can be paused, stopped, or hidden.", versions: ["2.0", "2.1", "2.2"] },
  { id: "2.3.1", name: "Three Flashes or Below Threshold", level: "A", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify no content flashes more than 3 times per second.", versions: ["2.0", "2.1", "2.2"], relevantWhen: "hasAnimation" },
  { id: "2.4.1", name: "Bypass Blocks", level: "A", principle: "operable", automation: "partial", axeRules: ["bypass", "region"], manualCheck: "Verify a mechanism exists to bypass repeated content blocks.", versions: ["2.0", "2.1", "2.2"] },
  { id: "2.4.2", name: "Page Titled", level: "A", principle: "operable", automation: "full", axeRules: ["document-title"], manualCheck: "", versions: ["2.0", "2.1", "2.2"] },
  { id: "2.4.3", name: "Focus Order", level: "A", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify focus order preserves meaning and operability.", versions: ["2.0", "2.1", "2.2"] },
  { id: "2.4.4", name: "Link Purpose (In Context)", level: "A", principle: "operable", automation: "partial", axeRules: ["link-name"], manualCheck: "Verify link text describes the purpose of each link.", versions: ["2.0", "2.1", "2.2"] },
  { id: "2.4.5", name: "Multiple Ways", level: "AA", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify more than one way to locate a page.", versions: ["2.0", "2.1", "2.2"] },
  { id: "2.4.6", name: "Headings and Labels", level: "AA", principle: "operable", automation: "partial", axeRules: ["empty-heading"], manualCheck: "Verify headings and labels describe their topic or purpose.", versions: ["2.0", "2.1", "2.2"] },
  { id: "2.4.7", name: "Focus Visible", level: "AA", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify keyboard focus indicator is visible on all interactive elements.", versions: ["2.0", "2.1", "2.2"] },
  { id: "2.4.11", name: "Focus Not Obscured (Minimum)", level: "AA", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify focused element is not entirely hidden by other content.", versions: ["2.2"] },
  { id: "2.5.1", name: "Pointer Gestures", level: "A", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify multipoint or path-based gestures have single-pointer alternatives.", versions: ["2.1", "2.2"] },
  { id: "2.5.2", name: "Pointer Cancellation", level: "A", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify actions use up-event, can be aborted, or can be undone.", versions: ["2.1", "2.2"] },
  { id: "2.5.3", name: "Label in Name", level: "A", principle: "operable", automation: "partial", axeRules: ["label-content-name-mismatch"], manualCheck: "Verify visible label text is included in the accessible name.", versions: ["2.1", "2.2"] },
  { id: "2.5.4", name: "Motion Actuation", level: "A", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify motion-triggered functions have UI alternatives and can be disabled.", versions: ["2.1", "2.2"] },
  { id: "2.5.7", name: "Dragging Movements", level: "AA", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify drag operations have single-pointer alternatives.", versions: ["2.2"], relevantWhen: "hasDragDrop" },
  { id: "2.5.8", name: "Target Size (Minimum)", level: "AA", principle: "operable", automation: "partial", axeRules: ["target-size"], manualCheck: "Verify interactive targets are at least 24x24 CSS pixels.", versions: ["2.2"] },

  // ── Understandable ──
  { id: "3.1.1", name: "Language of Page", level: "A", principle: "understandable", automation: "full", axeRules: ["html-has-lang", "html-lang-valid"], manualCheck: "", versions: ["2.0", "2.1", "2.2"] },
  { id: "3.1.2", name: "Language of Parts", level: "AA", principle: "understandable", automation: "partial", axeRules: ["valid-lang"], manualCheck: "Verify content in a different language has a lang attribute.", versions: ["2.0", "2.1", "2.2"] },
  { id: "3.2.1", name: "On Focus", level: "A", principle: "understandable", automation: "manual", axeRules: [], manualCheck: "Verify focusing an element does not trigger unexpected context changes.", versions: ["2.0", "2.1", "2.2"] },
  { id: "3.2.2", name: "On Input", level: "A", principle: "understandable", automation: "manual", axeRules: [], manualCheck: "Verify changing a form control does not trigger unexpected context changes.", versions: ["2.0", "2.1", "2.2"], relevantWhen: "hasForms" },
  { id: "3.2.3", name: "Consistent Navigation", level: "AA", principle: "understandable", automation: "manual", axeRules: [], manualCheck: "Verify navigation menus appear in the same relative order across pages.", versions: ["2.0", "2.1", "2.2"] },
  { id: "3.2.4", name: "Consistent Identification", level: "AA", principle: "understandable", automation: "manual", axeRules: [], manualCheck: "Verify components with same function are identified consistently across pages.", versions: ["2.0", "2.1", "2.2"] },
  { id: "3.2.6", name: "Consistent Help", level: "A", principle: "understandable", automation: "manual", axeRules: [], manualCheck: "Verify help mechanisms appear in consistent locations across pages.", versions: ["2.2"] },
  { id: "3.3.1", name: "Error Identification", level: "A", principle: "understandable", automation: "manual", axeRules: [], manualCheck: "Verify input errors are identified in text and described to the user.", versions: ["2.0", "2.1", "2.2"], relevantWhen: "hasForms" },
  { id: "3.3.2", name: "Labels or Instructions", level: "A", principle: "understandable", automation: "partial", axeRules: ["label"], manualCheck: "Verify form fields have descriptive labels and instructions.", versions: ["2.0", "2.1", "2.2"] },
  { id: "3.3.3", name: "Error Suggestion", level: "AA", principle: "understandable", automation: "manual", axeRules: [], manualCheck: "Verify error messages suggest corrections when possible.", versions: ["2.0", "2.1", "2.2"], relevantWhen: "hasForms" },
  { id: "3.3.4", name: "Error Prevention (Legal, Financial, Data)", level: "AA", principle: "understandable", automation: "manual", axeRules: [], manualCheck: "Verify legal/financial submissions are reversible, verified, or confirmable.", versions: ["2.0", "2.1", "2.2"], relevantWhen: "hasForms" },
  { id: "3.3.7", name: "Redundant Entry", level: "A", principle: "understandable", automation: "manual", axeRules: [], manualCheck: "Verify previously entered information is auto-populated or available for selection.", versions: ["2.2"], relevantWhen: "hasForms" },
  { id: "3.3.8", name: "Accessible Authentication (Minimum)", level: "AA", principle: "understandable", automation: "manual", axeRules: [], manualCheck: "Verify login does not require cognitive function tests without alternatives.", versions: ["2.2"], relevantWhen: "hasForms" },

  // ── Robust ──
  { id: "4.1.2", name: "Name, Role, Value", level: "A", principle: "robust", automation: "partial", axeRules: ["aria-allowed-attr", "aria-hidden-body", "aria-required-attr", "aria-roles", "aria-valid-attr", "aria-valid-attr-value", "button-name", "frame-title", "image-alt", "input-image-alt", "link-name", "select-name"], manualCheck: "Verify all UI components have accessible names, roles, and states.", versions: ["2.0", "2.1", "2.2"] },
  { id: "4.1.3", name: "Status Messages", level: "AA", principle: "robust", automation: "manual", axeRules: [], manualCheck: "Verify status messages use role=\"status\", role=\"alert\", or aria-live regions.", versions: ["2.1", "2.2"] },

  // ── AAA Level Criteria ──
  { id: "1.2.6", name: "Sign Language (Prerecorded)", level: "AAA", principle: "perceivable", automation: "manual", axeRules: [], manualCheck: "Verify sign language interpretation is provided for prerecorded audio content.", versions: ["2.0", "2.1", "2.2"], relevantWhen: "hasVideo" },
  { id: "1.2.7", name: "Extended Audio Description (Prerecorded)", level: "AAA", principle: "perceivable", automation: "manual", axeRules: [], manualCheck: "Verify extended audio description is provided when standard audio description is insufficient.", versions: ["2.0", "2.1", "2.2"], relevantWhen: "hasVideo" },
  { id: "1.2.8", name: "Media Alternative (Prerecorded)", level: "AAA", principle: "perceivable", automation: "manual", axeRules: [], manualCheck: "Verify a text alternative is provided for all prerecorded synchronized media.", versions: ["2.0", "2.1", "2.2"], relevantWhen: "hasVideo" },
  { id: "1.2.9", name: "Audio-only (Live)", level: "AAA", principle: "perceivable", automation: "manual", axeRules: [], manualCheck: "Verify a text alternative is provided for live audio-only content.", versions: ["2.0", "2.1", "2.2"], relevantWhen: "hasAudio" },
  { id: "1.3.6", name: "Identify Purpose", level: "AAA", principle: "perceivable", automation: "manual", axeRules: [], manualCheck: "Verify the purpose of UI components, icons, and regions can be programmatically determined.", versions: ["2.1", "2.2"] },
  { id: "1.4.6", name: "Contrast (Enhanced)", level: "AAA", principle: "perceivable", automation: "partial", axeRules: ["color-contrast-enhanced"], manualCheck: "Verify text contrast is 7:1 for normal text, 4.5:1 for large text.", versions: ["2.0", "2.1", "2.2"] },
  { id: "1.4.7", name: "Low or No Background Audio", level: "AAA", principle: "perceivable", automation: "manual", axeRules: [], manualCheck: "Verify prerecorded audio with speech has no or very low background sounds.", versions: ["2.0", "2.1", "2.2"], relevantWhen: "hasAudio" },
  { id: "1.4.8", name: "Visual Presentation", level: "AAA", principle: "perceivable", automation: "manual", axeRules: [], manualCheck: "Verify text blocks can have foreground/background colors selected by the user, line width ≤80 chars, not full-justified, line spacing ≥1.5, and text resizable to 200%.", versions: ["2.0", "2.1", "2.2"] },
  { id: "1.4.9", name: "Images of Text (No Exception)", level: "AAA", principle: "perceivable", automation: "manual", axeRules: [], manualCheck: "Verify images of text are only used for pure decoration or where presentation is essential.", versions: ["2.0", "2.1", "2.2"], relevantWhen: "hasImages" },
  { id: "2.1.3", name: "Keyboard (No Exception)", level: "AAA", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify ALL functionality is operable through keyboard with no exceptions.", versions: ["2.0", "2.1", "2.2"] },
  { id: "2.2.3", name: "No Timing", level: "AAA", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify timing is not an essential part of any activity, except real-time events.", versions: ["2.0", "2.1", "2.2"], relevantWhen: "hasTimeLimited" },
  { id: "2.2.4", name: "Interruptions", level: "AAA", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify interruptions can be postponed or suppressed by the user.", versions: ["2.0", "2.1", "2.2"] },
  { id: "2.2.5", name: "Re-authenticating", level: "AAA", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify user data is preserved when session expires and user re-authenticates.", versions: ["2.0", "2.1", "2.2"] },
  { id: "2.2.6", name: "Timeouts", level: "AAA", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify users are warned of data loss due to inactivity timeouts, or data is preserved for 20 hours.", versions: ["2.1", "2.2"] },
  { id: "2.3.2", name: "Three Flashes", level: "AAA", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify no content flashes more than 3 times per second.", versions: ["2.0", "2.1", "2.2"], relevantWhen: "hasAnimation" },
  { id: "2.3.3", name: "Animation from Interactions", level: "AAA", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify motion animation triggered by interaction can be disabled unless essential.", versions: ["2.1", "2.2"], relevantWhen: "hasAnimation" },
  { id: "2.4.8", name: "Location", level: "AAA", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify information about the user's location within a set of pages is available (breadcrumbs, site map).", versions: ["2.0", "2.1", "2.2"] },
  { id: "2.4.9", name: "Link Purpose (Link Only)", level: "AAA", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify the purpose of each link can be identified from the link text alone.", versions: ["2.0", "2.1", "2.2"] },
  { id: "2.4.10", name: "Section Headings", level: "AAA", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify section headings are used to organize content.", versions: ["2.0", "2.1", "2.2"], relevantWhen: "hasHeadings" },
  { id: "2.4.12", name: "Focus Not Obscured (Enhanced)", level: "AAA", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify no part of the focused element is hidden by other content.", versions: ["2.2"] },
  { id: "2.4.13", name: "Focus Appearance", level: "AAA", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify focus indicators have sufficient size (≥2px outline) and contrast (≥3:1).", versions: ["2.2"] },
  { id: "2.5.5", name: "Target Size (Enhanced)", level: "AAA", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify interactive targets are at least 44x44 CSS pixels.", versions: ["2.1", "2.2"] },
  { id: "2.5.6", name: "Concurrent Input Mechanisms", level: "AAA", principle: "operable", automation: "manual", axeRules: [], manualCheck: "Verify content does not restrict use of input modalities available on the platform.", versions: ["2.1", "2.2"] },
  { id: "3.1.3", name: "Unusual Words", level: "AAA", principle: "understandable", automation: "manual", axeRules: [], manualCheck: "Verify a mechanism is provided for identifying definitions of unusual words or phrases.", versions: ["2.0", "2.1", "2.2"] },
  { id: "3.1.4", name: "Abbreviations", level: "AAA", principle: "understandable", automation: "manual", axeRules: [], manualCheck: "Verify a mechanism is provided for identifying expanded forms of abbreviations.", versions: ["2.0", "2.1", "2.2"] },
  { id: "3.1.5", name: "Reading Level", level: "AAA", principle: "understandable", automation: "manual", axeRules: [], manualCheck: "Verify content readability does not require more than lower secondary education reading level, or supplemental content is provided.", versions: ["2.0", "2.1", "2.2"] },
  { id: "3.1.6", name: "Pronunciation", level: "AAA", principle: "understandable", automation: "manual", axeRules: [], manualCheck: "Verify a mechanism is provided for identifying pronunciation of words where meaning is ambiguous.", versions: ["2.0", "2.1", "2.2"] },
  { id: "3.2.5", name: "Change on Request", level: "AAA", principle: "understandable", automation: "manual", axeRules: [], manualCheck: "Verify changes of context are initiated only by user request, or a mechanism is provided to turn them off.", versions: ["2.0", "2.1", "2.2"] },
  { id: "3.3.5", name: "Help", level: "AAA", principle: "understandable", automation: "manual", axeRules: [], manualCheck: "Verify context-sensitive help is available for form inputs.", versions: ["2.0", "2.1", "2.2"], relevantWhen: "hasForms" },
  { id: "3.3.6", name: "Error Prevention (All)", level: "AAA", principle: "understandable", automation: "manual", axeRules: [], manualCheck: "Verify all form submissions are reversible, verified, or confirmable.", versions: ["2.0", "2.1", "2.2"], relevantWhen: "hasForms" },
  { id: "3.3.9", name: "Accessible Authentication (Enhanced)", level: "AAA", principle: "understandable", automation: "manual", axeRules: [], manualCheck: "Verify no cognitive function test is required for authentication, with no exceptions.", versions: ["2.2"], relevantWhen: "hasForms" },
];

/** WCAG criterion ID → website URL slug mapping (matches a11yscan.yantrakit.com/wcag/[slug]) */
export const WCAG_SLUG_MAP: Record<string, string> = {
  "1.1.1": "1-1-1-non-text-content", "1.2.1": "1-2-1-audio-only-video-only", "1.2.2": "1-2-2-captions-prerecorded",
  "1.2.3": "1-2-3-audio-description", "1.2.4": "1-2-4-captions-live", "1.2.5": "1-2-5-audio-description-prerecorded",
  "1.2.6": "1-2-6-sign-language-prerecorded", "1.2.7": "1-2-7-extended-audio-description", "1.2.8": "1-2-8-media-alternative-prerecorded",
  "1.2.9": "1-2-9-audio-only-live", "1.3.1": "1-3-1-info-and-relationships", "1.3.2": "1-3-2-meaningful-sequence",
  "1.3.3": "1-3-3-sensory-characteristics", "1.3.4": "1-3-4-orientation", "1.3.5": "1-3-5-identify-input-purpose",
  "1.3.6": "1-3-6-identify-purpose", "1.4.1": "1-4-1-use-of-color", "1.4.2": "1-4-2-audio-control",
  "1.4.3": "1-4-3-contrast-minimum", "1.4.4": "1-4-4-resize-text", "1.4.5": "1-4-5-images-of-text",
  "1.4.6": "1-4-6-contrast-enhanced", "1.4.7": "1-4-7-low-or-no-background-audio", "1.4.8": "1-4-8-visual-presentation",
  "1.4.9": "1-4-9-images-of-text-no-exception", "1.4.10": "1-4-10-reflow", "1.4.11": "1-4-11-non-text-contrast",
  "1.4.12": "1-4-12-text-spacing", "1.4.13": "1-4-13-content-on-hover-or-focus",
  "2.1.1": "2-1-1-keyboard", "2.1.2": "2-1-2-no-keyboard-trap", "2.1.3": "2-1-3-keyboard-no-exception",
  "2.1.4": "2-1-4-character-key-shortcuts", "2.2.1": "2-2-1-timing-adjustable", "2.2.2": "2-2-2-pause-stop-hide",
  "2.2.3": "2-2-3-no-timing", "2.2.4": "2-2-4-interruptions", "2.2.5": "2-2-5-re-authenticating",
  "2.2.6": "2-2-6-timeouts", "2.3.1": "2-3-1-three-flashes", "2.3.2": "2-3-2-three-flashes-no-threshold",
  "2.3.3": "2-3-3-animation-from-interactions", "2.4.1": "2-4-1-bypass-blocks", "2.4.2": "2-4-2-page-titled",
  "2.4.3": "2-4-3-focus-order", "2.4.4": "2-4-4-link-purpose-in-context", "2.4.5": "2-4-5-multiple-ways",
  "2.4.6": "2-4-6-headings-and-labels", "2.4.7": "2-4-7-focus-visible", "2.4.8": "2-4-8-location",
  "2.4.9": "2-4-9-link-purpose-link-only", "2.4.10": "2-4-10-section-headings", "2.4.11": "2-4-11-focus-not-obscured",
  "2.4.12": "2-4-12-focus-not-obscured-enhanced", "2.4.13": "2-4-13-focus-appearance",
  "2.5.1": "2-5-1-pointer-gestures", "2.5.2": "2-5-2-pointer-cancellation", "2.5.3": "2-5-3-label-in-name",
  "2.5.4": "2-5-4-motion-actuation", "2.5.5": "2-5-5-target-size-enhanced", "2.5.6": "2-5-6-concurrent-input-mechanisms",
  "2.5.7": "2-5-7-dragging-movements", "2.5.8": "2-5-8-target-size-minimum",
  "3.1.1": "3-1-1-language-of-page", "3.1.2": "3-1-2-language-of-parts", "3.1.3": "3-1-3-unusual-words",
  "3.1.4": "3-1-4-abbreviations", "3.1.5": "3-1-5-reading-level", "3.1.6": "3-1-6-pronunciation",
  "3.2.1": "3-2-1-on-focus", "3.2.2": "3-2-2-on-input", "3.2.3": "3-2-3-consistent-navigation",
  "3.2.4": "3-2-4-consistent-identification", "3.2.5": "3-2-5-change-on-request", "3.2.6": "3-2-6-consistent-help",
  "3.3.1": "3-3-1-error-identification", "3.3.2": "3-3-2-labels-or-instructions", "3.3.3": "3-3-3-error-suggestion",
  "3.3.4": "3-3-4-error-prevention", "3.3.5": "3-3-5-help", "3.3.6": "3-3-6-error-prevention-all",
  "3.3.7": "3-3-7-redundant-entry", "3.3.8": "3-3-8-accessible-authentication", "3.3.9": "3-3-9-accessible-authentication-enhanced",
  "4.1.2": "4-1-2-name-role-value", "4.1.3": "4-1-3-status-messages",
};

/** Get the website URL for a WCAG criterion */
export function getWcagUrl(criterionId: string): string {
  const slug = WCAG_SLUG_MAP[criterionId];
  return slug ? `https://a11yscan.yantrakit.com/wcag/${slug}` : `https://a11yscan.yantrakit.com/wcag`;
}

/** Filter criteria by WCAG version and level */
export function filterCriteria(version: string, level: string): iWcagCriterion[] {
  const levels = ["A", "AA", "AAA"];
  const levelIdx = levels.indexOf(level);
  return WCAG_CRITERIA.filter((c) => {
    if (levels.indexOf(c.level) > levelIdx) return false;
    return c.versions.includes(version);
  });
}

/** Get criteria that need manual review (partial + manual automation) */
export function getManualReviewCriteria(version: string, level: string): iWcagCriterion[] {
  return filterCriteria(version, level).filter((c) => c.automation !== "full");
}

/** Map axe rule ID to WCAG criteria */
export function mapRuleToWcag(ruleId: string): string[] {
  return WCAG_CRITERIA.filter((c) => c.axeRules.includes(ruleId)).map((c) => c.id);
}

/**
 * Convert axe-core tag list (e.g. ["wcag2aa", "wcag111", "wcag1410"]) to
 * dotted WCAG criterion IDs (e.g. ["1.1.1", "1.4.10"]). Tags that don't
 * encode a numbered criterion (level tags like "wcag2aa", "best-practice",
 * "ACT") are skipped. Result is deduplicated.
 *
 * Format expected: ^wcag<principle><guideline><criterion>$ where each digit
 * group is a single digit except the last, which can be 1-2 digits to
 * accommodate WCAG 2.2 criteria like 1.4.10, 1.4.13, 2.4.11, 2.4.13, etc.
 */
export function mapAxeTagsToWcag(tags: string[]): string[] {
  const wcagPattern = /^wcag(\d)(\d)(\d+)$/;
  const criteria: string[] = [];
  for (const tag of tags) {
    const match = tag.match(wcagPattern);
    if (match) criteria.push(`${match[1]}.${match[2]}.${match[3]}`);
  }
  return [...new Set(criteria)];
}

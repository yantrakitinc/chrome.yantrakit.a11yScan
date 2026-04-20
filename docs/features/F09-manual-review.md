# F09 — Manual Review Checklist

## Purpose

WCAG criteria that can't be automated — things only a human can judge. Provides a structured checklist so users systematically review what axe-core cannot detect.

## Who needs it

Auditors doing thorough assessments, developers wanting comprehensive coverage, QA following a checklist.

## Dependencies

- F01 (Single Page Scan) — provides `pageElements` to filter relevant criteria

## Behavior

### Sub-tab location

Manual review lives in the **Manual** sub-tab of the Scan tab. Visible when phase is Paused, Wait, or Results.

### Criteria database

All criteria sourced from `wcag-mapping.ts`. Criteria with `automation: 'manual'` or `automation: 'partial'` are included. Each criterion has:
- WCAG ID (e.g., "1.2.1")
- Name (e.g., "Audio-only Content")
- Description of what to check (plain English, actionable)
- Relevance hints (e.g., "only if hasVideo")
- Level (A, AA, AAA)
- Applicable WCAG versions

#### Complete criteria list

The table below enumerates every criterion shown in the manual review checklist. "Always shown" means no `relevantWhen` guard; the page element trigger column lists the flag(s) that must be true for conditional criteria.

---

**Principle 1 — Perceivable**

| WCAG ID | Name | Level | Automation | What to check | Page element trigger |
|---------|------|-------|------------|---------------|----------------------|
| 1.1.1 | Non-text Content | A | partial | Verify alt text accurately describes image content. Check decorative images have empty alt. | Always shown |
| 1.2.1 | Audio-only and Video-only (Prerecorded) | A | manual | Verify prerecorded audio has a transcript. Verify prerecorded video-only has audio description or text alternative. | `hasAudio` or `hasVideo` |
| 1.2.2 | Captions (Prerecorded) | A | partial | Verify captions are accurate, synchronized, and include speaker identification and sound effects. | Always shown |
| 1.2.3 | Audio Description or Media Alternative (Prerecorded) | A | manual | Verify video has audio description or full text transcript covering visual content. | `hasVideo` |
| 1.2.4 | Captions (Live) | AA | manual | Verify live video streams have real-time captions. | `hasVideo` |
| 1.2.5 | Audio Description (Prerecorded) | AA | manual | Verify prerecorded video has audio description for visual-only information. | `hasVideo` |
| 1.2.6 | Sign Language (Prerecorded) | AAA | manual | Verify prerecorded video has sign language interpretation. | `hasVideo` |
| 1.2.7 | Extended Audio Description (Prerecorded) | AAA | manual | Verify prerecorded video has extended audio description where pauses are insufficient. | `hasVideo` |
| 1.2.8 | Media Alternative (Prerecorded) | AAA | manual | Verify prerecorded video has a full text alternative describing all visual and auditory content. | `hasVideo` |
| 1.2.9 | Audio-only (Live) | AAA | manual | Verify live audio-only content has a real-time text alternative. | `hasAudio` |
| 1.3.1 | Info and Relationships | A | partial | Verify information conveyed through presentation is also available programmatically. Check headings, lists, and tables use proper semantic markup. | Always shown |
| 1.3.2 | Meaningful Sequence | A | manual | Verify DOM order matches visual reading order. Check CSS reordering does not break logical sequence. | Always shown |
| 1.3.3 | Sensory Characteristics | A | manual | Verify instructions do not rely solely on shape, size, visual location, orientation, or sound. | Always shown |
| 1.3.4 | Orientation | AA | partial | Verify content is not restricted to a single display orientation unless essential. | Always shown |
| 1.3.5 | Identify Input Purpose | AA | partial | Verify input fields collecting personal data have appropriate autocomplete attributes. | Always shown |
| 1.4.1 | Use of Color | A | partial | Verify color is not the only visual means of conveying information, indicating actions, or distinguishing elements. | Always shown |
| 1.4.2 | Audio Control | A | partial | Verify auto-playing audio lasting >3 seconds has pause, stop, or volume controls. | Always shown |
| 1.4.3 | Contrast (Minimum) | AA | partial | Verify text contrast is 4.5:1 for normal text, 3:1 for large text. Check text over images and gradients manually. | Always shown |
| 1.4.4 | Resize Text | AA | partial | Verify text can be resized up to 200% without loss of content or functionality. | Always shown |
| 1.4.5 | Images of Text | AA | manual | Verify text is used instead of images of text, except for logos or where presentation is essential. | `hasImages` |
| 1.4.6 | Contrast (Enhanced) | AAA | partial | Verify text contrast is 7:1 for normal text, 4.5:1 for large text. | Always shown |
| 1.4.7 | Low or No Background Audio | AAA | manual | Verify speech audio has no background sounds, or background is at least 20dB lower than speech. | `hasAudio` |
| 1.4.8 | Visual Presentation | AAA | manual | Verify text blocks: foreground/background colors selectable by user, width ≤80 characters, not fully justified, line spacing ≥1.5, paragraph spacing ≥2x line spacing, text resizable to 200% without scrolling. | Always shown |
| 1.4.9 | Images of Text (No Exception) | AAA | manual | Verify images of text are only used for pure decoration. No exceptions for customizable text. | `hasImages` |
| 1.4.10 | Reflow | AA | manual | Verify content reflows at 320px width (400% zoom) without horizontal scrolling. | Always shown |
| 1.4.11 | Non-text Contrast | AA | manual | Verify UI components and graphical objects have at least 3:1 contrast ratio against adjacent colors. | Always shown |
| 1.4.12 | Text Spacing | AA | partial | Verify content does not break when text spacing is increased (line-height 1.5x, letter-spacing 0.12em, word-spacing 0.16em, paragraph-spacing 2x). | Always shown |
| 1.4.13 | Content on Hover or Focus | AA | manual | Verify hover/focus content is dismissible, hoverable, and persistent. | Always shown |

---

**Principle 2 — Operable**

| WCAG ID | Name | Level | Automation | What to check | Page element trigger |
|---------|------|-------|------------|---------------|----------------------|
| 2.1.1 | Keyboard | A | partial | Verify all functionality is operable through keyboard alone. | Always shown |
| 2.1.2 | No Keyboard Trap | A | manual | Verify focus can be moved away from every component using keyboard only. | Always shown |
| 2.1.3 | Keyboard (No Exception) | AAA | manual | Verify ALL functionality is operable through keyboard with no exceptions. | Always shown |
| 2.1.4 | Character Key Shortcuts | A | manual | Verify single character key shortcuts can be turned off, remapped, or are only active on focus. | Always shown |
| 2.2.1 | Timing Adjustable | A | partial | Verify time limits can be turned off, adjusted, or extended. | Always shown |
| 2.2.2 | Pause, Stop, Hide | A | partial | Verify moving, blinking, or auto-updating content can be paused, stopped, or hidden. | Always shown |
| 2.2.3 | No Timing | AAA | manual | Verify timing is not an essential part of any activity (no time limits at all). | `hasTimeLimits` |
| 2.2.4 | Interruptions | AAA | manual | Verify interruptions (alerts, updates) can be postponed or suppressed by the user, except emergencies. | Always shown |
| 2.2.5 | Re-authenticating | AAA | manual | Verify that when an authenticated session expires, the user can re-authenticate and continue without data loss. | Always shown |
| 2.3.1 | Three Flashes or Below Threshold | A | manual | Verify no content flashes more than 3 times per second. | `hasAnimation` or `hasVideo` |
| 2.3.2 | Three Flashes | AAA | manual | Verify no content flashes more than three times per second (no threshold exception). | `hasAnimation` |
| 2.4.1 | Bypass Blocks | A | partial | Verify a mechanism exists to bypass repeated content blocks (skip link, landmarks). | Always shown |
| 2.4.3 | Focus Order | A | manual | Verify focus order preserves meaning and operability. Tab through entire page. | Always shown |
| 2.4.4 | Link Purpose (In Context) | A | partial | Verify link text describes the purpose of each link, in context of surrounding text. | Always shown |
| 2.4.5 | Multiple Ways | AA | manual | Verify more than one way to locate a page (sitemap, search, navigation, links). | Always shown |
| 2.4.6 | Headings and Labels | AA | partial | Verify headings and labels describe their topic or purpose. Check for empty or non-descriptive headings. | Always shown |
| 2.4.7 | Focus Visible | AA | manual | Verify keyboard focus indicator is visible on all interactive elements. | Always shown |
| 2.4.8 | Location | AAA | manual | Verify user's location within a set of pages is indicated (breadcrumbs, site map highlight, etc.). | Always shown |
| 2.4.9 | Link Purpose (Link Only) | AAA | manual | Verify every link's purpose can be determined from link text alone (not from surrounding context). | `hasLinks` |
| 2.4.10 | Section Headings | AAA | manual | Verify content is organized using section headings. | `hasHeadings` |
| 2.4.11 | Focus Not Obscured (Minimum) | AA | manual | Verify focused element is not entirely hidden by other content (sticky headers, modals). | Always shown |
| 2.5.1 | Pointer Gestures | A | manual | Verify multipoint or path-based gestures have single-pointer alternatives. | Always shown |
| 2.5.2 | Pointer Cancellation | A | manual | Verify actions use up-event, can be aborted, or can be undone. | Always shown |
| 2.5.3 | Label in Name | A | partial | Verify visible label text is included in the accessible name. | Always shown |
| 2.5.4 | Motion Actuation | A | manual | Verify motion-triggered functions have UI alternatives and can be disabled. | Always shown |
| 2.5.7 | Dragging Movements | AA | manual | Verify drag operations have single-pointer alternatives (click, tap). | `hasDragDrop` |
| 2.5.8 | Target Size (Minimum) | AA | partial | Verify interactive targets are at least 24x24 CSS pixels or have sufficient spacing. | Always shown |

---

**Principle 3 — Understandable**

| WCAG ID | Name | Level | Automation | What to check | Page element trigger |
|---------|------|-------|------------|---------------|----------------------|
| 3.1.2 | Language of Parts | AA | partial | Verify content in a different language has a lang attribute on the containing element. | Always shown |
| 3.1.3 | Unusual Words | AAA | manual | Verify a mechanism is available to identify definitions of words used in unusual or restricted ways, including idioms and jargon. | Always shown |
| 3.1.4 | Abbreviations | AAA | manual | Verify a mechanism is available to identify the expanded form of abbreviations. | Always shown |
| 3.1.5 | Reading Level | AAA | manual | Verify supplemental content or an alternative version is available when text requires reading ability above lower secondary education level. | Always shown |
| 3.1.6 | Pronunciation | AAA | manual | Verify a mechanism is available to identify pronunciation of words where meaning is ambiguous without pronunciation. | Always shown |
| 3.2.1 | On Focus | A | manual | Verify focusing an element does not trigger unexpected context changes. | Always shown |
| 3.2.2 | On Input | A | manual | Verify changing a form control does not trigger unexpected context changes without advance notice. | `hasForms` |
| 3.2.3 | Consistent Navigation | AA | manual | Verify navigation menus appear in the same relative order across pages. | Always shown |
| 3.2.4 | Consistent Identification | AA | manual | Verify components with same function are identified consistently across pages. | Always shown |
| 3.2.5 | Change on Request | AAA | manual | Verify changes of context are initiated only by user request, or a mechanism is available to turn off such changes. | Always shown |
| 3.2.6 | Consistent Help | A | manual | Verify help mechanisms appear in consistent locations across pages. | Always shown |
| 3.3.1 | Error Identification | A | manual | Verify input errors are identified in text and described to the user. | `hasForms` |
| 3.3.2 | Labels or Instructions | A | partial | Verify form fields have descriptive labels and instructions when needed. | Always shown |
| 3.3.3 | Error Suggestion | AA | manual | Verify error messages suggest corrections when possible. | `hasForms` |
| 3.3.4 | Error Prevention (Legal, Financial, Data) | AA | manual | Verify legal/financial submissions are reversible, verified, or confirmable. | `hasForms` |
| 3.3.5 | Help | AAA | manual | Verify context-sensitive help is available for form inputs and interactions. | `hasForms` |
| 3.3.6 | Error Prevention (All) | AAA | manual | Verify ALL form submissions are reversible, verified, or confirmable (not just legal/financial). | `hasForms` |
| 3.3.7 | Redundant Entry | A | manual | Verify previously entered information is auto-populated or available for selection. | `hasForms` |
| 3.3.8 | Accessible Authentication (Minimum) | AA | manual | Verify login does not require cognitive function tests without alternatives. | `hasForms` |

---

**Principle 4 — Robust**

| WCAG ID | Name | Level | Automation | What to check | Page element trigger |
|---------|------|-------|------------|---------------|----------------------|
| 4.1.2 | Name, Role, Value | A | partial | Verify all UI components have accessible names, roles, and states that can be programmatically determined. | Always shown |
| 4.1.3 | Status Messages | AA | manual | Verify status messages use role="status", role="alert", or aria-live regions. | Always shown |

---

**Totals: 55 criteria — 22 partial, 33 manual**

### Filtering by page content

Criteria are filtered based on `pageElements` from the scan:
- Video criteria only show if `hasVideo` is true.
- Audio criteria only show if `hasAudio` is true.
- Form criteria only show if `hasForms` is true.
- Table criteria only show if `hasTables` is true.
- etc.

Three groups:
1. **Likely Relevant** — page has the element type this criterion checks.
2. **May Not Apply** — page may or may not have what this criterion checks.
3. **Not Applicable** — user marked N/A.

### Per-criterion UI

Each criterion is a card:
- **Header row**: WCAG ID + name (left), Pass/Fail/N/A buttons (right).
- **Description**: what to check, in plain language.
- **Pass/Fail/N/A** buttons: three small buttons, mutually exclusive.
  - Pass → green background
  - Fail → red background
  - N/A → gray background
  - Click same button again → deselects (returns to unreviewed)
  - All buttons minimum 24×24px target size.

### Progress

Header shows: "**X criteria need human review**" + "**Y of X reviewed**"
- "Reviewed" = has a Pass, Fail, or N/A status. Unreviewed criteria count toward the total.

### State persistence

Manual review state (Pass/Fail/N/A per criterion) persists per tab:
- Stored in memory while the side panel is open.
- Included in exports (JSON/HTML/PDF).
- Cleared when user clicks "Clear".

### Design requirement

This must be an **immaculate, easily understood design**. Each criterion must be crystal clear about:
1. What it means.
2. What action the user should take to verify it.
3. What their current progress is.

## Acceptance Criteria

1. Manual sub-tab shows when phase is Results, Paused, or Wait.
2. Criteria are filtered by page elements (video, audio, forms, etc.).
3. Each criterion shows WCAG ID, name, and description.
4. Pass/Fail/N/A buttons are mutually exclusive toggles.
5. Clicking an already-selected button deselects it.
6. Progress counter updates when criteria are reviewed.
7. All buttons meet 24px minimum target size.
8. Manual review state is included in exports.
9. State is cleared when Clear is clicked.
10. Descriptions are in plain, actionable language.
11. All text meets minimum 11px size and 4.5:1 contrast.

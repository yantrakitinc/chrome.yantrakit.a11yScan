/**
 * WAI-ARIA widget pattern definitions for validation (F10).
 * Each pattern defines how to detect the widget and what to validate.
 */

export interface iAriaPatternCheck {
  name: string;
  validate: (el: Element) => { pass: boolean; message: string };
}

export interface iAriaPattern {
  role: string;
  selector: string;
  label: string;
  checks: iAriaPatternCheck[];
}

/** Check if element has attribute */
function hasAttr(el: Element, attr: string): boolean {
  return el.hasAttribute(attr);
}

/** Check if element has child matching selector */
function hasChild(el: Element, sel: string): boolean {
  return el.querySelector(sel) !== null;
}

/** Count children matching selector */
function countChildren(el: Element, sel: string): number {
  return el.querySelectorAll(sel).length;
}

export const ARIA_PATTERNS: iAriaPattern[] = [
  {
    role: "tablist",
    selector: '[role="tablist"]',
    label: "Tab list",
    checks: [
      { name: "has-tab-children", validate: (el) => {
        const count = countChildren(el, '[role="tab"]');
        return { pass: count > 0, message: count > 0 ? `Found ${count} tabs` : "No role=\"tab\" children found" };
      }},
      { name: "tabs-have-selected", validate: (el) => {
        const tabs = el.querySelectorAll('[role="tab"]');
        const hasSelected = Array.from(tabs).some(t => hasAttr(t, "aria-selected"));
        return { pass: hasSelected, message: hasSelected ? "At least one tab has aria-selected" : "No tab has aria-selected attribute" };
      }},
      { name: "tabs-have-controls", validate: (el) => {
        const tabs = el.querySelectorAll('[role="tab"]');
        const missing = Array.from(tabs).filter(t => !hasAttr(t, "aria-controls"));
        return { pass: missing.length === 0, message: missing.length === 0 ? "All tabs have aria-controls" : `${missing.length} tabs missing aria-controls` };
      }},
    ],
  },
  {
    role: "menu",
    selector: '[role="menu"]',
    label: "Menu",
    checks: [
      { name: "has-menuitem-children", validate: (el) => {
        const count = countChildren(el, '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]');
        return { pass: count > 0, message: count > 0 ? `Found ${count} menu items` : "No menuitem children found" };
      }},
      { name: "has-orientation", validate: (el) => {
        const has = hasAttr(el, "aria-orientation");
        return { pass: has, message: has ? "Has aria-orientation" : "Missing aria-orientation" };
      }},
    ],
  },
  {
    role: "menubar",
    selector: '[role="menubar"]',
    label: "Menu bar",
    checks: [
      { name: "has-menuitem-children", validate: (el) => {
        const count = countChildren(el, '[role="menuitem"]');
        return { pass: count > 0, message: count > 0 ? `Found ${count} menu items` : "No menuitem children found" };
      }},
    ],
  },
  {
    role: "dialog",
    selector: '[role="dialog"], dialog',
    label: "Dialog",
    checks: [
      { name: "has-aria-modal", validate: (el) => {
        const has = hasAttr(el, "aria-modal") || el.tagName === "DIALOG";
        return { pass: has, message: has ? "Has aria-modal or is <dialog>" : "Missing aria-modal attribute" };
      }},
      { name: "has-label", validate: (el) => {
        const has = hasAttr(el, "aria-label") || hasAttr(el, "aria-labelledby");
        return { pass: has, message: has ? "Has accessible label" : "Missing aria-label or aria-labelledby" };
      }},
      { name: "has-focusable-child", validate: (el) => {
        const has = hasChild(el, 'a[href], button, input, select, textarea, [tabindex]');
        return { pass: has, message: has ? "Has focusable child" : "No focusable child element inside dialog" };
      }},
    ],
  },
  {
    role: "alertdialog",
    selector: '[role="alertdialog"]',
    label: "Alert dialog",
    checks: [
      { name: "has-aria-modal", validate: (el) => {
        const has = hasAttr(el, "aria-modal");
        return { pass: has, message: has ? "Has aria-modal" : "Missing aria-modal attribute" };
      }},
      { name: "has-describedby", validate: (el) => {
        const has = hasAttr(el, "aria-describedby");
        return { pass: has, message: has ? "Has aria-describedby" : "Missing aria-describedby" };
      }},
    ],
  },
  {
    role: "combobox",
    selector: '[role="combobox"]',
    label: "Combobox",
    checks: [
      { name: "has-controls", validate: (el) => {
        const has = hasAttr(el, "aria-controls") || hasAttr(el, "aria-owns");
        return { pass: has, message: has ? "Has aria-controls/aria-owns" : "Missing aria-controls pointing to listbox" };
      }},
      { name: "has-expanded", validate: (el) => {
        const has = hasAttr(el, "aria-expanded");
        return { pass: has, message: has ? "Has aria-expanded" : "Missing aria-expanded" };
      }},
    ],
  },
  {
    role: "slider",
    selector: '[role="slider"]',
    label: "Slider",
    checks: [
      { name: "has-valuenow", validate: (el) => {
        const has = hasAttr(el, "aria-valuenow");
        return { pass: has, message: has ? "Has aria-valuenow" : "Missing aria-valuenow" };
      }},
      { name: "has-valuemin-max", validate: (el) => {
        const hasMin = hasAttr(el, "aria-valuemin");
        const hasMax = hasAttr(el, "aria-valuemax");
        return { pass: hasMin && hasMax, message: hasMin && hasMax ? "Has value range" : "Missing aria-valuemin or aria-valuemax" };
      }},
    ],
  },
  {
    role: "tree",
    selector: '[role="tree"]',
    label: "Tree",
    checks: [
      { name: "has-treeitem-children", validate: (el) => {
        const count = countChildren(el, '[role="treeitem"]');
        return { pass: count > 0, message: count > 0 ? `Found ${count} tree items` : "No treeitem children found" };
      }},
      { name: "treeitems-have-expanded", validate: (el) => {
        const items = el.querySelectorAll('[role="treeitem"]');
        const withExpanded = Array.from(items).filter(i => hasAttr(i, "aria-expanded"));
        if (items.length === 0) return { pass: true, message: "No tree items to check" };
        return { pass: withExpanded.length > 0, message: withExpanded.length > 0 ? `${withExpanded.length} of ${items.length} treeitems have aria-expanded` : "No treeitems have aria-expanded attribute" };
      }},
    ],
  },
  {
    role: "radiogroup",
    selector: '[role="radiogroup"]',
    label: "Radio group",
    checks: [
      { name: "has-radio-children", validate: (el) => {
        const count = countChildren(el, '[role="radio"]');
        return { pass: count > 0, message: count > 0 ? `Found ${count} radio buttons` : "No radio children found" };
      }},
      { name: "has-checked-radio", validate: (el) => {
        const has = hasChild(el, '[role="radio"][aria-checked="true"]');
        return { pass: has, message: has ? "Has checked radio" : "No radio has aria-checked=\"true\"" };
      }},
    ],
  },
  {
    role: "checkbox",
    selector: '[role="checkbox"]',
    label: "Checkbox",
    checks: [
      { name: "has-checked", validate: (el) => {
        const has = hasAttr(el, "aria-checked");
        return { pass: has, message: has ? "Has aria-checked" : "Missing aria-checked attribute" };
      }},
      { name: "has-name", validate: (el) => {
        const has = hasAttr(el, "aria-label") || hasAttr(el, "aria-labelledby") || (el.textContent?.trim().length ?? 0) > 0;
        return { pass: has, message: has ? "Has accessible name" : "No accessible name" };
      }},
    ],
  },
  {
    role: "switch",
    selector: '[role="switch"]',
    label: "Switch",
    checks: [
      { name: "has-checked", validate: (el) => {
        const has = hasAttr(el, "aria-checked");
        return { pass: has, message: has ? "Has aria-checked" : "Missing aria-checked" };
      }},
      { name: "has-name", validate: (el) => {
        const has = hasAttr(el, "aria-label") || hasAttr(el, "aria-labelledby") || (el.textContent?.trim().length ?? 0) > 0;
        return { pass: has, message: has ? "Has accessible name" : "No accessible name" };
      }},
    ],
  },
  {
    role: "accordion",
    selector: "button[aria-expanded], [role='button'][aria-expanded]",
    label: "Accordion (heuristic)",
    checks: [
      { name: "parent-has-multiple-expanded-buttons", validate: (el) => {
        const parent = el.parentElement;
        if (!parent) return { pass: false, message: "No parent element found" };
        const siblings = parent.querySelectorAll("button[aria-expanded], [role='button'][aria-expanded]");
        return { pass: siblings.length >= 2, message: siblings.length >= 2 ? `Parent has ${siblings.length} expandable buttons (accordion pattern)` : "Parent has fewer than 2 expandable buttons — not an accordion" };
      }},
      { name: "buttons-have-controls", validate: (el) => {
        const has = hasAttr(el, "aria-controls");
        return { pass: has, message: has ? "Has aria-controls" : "Missing aria-controls" };
      }},
    ],
  },
];

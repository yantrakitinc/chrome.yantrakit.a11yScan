/**
 * WAI-ARIA widget pattern definitions and validation checks.
 * Each rule defines expected ARIA structure for a specific widget role.
 */

export interface iAriaCheckResult {
  pass: boolean;
  message: string;
}

export interface iAriaCheck {
  id: string;
  description: string;
  check: (el: Element) => iAriaCheckResult;
}

export interface iAriaPatternRule {
  role: string;
  label: string;
  description: string;
  checks: iAriaCheck[];
}

export interface iAriaWidgetResult {
  role: string;
  label: string;
  selector: string;
  html: string;
  checks: { id: string; description: string; pass: boolean; message: string }[];
  passCount: number;
  failCount: number;
}

/**
 * Checks whether an element has at least one focusable descendant.
 */
function hasFocusableChild(el: Element): boolean {
  const focusableSelector =
    'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
  return el.querySelector(focusableSelector) !== null;
}

/**
 * Checks whether an element itself is keyboard-accessible via tabindex.
 */
function hasTabindex(el: Element): boolean {
  return el.hasAttribute('tabindex');
}

/**
 * Checks whether an element has an accessible name via aria-label or aria-labelledby.
 */
function hasAccessibleName(el: Element): boolean {
  return (
    (el.getAttribute('aria-label') ?? '').trim().length > 0 ||
    (el.getAttribute('aria-labelledby') ?? '').trim().length > 0
  );
}

export const ARIA_PATTERN_RULES: iAriaPatternRule[] = [
  // ── tablist ──────────────────────────────────────────────
  {
    role: 'tablist',
    label: 'Tab List',
    description: 'A set of tab elements and their associated tab panels.',
    checks: [
      {
        id: 'tablist-has-tabs',
        description: 'Has role="tab" children',
        check: (el) => {
          const tabs = el.querySelectorAll('[role="tab"]');
          return tabs.length > 0
            ? { pass: true, message: `Found ${tabs.length} tab(s).` }
            : { pass: false, message: 'No role="tab" children found.' };
        },
      },
      {
        id: 'tab-has-aria-selected',
        description: 'Each tab has aria-selected',
        check: (el) => {
          const tabs = el.querySelectorAll('[role="tab"]');
          if (tabs.length === 0) return { pass: false, message: 'No tabs to check.' };
          const missing = Array.from(tabs).filter((t) => !t.hasAttribute('aria-selected'));
          return missing.length === 0
            ? { pass: true, message: 'All tabs have aria-selected.' }
            : { pass: false, message: `${missing.length} tab(s) missing aria-selected.` };
        },
      },
      {
        id: 'tab-has-aria-controls',
        description: 'Each tab has aria-controls pointing to a tabpanel',
        check: (el) => {
          const tabs = el.querySelectorAll('[role="tab"]');
          if (tabs.length === 0) return { pass: false, message: 'No tabs to check.' };
          const broken: string[] = [];
          tabs.forEach((t) => {
            const controls = t.getAttribute('aria-controls');
            if (!controls) {
              broken.push('missing aria-controls');
            } else {
              const panel = document.getElementById(controls);
              if (!panel || panel.getAttribute('role') !== 'tabpanel') {
                broken.push(`aria-controls="${controls}" does not point to a tabpanel`);
              }
            }
          });
          return broken.length === 0
            ? { pass: true, message: 'All tabs have valid aria-controls.' }
            : { pass: false, message: broken.join('; ') };
        },
      },
      {
        id: 'tabpanel-exists',
        description: 'Tabpanel exists with role="tabpanel"',
        check: () => {
          const panels = document.querySelectorAll('[role="tabpanel"]');
          return panels.length > 0
            ? { pass: true, message: `Found ${panels.length} tabpanel(s).` }
            : { pass: false, message: 'No role="tabpanel" elements found on the page.' };
        },
      },
    ],
  },

  // ── menu / menubar ───────────────────────────────────────
  {
    role: 'menu',
    label: 'Menu',
    description: 'A widget offering a list of choices (actions or functions).',
    checks: [
      {
        id: 'menu-has-menuitems',
        description: 'Has menuitem / menuitemcheckbox / menuitemradio children',
        check: (el) => {
          const items = el.querySelectorAll(
            '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]',
          );
          return items.length > 0
            ? { pass: true, message: `Found ${items.length} menu item(s).` }
            : { pass: false, message: 'No menuitem children found.' };
        },
      },
      {
        id: 'menu-has-orientation',
        description: 'Has aria-orientation or inherits default orientation',
        check: (el) => {
          const orientation = el.getAttribute('aria-orientation');
          const role = el.getAttribute('role');
          if (orientation) {
            return { pass: true, message: `aria-orientation="${orientation}".` };
          }
          // menubar defaults to horizontal, menu defaults to vertical
          return {
            pass: true,
            message: `No explicit aria-orientation; defaults to ${role === 'menubar' ? 'horizontal' : 'vertical'}.`,
          };
        },
      },
    ],
  },
  {
    role: 'menubar',
    label: 'Menu Bar',
    description: 'A horizontal menu bar, typically containing menu items.',
    checks: [
      {
        id: 'menubar-has-menuitems',
        description: 'Has menuitem / menuitemcheckbox / menuitemradio children',
        check: (el) => {
          const items = el.querySelectorAll(
            '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]',
          );
          return items.length > 0
            ? { pass: true, message: `Found ${items.length} menu item(s).` }
            : { pass: false, message: 'No menuitem children found.' };
        },
      },
      {
        id: 'menubar-has-orientation',
        description: 'Has aria-orientation or inherits default orientation',
        check: (el) => {
          const orientation = el.getAttribute('aria-orientation');
          if (orientation) {
            return { pass: true, message: `aria-orientation="${orientation}".` };
          }
          return { pass: true, message: 'No explicit aria-orientation; defaults to horizontal.' };
        },
      },
    ],
  },

  // ── dialog / alertdialog ─────────────────────────────────
  {
    role: 'dialog',
    label: 'Dialog',
    description: 'A dialog box or window separated from the rest of the page.',
    checks: [
      {
        id: 'dialog-has-aria-modal',
        description: 'Has aria-modal="true" or aria-modal attribute',
        check: (el) => {
          const modal = el.getAttribute('aria-modal');
          return modal !== null
            ? { pass: true, message: `aria-modal="${modal}".` }
            : { pass: false, message: 'Missing aria-modal attribute.' };
        },
      },
      {
        id: 'dialog-has-label',
        description: 'Has aria-label or aria-labelledby',
        check: (el) => {
          return hasAccessibleName(el)
            ? { pass: true, message: 'Dialog has an accessible name.' }
            : { pass: false, message: 'Dialog is missing aria-label or aria-labelledby.' };
        },
      },
      {
        id: 'dialog-has-focusable',
        description: 'Has at least one focusable element inside',
        check: (el) => {
          return hasFocusableChild(el)
            ? { pass: true, message: 'Dialog contains focusable element(s).' }
            : { pass: false, message: 'Dialog has no focusable elements inside.' };
        },
      },
    ],
  },
  {
    role: 'alertdialog',
    label: 'Alert Dialog',
    description: 'A dialog that interrupts the user with important information.',
    checks: [
      {
        id: 'alertdialog-has-aria-modal',
        description: 'Has aria-modal="true" or aria-modal attribute',
        check: (el) => {
          const modal = el.getAttribute('aria-modal');
          return modal !== null
            ? { pass: true, message: `aria-modal="${modal}".` }
            : { pass: false, message: 'Missing aria-modal attribute.' };
        },
      },
      {
        id: 'alertdialog-has-label',
        description: 'Has aria-label or aria-labelledby',
        check: (el) => {
          return hasAccessibleName(el)
            ? { pass: true, message: 'Alert dialog has an accessible name.' }
            : { pass: false, message: 'Alert dialog is missing aria-label or aria-labelledby.' };
        },
      },
      {
        id: 'alertdialog-has-focusable',
        description: 'Has at least one focusable element inside',
        check: (el) => {
          return hasFocusableChild(el)
            ? { pass: true, message: 'Alert dialog contains focusable element(s).' }
            : { pass: false, message: 'Alert dialog has no focusable elements inside.' };
        },
      },
    ],
  },

  // ── combobox ─────────────────────────────────────────────
  {
    role: 'combobox',
    label: 'Combobox',
    description: 'An input widget with an associated popup for selecting a value.',
    checks: [
      {
        id: 'combobox-has-expanded',
        description: 'Has aria-expanded attribute',
        check: (el) => {
          return el.hasAttribute('aria-expanded')
            ? { pass: true, message: `aria-expanded="${el.getAttribute('aria-expanded')}".` }
            : { pass: false, message: 'Missing aria-expanded attribute.' };
        },
      },
      {
        id: 'combobox-has-controls',
        description: 'Has aria-controls pointing to a listbox',
        check: (el) => {
          const controls = el.getAttribute('aria-controls');
          if (!controls) return { pass: false, message: 'Missing aria-controls attribute.' };
          const target = document.getElementById(controls);
          if (!target) return { pass: false, message: `aria-controls="${controls}" target not found.` };
          const targetRole = target.getAttribute('role');
          if (targetRole === 'listbox' || targetRole === 'tree' || targetRole === 'dialog' || targetRole === 'grid') {
            return { pass: true, message: `aria-controls points to role="${targetRole}".` };
          }
          return { pass: false, message: `aria-controls target has role="${targetRole}", expected listbox/tree/dialog/grid.` };
        },
      },
      {
        id: 'combobox-has-input',
        description: 'Contains an input element or is an input itself',
        check: (el) => {
          const isInput = el.tagName.toLowerCase() === 'input';
          const hasInput = el.querySelector('input') !== null;
          return isInput || hasInput
            ? { pass: true, message: isInput ? 'Element is an input.' : 'Contains an input element.' }
            : { pass: false, message: 'No input element found inside combobox.' };
        },
      },
    ],
  },

  // ── checkbox (custom) ────────────────────────────────────
  {
    role: 'checkbox',
    label: 'Checkbox (Custom)',
    description: 'A custom checkbox widget (not a native input[type="checkbox"]).',
    checks: [
      {
        id: 'checkbox-has-aria-checked',
        description: 'Has aria-checked attribute',
        check: (el) => {
          return el.hasAttribute('aria-checked')
            ? { pass: true, message: `aria-checked="${el.getAttribute('aria-checked')}".` }
            : { pass: false, message: 'Missing aria-checked attribute.' };
        },
      },
      {
        id: 'checkbox-has-tabindex',
        description: 'Has tabindex for keyboard access',
        check: (el) => {
          const isNativelyFocusable = ['button', 'input'].includes(el.tagName.toLowerCase());
          return isNativelyFocusable || hasTabindex(el)
            ? { pass: true, message: 'Element is keyboard-accessible.' }
            : { pass: false, message: 'Missing tabindex; not keyboard-accessible.' };
        },
      },
    ],
  },

  // ── radiogroup ───────────────────────────────────────────
  {
    role: 'radiogroup',
    label: 'Radio Group',
    description: 'A group of radio buttons.',
    checks: [
      {
        id: 'radiogroup-has-radios',
        description: 'Has role="radio" children',
        check: (el) => {
          const radios = el.querySelectorAll('[role="radio"]');
          return radios.length > 0
            ? { pass: true, message: `Found ${radios.length} radio(s).` }
            : { pass: false, message: 'No role="radio" children found.' };
        },
      },
      {
        id: 'radio-has-aria-checked',
        description: 'Each radio has aria-checked',
        check: (el) => {
          const radios = el.querySelectorAll('[role="radio"]');
          if (radios.length === 0) return { pass: false, message: 'No radios to check.' };
          const missing = Array.from(radios).filter((r) => !r.hasAttribute('aria-checked'));
          return missing.length === 0
            ? { pass: true, message: 'All radios have aria-checked.' }
            : { pass: false, message: `${missing.length} radio(s) missing aria-checked.` };
        },
      },
    ],
  },

  // ── slider ───────────────────────────────────────────────
  {
    role: 'slider',
    label: 'Slider',
    description: 'An input where the user selects a value from within a range.',
    checks: [
      {
        id: 'slider-has-valuenow',
        description: 'Has aria-valuenow',
        check: (el) => {
          return el.hasAttribute('aria-valuenow')
            ? { pass: true, message: `aria-valuenow="${el.getAttribute('aria-valuenow')}".` }
            : { pass: false, message: 'Missing aria-valuenow.' };
        },
      },
      {
        id: 'slider-has-valuemin',
        description: 'Has aria-valuemin',
        check: (el) => {
          return el.hasAttribute('aria-valuemin')
            ? { pass: true, message: `aria-valuemin="${el.getAttribute('aria-valuemin')}".` }
            : { pass: false, message: 'Missing aria-valuemin.' };
        },
      },
      {
        id: 'slider-has-valuemax',
        description: 'Has aria-valuemax',
        check: (el) => {
          return el.hasAttribute('aria-valuemax')
            ? { pass: true, message: `aria-valuemax="${el.getAttribute('aria-valuemax')}".` }
            : { pass: false, message: 'Missing aria-valuemax.' };
        },
      },
      {
        id: 'slider-has-tabindex',
        description: 'Has tabindex for keyboard access',
        check: (el) => {
          const isNativelyFocusable = ['input'].includes(el.tagName.toLowerCase());
          return isNativelyFocusable || hasTabindex(el)
            ? { pass: true, message: 'Slider is keyboard-accessible.' }
            : { pass: false, message: 'Missing tabindex; not keyboard-accessible.' };
        },
      },
    ],
  },

  // ── tree ─────────────────────────────────────────────────
  {
    role: 'tree',
    label: 'Tree View',
    description: 'A hierarchical list of items that can be expanded and collapsed.',
    checks: [
      {
        id: 'tree-has-treeitems',
        description: 'Has role="treeitem" children',
        check: (el) => {
          const items = el.querySelectorAll('[role="treeitem"]');
          return items.length > 0
            ? { pass: true, message: `Found ${items.length} treeitem(s).` }
            : { pass: false, message: 'No role="treeitem" children found.' };
        },
      },
      {
        id: 'treeitem-expandable-has-expanded',
        description: 'Expandable treeitems have aria-expanded',
        check: (el) => {
          const items = el.querySelectorAll('[role="treeitem"]');
          if (items.length === 0) return { pass: false, message: 'No treeitems to check.' };
          // Items with child groups are expandable
          const expandable = Array.from(items).filter(
            (item) => item.querySelector('[role="group"], [role="tree"]') !== null,
          );
          if (expandable.length === 0) {
            return { pass: true, message: 'No expandable treeitems detected.' };
          }
          const missing = expandable.filter((item) => !item.hasAttribute('aria-expanded'));
          return missing.length === 0
            ? { pass: true, message: 'All expandable treeitems have aria-expanded.' }
            : { pass: false, message: `${missing.length} expandable treeitem(s) missing aria-expanded.` };
        },
      },
    ],
  },

  // ── switch ───────────────────────────────────────────────
  {
    role: 'switch',
    label: 'Switch',
    description: 'A toggle switch representing on/off values.',
    checks: [
      {
        id: 'switch-has-aria-checked',
        description: 'Has aria-checked',
        check: (el) => {
          return el.hasAttribute('aria-checked')
            ? { pass: true, message: `aria-checked="${el.getAttribute('aria-checked')}".` }
            : { pass: false, message: 'Missing aria-checked attribute.' };
        },
      },
      {
        id: 'switch-has-tabindex',
        description: 'Has tabindex for keyboard access',
        check: (el) => {
          const isNativelyFocusable = ['button', 'input'].includes(el.tagName.toLowerCase());
          return isNativelyFocusable || hasTabindex(el)
            ? { pass: true, message: 'Switch is keyboard-accessible.' }
            : { pass: false, message: 'Missing tabindex; not keyboard-accessible.' };
        },
      },
    ],
  },

  // ── accordion ────────────────────────────────────────────
  {
    role: 'accordion',
    label: 'Accordion',
    description: 'A set of disclosure buttons that show/hide associated content panels.',
    checks: [
      {
        id: 'accordion-buttons-have-expanded',
        description: 'Disclosure buttons have aria-expanded',
        check: (el) => {
          const buttons = el.querySelectorAll('button[aria-expanded], [role="button"][aria-expanded]');
          return buttons.length >= 2
            ? { pass: true, message: `Found ${buttons.length} disclosure button(s) with aria-expanded.` }
            : { pass: false, message: `Only ${buttons.length} button(s) with aria-expanded found; expected at least 2.` };
        },
      },
      {
        id: 'accordion-buttons-have-controls',
        description: 'Disclosure buttons have aria-controls pointing to content panels',
        check: (el) => {
          const buttons = el.querySelectorAll('button[aria-expanded], [role="button"][aria-expanded]');
          if (buttons.length === 0) return { pass: false, message: 'No disclosure buttons found.' };
          const broken: string[] = [];
          buttons.forEach((btn) => {
            const controls = btn.getAttribute('aria-controls');
            if (!controls) {
              broken.push('button missing aria-controls');
            } else if (!document.getElementById(controls)) {
              broken.push(`aria-controls="${controls}" target not found`);
            }
          });
          return broken.length === 0
            ? { pass: true, message: 'All disclosure buttons have valid aria-controls.' }
            : { pass: false, message: broken.join('; ') };
        },
      },
    ],
  },
];

// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { ARIA_PATTERNS } from "../aria-patterns";

function el(html: string): Element {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  return doc.body.firstElementChild!.firstElementChild!;
}

function pattern(role: string) {
  const p = ARIA_PATTERNS.find((x) => x.role === role);
  if (!p) throw new Error(`pattern for role=${role} not found`);
  return p;
}

function check(role: string, name: string) {
  const c = pattern(role).checks.find((x) => x.name === name);
  if (!c) throw new Error(`check ${role}.${name} not found`);
  return c;
}

describe("ARIA_PATTERNS", () => {
  it("has 12 widget patterns", () => {
    expect(ARIA_PATTERNS.length).toBe(12);
  });

  it("includes all documented widget types", () => {
    const roles = ARIA_PATTERNS.map((p) => p.role);
    expect(roles).toContain("tablist");
    expect(roles).toContain("menu");
    expect(roles).toContain("menubar");
    expect(roles).toContain("dialog");
    expect(roles).toContain("alertdialog");
    expect(roles).toContain("combobox");
    expect(roles).toContain("slider");
    expect(roles).toContain("tree");
    expect(roles).toContain("radiogroup");
    expect(roles).toContain("checkbox");
    expect(roles).toContain("switch");
    expect(roles).toContain("accordion");
  });

  it("every pattern has at least one check", () => {
    for (const pattern of ARIA_PATTERNS) {
      expect(pattern.checks.length).toBeGreaterThan(0);
    }
  });

  it("every pattern has a CSS selector", () => {
    for (const pattern of ARIA_PATTERNS) {
      expect(pattern.selector).toBeTruthy();
    }
  });

  it("every check has a name and validate function", () => {
    for (const pattern of ARIA_PATTERNS) {
      for (const check of pattern.checks) {
        expect(check.name).toBeTruthy();
        expect(typeof check.validate).toBe("function");
      }
    }
  });
});

describe("ARIA_PATTERNS — tablist behavior", () => {
  it("has-tab-children passes when role=tab children exist", () => {
    const e = el('<div role="tablist"><div role="tab"></div><div role="tab"></div></div>');
    expect(check("tablist", "has-tab-children").validate(e).pass).toBe(true);
  });
  it("has-tab-children fails when no tabs", () => {
    const e = el('<div role="tablist"></div>');
    const r = check("tablist", "has-tab-children").validate(e);
    expect(r.pass).toBe(false);
    expect(r.message).toMatch(/No role/);
  });
  it("tabs-have-selected passes when at least one tab has aria-selected", () => {
    const e = el('<div role="tablist"><div role="tab" aria-selected="true"></div><div role="tab"></div></div>');
    expect(check("tablist", "tabs-have-selected").validate(e).pass).toBe(true);
  });
  it("tabs-have-selected fails when no tab has aria-selected", () => {
    const e = el('<div role="tablist"><div role="tab"></div></div>');
    expect(check("tablist", "tabs-have-selected").validate(e).pass).toBe(false);
  });
  it("tabs-have-controls passes when every tab has aria-controls", () => {
    const e = el('<div role="tablist"><div role="tab" aria-controls="p1"></div><div role="tab" aria-controls="p2"></div></div>');
    expect(check("tablist", "tabs-have-controls").validate(e).pass).toBe(true);
  });
  it("tabs-have-controls fails when any tab is missing aria-controls", () => {
    const e = el('<div role="tablist"><div role="tab" aria-controls="p1"></div><div role="tab"></div></div>');
    expect(check("tablist", "tabs-have-controls").validate(e).pass).toBe(false);
  });
});

describe("ARIA_PATTERNS — dialog behavior", () => {
  it("has-aria-modal passes when aria-modal is set", () => {
    const e = el('<div role="dialog" aria-modal="true"></div>');
    expect(check("dialog", "has-aria-modal").validate(e).pass).toBe(true);
  });
  it("has-aria-modal passes for native <dialog> even without aria-modal", () => {
    const e = el('<dialog></dialog>');
    expect(check("dialog", "has-aria-modal").validate(e).pass).toBe(true);
  });
  it("has-aria-modal fails for div without aria-modal", () => {
    const e = el('<div role="dialog"></div>');
    expect(check("dialog", "has-aria-modal").validate(e).pass).toBe(false);
  });
  it("has-label passes with aria-label", () => {
    const e = el('<div role="dialog" aria-label="x"></div>');
    expect(check("dialog", "has-label").validate(e).pass).toBe(true);
  });
  it("has-label passes with aria-labelledby", () => {
    const e = el('<div role="dialog" aria-labelledby="t"></div>');
    expect(check("dialog", "has-label").validate(e).pass).toBe(true);
  });
  it("has-label fails without label", () => {
    const e = el('<div role="dialog"></div>');
    expect(check("dialog", "has-label").validate(e).pass).toBe(false);
  });
  it("has-focusable-child passes when a button is inside", () => {
    const e = el('<div role="dialog"><button>OK</button></div>');
    expect(check("dialog", "has-focusable-child").validate(e).pass).toBe(true);
  });
  it("has-focusable-child fails when there's nothing focusable", () => {
    const e = el('<div role="dialog"><span>no focusable</span></div>');
    expect(check("dialog", "has-focusable-child").validate(e).pass).toBe(false);
  });
});

describe("ARIA_PATTERNS — combobox / slider / radiogroup / checkbox / switch / tree / menu / menubar / alertdialog", () => {
  it("combobox.has-controls passes with aria-controls or aria-owns", () => {
    expect(check("combobox", "has-controls").validate(el('<div role="combobox" aria-controls="x"></div>')).pass).toBe(true);
    expect(check("combobox", "has-controls").validate(el('<div role="combobox" aria-owns="x"></div>')).pass).toBe(true);
    expect(check("combobox", "has-controls").validate(el('<div role="combobox"></div>')).pass).toBe(false);
  });
  it("combobox.has-expanded passes only when aria-expanded is set", () => {
    expect(check("combobox", "has-expanded").validate(el('<div role="combobox" aria-expanded="false"></div>')).pass).toBe(true);
    expect(check("combobox", "has-expanded").validate(el('<div role="combobox"></div>')).pass).toBe(false);
  });
  it("slider.has-valuemin-max requires both", () => {
    expect(check("slider", "has-valuemin-max").validate(el('<div role="slider" aria-valuemin="0" aria-valuemax="10"></div>')).pass).toBe(true);
    expect(check("slider", "has-valuemin-max").validate(el('<div role="slider" aria-valuemin="0"></div>')).pass).toBe(false);
  });
  it("radiogroup.has-checked-radio passes when one radio is aria-checked=true", () => {
    expect(check("radiogroup", "has-checked-radio").validate(
      el('<div role="radiogroup"><div role="radio" aria-checked="true"></div></div>')
    ).pass).toBe(true);
    expect(check("radiogroup", "has-checked-radio").validate(
      el('<div role="radiogroup"><div role="radio"></div></div>')
    ).pass).toBe(false);
  });
  it("checkbox.has-name passes with text content", () => {
    expect(check("checkbox", "has-name").validate(el('<div role="checkbox">Label</div>')).pass).toBe(true);
    expect(check("checkbox", "has-name").validate(el('<div role="checkbox"></div>')).pass).toBe(false);
  });
  it("switch.has-checked passes only with aria-checked", () => {
    expect(check("switch", "has-checked").validate(el('<div role="switch" aria-checked="false">x</div>')).pass).toBe(true);
    expect(check("switch", "has-checked").validate(el('<div role="switch">x</div>')).pass).toBe(false);
  });
  it("tree.has-treeitem-children counts treeitem descendants", () => {
    expect(check("tree", "has-treeitem-children").validate(
      el('<div role="tree"><div role="treeitem"></div></div>')
    ).pass).toBe(true);
    expect(check("tree", "has-treeitem-children").validate(el('<div role="tree"></div>')).pass).toBe(false);
  });
  it("menu.has-menuitem-children accepts plain menuitem and the checkbox/radio variants", () => {
    expect(check("menu", "has-menuitem-children").validate(
      el('<div role="menu"><div role="menuitem"></div></div>')
    ).pass).toBe(true);
    expect(check("menu", "has-menuitem-children").validate(
      el('<div role="menu"><div role="menuitemcheckbox"></div></div>')
    ).pass).toBe(true);
    expect(check("menu", "has-menuitem-children").validate(
      el('<div role="menu"><div role="menuitemradio"></div></div>')
    ).pass).toBe(true);
  });
  it("menubar.has-menuitem-children counts menuitem only", () => {
    expect(check("menubar", "has-menuitem-children").validate(
      el('<div role="menubar"><div role="menuitem"></div></div>')
    ).pass).toBe(true);
  });
  it("alertdialog.has-aria-modal + has-describedby are required", () => {
    expect(check("alertdialog", "has-aria-modal").validate(el('<div role="alertdialog" aria-modal="true"></div>')).pass).toBe(true);
    expect(check("alertdialog", "has-describedby").validate(el('<div role="alertdialog" aria-describedby="x"></div>')).pass).toBe(true);
    expect(check("alertdialog", "has-describedby").validate(el('<div role="alertdialog"></div>')).pass).toBe(false);
  });
});

describe("ARIA_PATTERNS — accordion heuristic", () => {
  it("parent-has-multiple-expanded-buttons passes when ≥2 expandables share parent", () => {
    const parent = el('<div><button aria-expanded="true">A</button><button aria-expanded="false">B</button></div>');
    const first = parent.firstElementChild!;
    const r = check("accordion", "parent-has-multiple-expanded-buttons").validate(first);
    expect(r.pass).toBe(true);
  });
  it("parent-has-multiple-expanded-buttons fails for a lone button", () => {
    const parent = el('<div><button aria-expanded="true">A</button></div>');
    const first = parent.firstElementChild!;
    expect(check("accordion", "parent-has-multiple-expanded-buttons").validate(first).pass).toBe(false);
  });
  it("buttons-have-controls passes when aria-controls is set", () => {
    expect(check("accordion", "buttons-have-controls").validate(el('<button aria-expanded="true" aria-controls="p1">x</button>')).pass).toBe(true);
    expect(check("accordion", "buttons-have-controls").validate(el('<button aria-expanded="true">x</button>')).pass).toBe(false);
  });
});

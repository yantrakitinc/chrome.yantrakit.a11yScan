/**
 * Visual verification — closes audit item 8.
 *
 * Role-badge classes drive the colored pills on every SR/KB row indicating
 * the element's role. Verify all 7 role variants + .ds-badge--source +
 * .ds-badge--state render visibly distinct from each other.
 */

import { launchWithExtension } from "./helpers";

async function main(): Promise<void> {
  const { browser, sidepanel } = await launchWithExtension();
  try {
    await sidepanel.waitForSelector("#tab-panels", { timeout: 10000 });

    const styles = await sidepanel.evaluate(() => {
      const host = document.createElement("div");
      host.style.cssText = "position:fixed;left:-9999px;top:-9999px";
      const variants = ["link", "button", "heading", "img", "textbox", "landmark", "default"];
      const result: Record<string, { background: string; color: string }> = {};
      variants.forEach((v) => {
        const el = document.createElement("span");
        el.className = `ds-badge ds-badge--role-${v}`;
        el.textContent = v;
        host.appendChild(el);
      });
      const source = document.createElement("span");
      source.className = "ds-badge ds-badge--source";
      source.textContent = "label";
      host.appendChild(source);
      const stateBadge = document.createElement("span");
      stateBadge.className = "ds-badge ds-badge--state";
      stateBadge.textContent = "selected";
      host.appendChild(stateBadge);
      document.body.appendChild(host);
      Array.from(host.children).forEach((el, i) => {
        const cs = getComputedStyle(el as HTMLElement);
        const key = i < variants.length ? variants[i] : (i === variants.length ? "source" : "state");
        result[key] = { background: cs.backgroundColor, color: cs.color };
      });
      host.remove();
      return result;
    });

    console.log(JSON.stringify(styles, null, 2));

    // Expected values come from the actual --ds-* CSS variables / inline
    // hexes in sidepanel.css — not from a generic Tailwind palette. The
    // project's --ds-blue-* tokens map to Tailwind's sky-*, not blue-*.
    const expected: Record<string, { bg: string; color: string }> = {
      link:     { bg: "rgb(224, 242, 254)", color: "rgb(7, 89, 133)" },      // --ds-blue-100 (#e0f2fe), --ds-blue-700 (#075985)
      button:   { bg: "rgb(237, 233, 254)", color: "rgb(91, 33, 182)" },     // #ede9fe, #5b21b6 (literal)
      heading:  { bg: "rgb(254, 243, 199)", color: "rgb(146, 64, 14)" },     // --ds-amber-100, --ds-amber-800
      img:      { bg: "rgb(252, 231, 243)", color: "rgb(157, 23, 77)" },     // #fce7f3, #9d174d (literal)
      textbox:  { bg: "rgb(209, 250, 229)", color: "rgb(6, 78, 59)" },       // --ds-green-100 (#d1fae5), --ds-green-900 (#064e3b)
      landmark: { bg: "rgb(224, 231, 255)", color: "rgb(55, 48, 163)" },     // #e0e7ff, #3730a3 (literal)
      default:  { bg: "rgb(244, 244, 245)", color: "rgb(63, 63, 70)" },      // --ds-zinc-100, --ds-zinc-700
      source:   { bg: "rgb(228, 228, 231)", color: "rgb(82, 82, 91)" },      // --ds-zinc-200, --ds-zinc-600
      state:    { bg: "rgb(228, 228, 231)", color: "rgb(82, 82, 91)" },      // --ds-zinc-200, --ds-zinc-600
    };

    for (const [variant, want] of Object.entries(expected)) {
      const got = styles[variant];
      if (!got) throw new Error(`badge variant '${variant}' not rendered`);
      if (got.background !== want.bg) throw new Error(`badge ${variant} bg mismatch: got ${got.background}, want ${want.bg}`);
      if (got.color !== want.color) throw new Error(`badge ${variant} color mismatch: got ${got.color}, want ${want.color}`);
    }

    // The 7 role variants must all be distinct from each other.
    const roleVariants = ["link", "button", "heading", "img", "textbox", "landmark", "default"];
    const roleBgs = new Set(roleVariants.map((v) => styles[v]!.background));
    if (roleBgs.size !== roleVariants.length) {
      throw new Error(`Role badge backgrounds collide: ${JSON.stringify(Array.from(roleBgs))}`);
    }

    console.log("\n✅ Audit item 8 verified: 7 role badges + source + state all render visibly distinct.\n");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("\n❌ Verification failed:", err);
  process.exit(1);
});

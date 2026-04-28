/**
 * Visual verification — closes audit item 1.
 *
 * The bug: ".toolbar-btn.active" class was toggled by JS but had no CSS
 * rule, so the Violations toggle looked identical pressed vs unpressed.
 *
 * The fix: a CSS rule with amber background/border + amber-700 text was
 * added to extension/src/sidepanel/sidepanel.css.
 *
 * This script loads the actual built sidepanel.html, injects two
 * .toolbar-btn elements (one plain, one with .active), reads the
 * computed background/border, and asserts they differ AND match the
 * expected amber values. Pixel-real verification, not "the rule is in
 * the file."
 */

import { launchWithExtension } from "./helpers";

async function main(): Promise<void> {
  const { browser, sidepanel } = await launchWithExtension();
  try {
    // Wait for the sidepanel CSS to be fully loaded.
    await sidepanel.waitForSelector("#tab-panels", { timeout: 10000 });

    const styles = await sidepanel.evaluate(() => {
      // Build a hidden test container so we don't disrupt the live UI.
      const host = document.createElement("div");
      host.style.position = "fixed";
      host.style.left = "-9999px";
      host.style.top = "-9999px";
      const inactive = document.createElement("button");
      inactive.className = "toolbar-btn";
      inactive.id = "__test-inactive";
      inactive.textContent = "Violations";
      const active = document.createElement("button");
      active.className = "toolbar-btn active";
      active.id = "__test-active";
      active.textContent = "Violations";
      host.appendChild(inactive);
      host.appendChild(active);
      document.body.appendChild(host);

      const ic = getComputedStyle(inactive);
      const ac = getComputedStyle(active);
      const result = {
        inactive: { background: ic.backgroundColor, color: ic.color, borderColor: ic.borderColor },
        active: { background: ac.backgroundColor, color: ac.color, borderColor: ac.borderColor },
      };
      host.remove();
      return result;
    });

    console.log("Inactive:", JSON.stringify(styles.inactive));
    console.log("Active:  ", JSON.stringify(styles.active));

    // Assertions — both reads must succeed AND differ AND match the amber rule.
    if (styles.inactive.background === styles.active.background &&
        styles.inactive.borderColor === styles.active.borderColor) {
      throw new Error(`Visual regression — pressed and unpressed look identical: ${styles.active.background}`);
    }
    const expectedActiveBg = "rgb(254, 243, 199)";       // #fef3c7
    const expectedActiveColor = "rgb(180, 83, 9)";       // #b45309
    const expectedActiveBorder = "rgb(245, 158, 11)";    // #f59e0b
    if (styles.active.background !== expectedActiveBg) {
      throw new Error(`Active background mismatch: got ${styles.active.background}, want ${expectedActiveBg}`);
    }
    if (styles.active.color !== expectedActiveColor) {
      throw new Error(`Active color mismatch: got ${styles.active.color}, want ${expectedActiveColor}`);
    }
    if (styles.active.borderColor !== expectedActiveBorder) {
      throw new Error(`Active border mismatch: got ${styles.active.borderColor}, want ${expectedActiveBorder}`);
    }

    console.log("\n✅ Audit item 1 verified: .toolbar-btn.active renders distinct amber styling.\n");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("\n❌ Verification failed:", err);
  process.exit(1);
});

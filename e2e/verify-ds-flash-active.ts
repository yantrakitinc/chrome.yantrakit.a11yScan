/**
 * Visual verification — closes audit item 6.
 *
 * .ds-flash-active is added by flashActiveItem / flashKbItem for 3s after
 * a Highlight click on a violation/gap/indicator/trap item. The rule
 * draws an amber-500 outline.
 */

import { launchWithExtension } from "./helpers";

async function main(): Promise<void> {
  const { browser, sidepanel } = await launchWithExtension();
  try {
    await sidepanel.waitForSelector("#tab-panels", { timeout: 10000 });

    const styles = await sidepanel.evaluate(() => {
      const host = document.createElement("div");
      host.style.cssText = "position:fixed;left:-9999px;top:-9999px";
      const inactive = document.createElement("div");
      inactive.textContent = "no flash";
      const active = document.createElement("div");
      active.className = "ds-flash-active";
      active.textContent = "flashing";
      host.appendChild(inactive);
      host.appendChild(active);
      document.body.appendChild(host);
      const ic = getComputedStyle(inactive);
      const ac = getComputedStyle(active);
      const out = {
        inactive: { outlineWidth: ic.outlineWidth, outlineColor: ic.outlineColor, outlineStyle: ic.outlineStyle },
        active: { outlineWidth: ac.outlineWidth, outlineColor: ac.outlineColor, outlineStyle: ac.outlineStyle },
      };
      host.remove();
      return out;
    });

    console.log("Inactive:", JSON.stringify(styles.inactive));
    console.log("Active:  ", JSON.stringify(styles.active));

    const expectedColor = "rgb(245, 158, 11)";   // --ds-amber-500
    const expectedWidth = "2px";
    if (styles.active.outlineColor !== expectedColor) {
      throw new Error(`Active outline color mismatch: got ${styles.active.outlineColor}, want ${expectedColor}`);
    }
    if (styles.active.outlineWidth !== expectedWidth) {
      throw new Error(`Active outline width mismatch: got ${styles.active.outlineWidth}, want ${expectedWidth}`);
    }
    if (styles.active.outlineStyle === "none") {
      throw new Error(`Active outline style should not be 'none'`);
    }
    if (styles.inactive.outlineWidth === styles.active.outlineWidth &&
        styles.inactive.outlineColor === styles.active.outlineColor &&
        styles.inactive.outlineStyle === styles.active.outlineStyle) {
      throw new Error("Flashing element renders identically to inactive");
    }

    console.log("\n✅ Audit item 6 verified: .ds-flash-active produces a distinct amber outline.\n");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("\n❌ Verification failed:", err);
  process.exit(1);
});

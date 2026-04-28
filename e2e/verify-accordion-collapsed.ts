/**
 * Visual verification — closes audit item 9.
 *
 * .accordion-body.collapsed sets grid-template-rows: 0fr (animatable
 * collapse from 1fr). Verify (a) expanded vs collapsed produce different
 * computed grid-template-rows AND (b) the collapsed state actually causes
 * the inner content to be 0px tall.
 */

import { launchWithExtension } from "./helpers";

async function main(): Promise<void> {
  const { browser, sidepanel } = await launchWithExtension();
  try {
    await sidepanel.waitForSelector("#tab-panels", { timeout: 10000 });

    const styles = await sidepanel.evaluate(() => {
      const host = document.createElement("div");
      host.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:300px";

      const expanded = document.createElement("div");
      expanded.className = "accordion-body";
      expanded.style.transition = "none"; // skip animation for measurement
      const expandedInner = document.createElement("div");
      expandedInner.className = "accordion-body-inner";
      const expandedContent = document.createElement("div");
      expandedContent.style.cssText = "height:120px;background:red";
      expandedInner.appendChild(expandedContent);
      expanded.appendChild(expandedInner);

      const collapsed = document.createElement("div");
      collapsed.className = "accordion-body collapsed";
      collapsed.style.transition = "none";
      const collapsedInner = document.createElement("div");
      collapsedInner.className = "accordion-body-inner";
      const collapsedContent = document.createElement("div");
      collapsedContent.style.cssText = "height:120px;background:red";
      collapsedInner.appendChild(collapsedContent);
      collapsed.appendChild(collapsedInner);

      host.appendChild(expanded);
      host.appendChild(collapsed);
      document.body.appendChild(host);

      const ec = getComputedStyle(expanded);
      const cc = getComputedStyle(collapsed);
      const ie = getComputedStyle(expandedInner);
      const ic = getComputedStyle(collapsedInner);

      const out = {
        expanded: {
          gridTemplateRows: ec.gridTemplateRows,
          innerHeight: ie.height,
          rect: expandedInner.getBoundingClientRect().height,
        },
        collapsed: {
          gridTemplateRows: cc.gridTemplateRows,
          innerHeight: ic.height,
          rect: collapsedInner.getBoundingClientRect().height,
        },
      };
      host.remove();
      return out;
    });

    console.log("Expanded:", JSON.stringify(styles.expanded));
    console.log("Collapsed:", JSON.stringify(styles.collapsed));

    if (styles.expanded.gridTemplateRows === styles.collapsed.gridTemplateRows) {
      throw new Error(`grid-template-rows identical: ${styles.expanded.gridTemplateRows}`);
    }
    if (styles.collapsed.rect !== 0) {
      throw new Error(`Collapsed inner should be 0px tall, got ${styles.collapsed.rect}px`);
    }
    if (styles.expanded.rect <= 0) {
      throw new Error(`Expanded inner should have height > 0, got ${styles.expanded.rect}px`);
    }

    console.log("\n✅ Audit item 9 verified: .accordion-body.collapsed produces a measurable 0px collapse.\n");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("\n❌ Verification failed:", err);
  process.exit(1);
});

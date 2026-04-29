/**
 * Crawl-flow handlers: crawl-mode dropdown, URL-list panel + manual/file/
 * paste add + remove, crawl results view toggle (page/wcag), pause/resume/
 * cancel/continue/scan-then-continue + page-rule-wait controls.
 */

import { state, updateTabDisabledStates } from "../../sidepanel";
import { sendMessage } from "@shared/messages";
import type { iScanResult } from "@shared/types";
import { scanTabState } from "../state";
import {
  addManualUrlToList, removeUrlAtIndex, mergeNewUrlsIntoList,
  parseTextFileUrls, parsePastedUrls,
} from "../url-list";
import { rerender } from "./callbacks";

/** Wire the Crawl sub-tab — crawl-mode dropdown, URL-list panel + add/remove, view toggle (page/wcag), pause/resume/cancel, page-rule wait controls. */
export function attachCrawlListeners(): void {
  // Crawl mode select (F03-AC2)
  document.getElementById("crawl-mode")?.addEventListener("change", (e) => {
    scanTabState.crawlMode = (e.target as HTMLSelectElement).value as "follow" | "urllist";
    scanTabState.urlListPanelOpen = false;
    rerender();
  });

  // URL list panel open/close (F03-AC3)
  document.getElementById("url-list-open")?.addEventListener("click", () => {
    scanTabState.urlListPanelOpen = !scanTabState.urlListPanelOpen;
    rerender();
  });
  document.getElementById("url-list-done")?.addEventListener("click", () => {
    scanTabState.urlListPanelOpen = false;
    rerender();
  });

  // URL paste-area add — accepts plaintext or sitemap XML (F03-AC5)
  document.getElementById("url-paste-add")?.addEventListener("click", () => {
    const ta = document.getElementById("url-paste-area") as HTMLTextAreaElement | null;
    if (!ta) return;
    const newUrls = parsePastedUrls(ta.value);
    if (newUrls.length === 0) return;
    const { list, added } = mergeNewUrlsIntoList(scanTabState.crawlUrlList, newUrls);
    scanTabState.crawlUrlList.length = 0;
    scanTabState.crawlUrlList.push(...list);
    // Only clear textarea if URLs actually came out (so typo'd input survives).
    if (added > 0) ta.value = "";
    rerender();
  });

  // URL file upload .txt (F03-AC4)
  document.getElementById("url-file-input")?.addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const { list } = mergeNewUrlsIntoList(scanTabState.crawlUrlList, parseTextFileUrls(text));
      scanTabState.crawlUrlList.length = 0;
      scanTabState.crawlUrlList.push(...list);
      rerender();
    };
    reader.readAsText(file);
    input.value = "";
  });

  // URL manual add (F03-AC4)
  const addManualUrl = () => {
    const input = document.getElementById("url-manual-input") as HTMLInputElement | null;
    if (!input) return;
    const url = input.value.trim();
    if (!url || !input.checkValidity()) {
      input.reportValidity();
      return;
    }
    const { list, added } = addManualUrlToList(scanTabState.crawlUrlList, url);
    if (added) {
      scanTabState.crawlUrlList.length = 0;
      scanTabState.crawlUrlList.push(...list);
      input.value = "";
      rerender();
      document.getElementById("url-manual-input")?.focus();
    }
  };
  document.getElementById("url-manual-add")?.addEventListener("click", addManualUrl);
  document.getElementById("url-manual-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addManualUrl();
    }
  });

  // URL remove (F03-AC4)
  document.querySelectorAll<HTMLButtonElement>(".url-remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index ?? "0");
      const { list } = removeUrlAtIndex(scanTabState.crawlUrlList, idx);
      scanTabState.crawlUrlList.length = 0;
      scanTabState.crawlUrlList.push(...list);
      rerender();
    });
  });

  // Crawl results view toggle (F03-AC13)
  document.getElementById("crawl-view-page")?.addEventListener("click", () => {
    scanTabState.crawlViewMode = "page";
    rerender();
  });
  document.getElementById("crawl-view-wcag")?.addEventListener("click", () => {
    scanTabState.crawlViewMode = "wcag";
    rerender();
  });

  // Crawl run controls
  document.getElementById("pause-crawl")?.addEventListener("click", () => sendMessage({ type: "PAUSE_CRAWL" }));
  document.getElementById("resume-crawl")?.addEventListener("click", () => sendMessage({ type: "RESUME_CRAWL" }));
  document.getElementById("cancel-crawl")?.addEventListener("click", () => {
    state.crawlPhase = "idle";
    state.accordionExpanded = true;
    sendMessage({ type: "CANCEL_CRAWL" });
    updateTabDisabledStates();
    rerender();
  });
  document.getElementById("cancel-scan")?.addEventListener("click", () => {
    state.scanPhase = "idle";
    updateTabDisabledStates();
    rerender();
  });

  // Page-rule wait controls (F03 page-rule pause)
  document.getElementById("continue-crawl")?.addEventListener("click", () => {
    state.crawlWaitInfo = null;
    sendMessage({ type: "USER_CONTINUE" });
  });
  document.getElementById("scan-then-continue")?.addEventListener("click", async () => {
    const result = await sendMessage({ type: "SCAN_REQUEST" });
    if (result && (result as { type: string }).type === "SCAN_RESULT") {
      state.lastScanResult = (result as { payload: iScanResult }).payload;
      state.scanSubTab = "results";
    }
    state.crawlWaitInfo = null;
    sendMessage({ type: "USER_CONTINUE" });
    rerender();
  });
  document.getElementById("cancel-wait")?.addEventListener("click", () => {
    state.crawlWaitInfo = null;
    sendMessage({ type: "CANCEL_CRAWL" });
  });
}

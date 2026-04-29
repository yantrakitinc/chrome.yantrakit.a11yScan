/**
 * DevTools sidebar panel — shows a11y properties of the selected element (F20-AC12/AC13).
 * Evaluated in the devtools page context; reads data from the inspected window via eval.
 */

export interface iPanelViolation {
  ruleId: string;
  impact: string;
  message: string;
}

export interface iPanelData {
  selector: string;
  role: string;
  accessibleName: string;
  ariaAttributes: Record<string, string>;
  tabindex: number | null;
  isFocusable: boolean;
  violations: iPanelViolation[];
  error?: string;
}

export function render(data: iPanelData): void {
  const contentEl = document.getElementById("content");
  if (!contentEl) return;

  if (data.error) {
    contentEl.innerHTML = `<div id="status" style="color:var(--ds-red-700)">${data.error}</div>`;
    return;
  }

  const ariaRows = Object.entries(data.ariaAttributes)
    .map(([k, v]) => `<div class="aria-row">${k}="${v}"</div>`)
    .join("");

  const violationRows = data.violations.length === 0
    ? '<div style="font-size:11px;color:var(--ds-green-700);margin-top:4px">No violations found for this element.</div>'
    : data.violations.map((v) => `
        <div class="violation-item">
          <div><span class="violation-rule">${v.ruleId}</span><span class="violation-impact">[${v.impact}]</span></div>
          <div class="violation-msg">${v.message || ""}</div>
        </div>
      `).join("");

  contentEl.innerHTML = `
    <div class="section-label">Selector</div>
    <div class="value">${data.selector}</div>

    <div class="section-label">Role</div>
    <div class="value">${data.role}</div>

    <div class="section-label">Accessible Name</div>
    <div class="value">${data.accessibleName || "<none>"}</div>

    ${Object.keys(data.ariaAttributes).length > 0 ? `
      <div class="section-label">ARIA Attributes</div>
      ${ariaRows}
    ` : ""}

    <div class="section-label">Tabindex</div>
    <div class="value">${data.tabindex !== null ? String(data.tabindex) : "—"}</div>

    <div class="section-label">Keyboard</div>
    <div class="value ${data.isFocusable ? "focusable-yes" : "focusable-no"}">${data.isFocusable ? "Focusable" : "Not focusable"}</div>

    <div class="section-label">Violations (${data.violations.length})</div>
    ${violationRows}

    <button type="button" id="btn-refresh">Refresh</button>
  `;

  document.getElementById("btn-refresh")?.addEventListener("click", loadData);
}

export function loadData(): void {
  const statusEl = document.getElementById("status");
  if (statusEl) statusEl.textContent = "Loading…";

  // Expression evaluated in the context of the inspected page.
  // Reads from the content script's scan-state via the inspected window globals.
  const expression = `
    (function() {
      try {
        var el = $0;
        if (!el) return { error: "No element selected." };

        var ariaAttrs = {};
        for (var i = 0; i < el.attributes.length; i++) {
          var a = el.attributes[i];
          if (a.name.startsWith("aria-")) ariaAttrs[a.name] = a.value;
        }

        function getSelector(e) {
          if (e.id) return "#" + e.id;
          var tag = e.tagName.toLowerCase();
          var cls = Array.from(e.classList).filter(function(c) { return !/[\\[\\]:@!]/.test(c); }).slice(0, 2).join(".");
          return cls ? tag + "." + cls : tag;
        }

        function getAccessibleName(e) {
          return e.getAttribute("aria-label") || e.getAttribute("title") || (e.textContent || "").trim().substring(0, 80) || "";
        }

        function isFocusable(e) {
          var tag = e.tagName.toLowerCase();
          if (["a", "button", "input", "select", "textarea"].indexOf(tag) !== -1) return !e.hasAttribute("disabled");
          return e.tabIndex >= 0;
        }

        var selector = getSelector(el);

        // Match violations from last scan (stored in __a11yScanViolations global set by content script)
        var violations = [];
        var stored = window.__a11yScanViolations || [];
        for (var vi = 0; vi < stored.length; vi++) {
          var v = stored[vi];
          for (var ni = 0; ni < v.nodes.length; ni++) {
            if (v.nodes[ni].selector === selector) {
              violations.push({ ruleId: v.id, impact: v.impact, message: v.nodes[ni].failureSummary || "" });
              break;
            }
          }
        }

        return {
          selector: selector,
          role: el.getAttribute("role") || el.tagName.toLowerCase(),
          accessibleName: getAccessibleName(el),
          ariaAttributes: ariaAttrs,
          tabindex: el.hasAttribute("tabindex") ? el.tabIndex : null,
          isFocusable: isFocusable(el),
          violations: violations
        };
      } catch(err) {
        return { error: String(err) };
      }
    })()
  `;

  chrome.devtools.inspectedWindow.eval(
    expression,
    (result: iPanelData, exceptionInfo: chrome.devtools.inspectedWindow.EvaluationExceptionInfo) => {
      if (exceptionInfo.isException || !result) {
        render({ selector: "", role: "", accessibleName: "", ariaAttributes: {}, tabindex: null, isFocusable: false, violations: [], error: "Could not inspect element." });
        return;
      }
      const statusEl2 = document.getElementById("status");
      if (statusEl2) statusEl2.textContent = "";
      render(result);
    }
  );
}

// Load on startup and whenever selection changes — only when running inside
// DevTools (the unit test harness imports this module without chrome.devtools).
if (typeof chrome !== "undefined" && chrome.devtools?.panels?.elements) {
  loadData();
  chrome.devtools.panels.elements.onSelectionChanged.addListener(loadData);
}

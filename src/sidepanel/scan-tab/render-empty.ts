/**
 * Empty-state copy shown when nothing has been scanned.
 */

export function renderEmptyState(): string {
  return `
    <div style="padding:16px">
      <h2 style="font-size:14px;font-weight:800;color:var(--ds-zinc-900);margin-bottom:4px">Get started</h2>
      <p style="font-size:12px;color:var(--ds-zinc-600);line-height:1.5">Click the button above to check this page for accessibility issues.</p>
      <div style="margin-top:16px">
        <h3 style="font-size:11px;font-weight:800;color:var(--ds-zinc-500);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Scan modes</h3>
        <div style="padding-left:12px;border-left:2px solid var(--ds-sky-400);margin-bottom:8px">
          <div class="scan-section-title">Crawl</div>
          <div class="scan-body">Automatically visits every page on your website and checks each one for issues.</div>
        </div>
        <div style="padding-left:12px;border-left:2px solid var(--ds-emerald-400);margin-bottom:8px">
          <div class="scan-section-title">Observer</div>
          <div class="scan-body">Watches your browsing and checks every page you visit. Everything stays on your computer.</div>
        </div>
        <div style="padding-left:12px;border-left:2px solid var(--ds-violet-400);margin-bottom:8px">
          <div class="scan-section-title">Movie</div>
          <div class="scan-body">After each scan, shows you how keyboard-only users navigate the page step by step.</div>
        </div>
      </div>
    </div>
  `;
}

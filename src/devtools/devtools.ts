/**
 * DevTools page — registers the A11y Scan sidebar pane in the Elements panel (F20-AC12/AC13).
 */

chrome.devtools.panels.elements.createSidebarPane(
  "A11y Scan",
  (sidebar) => {
    sidebar.setPage("panel.html");

    chrome.devtools.panels.elements.onSelectionChanged.addListener(() => {
      sidebar.setPage("panel.html");
    });
  }
);

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

/** Per-tab scan results stored in memory. */
const tabResults = new Map<number, unknown>();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SCAN_REQUEST') {
    handleScan(sendResponse);
    return true;
  }
  if (message.type === 'GET_TAB_RESULTS') {
    handleGetTabResults(sendResponse);
    return true;
  }
  if (message.type === 'CLEAR_TAB_RESULTS') {
    handleClearTabResults(sendResponse);
    return true;
  }
  if (message.type === 'SAVE_MANUAL_STATE') {
    handleSaveManualState(message.payload);
    return false;
  }
  if (message.type === 'RUN_ARIA_SCAN') {
    handleAriaScan(sendResponse);
    return true;
  }
  if (message.type === 'APPLY_CVD_FILTER') {
    handleCvdFilter(message.matrix, sendResponse);
    return true;
  }
  if (message.type === 'HIGHLIGHT_ELEMENT') {
    handleHighlight(message.selector, sendResponse);
    return true;
  }
  if (message.type === 'SHOW_VIOLATION_OVERLAY') {
    forwardToContentScript({ type: 'SHOW_VIOLATION_OVERLAY', violations: message.violations }, sendResponse);
    return true;
  }
  if (message.type === 'HIDE_VIOLATION_OVERLAY') {
    forwardToContentScript({ type: 'HIDE_VIOLATION_OVERLAY' }, sendResponse);
    return true;
  }
  if (message.type === 'SHOW_TAB_ORDER') {
    forwardToContentScript({ type: 'SHOW_TAB_ORDER' }, sendResponse);
    return true;
  }
  if (message.type === 'HIDE_TAB_ORDER') {
    forwardToContentScript({ type: 'HIDE_TAB_ORDER' }, sendResponse);
    return true;
  }
  if (message.type === 'SHOW_FOCUS_GAPS') {
    forwardToContentScript({ type: 'SHOW_FOCUS_GAPS' }, sendResponse);
    return true;
  }
  if (message.type === 'HIDE_FOCUS_GAPS') {
    forwardToContentScript({ type: 'HIDE_FOCUS_GAPS' }, sendResponse);
    return true;
  }
  if (message.type === 'GET_TAB_ORDER') {
    forwardToContentScript({ type: 'GET_TAB_ORDER' }, sendResponse);
    return true;
  }
  if (message.type === 'GET_FOCUS_GAPS') {
    forwardToContentScript({ type: 'GET_FOCUS_GAPS' }, sendResponse);
    return true;
  }
});

/** When user switches tabs, notify side panel to update. */
chrome.tabs.onActivated.addListener((activeInfo) => {
  const results = tabResults.get(activeInfo.tabId);
  chrome.runtime.sendMessage({
    type: 'TAB_CHANGED',
    tabId: activeInfo.tabId,
    results: results || null,
  }).catch(() => {});
});

/** When a tab navigates to a new URL, clear its results and notify. */
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === 'loading') {
    if (tabResults.has(tabId)) {
      tabResults.delete(tabId);
      chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => {
        if (activeTab?.id === tabId) {
          chrome.runtime.sendMessage({
            type: 'TAB_CHANGED',
            tabId,
            results: null,
            reason: 'navigated',
          }).catch(() => {});
        }
      });
    }
  }
});

/** When a tab closes, clean up its results. */
chrome.tabs.onRemoved.addListener((tabId) => {
  tabResults.delete(tabId);
});

async function handleScan(sendResponse: (response: unknown) => void) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      sendResponse({ type: 'SCAN_ERROR', message: 'No active tab found.' });
      return;
    }

    const url = tab.url || '';
    const blocked =
      !url ||
      url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('edge://') ||
      url.startsWith('brave://') ||
      url.startsWith('chrome-search://') ||
      url.startsWith('about:');

    if (blocked) {
      sendResponse({ type: 'SCAN_ERROR', message: 'Cannot scan Chrome internal pages. Navigate to a website (http/https) to scan.' });
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });

    await new Promise((r) => setTimeout(r, 100));

    chrome.tabs.sendMessage(tab.id, { type: 'RUN_SCAN' }, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ type: 'SCAN_ERROR', message: chrome.runtime.lastError.message });
      } else {
        tabResults.set(tab.id!, response);
        sendResponse(response);
      }
    });
  } catch (err) {
    sendResponse({ type: 'SCAN_ERROR', message: String(err) });
  }
}

async function handleGetTabResults(sendResponse: (response: unknown) => void) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && tabResults.has(tab.id)) {
    sendResponse({ type: 'TAB_RESULTS', results: tabResults.get(tab.id) });
  } else {
    sendResponse({ type: 'TAB_RESULTS', results: null });
  }
}

async function handleClearTabResults(sendResponse: (response: unknown) => void) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    tabResults.delete(tab.id);
  }
  sendResponse({ type: 'TAB_CLEARED' });
}

async function handleSaveManualState(manualState: Record<string, string | null>) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && tabResults.has(tab.id)) {
    const results = tabResults.get(tab.id) as any;
    results._manualState = manualState;
    tabResults.set(tab.id, results);
  }
}

async function handleHighlight(selector: string, sendResponse: (response: unknown) => void) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) { sendResponse({ ok: false }); return; }
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'HIGHLIGHT_ELEMENT', selector });
    sendResponse(response);
  } catch {
    sendResponse({ ok: false });
  }
}

async function handleCvdFilter(matrix: number[] | null, sendResponse: (response: unknown) => void) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) { sendResponse({ ok: false }); return; }
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'APPLY_CVD_FILTER', matrix });
    sendResponse(response);
  } catch {
    sendResponse({ ok: false });
  }
}

/**
 * Injects the content script if needed and forwards a message to the active tab.
 */
async function forwardToContentScript(message: Record<string, unknown>, sendResponse: (response: unknown) => void) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) { sendResponse({ ok: false }); return; }
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    const response = await chrome.tabs.sendMessage(tab.id, message);
    sendResponse(response);
  } catch {
    sendResponse({ ok: false });
  }
}

async function handleAriaScan(sendResponse: (response: unknown) => void) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      sendResponse({ type: 'ARIA_SCAN_ERROR', message: 'No active tab found.' });
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'RUN_ARIA_SCAN' });

    // Store ARIA results alongside main scan results
    if (tabResults.has(tab.id)) {
      const results = tabResults.get(tab.id) as any;
      results._ariaWidgets = response?.widgets || [];
      tabResults.set(tab.id, results);
    }
    sendResponse(response);
  } catch (err) {
    sendResponse({ type: 'ARIA_SCAN_ERROR', message: String(err) });
  }
}

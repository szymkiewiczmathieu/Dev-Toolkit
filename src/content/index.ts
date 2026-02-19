/** Content script - injected into Salesforce pages */

import { sendSessionToBackground } from "./sessionExtractor";
import { initFieldHighlighter } from "./fieldHighlighter";

// Send session info to background on page load
sendSessionToBackground();

// Initialize field highlighter for the Field Inspector feature
initFieldHighlighter();

// Listen for commands from the extension
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "TOGGLE_FIELD_INSPECTOR") {
    toggleFieldInspector();
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "OPEN_QUICK_NAV") {
    openQuickNav();
    sendResponse({ ok: true });
    return;
  }
});

let fieldInspectorActive = false;

function toggleFieldInspector(): void {
  fieldInspectorActive = !fieldInspectorActive;
  document.body.classList.toggle("sfdt-inspector-active", fieldInspectorActive);
}

function openQuickNav(): void {
  // Dispatch custom event that the quick nav overlay listens to
  window.dispatchEvent(new CustomEvent("sfdt-open-quick-nav"));
}

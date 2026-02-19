/** Extract Salesforce session info from the current page */

export function extractSessionInfo(): {
  sessionId: string | null;
  instanceUrl: string;
} {
  const instanceUrl = `${window.location.protocol}//${window.location.hostname}`;

  // Try to get session ID from cookie
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "sid" && value) {
      return { sessionId: value, instanceUrl };
    }
  }

  return { sessionId: null, instanceUrl };
}

/** Send session info to the background service worker */
export function sendSessionToBackground(): void {
  const { sessionId } = extractSessionInfo();
  if (sessionId) {
    chrome.runtime.sendMessage({
      type: "SESSION_FROM_CONTENT",
      sessionId,
      href: window.location.href,
    });
  }
}

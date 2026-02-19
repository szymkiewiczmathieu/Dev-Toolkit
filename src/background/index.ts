/** Service Worker - Background script for SF Dev Toolkit */

import type { SfConnection } from "../lib/sfApi";

// Open side panel when clicking the extension icon
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

/**
 * Find the best Salesforce session by scanning ALL sid cookies.
 * Returns both the session ID and the correct API instance URL
 * derived from the cookie's domain (not guessed from the tab URL).
 */
async function findSalesforceSession(
  tabUrl: string
): Promise<{ sessionId: string; instanceUrl: string } | null> {
  try {
    const tabHostname = new URL(tabUrl).hostname;

    // Extract the org identifier from the tab URL
    // e.g. "bridor--devrunbrd" from "bridor--devrunbrd.sandbox.lightning.force.com"
    // or "bridor--devrunbrd" from "bridor--devrunbrd.lightning.force.com"
    const orgId = tabHostname.split(".")[0]; // First segment is always the org identifier

    // Get ALL sid cookies across all Salesforce domains
    const allCookies = await chrome.cookies.getAll({ name: "sid" });

    // Filter to only Salesforce-related cookies
    const sfCookies = allCookies.filter(
      (c) =>
        c.domain.includes(".salesforce.com") ||
        c.domain.includes(".force.com")
    );

    // Strategy 1: Find a cookie whose domain starts with the same org identifier
    // This is the most reliable match
    for (const cookie of sfCookies) {
      const cookieDomain = cookie.domain.startsWith(".")
        ? cookie.domain.slice(1)
        : cookie.domain;

      if (cookieDomain.startsWith(orgId)) {
        // Prefer .my.salesforce.com domains for API calls
        if (cookieDomain.includes(".my.salesforce.com")) {
          return {
            sessionId: cookie.value,
            instanceUrl: `https://${cookieDomain}`,
          };
        }
      }
    }

    // Strategy 2: Find any cookie on a .my.salesforce.com domain matching the org
    for (const cookie of sfCookies) {
      const cookieDomain = cookie.domain.startsWith(".")
        ? cookie.domain.slice(1)
        : cookie.domain;

      if (
        cookieDomain.includes(orgId) &&
        cookieDomain.includes("salesforce.com")
      ) {
        return {
          sessionId: cookie.value,
          instanceUrl: `https://${cookieDomain}`,
        };
      }
    }

    // Strategy 3: Try the exact tab domain
    const exactCookie = await chrome.cookies.get({ url: tabUrl, name: "sid" });
    if (exactCookie) {
      // For Lightning URLs, convert to My Salesforce for API calls
      const instanceUrl = tabHostname.endsWith(".lightning.force.com")
        ? `https://${tabHostname.replace(".lightning.force.com", ".my.salesforce.com")}`
        : `https://${tabHostname}`;
      return { sessionId: exactCookie.value, instanceUrl };
    }

    // Strategy 4: Brute-force common domain patterns for the org
    const domainPatterns = [
      `${orgId}.my.salesforce.com`,
      `${orgId}.sandbox.my.salesforce.com`,
      `${orgId}.develop.my.salesforce.com`,
      `${orgId}.scratch.my.salesforce.com`,
    ];
    for (const domain of domainPatterns) {
      const cookie = await chrome.cookies.get({
        url: `https://${domain}`,
        name: "sid",
      });
      if (cookie) {
        return {
          sessionId: cookie.value,
          instanceUrl: `https://${domain}`,
        };
      }
    }

    // Strategy 5: Fallback to session stored by content script
    const stored = await chrome.storage.session.get(["sessionId", "href"]);
    if (stored.sessionId && stored.href) {
      const storedHostname = new URL(stored.href).hostname;
      const instanceUrl = storedHostname.endsWith(".lightning.force.com")
        ? `https://${storedHostname.replace(".lightning.force.com", ".my.salesforce.com")}`
        : `https://${storedHostname}`;
      return { sessionId: stored.sessionId, instanceUrl };
    }

    return null;
  } catch {
    return null;
  }
}

export type MessageType =
  | { type: "GET_CONNECTION" }
  | { type: "SF_API_REQUEST"; path: string; method?: string; body?: string }
  | { type: "SF_SOAP_DESCRIBE"; objectName: string; locale: string }
  | { type: "SESSION_FROM_CONTENT"; sessionId: string; href: string };

const HANDLED_TYPES = ["GET_CONNECTION", "SF_API_REQUEST", "SF_SOAP_DESCRIBE", "SESSION_FROM_CONTENT"];

// Message handler - only handle messages meant for the background
chrome.runtime.onMessage.addListener((message: MessageType, sender, sendResponse) => {
  // Ignore messages not meant for the background (e.g. FIELD_CLICKED goes to side panel)
  if (!message?.type || !HANDLED_TYPES.includes(message.type)) {
    return false; // Let other listeners handle it
  }

  handleMessage(message, sender).then(sendResponse).catch((err) => {
    sendResponse({ error: err.message });
  });
  return true; // async response
});

async function handleMessage(
  message: MessageType,
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  switch (message.type) {
    case "GET_CONNECTION": {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.url) return { error: "No active Salesforce tab" };

      const isSf =
        tab.url.includes(".salesforce.com") ||
        tab.url.includes(".force.com");
      if (!isSf) return { error: "Not a Salesforce page" };

      const session = await findSalesforceSession(tab.url);
      if (!session) return { error: "No session found" };

      const conn: SfConnection = {
        instanceUrl: session.instanceUrl,
        sessionId: session.sessionId,
        apiVersion: "v62.0",
      };
      return { connection: conn };
    }

    case "SF_API_REQUEST": {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.url) return { error: "No active tab" };

      const session = await findSalesforceSession(tab.url);
      if (!session) return { error: "No session" };

      const url = `${session.instanceUrl}${message.path}`;

      const res = await fetch(url, {
        method: message.method || "GET",
        headers: {
          Authorization: `Bearer ${session.sessionId}`,
          "Content-Type": "application/json",
        },
        body: message.body || undefined,
      });

      const data = await res.json();
      if (!res.ok) return { error: JSON.stringify(data) };
      return { data };
    }

    case "SF_SOAP_DESCRIBE": {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.url) return { error: "No active tab" };

      const session = await findSalesforceSession(tab.url);
      if (!session) return { error: "No session" };

      const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:partner.soap.sforce.com">
  <soapenv:Header>
    <urn:SessionHeader><urn:sessionId>${session.sessionId}</urn:sessionId></urn:SessionHeader>
    <urn:LocaleOptions><urn:language>${message.locale}</urn:language></urn:LocaleOptions>
  </soapenv:Header>
  <soapenv:Body>
    <urn:describeSObject><urn:sObjectType>${message.objectName}</urn:sObjectType></urn:describeSObject>
  </soapenv:Body>
</soapenv:Envelope>`;

      const soapUrl = `${session.instanceUrl}/services/Soap/u/62.0`;
      const res = await fetch(soapUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: '""',
        },
        body: soapBody,
      });

      const xmlText = await res.text();
      if (!res.ok) return { error: `SOAP ${res.status}` };

      // Parse field labels from SOAP XML response
      const fieldLabels: Record<string, string> = {};
      const fieldRegex = /<fields>([\s\S]*?)<\/fields>/g;
      let match;
      while ((match = fieldRegex.exec(xmlText)) !== null) {
        const block = match[1];
        const nameMatch = block.match(/<name>(.*?)<\/name>/);
        const labelMatch = block.match(/<label>(.*?)<\/label>/);
        if (nameMatch && labelMatch) {
          fieldLabels[nameMatch[1]] = labelMatch[1];
        }
      }

      return { data: fieldLabels };
    }

    case "SESSION_FROM_CONTENT": {
      // Content script sends session info as fallback
      await chrome.storage.session.set({
        sessionId: message.sessionId,
        href: message.href,
      });
      return { ok: true };
    }

    default:
      return { error: "Unknown message type" };
  }
}

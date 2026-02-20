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
  | { type: "SF_METADATA_DEPLOY"; zipBase64: string }
  | { type: "SF_DEPLOY_STATUS"; deployId: string }
  | { type: "SESSION_FROM_CONTENT"; sessionId: string; href: string };

const HANDLED_TYPES = ["GET_CONNECTION", "SF_API_REQUEST", "SF_SOAP_DESCRIBE", "SF_METADATA_DEPLOY", "SF_DEPLOY_STATUS", "SESSION_FROM_CONTENT"];

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

      // Parse field labels and picklist values from SOAP XML response
      const fieldLabels: Record<string, string> = {};
      const picklistValues: Record<string, { value: string; label: string }[]> = {};
      const fieldRegex = /<fields>([\s\S]*?)<\/fields>/g;
      let match;
      while ((match = fieldRegex.exec(xmlText)) !== null) {
        const block = match[1];
        const nameMatch = block.match(/<name>(.*?)<\/name>/);
        const labelMatch = block.match(/<label>(.*?)<\/label>/);
        if (nameMatch && labelMatch) {
          const fieldName = nameMatch[1];
          fieldLabels[fieldName] = labelMatch[1];

          // Extract picklist values if present
          const pvRegex = /<picklistValues>([\s\S]*?)<\/picklistValues>/g;
          let pvMatch;
          const pvList: { value: string; label: string }[] = [];
          while ((pvMatch = pvRegex.exec(block)) !== null) {
            const pvBlock = pvMatch[1];
            const pvValue = pvBlock.match(/<value>(.*?)<\/value>/);
            const pvLabel = pvBlock.match(/<label>(.*?)<\/label>/);
            const pvActive = pvBlock.match(/<active>(.*?)<\/active>/);
            if (pvValue && pvLabel && pvActive?.[1] === "true") {
              pvList.push({ value: pvValue[1], label: pvLabel[1] });
            }
          }
          if (pvList.length > 0) {
            picklistValues[fieldName] = pvList;
          }
        }
      }

      return { data: { fieldLabels, picklistValues } };
    }

    case "SF_METADATA_DEPLOY": {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) return { error: "No active tab" };

      const session = await findSalesforceSession(tab.url);
      if (!session) return { error: "No session" };

      // Convert base64 ZIP to Blob
      const binaryString = atob(message.zipBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const zipBlob = new Blob([bytes], { type: "application/zip" });

      // Use SOAP Metadata API deploy
      const deployUrl = `${session.instanceUrl}/services/Soap/m/62.0`;
      const zipB64 = message.zipBase64;
      const deploySoapBody = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">
  <soapenv:Header>
    <met:SessionHeader><met:sessionId>${session.sessionId}</met:sessionId></met:SessionHeader>
  </soapenv:Header>
  <soapenv:Body>
    <met:deploy>
      <met:ZipFile>${zipB64}</met:ZipFile>
      <met:DeployOptions>
        <met:singlePackage>true</met:singlePackage>
        <met:rollbackOnError>true</met:rollbackOnError>
      </met:DeployOptions>
    </met:deploy>
  </soapenv:Body>
</soapenv:Envelope>`;

      const deployRes = await fetch(deployUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: '""',
        },
        body: deploySoapBody,
      });

      const deployXml = await deployRes.text();
      if (!deployRes.ok) {
        // Try to extract SOAP fault message
        const faultMatch = deployXml.match(/<faultstring>([\s\S]*?)<\/faultstring>/);
        return { error: faultMatch ? faultMatch[1] : `Deploy HTTP ${deployRes.status}` };
      }

      // Extract deploy ID from response
      const idMatch = deployXml.match(/<id>(.*?)<\/id>/);
      if (!idMatch) {
        // Check for SOAP fault in successful HTTP response
        const faultMatch = deployXml.match(/<faultstring>([\s\S]*?)<\/faultstring>/);
        return { error: faultMatch ? faultMatch[1] : "No deploy ID in response" };
      }

      return { data: { deployId: idMatch[1] } };
    }

    case "SF_DEPLOY_STATUS": {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) return { error: "No active tab" };

      const session = await findSalesforceSession(tab.url);
      if (!session) return { error: "No session" };

      const statusUrl = `${session.instanceUrl}/services/Soap/m/62.0`;
      const statusSoapBody = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">
  <soapenv:Header>
    <met:SessionHeader><met:sessionId>${session.sessionId}</met:sessionId></met:SessionHeader>
  </soapenv:Header>
  <soapenv:Body>
    <met:checkDeployStatus>
      <met:asyncProcessId>${message.deployId}</met:asyncProcessId>
      <met:includeDetails>true</met:includeDetails>
    </met:checkDeployStatus>
  </soapenv:Body>
</soapenv:Envelope>`;

      const statusRes = await fetch(statusUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: '""',
        },
        body: statusSoapBody,
      });

      const statusXml = await statusRes.text();
      if (!statusRes.ok) return { error: `Status check failed: ${statusRes.status}` };

      const doneMatch = statusXml.match(/<done>(.*?)<\/done>/);
      const successMatch = statusXml.match(/<success>(.*?)<\/success>/);
      const statusMatch = statusXml.match(/<status>(.*?)<\/status>/);
      const errorMsg = statusXml.match(/<errorMessage>(.*?)<\/errorMessage>/);

      // Also extract component failure details (where actual errors usually are)
      let errorMessage = errorMsg?.[1] || null;
      if (!errorMessage || errorMessage === "null") {
        // Look for componentFailures > problem
        const problemMatch = statusXml.match(/<problem>([\s\S]*?)<\/problem>/);
        if (problemMatch) {
          const fullName = statusXml.match(/<fullName>([\s\S]*?)<\/fullName>/);
          errorMessage = (fullName ? fullName[1] + ": " : "") + problemMatch[1];
        }
      }
      // Also check for generic error messages in the response
      if (!errorMessage || errorMessage === "null") {
        const faultMatch = statusXml.match(/<faultstring>([\s\S]*?)<\/faultstring>/);
        if (faultMatch) {
          errorMessage = faultMatch[1];
        }
      }

      return {
        data: {
          done: doneMatch?.[1] === "true",
          success: successMatch?.[1] === "true",
          status: statusMatch?.[1] || "Unknown",
          errorMessage,
        },
      };
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

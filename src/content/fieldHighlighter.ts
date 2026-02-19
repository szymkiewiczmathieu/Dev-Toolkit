/** Field Highlighter - detects Salesforce fields on Lightning pages */

interface FieldInfo {
  apiName: string;
  objectName: string;
  fieldLabel: string;
  element: HTMLElement;
}

let isActive = false;
let currentTooltip: HTMLElement | null = null;

export function initFieldHighlighter(): void {
  // Listen for hover events on field elements
  document.addEventListener("mouseover", handleMouseOver, true);
  document.addEventListener("mouseout", handleMouseOut, true);
  document.addEventListener("click", handleClick, true);
}

function handleMouseOver(e: MouseEvent): void {
  if (!document.body.classList.contains("sfdt-inspector-active")) return;

  const target = e.target as HTMLElement;
  const fieldInfo = extractFieldInfo(target);
  if (!fieldInfo) return;

  fieldInfo.element.classList.add("sfdt-field-highlight");
  showTooltip(fieldInfo);
}

function handleMouseOut(e: MouseEvent): void {
  if (!document.body.classList.contains("sfdt-inspector-active")) return;

  const target = e.target as HTMLElement;
  target.classList.remove("sfdt-field-highlight");

  const parent = target.closest(".sfdt-field-highlight");
  if (parent) parent.classList.remove("sfdt-field-highlight");

  removeTooltip();
}

function handleClick(e: MouseEvent): void {
  if (!document.body.classList.contains("sfdt-inspector-active")) return;

  const target = e.target as HTMLElement;
  const fieldInfo = extractFieldInfo(target);
  if (!fieldInfo) return;

  e.preventDefault();
  e.stopPropagation();

  // Send field info to side panel
  chrome.runtime.sendMessage({
    type: "FIELD_CLICKED",
    field: {
      apiName: fieldInfo.apiName,
      objectName: fieldInfo.objectName,
      fieldLabel: fieldInfo.fieldLabel,
    },
  });

  // Copy API name to clipboard
  navigator.clipboard.writeText(fieldInfo.apiName).catch(() => {});

  // Flash feedback
  showCopyFeedback(fieldInfo.element, fieldInfo.apiName);
}

function extractFieldInfo(element: HTMLElement): FieldInfo | null {
  // Lightning record fields have data-target-selection-name
  // Format: "sfdc:RecordField.Account.Name"
  const selectionName =
    element.closest("[data-target-selection-name]")?.getAttribute("data-target-selection-name") ||
    element.getAttribute("data-target-selection-name");

  if (selectionName) {
    const parts = selectionName.split(".");
    if (parts.length >= 3) {
      const objectName = parts[1];
      const fieldName = parts.slice(2).join(".");
      const label =
        element.closest(".slds-form-element")?.querySelector(".slds-form-element__label")?.textContent?.trim() ||
        fieldName;
      return {
        apiName: fieldName,
        objectName,
        fieldLabel: label,
        element: (element.closest("[data-target-selection-name]") as HTMLElement) || element,
      };
    }
  }

  // Try data-field-id attribute (used in some Lightning components)
  const fieldId = element.closest("[data-field-id]")?.getAttribute("data-field-id");
  if (fieldId) {
    const label = element.closest(".slds-form-element")?.querySelector(".slds-form-element__label")?.textContent?.trim() || "";
    return {
      apiName: fieldId,
      objectName: "",
      fieldLabel: label,
      element: (element.closest("[data-field-id]") as HTMLElement) || element,
    };
  }

  // Try output field containers
  const outputField = element.closest("lightning-output-field, lightning-input-field");
  if (outputField) {
    const fieldName = outputField.getAttribute("field-name") || outputField.getAttribute("data-field") || "";
    if (fieldName) {
      const label = outputField.querySelector(".slds-form-element__label")?.textContent?.trim() || fieldName;
      return {
        apiName: fieldName,
        objectName: "",
        fieldLabel: label,
        element: outputField as HTMLElement,
      };
    }
  }

  return null;
}

function showTooltip(info: FieldInfo): void {
  removeTooltip();

  const tooltip = document.createElement("div");
  tooltip.className = "sfdt-tooltip";
  tooltip.innerHTML = `
    <div class="sfdt-tooltip-api">${info.apiName}</div>
    ${info.objectName ? `<div class="sfdt-tooltip-obj">${info.objectName}</div>` : ""}
    <div class="sfdt-tooltip-hint">Click to copy & inspect</div>
  `;

  const rect = info.element.getBoundingClientRect();
  tooltip.style.top = `${rect.top + window.scrollY - 8}px`;
  tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;

  document.body.appendChild(tooltip);
  currentTooltip = tooltip;
}

function removeTooltip(): void {
  if (currentTooltip) {
    currentTooltip.remove();
    currentTooltip = null;
  }
}

function showCopyFeedback(element: HTMLElement, apiName: string): void {
  const feedback = document.createElement("div");
  feedback.className = "sfdt-copy-feedback";
  feedback.textContent = `Copied: ${apiName}`;

  const rect = element.getBoundingClientRect();
  feedback.style.top = `${rect.top + window.scrollY - 32}px`;
  feedback.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;

  document.body.appendChild(feedback);
  setTimeout(() => feedback.remove(), 1500);
}

<script lang="ts">
  import { onMount } from "svelte";
  import { connection, isConnected } from "../stores/connection";
  import { loadObjectDescribe } from "../stores/metadata";
  import { inspectedField } from "../stores/inspector";
  import type { FieldDescribe, DescribeResult } from "../../lib/sfApi";
  import { getCustomFieldDef, getFieldDefinition } from "../../lib/toolingApi";
  import { getFieldTranslations, type FieldTranslations } from "../../lib/translationApi";

  let inspectorActive = $state(false);
  let currentField = $state<{ apiName: string; objectName: string; fieldLabel: string } | null>(null);
  let fieldDetails = $state<FieldDescribe | null>(null);
  let objectDescribe = $state<DescribeResult | null>(null);
  let masterLabel = $state<string | null>(null);
  let fieldDefInfo = $state<Record<string, unknown> | null>(null);
  let translations = $state<FieldTranslations>({});
  let isLoading = $state(false);
  let searchTerm = $state("");

  // React to inspected field changes from the store (set by App.svelte on FIELD_CLICKED)
  $effect(() => {
    const field = $inspectedField;
    if (field) {
      currentField = field;
      loadFieldDetails(field);
    }
  });

  async function toggleInspector() {
    inspectorActive = !inspectorActive;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_FIELD_INSPECTOR" });
      }
    } catch {
      // Content script not loaded - user needs to refresh the Salesforce page
      inspectorActive = false;
    }
  }

  async function loadFieldDetails(field: { apiName: string; objectName: string }) {
    if (!$connection || !field.objectName) {
      fieldDetails = null;
      objectDescribe = null;
      masterLabel = null;
      fieldDefInfo = null;
      return;
    }

    isLoading = true;
    masterLabel = null;
    fieldDefInfo = null;
    translations = {};

    try {
      const desc = await loadObjectDescribe($connection, field.objectName);
      if (desc) {
        objectDescribe = desc;
        fieldDetails = desc.fields.find((f) => f.name === field.apiName) || null;
      }

      // Load extra info in parallel (non-blocking)
      loadExtraInfo(field);
    } catch {
      fieldDetails = null;
    } finally {
      isLoading = false;
    }
  }

  async function loadExtraInfo(field: { apiName: string; objectName: string }) {
    if (!$connection) return;

    // Load FieldDefinition info (standard + custom fields)
    try {
      const fdi = await getFieldDefinition($connection, field.objectName, field.apiName);
      if (fdi) {
        fieldDefInfo = fdi;
      }
    } catch {}

    // For custom fields, get the master label from Tooling API
    if (field.apiName.endsWith("__c")) {
      try {
        const devName = field.apiName.replace("__c", "");
        const cfDef = await getCustomFieldDef($connection, field.objectName, devName);
        if (cfDef?.Metadata?.label) {
          masterLabel = cfDef.Metadata.label;
        }
      } catch {}
    }

    // Load translations (EN + ES) via SOAP API
    try {
      const trans = await getFieldTranslations(field.objectName, field.apiName);
      translations = trans;
    } catch {}
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  const filteredPicklist = $derived(() => {
    if (!fieldDetails?.picklistValues) return [];
    const values = fieldDetails.picklistValues.filter((p) => p.active);
    if (!searchTerm) return values;
    return values.filter(
      (p) =>
        p.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.value.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const recordTypes = $derived(() => {
    if (!objectDescribe?.recordTypeInfos) return [];
    return objectDescribe.recordTypeInfos.filter((rt) => !rt.master && rt.active);
  });
</script>

<div class="field-inspector">
  <div class="inspector-toggle">
    <button
      class="btn"
      class:btn-primary={inspectorActive}
      class:btn-ghost={!inspectorActive}
      onclick={toggleInspector}
      disabled={!$isConnected}
    >
      {inspectorActive ? "Inspector ON" : "Inspector OFF"}
    </button>
    <span class="inspector-hint">
      {inspectorActive ? "Click on a field in Salesforce" : "Enable to inspect fields"}
    </span>
  </div>

  {#if currentField}
    <div class="field-card">
      <div class="field-card-header">
        <div class="field-name">
          <code>{currentField.apiName}</code>
          <button class="btn btn-ghost btn-sm" onclick={() => copyToClipboard(currentField!.apiName)} title="Copy API name">
            Copy
          </button>
        </div>
        {#if currentField.objectName}
          <div class="field-object">{currentField.objectName}</div>
        {/if}
        <div class="field-label">{currentField.fieldLabel}</div>
      </div>

      {#if isLoading}
        <div class="field-loading">Loading field details...</div>
      {:else if fieldDetails}
        <div class="field-details">
          <!-- Labels / Translations -->
          <div class="detail-section">
            <div class="detail-section-title">Labels & Translations</div>
            <div class="label-list">
              {#if masterLabel}
                <div class="label-row">
                  <span class="label-lang label-flag">FR</span>
                  <span class="label-text">{masterLabel}</span>
                </div>
              {:else}
                <div class="label-row">
                  <span class="label-lang label-flag">FR</span>
                  <span class="label-text">{fieldDetails.label}</span>
                </div>
              {/if}
              {#if translations.en}
                <div class="label-row">
                  <span class="label-lang label-flag">EN</span>
                  <span class="label-text">{translations.en}</span>
                </div>
              {/if}
              {#if translations.es}
                <div class="label-row">
                  <span class="label-lang label-flag">ES</span>
                  <span class="label-text">{translations.es}</span>
                </div>
              {/if}
              {#if !translations.en && !translations.es && !masterLabel}
                <div class="label-row">
                  <span class="label-lang">Current</span>
                  <span class="label-text">{fieldDetails.label}</span>
                </div>
              {/if}
              {#if fieldDefInfo?.Description}
                <div class="label-row">
                  <span class="label-lang">Desc</span>
                  <span class="label-text label-desc">{fieldDefInfo.Description}</span>
                </div>
              {/if}
            </div>
          </div>

          <!-- Properties grid -->
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">Type</span>
              <span class="detail-value">{fieldDetails.type}</span>
            </div>
            {#if fieldDetails.length > 0}
              <div class="detail-item">
                <span class="detail-label">Length</span>
                <span class="detail-value">{fieldDetails.length}</span>
              </div>
            {/if}
            {#if fieldDetails.precision > 0}
              <div class="detail-item">
                <span class="detail-label">Precision</span>
                <span class="detail-value">{fieldDetails.precision},{fieldDetails.scale}</span>
              </div>
            {/if}
            <div class="detail-item">
              <span class="detail-label">Custom</span>
              <span class="detail-value">{fieldDetails.custom ? "Yes" : "No"}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Required</span>
              <span class="detail-value">{!fieldDetails.nillable ? "Yes" : "No"}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Updatable</span>
              <span class="detail-value">{fieldDetails.updateable ? "Yes" : "No"}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Calculated</span>
              <span class="detail-value">{fieldDetails.calculated ? "Yes" : "No"}</span>
            </div>
            {#if fieldDefInfo?.IsIndexed}
              <div class="detail-item">
                <span class="detail-label">Indexed</span>
                <span class="detail-value">Yes</span>
              </div>
            {/if}
            {#if fieldDefInfo?.IsFieldHistoryTracked}
              <div class="detail-item">
                <span class="detail-label">History</span>
                <span class="detail-value">Tracked</span>
              </div>
            {/if}
          </div>

          <!-- References -->
          {#if fieldDetails.referenceTo && fieldDetails.referenceTo.length > 0}
            <div class="detail-section">
              <div class="detail-section-title">References</div>
              <div class="detail-refs">
                {#each fieldDetails.referenceTo as ref}
                  <span class="ref-badge">{ref}</span>
                {/each}
                {#if fieldDetails.relationshipName}
                  <div class="label-row" style="margin-top: 4px;">
                    <span class="label-lang">Relationship</span>
                    <code class="label-text">{fieldDetails.relationshipName}</code>
                  </div>
                {/if}
              </div>
            </div>
          {/if}

          <!-- Help Text -->
          {#if fieldDetails.inlineHelpText}
            <div class="detail-section">
              <div class="detail-section-title">Help Text</div>
              <div class="detail-helptext">{fieldDetails.inlineHelpText}</div>
            </div>
          {/if}

          <!-- Record Types -->
          {#if recordTypes().length > 0}
            <div class="detail-section">
              <div class="detail-section-title">Record Types ({recordTypes().length})</div>
              <div class="rt-list">
                {#each recordTypes() as rt}
                  <div class="rt-item">
                    <span class="rt-name">{rt.name}</span>
                    {#if rt.developerName}
                      <span class="rt-dev">{rt.developerName}</span>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Picklist Values -->
          {#if fieldDetails.picklistValues && fieldDetails.picklistValues.length > 0}
            <div class="detail-section">
              <div class="detail-section-title">
                Picklist Values ({fieldDetails.picklistValues.filter((p) => p.active).length})
              </div>
              <input
                type="text"
                bind:value={searchTerm}
                placeholder="Filter values..."
                class="picklist-search"
              />
              <div class="picklist-list">
                {#each filteredPicklist() as pv}
                  <button class="picklist-item" onclick={() => copyToClipboard(pv.value)} title="Click to copy">
                    <span class="pv-value">{pv.value}</span>
                    {#if pv.label !== pv.value}
                      <span class="pv-label">{pv.label}</span>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Quick SOQL -->
          <div class="detail-section">
            <button
              class="btn btn-ghost btn-sm"
              onclick={() => copyToClipboard(`SELECT Id, ${currentField?.apiName} FROM ${currentField?.objectName} LIMIT 10`)}
              title="Copy SOQL query"
            >
              Copy SOQL: SELECT {currentField?.apiName}
            </button>
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <div class="inspector-empty">
      <div class="inspector-empty-icon">#</div>
      <p>Enable the inspector and click on any field in Salesforce to see its details.</p>
      <p class="inspector-empty-hint">API name is copied to clipboard on click.</p>
    </div>
  {/if}
</div>

<style>
  .field-inspector {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .inspector-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
  }

  .inspector-hint {
    font-size: 11px;
    color: var(--text-muted);
  }

  .inspector-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
    color: var(--text-muted);
    gap: 8px;
  }

  .inspector-empty-icon {
    font-size: 40px;
    font-weight: 700;
    color: var(--bg-tertiary);
    font-family: var(--font-mono);
  }

  .inspector-empty p {
    font-size: 12px;
    max-width: 250px;
  }

  .inspector-empty-hint {
    font-size: 11px !important;
    color: var(--text-muted);
  }

  /* Field card */
  .field-card {
    flex: 1;
    overflow-y: auto;
  }

  .field-card-header {
    padding: 10px 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
  }

  .field-name {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .field-name code {
    font-size: 14px;
    color: var(--accent);
    font-weight: 600;
  }

  .field-object {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .field-label {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 2px;
  }

  .field-loading {
    padding: 16px;
    text-align: center;
    color: var(--text-muted);
    font-size: 12px;
  }

  /* Labels section */
  .label-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .label-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 12px;
  }

  .label-lang {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    min-width: 40px;
    flex-shrink: 0;
  }

  .label-flag {
    font-weight: 700;
    font-size: 11px;
    color: var(--accent);
  }

  .label-text {
    color: var(--text-primary);
  }

  .label-desc {
    font-style: italic;
    color: var(--text-muted);
  }

  /* Details grid */
  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    background: var(--border);
    margin: 0;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    padding: 6px 10px;
    background: var(--bg-primary);
  }

  .detail-label {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .detail-value {
    font-size: 12px;
    color: var(--text-primary);
    font-family: var(--font-mono);
  }

  /* Sections */
  .detail-section {
    padding: 8px 12px;
    border-top: 1px solid var(--border);
  }

  .detail-section-title {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }

  .detail-helptext {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .ref-badge {
    display: inline-block;
    padding: 2px 8px;
    background: var(--bg-tertiary);
    border-radius: var(--radius);
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent);
    margin-right: 4px;
  }

  .detail-refs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  /* Record Types */
  .rt-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .rt-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 0;
    font-size: 12px;
  }

  .rt-name {
    color: var(--text-primary);
  }

  .rt-dev {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-muted);
  }

  /* Picklist - FIX: explicit colors on button elements */
  .picklist-search {
    width: 100%;
    padding: 4px 8px;
    font-size: 11px;
    margin-bottom: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .picklist-list {
    max-height: 200px;
    overflow-y: auto;
  }

  .picklist-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 4px 8px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
    background: transparent;
    border: none;
    text-align: left;
    color: var(--text-primary);
  }

  .picklist-item:hover {
    background: var(--bg-tertiary);
  }

  .pv-value {
    font-family: var(--font-mono);
    color: var(--text-primary);
    font-size: 11px;
  }

  .pv-label {
    color: var(--text-muted);
    font-size: 10px;
    margin-left: 8px;
  }
</style>

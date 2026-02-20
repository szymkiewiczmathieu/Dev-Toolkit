<script lang="ts">
  import { onMount } from "svelte";
  import { connection, isConnected } from "../stores/connection";
  import { loadObjectDescribe } from "../stores/metadata";
  import { inspectedField } from "../stores/inspector";
  import type { FieldDescribe, DescribeResult } from "../../lib/sfApi";
  import { getCustomFieldDef, getFieldDefinition } from "../../lib/toolingApi";
  import { getFieldTranslations, getPicklistTranslations, saveFieldLabelTranslation, type FieldTranslations, type PicklistValueTranslation, type DeployResult } from "../../lib/translationApi";

  let inspectorActive = $state(false);
  let currentField = $state<{ apiName: string; objectName: string; fieldLabel: string } | null>(null);
  let fieldDetails = $state<FieldDescribe | null>(null);
  let objectDescribe = $state<DescribeResult | null>(null);
  let masterLabel = $state<string | null>(null);
  let fieldDefInfo = $state<Record<string, unknown> | null>(null);
  let translations = $state<FieldTranslations>({});
  let picklistTranslations = $state<PicklistValueTranslation[]>([]);
  let isLoading = $state(false);
  let searchTerm = $state("");

  // Inline editing state
  let editingLabel = $state<{ locale: string; value: string } | null>(null);
  let editingPicklist = $state<{ locale: string; values: Map<string, string> } | null>(null);
  let isSaving = $state(false);
  let saveResult = $state<{ success: boolean; message: string } | null>(null);

  function startEditLabel(locale: string, currentValue: string) {
    editingLabel = { locale, value: currentValue };
    saveResult = null;
  }

  function cancelEditLabel() {
    editingLabel = null;
  }

  function startEditPicklist(locale: string) {
    if (!picklistTranslations.length) return;
    const values = new Map<string, string>();
    for (const pv of picklistTranslations) {
      const langVal = locale === "en" ? pv.en : pv.es;
      values.set(pv.value, langVal);
    }
    editingPicklist = { locale, values };
    saveResult = null;
  }

  function cancelEditPicklist() {
    editingPicklist = null;
  }

  function updatePicklistEdit(apiValue: string, newLabel: string) {
    if (editingPicklist) {
      editingPicklist.values.set(apiValue, newLabel);
    }
  }

  async function saveTranslation() {
    if (!currentField || (!editingLabel && !editingPicklist)) return;
    isSaving = true;
    saveResult = null;

    try {
      const locale = editingLabel?.locale || editingPicklist?.locale || "";
      const label = editingLabel?.value || "";

      // When editing a label only, also include existing picklist translations for that locale
      // so they don't get wiped. When editing picklists, include the existing label too.
      let picklistVals: { masterLabel: string; translation: string }[] | undefined;

      if (editingPicklist) {
        picklistVals = [];
        for (const pv of picklistTranslations) {
          const translation = editingPicklist.values.get(pv.value) || "";
          if (translation) {
            picklistVals.push({ masterLabel: pv.value, translation });
          }
        }
      } else if (picklistTranslations.length > 0) {
        // Editing label only — preserve existing picklist translations
        picklistVals = [];
        for (const pv of picklistTranslations) {
          const existingTranslation = locale === "en" ? pv.en : pv.es;
          if (existingTranslation) {
            picklistVals.push({ masterLabel: pv.value, translation: existingTranslation });
          }
        }
      }

      // When editing picklist only, preserve existing label translation
      let labelToSave = label;
      if (editingPicklist && !editingLabel) {
        labelToSave = locale === "en" ? (translations.en || "") : (translations.es || "");
      }

      const result = await saveFieldLabelTranslation(
        currentField.objectName,
        currentField.apiName,
        locale,
        labelToSave,
        picklistVals
      );

      if (result.success) {
        saveResult = { success: true, message: "Deployed!" };
        editingLabel = null;
        editingPicklist = null;
        // Reload translations
        loadExtraInfo(currentField);
      } else {
        saveResult = { success: false, message: result.error || "Deploy failed" };
      }
    } catch (e: any) {
      saveResult = { success: false, message: e.message || "Error" };
    } finally {
      isSaving = false;
    }
  }

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
    picklistTranslations = [];

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

    // Load picklist translations if this is a picklist field
    try {
      const desc = objectDescribe;
      const fd = desc?.fields.find((f) => f.name === field.apiName);
      if (fd && (fd.type === "picklist" || fd.type === "multipicklist") && fd.picklistValues?.length > 0) {
        const pvTrans = await getPicklistTranslations(field.objectName, field.apiName);
        picklistTranslations = pvTrans;
      }
    } catch {}
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  const filteredPicklistTranslations = $derived(() => {
    if (!picklistTranslations.length) return [];
    if (!searchTerm) return picklistTranslations;
    const term = searchTerm.toLowerCase();
    return picklistTranslations.filter(
      (p) =>
        p.value.toLowerCase().includes(term) ||
        p.fr.toLowerCase().includes(term) ||
        p.en.toLowerCase().includes(term) ||
        p.es.toLowerCase().includes(term)
    );
  });

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

              <!-- EN label — editable -->
              <div class="label-row">
                <span class="label-lang label-flag">EN</span>
                {#if editingLabel?.locale === "en"}
                  <input
                    type="text"
                    class="label-edit-input"
                    bind:value={editingLabel.value}
                    onkeydown={(e) => { if (e.key === "Enter") saveTranslation(); if (e.key === "Escape") cancelEditLabel(); }}
                  />
                  <button class="btn-icon" onclick={saveTranslation} disabled={isSaving} title="Save">{isSaving ? "..." : "✓"}</button>
                  <button class="btn-icon" onclick={cancelEditLabel} title="Cancel">✕</button>
                {:else}
                  <span class="label-text" class:pv-missing={!translations.en}>{translations.en || "—"}</span>
                  {#if fieldDetails.custom}
                    <button class="btn-icon btn-edit" onclick={() => startEditLabel("en", translations.en || "")} title="Edit EN label">✎</button>
                  {/if}
                {/if}
              </div>

              <!-- ES label — editable -->
              <div class="label-row">
                <span class="label-lang label-flag">ES</span>
                {#if editingLabel?.locale === "es"}
                  <input
                    type="text"
                    class="label-edit-input"
                    bind:value={editingLabel.value}
                    onkeydown={(e) => { if (e.key === "Enter") saveTranslation(); if (e.key === "Escape") cancelEditLabel(); }}
                  />
                  <button class="btn-icon" onclick={saveTranslation} disabled={isSaving} title="Save">{isSaving ? "..." : "✓"}</button>
                  <button class="btn-icon" onclick={cancelEditLabel} title="Cancel">✕</button>
                {:else}
                  <span class="label-text" class:pv-missing={!translations.es}>{translations.es || "—"}</span>
                  {#if fieldDetails.custom}
                    <button class="btn-icon btn-edit" onclick={() => startEditLabel("es", translations.es || "")} title="Edit ES label">✎</button>
                  {/if}
                {/if}
              </div>

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

            {#if saveResult}
              <div class="save-result" class:save-success={saveResult.success} class:save-error={!saveResult.success}>
                {saveResult.message}
              </div>
            {/if}
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

          <!-- Picklist Values with Translations -->
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
              {#if picklistTranslations.length > 0}
                <div class="pv-table">
                  <div class="pv-table-header">
                    <span class="pv-col-value">API Value</span>
                    <span class="pv-col-lang">FR</span>
                    <span class="pv-col-lang">
                      EN
                      {#if fieldDetails.custom && !editingPicklist}
                        <button class="btn-icon btn-edit btn-edit-sm" onclick={() => startEditPicklist("en")} title="Edit EN picklist">✎</button>
                      {/if}
                    </span>
                    <span class="pv-col-lang">
                      ES
                      {#if fieldDetails.custom && !editingPicklist}
                        <button class="btn-icon btn-edit btn-edit-sm" onclick={() => startEditPicklist("es")} title="Edit ES picklist">✎</button>
                      {/if}
                    </span>
                  </div>
                  <div class="pv-table-body">
                    {#each filteredPicklistTranslations() as pv}
                      <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
                      <div class="pv-table-row" onclick={() => copyToClipboard(pv.value)} title="Click to copy API value">
                        <span class="pv-col-value pv-api">{pv.value}</span>
                        <span class="pv-col-lang">{pv.fr}</span>
                        {#if editingPicklist?.locale === "en"}
                          <input
                            type="text"
                            class="pv-edit-input"
                            value={editingPicklist.values.get(pv.value) || ""}
                            oninput={(e) => updatePicklistEdit(pv.value, e.currentTarget.value)}
                            onclick={(e) => e.stopPropagation()}
                          />
                        {:else}
                          <span class="pv-col-lang" class:pv-missing={!pv.en || pv.en === pv.fr}>{pv.en || "—"}</span>
                        {/if}
                        {#if editingPicklist?.locale === "es"}
                          <input
                            type="text"
                            class="pv-edit-input"
                            value={editingPicklist.values.get(pv.value) || ""}
                            oninput={(e) => updatePicklistEdit(pv.value, e.currentTarget.value)}
                            onclick={(e) => e.stopPropagation()}
                          />
                        {:else}
                          <span class="pv-col-lang" class:pv-missing={!pv.es || pv.es === pv.fr}>{pv.es || "—"}</span>
                        {/if}
                      </div>
                    {/each}
                  </div>
                  {#if editingPicklist}
                    <div class="pv-table-actions">
                      <button class="btn btn-primary btn-sm" onclick={saveTranslation} disabled={isSaving}>
                        {isSaving ? "Deploying..." : `Save ${editingPicklist.locale.toUpperCase()} translations`}
                      </button>
                      <button class="btn btn-ghost btn-sm" onclick={cancelEditPicklist}>Cancel</button>
                    </div>
                  {/if}
                </div>
              {:else}
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
              {/if}
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

  /* Picklist translation table */
  .pv-table {
    font-size: 11px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .pv-table-header {
    display: grid;
    grid-template-columns: 1.5fr 1fr 1fr 1fr;
    gap: 1px;
    padding: 4px 6px;
    background: var(--bg-tertiary);
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .pv-table-body {
    max-height: 300px;
    overflow-y: auto;
  }

  .pv-table-row {
    display: grid;
    grid-template-columns: 1.5fr 1fr 1fr 1fr;
    gap: 1px;
    padding: 3px 6px;
    border-top: 1px solid var(--border);
    background: transparent;
    border-left: none;
    border-right: none;
    border-bottom: none;
    width: 100%;
    text-align: left;
    cursor: pointer;
    color: var(--text-primary);
    font-size: 11px;
  }

  .pv-table-row:first-child {
    border-top: none;
  }

  .pv-table-row:hover {
    background: var(--bg-tertiary);
  }

  .pv-col-value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pv-col-lang {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pv-api {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--accent);
  }

  .pv-missing {
    color: var(--text-muted);
    font-style: italic;
    opacity: 0.6;
  }

  /* Inline editing */
  .label-edit-input {
    flex: 1;
    padding: 2px 6px;
    font-size: 12px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    outline: none;
  }

  .btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 12px;
    padding: 2px 4px;
    color: var(--text-primary);
    border-radius: 3px;
  }

  .btn-icon:hover {
    background: var(--bg-tertiary);
  }

  .btn-edit {
    color: var(--text-muted);
    font-size: 11px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .label-row:hover .btn-edit,
  .pv-table-header:hover .btn-edit {
    opacity: 1;
  }

  .btn-edit-sm {
    font-size: 10px;
    padding: 1px 3px;
    margin-left: 2px;
  }

  .pv-edit-input {
    width: 100%;
    padding: 1px 4px;
    font-size: 11px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--accent);
    border-radius: 2px;
    outline: none;
  }

  .pv-table-actions {
    display: flex;
    gap: 6px;
    padding: 6px;
    border-top: 1px solid var(--border);
    justify-content: flex-end;
  }

  .save-result {
    margin-top: 6px;
    padding: 4px 8px;
    border-radius: var(--radius);
    font-size: 11px;
  }

  .save-success {
    background: rgba(76, 175, 80, 0.15);
    color: #4caf50;
  }

  .save-error {
    background: rgba(244, 67, 54, 0.15);
    color: #f44336;
  }
</style>

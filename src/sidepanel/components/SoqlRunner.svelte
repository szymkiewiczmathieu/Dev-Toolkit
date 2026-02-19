<script lang="ts">
  import { onMount } from "svelte";
  import { connection, isConnected } from "../stores/connection";
  import { queryHistory, addToHistory, clearHistory } from "../stores/queryHistory";
  import { objectList, loadObjectDescribe } from "../stores/metadata";
  import { query } from "../../lib/sfApi";
  import type { QueryResult } from "../../lib/sfApi";
  import ResultTable from "./ResultTable.svelte";

  let soqlText = $state("SELECT Id, Name FROM Account LIMIT 10");
  let isRunning = $state(false);
  let result = $state<QueryResult | null>(null);
  let error = $state<string | null>(null);
  let duration = $state(0);
  let showHistory = $state(false);
  let showAutocomplete = $state(false);
  let suggestions = $state<string[]>([]);
  let selectedSuggestion = $state(0);
  let textareaEl: HTMLTextAreaElement | undefined = $state();

  async function runQuery() {
    if (!$connection || !soqlText.trim()) return;

    isRunning = true;
    error = null;
    result = null;
    const start = performance.now();

    try {
      result = await query($connection, soqlText.trim());
      duration = Math.round(performance.now() - start);

      addToHistory({
        query: soqlText.trim(),
        timestamp: Date.now(),
        rowCount: result.totalSize,
        duration,
      });
    } catch (err: any) {
      error = err.message || "Query failed";
      duration = Math.round(performance.now() - start);

      addToHistory({
        query: soqlText.trim(),
        timestamp: Date.now(),
        rowCount: 0,
        duration,
        error: error,
      });
    } finally {
      isRunning = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      runQuery();
      return;
    }

    if (showAutocomplete) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedSuggestion = Math.min(selectedSuggestion + 1, suggestions.length - 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedSuggestion = Math.max(selectedSuggestion - 1, 0);
      } else if (e.key === "Tab" || e.key === "Enter") {
        if (suggestions.length > 0) {
          e.preventDefault();
          applySuggestion(suggestions[selectedSuggestion]);
        }
      } else if (e.key === "Escape") {
        showAutocomplete = false;
      }
    }
  }

  function handleInput() {
    updateAutocomplete();
  }

  function updateAutocomplete() {
    if (!textareaEl) return;

    const text = soqlText;
    const cursorPos = textareaEl.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPos);

    // Get current word
    const wordMatch = textBeforeCursor.match(/[\w.]*$/);
    const currentWord = wordMatch ? wordMatch[0].toLowerCase() : "";

    if (currentWord.length < 2) {
      showAutocomplete = false;
      return;
    }

    // Check context: after FROM/JOIN -> suggest objects, otherwise suggest fields
    const contextMatch = textBeforeCursor.match(/\b(FROM|JOIN)\s+\w*$/i);

    if (contextMatch) {
      // Suggest object names
      suggestions = $objectList
        .filter((o) => o.name.toLowerCase().includes(currentWord))
        .map((o) => o.name)
        .slice(0, 10);
    } else {
      // Try to find the object name in the query to suggest fields
      const fromMatch = text.match(/\bFROM\s+(\w+)/i);
      if (fromMatch) {
        const objectName = fromMatch[1];
        const conn = $connection;
        if (conn) {
          loadObjectDescribe(conn, objectName).then((desc) => {
            if (desc) {
              suggestions = desc.fields
                .filter((f) => f.name.toLowerCase().includes(currentWord))
                .map((f) => f.name)
                .slice(0, 10);
              showAutocomplete = suggestions.length > 0;
              selectedSuggestion = 0;
            }
          });
          return;
        }
      }

      // Fall back to object name suggestions
      suggestions = $objectList
        .filter((o) => o.name.toLowerCase().includes(currentWord))
        .map((o) => o.name)
        .slice(0, 10);
    }

    showAutocomplete = suggestions.length > 0;
    selectedSuggestion = 0;
  }

  function applySuggestion(suggestion: string) {
    if (!textareaEl) return;

    const cursorPos = textareaEl.selectionStart;
    const textBeforeCursor = soqlText.substring(0, cursorPos);
    const textAfterCursor = soqlText.substring(cursorPos);

    const wordMatch = textBeforeCursor.match(/[\w.]*$/);
    const wordStart = cursorPos - (wordMatch ? wordMatch[0].length : 0);

    soqlText =
      soqlText.substring(0, wordStart) + suggestion + textAfterCursor;
    showAutocomplete = false;

    // Set cursor after the suggestion
    requestAnimationFrame(() => {
      if (textareaEl) {
        const newPos = wordStart + suggestion.length;
        textareaEl.setSelectionRange(newPos, newPos);
        textareaEl.focus();
      }
    });
  }

  function loadFromHistory(entry: { query: string }) {
    soqlText = entry.query;
    showHistory = false;
  }

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString();
  }

  function copyResults(format: "csv" | "json") {
    if (!result?.records) return;

    let text: string;
    if (format === "json") {
      text = JSON.stringify(result.records, null, 2);
    } else {
      const records = result.records;
      if (records.length === 0) return;
      const headers = Object.keys(records[0]).filter((k) => k !== "attributes");
      const rows = records.map((r) =>
        headers.map((h) => {
          const val = r[h];
          if (val === null || val === undefined) return "";
          const str = typeof val === "object" ? JSON.stringify(val) : String(val);
          return str.includes(",") ? `"${str}"` : str;
        }).join(",")
      );
      text = [headers.join(","), ...rows].join("\n");
    }

    navigator.clipboard.writeText(text);
  }
</script>

<div class="soql-runner">
  <div class="editor-section">
    <div class="editor-wrapper">
      <textarea
        bind:this={textareaEl}
        bind:value={soqlText}
        oninput={handleInput}
        onkeydown={handleKeydown}
        class="soql-textarea"
        placeholder="SELECT Id, Name FROM Account LIMIT 10"
        spellcheck="false"
        rows="5"
      ></textarea>

      {#if showAutocomplete && suggestions.length > 0}
        <div class="autocomplete-dropdown">
          {#each suggestions as suggestion, i}
            <button
              class="autocomplete-item"
              class:selected={i === selectedSuggestion}
              onmousedown={(e) => { e.preventDefault(); applySuggestion(suggestion); }}
            >
              {suggestion}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="editor-actions">
      <button
        class="btn btn-primary"
        onclick={runQuery}
        disabled={isRunning || !$isConnected}
      >
        {isRunning ? "Running..." : "Run (Ctrl+Enter)"}
      </button>

      <button
        class="btn btn-ghost btn-sm"
        onclick={() => (showHistory = !showHistory)}
      >
        History ({$queryHistory.length})
      </button>
    </div>
  </div>

  {#if showHistory}
    <div class="history-panel">
      <div class="history-header">
        <span>Query History</span>
        <button class="btn btn-ghost btn-sm" onclick={clearHistory}>Clear</button>
      </div>
      <div class="history-list">
        {#each $queryHistory as entry}
          <button
            class="history-item"
            class:history-error={!!entry.error}
            onclick={() => loadFromHistory(entry)}
          >
            <code class="history-query">{entry.query}</code>
            <div class="history-meta">
              <span>{formatTime(entry.timestamp)}</span>
              <span>{entry.rowCount} rows</span>
              <span>{entry.duration}ms</span>
            </div>
          </button>
        {/each}
        {#if $queryHistory.length === 0}
          <div class="history-empty">No queries yet</div>
        {/if}
      </div>
    </div>
  {/if}

  {#if error}
    <div class="error-panel">
      <pre>{error}</pre>
    </div>
  {/if}

  {#if result}
    <div class="result-section">
      <div class="result-header">
        <span class="result-stats">
          {result.totalSize} row{result.totalSize !== 1 ? "s" : ""} &middot; {duration}ms
          {#if !result.done}
            <span class="badge badge-warning">partial</span>
          {/if}
        </span>
        <div class="result-actions">
          <button class="btn btn-ghost btn-sm" onclick={() => copyResults("csv")}>CSV</button>
          <button class="btn btn-ghost btn-sm" onclick={() => copyResults("json")}>JSON</button>
        </div>
      </div>
      <ResultTable records={result.records} />
    </div>
  {/if}
</div>

<style>
  .soql-runner {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .editor-section {
    padding: 8px;
    border-bottom: 1px solid var(--border);
  }

  .editor-wrapper {
    position: relative;
  }

  .soql-textarea {
    width: 100%;
    resize: vertical;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.6;
    padding: 8px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    outline: none;
    min-height: 80px;
    max-height: 200px;
  }

  .soql-textarea:focus {
    border-color: var(--accent);
  }

  .editor-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 6px;
  }

  /* Autocomplete */
  .autocomplete-dropdown {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    transform: translateY(100%);
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    max-height: 180px;
    overflow-y: auto;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .autocomplete-item {
    display: block;
    width: 100%;
    padding: 6px 10px;
    text-align: left;
    background: transparent;
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 12px;
    border: none;
    cursor: pointer;
  }

  .autocomplete-item:hover,
  .autocomplete-item.selected {
    background: var(--bg-tertiary);
    color: var(--accent);
  }

  /* History */
  .history-panel {
    border-bottom: 1px solid var(--border);
    max-height: 200px;
    overflow-y: auto;
  }

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 10px;
    font-weight: 600;
    font-size: 11px;
    color: var(--text-secondary);
    background: var(--bg-secondary);
    position: sticky;
    top: 0;
  }

  .history-list {
    padding: 0;
  }

  .history-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 6px 10px;
    background: transparent;
    color: var(--text-primary);
    border: none;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
  }

  .history-item:hover {
    background: var(--bg-secondary);
  }

  .history-item.history-error {
    border-left: 2px solid var(--error);
  }

  .history-query {
    font-size: 11px;
    color: var(--text-primary);
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .history-meta {
    display: flex;
    gap: 8px;
    font-size: 10px;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .history-empty {
    padding: 16px;
    text-align: center;
    color: var(--text-muted);
    font-size: 12px;
  }

  /* Error */
  .error-panel {
    padding: 8px;
    background: rgba(239, 68, 68, 0.1);
    border-bottom: 1px solid var(--error);
  }

  .error-panel pre {
    color: var(--error);
    font-size: 11px;
    white-space: pre-wrap;
    word-break: break-all;
  }

  /* Results */
  .result-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 10px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
  }

  .result-stats {
    font-size: 11px;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .result-actions {
    display: flex;
    gap: 4px;
  }
</style>

<script lang="ts">
  import { connection, isConnected } from "../stores/connection";
  import { searchSetupPages, SETUP_PAGES, type SetupPage } from "../../lib/setupPages";
  import { searchApexClasses, searchFlows } from "../../lib/toolingApi";

  let searchQuery = $state("");
  let selectedIndex = $state(0);
  let results = $state<SetupPage[]>(SETUP_PAGES.slice(0, 15));
  let metadataResults = $state<{ label: string; path: string; icon: string; category: string }[]>([]);
  let searchInputEl: HTMLInputElement | undefined = $state();
  let searchTimeout: ReturnType<typeof setTimeout> | undefined;

  function handleInput() {
    // Instant local search
    results = searchSetupPages(searchQuery);
    selectedIndex = 0;

    // Debounced metadata search
    if (searchTimeout) clearTimeout(searchTimeout);
    if (searchQuery.length >= 2 && $connection) {
      searchTimeout = setTimeout(async () => {
        const conn = $connection!;
        const metaResults: typeof metadataResults = [];

        try {
          const [classes, flows] = await Promise.allSettled([
            searchApexClasses(conn, searchQuery),
            searchFlows(conn, searchQuery),
          ]);

          if (classes.status === "fulfilled") {
            for (const cls of classes.value) {
              metaResults.push({
                label: cls.Name,
                path: `/lightning/setup/ApexClasses/page?address=%2F${cls.Id}`,
                icon: "A",
                category: "Apex Class",
              });
            }
          }

          if (flows.status === "fulfilled") {
            for (const flow of flows.value) {
              metaResults.push({
                label: flow.MasterLabel,
                path: `/builder_platform_interaction/flowBuilder.app?flowId=${flow.Id}`,
                icon: "F",
                category: "Flow",
              });
            }
          }
        } catch {
          // Ignore search errors
        }

        metadataResults = metaResults;
      }, 300);
    } else {
      metadataResults = [];
    }
  }

  function navigateTo(path: string) {
    if (!$connection) return;
    const baseUrl = $connection.instanceUrl.replace(".my.salesforce.com", ".lightning.force.com");
    const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.update(tabs[0].id, { url });
      }
    });
  }

  function handleKeydown(e: KeyboardEvent) {
    const totalResults = results.length + metadataResults.length;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, totalResults - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex < results.length) {
        navigateTo(results[selectedIndex].path);
      } else {
        const metaIdx = selectedIndex - results.length;
        if (metaIdx < metadataResults.length) {
          navigateTo(metadataResults[metaIdx].path);
        }
      }
    }
  }

  $effect(() => {
    // Auto-focus search input
    searchInputEl?.focus();
  });
</script>

<div class="quick-nav">
  <div class="search-bar">
    <input
      bind:this={searchInputEl}
      bind:value={searchQuery}
      oninput={handleInput}
      onkeydown={handleKeydown}
      type="text"
      placeholder="Search Setup pages, Apex classes, Flows..."
      class="search-input"
    />
    <div class="search-hint">Ctrl+Shift+K from any SF page</div>
  </div>

  <div class="results-list">
    {#if results.length > 0}
      <div class="results-section-title">Setup Pages</div>
      {#each results as page, i}
        <button
          class="result-item"
          class:selected={i === selectedIndex}
          onclick={() => navigateTo(page.path)}
        >
          <span class="result-icon" style:background={getCategoryColor(page.category)}>{page.icon}</span>
          <div class="result-info">
            <span class="result-label">{page.label}</span>
            <span class="result-category">{page.category}</span>
          </div>
        </button>
      {/each}
    {/if}

    {#if metadataResults.length > 0}
      <div class="results-section-title">Metadata</div>
      {#each metadataResults as meta, i}
        <button
          class="result-item"
          class:selected={results.length + i === selectedIndex}
          onclick={() => navigateTo(meta.path)}
        >
          <span class="result-icon result-icon-meta">{meta.icon}</span>
          <div class="result-info">
            <span class="result-label">{meta.label}</span>
            <span class="result-category">{meta.category}</span>
          </div>
        </button>
      {/each}
    {/if}

    {#if results.length === 0 && metadataResults.length === 0 && searchQuery.length > 0}
      <div class="no-results">No results for "{searchQuery}"</div>
    {/if}
  </div>
</div>

<script module lang="ts">
  function getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      Objects: "#1b96ff",
      Users: "#9b59b6",
      Automation: "#e67e22",
      Code: "#2ecc71",
      Deploy: "#e74c3c",
      UI: "#3498db",
      Email: "#f39c12",
      Data: "#1abc9c",
      Integration: "#8e44ad",
      Debug: "#d35400",
      Reports: "#27ae60",
      Company: "#7f8c8d",
    };
    return colors[category] || "#64748b";
  }
</script>

<style>
  .quick-nav {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .search-bar {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
  }

  .search-input {
    width: 100%;
    padding: 8px 12px;
    font-size: 13px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    outline: none;
  }

  .search-input:focus {
    border-color: var(--accent);
  }

  .search-hint {
    font-size: 10px;
    color: var(--text-muted);
    margin-top: 4px;
    text-align: center;
  }

  .results-list {
    flex: 1;
    overflow-y: auto;
  }

  .results-section-title {
    padding: 6px 12px;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: var(--bg-secondary);
    position: sticky;
    top: 0;
  }

  .result-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    width: 100%;
    background: transparent;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: background 0.1s;
  }

  .result-item:hover,
  .result-item.selected {
    background: var(--bg-secondary);
  }

  .result-icon {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    color: white;
    flex-shrink: 0;
  }

  .result-icon-meta {
    background: var(--bg-tertiary) !important;
    color: var(--accent);
  }

  .result-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .result-label {
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-category {
    font-size: 10px;
    color: var(--text-muted);
  }

  .no-results {
    padding: 24px;
    text-align: center;
    color: var(--text-muted);
    font-size: 12px;
  }
</style>

<script lang="ts">
  import { onMount } from "svelte";
  import TabBar from "./components/TabBar.svelte";
  import ConnectionStatus from "./components/ConnectionStatus.svelte";
  import SoqlRunner from "./components/SoqlRunner.svelte";
  import FieldInspector from "./components/FieldInspector.svelte";
  import QuickNav from "./components/QuickNav.svelte";
  import { refreshConnection, connection, isConnected } from "./stores/connection";
  import { loadObjects } from "./stores/metadata";
  import { loadHistory } from "./stores/queryHistory";
  import { inspectedField } from "./stores/inspector";

  let activeTab = $state("soql");

  onMount(async () => {
    await refreshConnection();
    await loadHistory();

    // Load metadata when connected
    if ($isConnected && $connection) {
      loadObjects($connection);
    }
  });

  // Reload connection when tab becomes visible
  function handleVisibilityChange() {
    if (!document.hidden) {
      refreshConnection();
    }
  }

  // Listen for field click events from content script
  function handleFieldClicked(message: any) {
    if (message.type === "FIELD_CLICKED") {
      // Store the field data BEFORE switching tabs, so FieldInspector can read it on mount
      inspectedField.set(message.field);
      activeTab = "inspector";
    }
  }

  onMount(() => {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    chrome.runtime.onMessage.addListener(handleFieldClicked);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      chrome.runtime.onMessage.removeListener(handleFieldClicked);
    };
  });
</script>

<div class="app-container">
  <header class="app-header">
    <div class="app-title">
      <span class="app-logo">SF</span>
      <span>Dev Toolkit</span>
    </div>
    <ConnectionStatus />
  </header>

  <TabBar bind:activeTab />

  <main class="app-content">
    {#if activeTab === "soql"}
      <SoqlRunner />
    {:else if activeTab === "inspector"}
      <FieldInspector />
    {:else if activeTab === "nav"}
      <QuickNav />
    {/if}
  </main>
</div>

<style>
  .app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
  }

  .app-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 13px;
  }

  .app-logo {
    background: var(--accent);
    color: white;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
  }

  .app-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
</style>

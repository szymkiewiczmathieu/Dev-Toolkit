<script lang="ts">
  interface Props {
    activeTab: string;
  }

  let { activeTab = $bindable() }: Props = $props();

  const tabs = [
    { id: "soql", label: "SOQL", icon: ">" },
    { id: "inspector", label: "Inspector", icon: "#" },
    { id: "nav", label: "Navigate", icon: "/" },
  ];
</script>

<nav class="tab-bar">
  {#each tabs as tab}
    <button
      class="tab"
      class:active={activeTab === tab.id}
      onclick={() => (activeTab = tab.id)}
    >
      <span class="tab-icon">{tab.icon}</span>
      <span class="tab-label">{tab.label}</span>
    </button>
  {/each}
</nav>

<style>
  .tab-bar {
    display: flex;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    padding: 0 4px;
  }

  .tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 0;
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 500;
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
  }

  .tab:hover {
    color: var(--text-secondary);
  }

  .tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .tab-icon {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 14px;
  }
</style>

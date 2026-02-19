<script lang="ts">
  import {
    isConnected,
    isConnecting,
    connectionError,
    orgName,
    refreshConnection,
  } from "../stores/connection";
</script>

<div class="connection-status">
  {#if $isConnecting}
    <span class="badge badge-warning">Connecting...</span>
  {:else if $isConnected}
    <span class="badge badge-success">{$orgName}</span>
  {:else}
    <button class="badge badge-error" onclick={refreshConnection} title={$connectionError || "Not connected"}>
      Disconnected
    </button>
  {/if}
</div>

<style>
  .connection-status {
    display: flex;
    align-items: center;
  }

  button.badge {
    cursor: pointer;
    border: none;
    font-family: inherit;
  }

  button.badge:hover {
    filter: brightness(1.2);
  }
</style>

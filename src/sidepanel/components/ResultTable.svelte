<script lang="ts">
  interface Props {
    records: Record<string, unknown>[];
  }

  let { records }: Props = $props();

  let sortField = $state<string | null>(null);
  let sortDir = $state<"asc" | "desc">("asc");

  const columns = $derived(() => {
    if (!records || records.length === 0) return [];
    return Object.keys(records[0]).filter((k) => k !== "attributes");
  });

  const sortedRecords = $derived(() => {
    if (!sortField || !records) return records;
    return [...records].sort((a, b) => {
      const va = a[sortField!];
      const vb = b[sortField!];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  });

  function toggleSort(field: string) {
    if (sortField === field) {
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      sortField = field;
      sortDir = "asc";
    }
  }

  function formatValue(val: unknown): string {
    if (val === null || val === undefined) return "";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  }

  function copyCell(val: unknown) {
    navigator.clipboard.writeText(formatValue(val));
  }
</script>

<div class="table-container">
  {#if records.length === 0}
    <div class="table-empty">No records returned</div>
  {:else}
    <table class="result-table">
      <thead>
        <tr>
          <th class="row-num">#</th>
          {#each columns() as col}
            <th onclick={() => toggleSort(col)} class="sortable">
              {col}
              {#if sortField === col}
                <span class="sort-indicator">{sortDir === "asc" ? "^" : "v"}</span>
              {/if}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each sortedRecords() as record, i}
          <tr>
            <td class="row-num">{i + 1}</td>
            {#each columns() as col}
              <td ondblclick={() => copyCell(record[col])} title="Double-click to copy">
                {formatValue(record[col])}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .table-container {
    flex: 1;
    overflow: auto;
  }

  .table-empty {
    padding: 24px;
    text-align: center;
    color: var(--text-muted);
  }

  .result-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    font-family: var(--font-mono);
  }

  thead {
    position: sticky;
    top: 0;
    z-index: 1;
  }

  th {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    padding: 4px 8px;
    text-align: left;
    font-weight: 600;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
    border-bottom: 1px solid var(--border);
    user-select: none;
  }

  th.sortable {
    cursor: pointer;
  }

  th.sortable:hover {
    color: var(--accent);
  }

  .sort-indicator {
    margin-left: 4px;
    font-size: 9px;
  }

  td {
    padding: 3px 8px;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
    max-width: 250px;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-primary);
  }

  td:hover {
    background: var(--bg-secondary);
  }

  tr:hover td {
    background: var(--bg-secondary);
  }

  .row-num {
    color: var(--text-muted);
    font-size: 10px;
    width: 30px;
    text-align: right;
    padding-right: 8px;
  }

  th.row-num {
    background: var(--bg-tertiary);
  }
</style>

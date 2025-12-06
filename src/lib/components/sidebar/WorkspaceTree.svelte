<script lang="ts">
  import { workspaceState } from "$lib/stores/workspace";
  import PageItem from "./PageItem.svelte";
</script>

<div class="workspace-tree">
  {#each $workspaceState.workspace.pages as page (page.id)}
    <PageItem {page} level={0} />
  {/each}
</div>

<style>
  .workspace-tree {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
</style>

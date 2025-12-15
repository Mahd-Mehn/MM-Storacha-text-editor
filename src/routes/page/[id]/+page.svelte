<script lang="ts">
  import { page } from "$app/stores";
  import PageEditor from "$lib/components/PageEditor.svelte";

  // Get page ID from route params using Svelte 5 runes
  let pageId = $derived($page.params.id || "");
</script>

<div class="page-container">
  {#key pageId}
    <PageEditor {pageId} />
  {/key}
</div>

<style>
  .page-container {
    min-height: 100vh;
    background: var(--bg-primary, #ffffff);
  }

  :global(.dark) .page-container {
    background: var(--bg-primary, #1a1a2e);
  }
</style>

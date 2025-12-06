<script lang="ts">
  import { writable } from "svelte/store";
  import PageItem from "./PageItem.svelte";

  // Mock data - will be replaced with real data from store
  const pages = writable([
    {
      id: "1",
      title: "Getting Started",
      icon: "📚",
      children: [
        { id: "1-1", title: "Introduction", icon: "👋", children: [] },
        { id: "1-2", title: "Quick Start", icon: "⚡", children: [] },
      ],
    },
    {
      id: "2",
      title: "Projects",
      icon: "📁",
      children: [
        { id: "2-1", title: "Website Redesign", icon: "🎨", children: [] },
        { id: "2-2", title: "Mobile App", icon: "📱", children: [] },
      ],
    },
    {
      id: "3",
      title: "Meeting Notes",
      icon: "📝",
      children: [],
    },
    {
      id: "4",
      title: "Personal",
      icon: "🏠",
      children: [
        { id: "4-1", title: "Journal", icon: "📖", children: [] },
        { id: "4-2", title: "Ideas", icon: "💡", children: [] },
      ],
    },
  ]);
</script>

<div class="workspace-tree">
  {#each $pages as page (page.id)}
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

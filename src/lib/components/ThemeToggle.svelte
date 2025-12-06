<script lang="ts">
  import { themeStore } from "$lib/stores/theme";

  function toggle() {
    themeStore.toggle();
  }
</script>

<button class="theme-toggle" on:click={toggle} title="Toggle theme">
  {#if $themeStore === "light"}
    <!-- Sun icon -->
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <circle cx="10" cy="10" r="3" />
      <path
        d="M10 1v2m0 14v2M19 10h-2M3 10H1m15.66-5.66l-1.42 1.42M5.76 14.24l-1.42 1.42m12.02 0l-1.42-1.42M5.76 5.76L4.34 4.34"
      />
    </svg>
  {:else}
    <!-- Moon icon -->
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"
      />
    </svg>
  {/if}
</button>

<style>
  .theme-toggle {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 0.375rem;
    color: var(--text-secondary, #6b7280);
    cursor: pointer;
    transition: all 0.2s;
  }

  .theme-toggle:hover {
    background: var(--bg-hover, rgba(0, 0, 0, 0.05));
    color: var(--text-primary, #1a1a1a);
  }
</style>

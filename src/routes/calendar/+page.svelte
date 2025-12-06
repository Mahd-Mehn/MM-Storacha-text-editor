<script lang="ts">
  import { workspaceState } from "$lib/stores/workspace";
  import { goto } from "$app/navigation";

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Generate calendar days
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  function isToday(day: number | null): boolean {
    return day === today.getDate();
  }

  function handleDayClick(day: number | null) {
    if (day) {
      console.log(`Clicked on day ${day}`);
      // TODO: Show events for this day
    }
  }
</script>

<div class="calendar-page">
  <header class="page-header">
    <h1>Calendar</h1>
    <p>{monthNames[currentMonth]} {currentYear}</p>
  </header>

  <div class="calendar-container">
    <div class="calendar-grid">
      <!-- Day headers -->
      {#each dayNames as dayName}
        <div class="day-header">{dayName}</div>
      {/each}

      <!-- Calendar days -->
      {#each calendarDays as day}
        <button
          class="calendar-day"
          class:today={isToday(day)}
          class:empty={day === null}
          on:click={() => handleDayClick(day)}
          disabled={day === null}
        >
          {#if day !== null}
            <span class="day-number">{day}</span>
          {/if}
        </button>
      {/each}
    </div>

    <div class="events-sidebar">
      <h2>Upcoming Events</h2>
      <div class="empty-state">
        <div class="empty-icon">📅</div>
        <p>No events scheduled</p>
      </div>
    </div>
  </div>
</div>

<style>
  .calendar-page {
    min-height: 100vh;
    background: var(--bg-tertiary);
    padding: 3rem 4rem;
  }

  .page-header {
    margin-bottom: 3rem;
  }

  .page-header h1 {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 0.5rem;
  }

  .page-header p {
    font-size: 1.125rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .calendar-container {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 2rem;
  }

  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.5rem;
    background: var(--bg-card);
    padding: 1.5rem;
    border-radius: 1rem;
    border: 1px solid var(--border-color);
  }

  .day-header {
    text-align: center;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary);
    padding: 0.75rem;
  }

  .calendar-day {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }

  .calendar-day:not(.empty):hover {
    background: var(--bg-hover);
    border-color: var(--accent-color);
  }

  .calendar-day.today {
    background: var(--bg-active);
    border-color: var(--accent-color);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  .calendar-day.empty {
    border-color: transparent;
    cursor: default;
  }

  .day-number {
    font-size: 1rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .events-sidebar {
    background: var(--bg-card);
    padding: 1.5rem;
    border-radius: 1rem;
    border: 1px solid var(--border-color);
  }

  .events-sidebar h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 1.5rem;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-state p {
    font-size: 0.9375rem;
    color: var(--text-secondary);
    margin: 0;
  }

  @media (max-width: 1024px) {
    .calendar-container {
      grid-template-columns: 1fr;
    }

    .events-sidebar {
      order: -1;
    }
  }

  @media (max-width: 768px) {
    .calendar-page {
      padding: 2rem 1.5rem;
    }

    .calendar-grid {
      gap: 0.25rem;
      padding: 1rem;
    }

    .day-header {
      font-size: 0.75rem;
      padding: 0.5rem;
    }

    .day-number {
      font-size: 0.875rem;
    }
  }
</style>

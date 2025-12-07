<script lang="ts">
  import type { 
    DatabaseSchema, 
    DatabaseRow, 
    DatabaseView,
    PropertyDefinition,
    PropertyValue
  } from '$lib/types/database';

  // Props
  export let schema: DatabaseSchema;
  export let rows: DatabaseRow[];
  export let view: DatabaseView;
  export let onRowClick: ((row: DatabaseRow) => void) | undefined = undefined;
  export let onAddRow: ((date?: string) => void) | undefined = undefined;
  export let readonly: boolean = false;

  // State
  let currentDate = $state(new Date());
  let viewMode = $state<'month' | 'week'>('month');

  // Get the date property
  function getDateProperty(): PropertyDefinition | undefined {
    if (!view.calendarProperty) {
      // Find first date property
      return schema.properties.find(p => p.type === 'date');
    }
    return schema.properties.find(p => p.id === view.calendarProperty);
  }

  // Get the title of a row
  function getRowTitle(row: DatabaseRow): string {
    const titleProp = schema.properties.find(p => p.type === 'text');
    if (titleProp) {
      const value = row.properties[titleProp.id];
      if (value?.type === 'text' && value.value) {
        return value.value;
      }
    }
    return 'Untitled';
  }

  // Get rows for a specific date
  function getRowsForDate(date: Date): DatabaseRow[] {
    const dateProp = getDateProperty();
    if (!dateProp) return [];

    const dateStr = date.toISOString().split('T')[0];

    return rows.filter(row => {
      const value = row.properties[dateProp.id];
      if (value?.type === 'date' && value.value) {
        const rowDate = value.value.start.split('T')[0];
        return rowDate === dateStr;
      }
      return false;
    });
  }

  // Calendar helpers
  function getDaysInMonth(date: Date): Date[] {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days: Date[] = [];
    
    // Add days from previous month to fill the first week
    const startDayOfWeek = firstDay.getDay();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i));
    }
    
    // Add all days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    // Add days from next month to complete the last week
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }
    
    return days;
  }

  function getWeekDays(date: Date): Date[] {
    const days: Date[] = [];
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    
    for (let i = 0; i < 7; i++) {
      days.push(new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + i));
    }
    
    return days;
  }

  function isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  function isCurrentMonth(date: Date): boolean {
    return date.getMonth() === currentDate.getMonth();
  }

  function formatMonthYear(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function formatDayName(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  function navigatePrev() {
    if (viewMode === 'month') {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    } else {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7);
    }
  }

  function navigateNext() {
    if (viewMode === 'month') {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    } else {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7);
    }
  }

  function goToToday() {
    currentDate = new Date();
  }

  function handleDateClick(date: Date) {
    if (readonly) return;
    onAddRow?.(date.toISOString());
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
</script>

<div class="calendar-view">
  <div class="calendar-header">
    <div class="header-left">
      <h2 class="month-title">{formatMonthYear(currentDate)}</h2>
    </div>
    <div class="header-center">
      <button class="nav-btn" onclick={navigatePrev}>←</button>
      <button class="today-btn" onclick={goToToday}>Today</button>
      <button class="nav-btn" onclick={navigateNext}>→</button>
    </div>
    <div class="header-right">
      <div class="view-toggle">
        <button 
          class:active={viewMode === 'month'}
          onclick={() => viewMode = 'month'}
        >Month</button>
        <button 
          class:active={viewMode === 'week'}
          onclick={() => viewMode = 'week'}
        >Week</button>
      </div>
    </div>
  </div>

  <div class="calendar-grid">
    <div class="day-headers">
      {#each dayNames as day}
        <div class="day-header">{day}</div>
      {/each}
    </div>

    <div class="days-grid" class:week-view={viewMode === 'week'}>
      {#each viewMode === 'month' ? getDaysInMonth(currentDate) : getWeekDays(currentDate) as date (date.toISOString())}
        {@const dayRows = getRowsForDate(date)}
        <div 
          class="day-cell"
          class:today={isToday(date)}
          class:other-month={!isCurrentMonth(date)}
          onclick={() => handleDateClick(date)}
        >
          <div class="day-number">{date.getDate()}</div>
          <div class="day-events">
            {#each dayRows.slice(0, 3) as row (row.id)}
              <button 
                class="event-item"
                onclick={(e) => {
                  e.stopPropagation();
                  onRowClick?.(row);
                }}
              >
                {getRowTitle(row)}
              </button>
            {/each}
            {#if dayRows.length > 3}
              <div class="more-events">+{dayRows.length - 3} more</div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .calendar-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary, #ffffff);
  }

  .calendar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .header-left, .header-right {
    flex: 1;
  }

  .header-right {
    display: flex;
    justify-content: flex-end;
  }

  .header-center {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .month-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
    margin: 0;
  }

  .nav-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.375rem;
    cursor: pointer;
    color: var(--text-secondary, #6b7280);
    font-size: 0.875rem;
  }

  .nav-btn:hover {
    background: var(--bg-hover, #f3f4f6);
    color: var(--text-primary, #111827);
  }

  .today-btn {
    padding: 0.375rem 0.75rem;
    background: transparent;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.8125rem;
    color: var(--text-secondary, #6b7280);
  }

  .today-btn:hover {
    background: var(--bg-hover, #f3f4f6);
    color: var(--text-primary, #111827);
  }

  .view-toggle {
    display: flex;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.375rem;
    overflow: hidden;
  }

  .view-toggle button {
    padding: 0.375rem 0.75rem;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.8125rem;
    color: var(--text-secondary, #6b7280);
  }

  .view-toggle button:not(:last-child) {
    border-right: 1px solid var(--border-color, #e5e7eb);
  }

  .view-toggle button:hover {
    background: var(--bg-hover, #f3f4f6);
  }

  .view-toggle button.active {
    background: var(--accent-color, #3b82f6);
    color: white;
  }

  .calendar-grid {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .day-headers {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .day-header {
    padding: 0.75rem;
    text-align: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-tertiary, #9ca3af);
    text-transform: uppercase;
  }

  .days-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-template-rows: repeat(6, 1fr);
    overflow: hidden;
  }

  .days-grid.week-view {
    grid-template-rows: 1fr;
  }

  .day-cell {
    border-right: 1px solid var(--border-color, #e5e7eb);
    border-bottom: 1px solid var(--border-color, #e5e7eb);
    padding: 0.5rem;
    min-height: 100px;
    cursor: pointer;
    transition: background 0.15s;
    overflow: hidden;
  }

  .day-cell:nth-child(7n) {
    border-right: none;
  }

  .day-cell:hover {
    background: var(--bg-hover, #f9fafb);
  }

  .day-cell.today {
    background: var(--accent-light, #eff6ff);
  }

  .day-cell.other-month {
    background: var(--bg-secondary, #f9fafb);
  }

  .day-cell.other-month .day-number {
    color: var(--text-tertiary, #9ca3af);
  }

  .day-number {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary, #111827);
    margin-bottom: 0.25rem;
  }

  .day-cell.today .day-number {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-color, #3b82f6);
    color: white;
    border-radius: 50%;
  }

  .day-events {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .event-item {
    width: 100%;
    padding: 0.125rem 0.375rem;
    background: var(--accent-light, #e0f2fe);
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    text-align: left;
    font-size: 0.6875rem;
    color: var(--accent-color, #3b82f6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: background 0.15s;
  }

  .event-item:hover {
    background: var(--accent-light-hover, #bae6fd);
  }

  .more-events {
    font-size: 0.625rem;
    color: var(--text-tertiary, #9ca3af);
    padding: 0.125rem 0.375rem;
  }

  .week-view .day-cell {
    min-height: 300px;
  }
</style>

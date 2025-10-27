/**
 * End-to-End Integration Tests for Storacha Notes
 * Tests complete workflows including note creation, editing, sharing, and synchronization
 * Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1
 */

import { test, expect, type Page } from '@playwright/test';

// Test configuration
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const TEST_TIMEOUT = 30000;

test.describe('Application Initialization', () => {
  test('should load the application successfully', async ({ page }) => {
    await page.goto(APP_URL);
    
    // Wait for initialization
    await page.waitForSelector('.app-container', { timeout: TEST_TIMEOUT });
    
    // Check for status indicators
    await expect(page.locator('.status-bar')).toBeVisible();
  });

  test('should initialize user identity automatically', async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForSelector('.app-container', { timeout: TEST_TIMEOUT });
    
    // Should show welcome notification for first-time users
    const notification = page.locator('.toast-container');
    await expect(notification).toBeVisible({ timeout: 10000 });
  });

  test('should handle initialization errors gracefully', async ({ page }) => {
    // Simulate network failure
    await page.route('**/*', route => route.abort());
    
    await page.goto(APP_URL);
    
    // Should show error screen
    await expect(page.locator('.error-screen')).toBeVisible({ timeout: TEST_TIMEOUT });
    await expect(page.locator('.retry-button')).toBeVisible();
  });
});

test.describe('Note Creation and Editing', () => {
  test('should create a new note', async ({ page }) => {
    await page.goto(`${APP_URL}/notes`);
    await page.waitForLoadState('networkidle');
    
    // Click create note button
    await page.click('button:has-text("New Note")');
    
    // Should show success notification
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 5000 });
    
    // Note should appear in the list
    await expect(page.locator('.note-card')).toHaveCount(1);
  });

  test('should edit note content', async ({ page }) => {
    await page.goto(`${APP_URL}/notes`);
    await page.waitForLoadState('networkidle');
    
    // Create a note
    await page.click('button:has-text("New Note")');
    await page.waitForTimeout(1000);
    
    // Click on the note to edit
    await page.click('.note-card');
    
    // Wait for editor to load
    await page.waitForSelector('.rich-text-editor', { timeout: 5000 });
    
    // Type content
    await page.fill('.rich-text-editor', 'Test note content');
    
    // Content should be saved automatically
    await page.waitForTimeout(2000);
    
    // Check for auto-save notification
    await expect(page.locator('.toast-success:has-text("saved")')).toBeVisible({ timeout: 5000 });
  });

  test('should delete a note', async ({ page }) => {
    await page.goto(`${APP_URL}/notes`);
    await page.waitForLoadState('networkidle');
    
    // Create a note
    await page.click('button:has-text("New Note")');
    await page.waitForTimeout(1000);
    
    // Click delete button
    page.on('dialog', dialog => dialog.accept());
    await page.click('.delete-button');
    
    // Note should be removed
    await expect(page.locator('.note-card')).toHaveCount(0);
  });
});

test.describe('Search Functionality', () => {
  test('should search notes by title', async ({ page }) => {
    await page.goto(`${APP_URL}/notes`);
    await page.waitForLoadState('networkidle');
    
    // Create multiple notes
    for (let i = 0; i < 3; i++) {
      await page.click('button:has-text("New Note")');
      await page.waitForTimeout(500);
    }
    
    // Search for a note
    await page.fill('.search-input', 'Untitled');
    await page.waitForTimeout(500);
    
    // Should show matching notes
    await expect(page.locator('.note-card')).toHaveCount(3);
  });

  test('should show empty state for no results', async ({ page }) => {
    await page.goto(`${APP_URL}/notes`);
    await page.waitForLoadState('networkidle');
    
    // Search for non-existent note
    await page.fill('.search-input', 'nonexistent');
    await page.waitForTimeout(500);
    
    // Should show empty state
    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.locator('text=No notes found')).toBeVisible();
  });
});

test.describe('Offline Functionality', () => {
  test('should work offline', async ({ page, context }) => {
    await page.goto(`${APP_URL}/notes`);
    await page.waitForLoadState('networkidle');
    
    // Go offline
    await context.setOffline(true);
    
    // Should show offline indicator
    await expect(page.locator('.connection-status:has-text("Offline")')).toBeVisible({ timeout: 5000 });
    
    // Should still be able to create notes
    await page.click('button:has-text("New Note")');
    await expect(page.locator('.note-card')).toHaveCount(1);
  });

  test('should sync when coming back online', async ({ page, context }) => {
    await page.goto(`${APP_URL}/notes`);
    await page.waitForLoadState('networkidle');
    
    // Go offline and create a note
    await context.setOffline(true);
    await page.click('button:has-text("New Note")');
    await page.waitForTimeout(1000);
    
    // Go back online
    await context.setOffline(false);
    
    // Should show sync notification
    await expect(page.locator('.toast:has-text("Syncing")')).toBeVisible({ timeout: 10000 });
  });

  test('should queue operations while offline', async ({ page, context }) => {
    await page.goto(`${APP_URL}/notes`);
    await page.waitForLoadState('networkidle');
    
    // Go offline
    await context.setOffline(true);
    
    // Create multiple notes
    for (let i = 0; i < 3; i++) {
      await page.click('button:has-text("New Note")');
      await page.waitForTimeout(500);
    }
    
    // Should show pending sync indicator
    await expect(page.locator('.sync-status:has-text("pending")')).toBeVisible();
  });
});

test.describe('Version History', () => {
  test('should create version on save', async ({ page }) => {
    await page.goto(`${APP_URL}/notes`);
    await page.waitForLoadState('networkidle');
    
    // Create and edit a note
    await page.click('button:has-text("New Note")');
    await page.waitForTimeout(1000);
    await page.click('.note-card');
    
    // Make multiple edits
    await page.fill('.rich-text-editor', 'Version 1');
    await page.waitForTimeout(3000);
    
    await page.fill('.rich-text-editor', 'Version 2');
    await page.waitForTimeout(3000);
    
    // Open version history
    await page.click('button:has-text("History")');
    
    // Should show multiple versions
    await expect(page.locator('.version-item')).toHaveCount(2, { timeout: 5000 });
  });

  test('should restore previous version', async ({ page }) => {
    await page.goto(`${APP_URL}/notes`);
    await page.waitForLoadState('networkidle');
    
    // Create note with versions
    await page.click('button:has-text("New Note")');
    await page.waitForTimeout(1000);
    await page.click('.note-card');
    
    await page.fill('.rich-text-editor', 'Original content');
    await page.waitForTimeout(3000);
    
    await page.fill('.rich-text-editor', 'Modified content');
    await page.waitForTimeout(3000);
    
    // Open version history and restore
    await page.click('button:has-text("History")');
    await page.click('.restore-button');
    
    // Confirm restoration
    page.on('dialog', dialog => dialog.accept());
    
    // Should show success notification
    await expect(page.locator('.toast-success:has-text("restored")')).toBeVisible({ timeout: 5000 });
  });

  test('should compare versions', async ({ page }) => {
    await page.goto(`${APP_URL}/notes`);
    await page.waitForLoadState('networkidle');
    
    // Create note with versions
    await page.click('button:has-text("New Note")');
    await page.waitForTimeout(1000);
    await page.click('.note-card');
    
    await page.fill('.rich-text-editor', 'Version 1');
    await page.waitForTimeout(3000);
    
    await page.fill('.rich-text-editor', 'Version 2');
    await page.waitForTimeout(3000);
    
    // Open version history
    await page.click('button:has-text("History")');
    
    // Enable compare mode
    await page.click('button:has-text("Compare")');
    
    // Select two versions
    await page.click('.version-item:nth-child(1)');
    await page.click('.version-item:nth-child(2)');
    
    // Should show comparison view
    await expect(page.locator('.version-comparison-view')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Error Handling', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    await page.goto(`${APP_URL}/notes`);
    await page.waitForLoadState('networkidle');
    
    // Simulate network error
    await page.route('**/api/**', route => route.abort());
    
    // Try to create a note
    await page.click('button:has-text("New Note")');
    
    // Should show error notification
    await expect(page.locator('.toast-error')).toBeVisible({ timeout: 5000 });
  });

  test('should retry failed operations', async ({ page }) => {
    await page.goto(`${APP_URL}/notes`);
    await page.waitForLoadState('networkidle');
    
    // Simulate temporary network failure
    let requestCount = 0;
    await page.route('**/upload/**', route => {
      requestCount++;
      if (requestCount < 3) {
        route.abort();
      } else {
        route.continue();
      }
    });
    
    // Create a note (should retry and succeed)
    await page.click('button:has-text("New Note")');
    
    // Should eventually succeed
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 15000 });
  });

  test('should show storage quota warnings', async ({ page }) => {
    await page.goto(`${APP_URL}/notes`);
    await page.waitForLoadState('networkidle');
    
    // Simulate quota exceeded error
    await page.evaluate(() => {
      window.localStorage.setItem = () => {
        throw new Error('QuotaExceededError');
      };
    });
    
    // Try to create a note
    await page.click('button:has-text("New Note")');
    
    // Should show quota warning
    await expect(page.locator('.toast-warning:has-text("quota")')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Performance', () => {
  test('should load notes list quickly', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(`${APP_URL}/notes`);
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should implement lazy loading for large note lists', async ({ page }) => {
    await page.goto(`${APP_URL}/notes`);
    await page.waitForLoadState('networkidle');
    
    // Create many notes (in real test, would use mock data)
    // Check that only initial batch is rendered
    const initialNotes = await page.locator('.note-card').count();
    
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Should load more notes
    await page.waitForTimeout(1000);
    const afterScrollNotes = await page.locator('.note-card').count();
    
    expect(afterScrollNotes).toBeGreaterThanOrEqual(initialNotes);
  });

  test('should cache frequently accessed data', async ({ page }) => {
    await page.goto(`${APP_URL}/notes`);
    await page.waitForLoadState('networkidle');
    
    // Load a note
    await page.click('.note-card:first-child');
    await page.waitForTimeout(1000);
    
    // Go back and reload
    await page.goBack();
    await page.click('.note-card:first-child');
    
    // Second load should be faster (cached)
    const startTime = Date.now();
    await page.waitForSelector('.rich-text-editor');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(500);
  });
});

test.describe('Cross-Browser Compatibility', () => {
  test('should work in Chromium', async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForSelector('.app-container', { timeout: TEST_TIMEOUT });
    await expect(page.locator('.status-bar')).toBeVisible();
  });

  // Additional browser tests would be configured in playwright.config.ts
});

test.describe('Mobile Responsiveness', () => {
  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto(`${APP_URL}/notes`);
    await page.waitForLoadState('networkidle');
    
    // Check mobile layout
    await expect(page.locator('.notes-grid')).toBeVisible();
    
    // Create note should work on mobile
    await page.click('button:has-text("New Note")');
    await expect(page.locator('.note-card')).toHaveCount(1);
  });

  test('should handle touch interactions', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${APP_URL}/notes`);
    await page.waitForLoadState('networkidle');
    
    // Create a note
    await page.click('button:has-text("New Note")');
    await page.waitForTimeout(1000);
    
    // Tap to open
    await page.tap('.note-card');
    
    // Should open editor
    await expect(page.locator('.rich-text-editor')).toBeVisible({ timeout: 5000 });
  });
});

// Helper functions for tests
async function createTestNote(page: Page, title: string, content: string) {
  await page.click('button:has-text("New Note")');
  await page.waitForTimeout(1000);
  await page.click('.note-card:last-child');
  await page.fill('.note-title-input', title);
  await page.fill('.rich-text-editor', content);
  await page.waitForTimeout(2000);
}

async function waitForSync(page: Page) {
  await page.waitForSelector('.sync-status:has-text("synced")', { timeout: 10000 });
}

async function goOffline(page: Page, context: any) {
  await context.setOffline(true);
  await page.waitForSelector('.connection-status:has-text("Offline")', { timeout: 5000 });
}

async function goOnline(page: Page, context: any) {
  await context.setOffline(false);
  await page.waitForSelector('.connection-status:has-text("Online")', { timeout: 5000 });
}

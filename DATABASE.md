# Database & Properties System

A comprehensive Notion-like database system built on Storacha (IPFS/IPLD) for decentralized, shareable structured data.

## Overview

This system provides:
- **Custom Properties** - User-definable fields (text, number, date, select, multi-select, etc.)
- **Multiple Views** - Table, Board (Kanban), Calendar, Gallery
- **Filters & Sorts** - Query-like data manipulation
- **Public Sharing** - Generate shareable links with permissions
- **Storacha Sync** - Decentralized storage with content-addressable CIDs

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (Browser)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Database    │  │ Share       │  │ View Components     │  │
│  │ Service     │  │ Service     │  │ (Table/Board/etc)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Storacha Client                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │                 IPLD DAG Structure                       ││
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐          ││
│  │  │ Database │───▶│  Rows    │───▶│  Cells   │          ││
│  │  │ Manifest │    │ (Pages)  │    │ (Blocks) │          ││
│  │  └──────────┘    └──────────┘    └──────────┘          ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │    Storacha     │
                    │  (IPFS/Filecoin)│
                    └─────────────────┘
```

## File Structure

```
src/lib/
├── types/
│   └── database.ts          # All database type definitions
├── services/
│   ├── database-service.ts  # Database CRUD and Storacha sync
│   └── share-service.ts     # Sharing and permissions
├── components/
│   └── database/
│       ├── Database.svelte       # Main database component
│       ├── TableView.svelte      # Table view
│       ├── BoardView.svelte      # Kanban board view
│       ├── CalendarView.svelte   # Calendar view
│       ├── GalleryView.svelte    # Gallery view
│       ├── PropertyCell.svelte   # Cell renderer/editor
│       ├── PropertyHeader.svelte # Column header
│       ├── AddPropertyModal.svelte
│       ├── ShareModal.svelte
│       └── index.ts
└── routes/
    ├── database/
    │   ├── +page.svelte          # Database list
    │   └── [id]/
    │       └── +page.svelte      # Individual database
    └── shared/
        └── [token]/
            └── +page.svelte      # Shared database access
```

## Usage

### Creating a Database

```typescript
import { databaseService } from '$lib/services/database-service';

// Initialize the service
await databaseService.initialize();

// Create a new database with default properties
const schema = await databaseService.createDatabase('My Tasks');

// Or with custom properties
const schema = await databaseService.createDatabase('Projects', [
  { id: 'name', name: 'Name', type: 'text' },
  { id: 'status', name: 'Status', type: 'select', options: [
    { id: 'active', name: 'Active', color: '#22c55e' },
    { id: 'completed', name: 'Completed', color: '#3b82f6' }
  ]},
  { id: 'dueDate', name: 'Due Date', type: 'date' }
], '📋');
```

### Adding Rows

```typescript
const row = await databaseService.createRow(databaseId, {
  name: { type: 'text', value: 'My First Task' },
  status: { type: 'select', value: 'active' },
  dueDate: { type: 'date', value: { start: '2024-12-31T00:00:00Z' } }
});
```

### Querying Data

```typescript
const result = await databaseService.queryRows({
  databaseId,
  filter: {
    operator: 'and',
    conditions: [
      { id: '1', propertyId: 'status', operator: 'equals', value: 'active' }
    ]
  },
  sorts: [
    { id: '1', propertyId: 'dueDate', direction: 'asc' }
  ],
  limit: 50
});

console.log(result.rows); // Filtered and sorted rows
```

### Adding Views

```typescript
// Add a Kanban board view
const boardView = await databaseService.addView(databaseId, 'Board', 'board', {
  groupBy: 'status'
});

// Add a calendar view
const calendarView = await databaseService.addView(databaseId, 'Calendar', 'calendar', {
  calendarProperty: 'dueDate'
});
```

### Sharing

```typescript
import { shareService } from '$lib/services/share-service';

await shareService.initialize();

// Create a public share link
const link = await shareService.createPublicLink(databaseId, 'view', {
  password: 'optional-password',
  expiresAt: '2024-12-31T23:59:59Z'
});

console.log(link.url); // https://your-app.com/shared/abc123...

// Validate a share token
const validation = await shareService.validateShareToken(token, password);
if (validation.valid) {
  console.log('Access granted with permission:', validation.permission);
}
```

### Syncing to Storacha

```typescript
// Sync database to decentralized storage
const cid = await databaseService.syncToStoracha(databaseId);
console.log('Database synced with CID:', cid);

// Load database from CID
const manifest = await databaseService.loadFromStoracha(cid);
```

## Property Types

| Type | Description | Value Format |
|------|-------------|--------------|
| `text` | Plain text | `{ type: 'text', value: 'string' }` |
| `number` | Numeric value | `{ type: 'number', value: 123 }` |
| `date` | Date or date range | `{ type: 'date', value: { start: 'ISO', end?: 'ISO' } }` |
| `checkbox` | Boolean | `{ type: 'checkbox', value: true }` |
| `select` | Single select | `{ type: 'select', value: 'optionId' }` |
| `multiSelect` | Multiple select | `{ type: 'multiSelect', value: ['id1', 'id2'] }` |
| `url` | URL link | `{ type: 'url', value: 'https://...' }` |
| `email` | Email address | `{ type: 'url', value: 'email@...' }` |
| `phone` | Phone number | `{ type: 'url', value: '+1...' }` |
| `relation` | Link to other database | `{ type: 'relation', value: ['rowId1'] }` |
| `createdTime` | Auto timestamp | `{ type: 'timestamp', value: 'ISO' }` |
| `lastEditedTime` | Auto timestamp | `{ type: 'timestamp', value: 'ISO' }` |

## View Types

### Table View
- Spreadsheet-like interface
- Sortable columns
- Inline editing
- Column resizing

### Board View (Kanban)
- Group by select property
- Drag and drop between groups
- Card preview with properties

### Calendar View
- Month and week views
- Events based on date property
- Click to add entries

### Gallery View
- Card-based layout
- Cover images
- Property previews

## Sharing & Permissions

### Permission Levels

| Level | View | Comment | Edit | Admin |
|-------|------|---------|------|-------|
| `view` | ✓ | ✗ | ✗ | ✗ |
| `comment` | ✓ | ✓ | ✗ | ✗ |
| `edit` | ✓ | ✓ | ✓ | ✗ |
| `admin` | ✓ | ✓ | ✓ | ✓ |

### Share Link Features
- Password protection
- Expiration dates
- View count tracking
- Revocation

## Storage Strategy

### Local Storage (Cache)
- Database manifests cached in localStorage
- Row data cached for offline access
- Sync status tracked per database

### Storacha (Permanent Storage)
- Each row stored as individual IPLD block
- Manifest contains row index with CIDs
- Content-addressable for verification
- Immutable versions for history

### Sync Process
1. Upload each row as JSON → get CID
2. Update manifest with row CIDs
3. Upload manifest → get manifest CID
4. Store manifest CID for retrieval

## Events

Subscribe to database events:

```typescript
const unsubscribe = databaseService.on('row:created', (event) => {
  console.log('New row:', event.payload.row);
});

// Available events:
// - row:created, row:updated, row:deleted
// - schema:updated
// - view:created, view:updated, view:deleted
// - sync:started, sync:completed, sync:failed
```

## Future Enhancements

- [ ] Real-time collaboration via WebRTC
- [ ] Rollup and formula properties
- [ ] Timeline view
- [ ] Templates
- [ ] Import/Export (CSV, Notion)
- [ ] Full-text search with MiniSearch
- [ ] End-to-end encryption

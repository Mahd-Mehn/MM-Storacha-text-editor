/**
 * Database Service
 * 
 * Manages database-like functionality using Storacha as the storage backend.
 * Uses a client-side index for queries and IPLD DAG structure for relationships.
 * 
 * Storage Strategy:
 * 1. DatabaseManifest (schema + row index) → stored as single document, updated on changes
 * 2. DatabaseRows → stored individually, referenced by CID in manifest
 * 3. Client-side cache → rebuilt from manifest on load, cached in IndexedDB
 */

// Use crypto.randomUUID() for generating unique IDs
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).substring(2, 10);
};
import type {
  DatabaseSchema,
  DatabaseManifest,
  DatabaseRow,
  DatabaseRowIndex,
  DatabaseView,
  DatabaseQuery,
  DatabaseQueryResult,
  PropertyDefinition,
  PropertyValue,
  FilterGroup,
  FilterCondition,
  SortRule,
  SelectOption,
  ViewType,
  DatabaseEventType,
  DatabaseEventCallback,
  DatabaseEvent,
  SerializedDatabase,
  SerializedDatabaseRow,
  SyncedDatabaseServiceInterface,
  SyncMetadata,
  SyncConflict,
  ConflictResolution
} from '$lib/types/database';
import { storachaClient } from './storacha';
import { shareService } from './share-service';
import { authService } from './auth';
import { userDataService } from './user-data-service';

// Storage keys
const DATABASES_STORAGE_KEY = 'storacha_databases';
const DATABASE_CACHE_PREFIX = 'storacha_db_cache_';
const DATABASES_SYNC_KEY = 'storacha_databases_sync';

/**
 * Database Service - Manages databases stored on Storacha
 */
class DatabaseService implements SyncedDatabaseServiceInterface {
  private databases: Map<string, DatabaseManifest> = new Map();
  private rowCache: Map<string, DatabaseRow> = new Map();
  private syncInProgress: Set<string> = new Set();
  private initialized = false;
  private eventListeners: Map<DatabaseEventType, Set<DatabaseEventCallback>> = new Map();
  private syncQueue: Set<string> = new Set();
  private isSyncingFlag = false;
  private syncConflicts: SyncConflict[] = [];

  // ============================================================================
  // Initialization
  // ============================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load database manifests from localStorage (as cache)
      const stored = localStorage.getItem(DATABASES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, DatabaseManifest>;
        for (const [id, manifest] of Object.entries(parsed)) {
          this.databases.set(id, manifest);
        }
      }

      // Load row cache from localStorage
      for (const [dbId] of this.databases) {
        const rowCacheKey = `${DATABASE_CACHE_PREFIX}${dbId}_rows`;
        const rowCache = localStorage.getItem(rowCacheKey);
        if (rowCache) {
          const rows = JSON.parse(rowCache) as DatabaseRow[];
          for (const row of rows) {
            this.rowCache.set(row.id, row);
          }
        }
      }

      this.initialized = true;
      console.log(`DatabaseService initialized with ${this.databases.size} databases`);
    } catch (error) {
      console.error('Failed to initialize DatabaseService:', error);
      this.initialized = true;
    }
  }

  // ============================================================================
  // Event System
  // ============================================================================

  on(event: DatabaseEventType, callback: DatabaseEventCallback): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
    
    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  private emit(type: DatabaseEventType, databaseId: string, payload: any): void {
    const event: DatabaseEvent = {
      type,
      databaseId,
      payload,
      timestamp: new Date().toISOString()
    };

    this.eventListeners.get(type)?.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Event callback error:', error);
      }
    });
  }

  // ============================================================================
  // Database CRUD
  // ============================================================================

  /**
   * Create a new database
   */
  async createDatabase(
    name: string,
    properties: PropertyDefinition[] = [],
    icon?: string
  ): Promise<DatabaseSchema> {
    await this.initialize();

    const now = new Date().toISOString();
    const id = `db_${Date.now()}_${generateId().slice(0, 8)}`;

    // Default properties if none provided
    const defaultProperties: PropertyDefinition[] = properties.length > 0 ? properties : [
      {
        id: 'title',
        name: 'Name',
        type: 'text',
        isVisible: true
      },
      {
        id: 'status',
        name: 'Status',
        type: 'select',
        isVisible: true,
        options: [
          { id: 'todo', name: 'To Do', color: '#e0e0e0' },
          { id: 'in_progress', name: 'In Progress', color: '#fff3cd' },
          { id: 'done', name: 'Done', color: '#d4edda' }
        ]
      },
      {
        id: 'tags',
        name: 'Tags',
        type: 'multiSelect',
        isVisible: true,
        options: []
      },
      {
        id: 'created',
        name: 'Created',
        type: 'createdTime',
        isVisible: true
      },
      {
        id: 'lastEdited',
        name: 'Last Edited',
        type: 'lastEditedTime',
        isVisible: true
      }
    ];

    // Default table view
    const defaultView: DatabaseView = {
      id: `view_${Date.now()}`,
      name: 'Table',
      type: 'table',
      filters: { operator: 'and', conditions: [] },
      sorts: [],
      visibleProperties: defaultProperties.map(p => p.id)
    };

    const schema: DatabaseSchema = {
      id,
      name,
      icon,
      properties: defaultProperties,
      views: [defaultView],
      createdAt: now,
      updatedAt: now,
      createdBy: 'local' // TODO: Get from auth
    };

    const manifest: DatabaseManifest = {
      version: 1,
      schema,
      rowIndex: [],
      lastSync: now
    };

    this.databases.set(id, manifest);
    await this.saveToStorage();

    // Register with user data service
    try {
      await userDataService.initialize();
      await userDataService.addDatabase(id, name, 'default', { icon });
    } catch (error) {
      console.error('Failed to register database with user data service:', error);
    }

    this.emit('schema:updated', id, { schema });

    return schema;
  }

  /**
   * Get a database by ID
   */
  async getDatabase(id: string): Promise<DatabaseManifest | null> {
    await this.initialize();
    return this.databases.get(id) || null;
  }

  /**
   * List all databases
   */
  async listDatabases(): Promise<DatabaseSchema[]> {
    await this.initialize();
    return Array.from(this.databases.values()).map(m => m.schema);
  }

  /**
   * Update database schema
   */
  async updateDatabase(
    id: string,
    updates: Partial<Pick<DatabaseSchema, 'name' | 'icon' | 'cover' | 'description' | 'properties' | 'views'>>
  ): Promise<DatabaseSchema | null> {
    await this.initialize();

    const manifest = this.databases.get(id);
    if (!manifest) return null;

    manifest.schema = {
      ...manifest.schema,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    manifest.lastSync = new Date().toISOString();

    await this.saveToStorage();
    this.emit('schema:updated', id, { schema: manifest.schema });
    
    return manifest.schema;
  }

  /**
   * Delete a database
   */
  async deleteDatabase(id: string): Promise<boolean> {
    await this.initialize();

    if (!this.databases.has(id)) return false;

    // Delete all rows
    const manifest = this.databases.get(id)!;
    for (const rowIndex of manifest.rowIndex) {
      this.rowCache.delete(rowIndex.id);
    }

    this.databases.delete(id);
    localStorage.removeItem(`${DATABASE_CACHE_PREFIX}${id}_rows`);
    await this.saveToStorage();

    return true;
  }

  // ============================================================================
  // Row CRUD
  // ============================================================================

  /**
   * Create a new row in a database
   */
  async createRow(
    databaseId: string,
    properties: Record<string, PropertyValue> = {}
  ): Promise<DatabaseRow | null> {
    await this.initialize();

    const manifest = this.databases.get(databaseId);
    if (!manifest) return null;

    const now = new Date().toISOString();
    const id = `row_${Date.now()}_${generateId().slice(0, 8)}`;

    // Initialize all properties with defaults
    const initialProperties: Record<string, PropertyValue> = {};
    for (const propDef of manifest.schema.properties) {
      if (properties[propDef.id]) {
        initialProperties[propDef.id] = properties[propDef.id];
      } else {
        initialProperties[propDef.id] = this.getDefaultPropertyValue(propDef);
      }
    }

    // Set system properties
    const createdTimeProp = manifest.schema.properties.find(p => p.type === 'createdTime');
    if (createdTimeProp) {
      initialProperties[createdTimeProp.id] = { type: 'timestamp', value: now };
    }
    
    const lastEditedProp = manifest.schema.properties.find(p => p.type === 'lastEditedTime');
    if (lastEditedProp) {
      initialProperties[lastEditedProp.id] = { type: 'timestamp', value: now };
    }

    const row: DatabaseRow = {
      id,
      databaseId,
      properties: initialProperties,
      createdAt: now,
      updatedAt: now,
      createdBy: 'local',
      lastEditedBy: 'local'
    };

    // Add to cache
    this.rowCache.set(id, row);

    // Add to manifest index
    const rowIndex: DatabaseRowIndex = {
      id,
      cid: '', // Will be set after upload
      updatedAt: now,
      title: this.extractTitle(row, manifest.schema),
      indexedProperties: this.extractIndexedProperties(row, manifest.schema)
    };
    manifest.rowIndex.push(rowIndex);
    manifest.lastSync = now;

    await this.saveToStorage();
    await this.saveRowCache(databaseId);

    this.emit('row:created', databaseId, { row });

    return row;
  }

  /**
   * Get a row by ID
   */
  async getRow(rowId: string): Promise<DatabaseRow | null> {
    await this.initialize();
    return this.rowCache.get(rowId) || null;
  }

  /**
   * Get all rows for a database
   */
  async getRows(databaseId: string): Promise<DatabaseRow[]> {
    await this.initialize();
    return Array.from(this.rowCache.values())
      .filter(row => row.databaseId === databaseId);
  }

  /**
   * Update a row
   */
  async updateRow(
    rowId: string,
    propertyUpdates: Record<string, PropertyValue>
  ): Promise<DatabaseRow | null> {
    await this.initialize();

    const row = this.rowCache.get(rowId);
    if (!row) return null;

    const manifest = this.databases.get(row.databaseId);
    if (!manifest) return null;

    const now = new Date().toISOString();

    // Update properties
    row.properties = { ...row.properties, ...propertyUpdates };
    row.updatedAt = now;
    row.lastEditedBy = 'local';

    // Update lastEditedTime if exists
    const lastEditedProp = manifest.schema.properties.find(p => p.type === 'lastEditedTime');
    if (lastEditedProp) {
      row.properties[lastEditedProp.id] = { type: 'timestamp', value: now };
    }

    // Update index
    const indexEntry = manifest.rowIndex.find(r => r.id === rowId);
    if (indexEntry) {
      indexEntry.updatedAt = now;
      indexEntry.title = this.extractTitle(row, manifest.schema);
      indexEntry.indexedProperties = this.extractIndexedProperties(row, manifest.schema);
    }

    manifest.lastSync = now;

    await this.saveToStorage();
    await this.saveRowCache(row.databaseId);

    this.emit('row:updated', row.databaseId, { row });

    return row;
  }

  /**
   * Delete a row
   */
  async deleteRow(rowId: string): Promise<boolean> {
    await this.initialize();

    const row = this.rowCache.get(rowId);
    if (!row) return false;

    const manifest = this.databases.get(row.databaseId);
    if (!manifest) return false;

    // Remove from cache
    this.rowCache.delete(rowId);

    // Remove from index
    manifest.rowIndex = manifest.rowIndex.filter(r => r.id !== rowId);
    manifest.lastSync = new Date().toISOString();

    await this.saveToStorage();
    await this.saveRowCache(row.databaseId);

    this.emit('row:deleted', row.databaseId, { rowId });

    return true;
  }

  /**
   * Bulk create rows
   */
  async bulkCreateRows(
    databaseId: string,
    rowsData: Record<string, PropertyValue>[]
  ): Promise<DatabaseRow[]> {
    const createdRows: DatabaseRow[] = [];
    
    for (const properties of rowsData) {
      const row = await this.createRow(databaseId, properties);
      if (row) {
        createdRows.push(row);
      }
    }
    
    return createdRows;
  }

  // ============================================================================
  // Querying
  // ============================================================================

  /**
   * Query rows from a database with filters and sorts
   */
  async queryRows(query: DatabaseQuery): Promise<DatabaseQueryResult> {
    await this.initialize();

    const startTime = Date.now();
    const manifest = this.databases.get(query.databaseId);
    if (!manifest) {
      return { rows: [], total: 0, hasMore: false };
    }

    // Get all rows for this database
    let rows = Array.from(this.rowCache.values())
      .filter(row => row.databaseId === query.databaseId);

    // Apply filters
    if (query.filter && query.filter.conditions.length > 0) {
      rows = rows.filter(row => this.matchesFilter(row, query.filter!, manifest.schema));
    }

    // Apply sorts
    if (query.sorts && query.sorts.length > 0) {
      rows = this.sortRows(rows, query.sorts, manifest.schema);
    }

    const total = rows.length;

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    rows = rows.slice(offset, offset + limit);

    return {
      rows,
      total,
      hasMore: offset + rows.length < total,
      executionTime: Date.now() - startTime
    };
  }

  /**
   * Get rows grouped by a property (for board view)
   */
  async getGroupedRows(
    databaseId: string,
    groupByPropertyId: string,
    filter?: FilterGroup
  ): Promise<Map<string, DatabaseRow[]>> {
    await this.initialize();

    const manifest = this.databases.get(databaseId);
    if (!manifest) return new Map();

    const property = manifest.schema.properties.find(p => p.id === groupByPropertyId);
    if (!property) return new Map();

    let rows = Array.from(this.rowCache.values())
      .filter(row => row.databaseId === databaseId);

    if (filter && filter.conditions.length > 0) {
      rows = rows.filter(row => this.matchesFilter(row, filter, manifest.schema));
    }

    const groups = new Map<string, DatabaseRow[]>();

    // Initialize groups based on property options
    if (property.type === 'select' && property.options) {
      for (const option of property.options) {
        groups.set(option.id, []);
      }
      groups.set('_none', []); // For rows without a value
    } else if (property.type === 'checkbox') {
      groups.set('checked', []);
      groups.set('unchecked', []);
    }

    // Group rows
    for (const row of rows) {
      const propValue = row.properties[groupByPropertyId];
      let groupKey = '_none';

      if (propValue?.type === 'select' && propValue.value) {
        groupKey = propValue.value;
      } else if (propValue?.type === 'checkbox') {
        groupKey = propValue.value ? 'checked' : 'unchecked';
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(row);
    }

    return groups;
  }

  /**
   * Search rows by text content
   */
  async searchRows(databaseId: string, searchTerm: string): Promise<DatabaseRow[]> {
    await this.initialize();

    const manifest = this.databases.get(databaseId);
    if (!manifest) return [];

    const lowerSearch = searchTerm.toLowerCase();
    
    return Array.from(this.rowCache.values())
      .filter(row => {
        if (row.databaseId !== databaseId) return false;
        
        // Search through all text properties
        for (const [propId, propValue] of Object.entries(row.properties)) {
          if (propValue.type === 'text' && propValue.value.toLowerCase().includes(lowerSearch)) {
            return true;
          }
        }
        return false;
      });
  }

  // ============================================================================
  // View Management
  // ============================================================================

  /**
   * Add a view to a database
   */
  async addView(
    databaseId: string,
    name: string,
    type: ViewType,
    config?: Partial<DatabaseView>
  ): Promise<DatabaseView | null> {
    await this.initialize();

    const manifest = this.databases.get(databaseId);
    if (!manifest) return null;

    const view: DatabaseView = {
      id: `view_${Date.now()}_${generateId().slice(0, 8)}`,
      name,
      type,
      filters: config?.filters || { operator: 'and', conditions: [] },
      sorts: config?.sorts || [],
      visibleProperties: config?.visibleProperties || manifest.schema.properties.map(p => p.id),
      groupBy: config?.groupBy,
      calendarProperty: config?.calendarProperty,
      galleryProperty: config?.galleryProperty,
      timelineStartProperty: config?.timelineStartProperty,
      timelineEndProperty: config?.timelineEndProperty,
      cardSize: config?.cardSize,
      showEmptyGroups: config?.showEmptyGroups
    };

    manifest.schema.views.push(view);
    manifest.schema.updatedAt = new Date().toISOString();
    manifest.lastSync = new Date().toISOString();

    await this.saveToStorage();
    this.emit('view:created', databaseId, { view });
    
    return view;
  }

  /**
   * Update a view
   */
  async updateView(
    databaseId: string,
    viewId: string,
    updates: Partial<DatabaseView>
  ): Promise<DatabaseView | null> {
    await this.initialize();

    const manifest = this.databases.get(databaseId);
    if (!manifest) return null;

    const viewIndex = manifest.schema.views.findIndex(v => v.id === viewId);
    if (viewIndex === -1) return null;

    manifest.schema.views[viewIndex] = {
      ...manifest.schema.views[viewIndex],
      ...updates
    };

    manifest.schema.updatedAt = new Date().toISOString();
    manifest.lastSync = new Date().toISOString();

    await this.saveToStorage();
    this.emit('view:updated', databaseId, { view: manifest.schema.views[viewIndex] });
    
    return manifest.schema.views[viewIndex];
  }

  /**
   * Delete a view
   */
  async deleteView(databaseId: string, viewId: string): Promise<boolean> {
    await this.initialize();

    const manifest = this.databases.get(databaseId);
    if (!manifest) return false;

    // Can't delete the last view
    if (manifest.schema.views.length <= 1) return false;

    manifest.schema.views = manifest.schema.views.filter(v => v.id !== viewId);
    manifest.schema.updatedAt = new Date().toISOString();
    manifest.lastSync = new Date().toISOString();

    await this.saveToStorage();
    this.emit('view:deleted', databaseId, { viewId });
    
    return true;
  }

  // ============================================================================
  // Property Management
  // ============================================================================

  /**
   * Add a property to a database
   */
  async addProperty(
    databaseId: string,
    property: PropertyDefinition
  ): Promise<PropertyDefinition | null> {
    await this.initialize();

    const manifest = this.databases.get(databaseId);
    if (!manifest) return null;

    // Ensure unique ID
    if (!property.id) {
      property.id = `prop_${Date.now()}_${generateId().slice(0, 8)}`;
    }

    // Set default visibility
    if (property.isVisible === undefined) {
      property.isVisible = true;
    }

    manifest.schema.properties.push(property);

    // Add to visible properties in all views
    for (const view of manifest.schema.views) {
      view.visibleProperties.push(property.id);
    }

    // Initialize property value in all existing rows
    const defaultValue = this.getDefaultPropertyValue(property);
    for (const rowIndex of manifest.rowIndex) {
      const row = this.rowCache.get(rowIndex.id);
      if (row) {
        row.properties[property.id] = defaultValue;
      }
    }

    manifest.schema.updatedAt = new Date().toISOString();
    manifest.lastSync = new Date().toISOString();

    await this.saveToStorage();
    await this.saveRowCache(databaseId);

    this.emit('schema:updated', databaseId, { property });

    return property;
  }

  /**
   * Update a property definition
   */
  async updateProperty(
    databaseId: string,
    propertyId: string,
    updates: Partial<PropertyDefinition>
  ): Promise<PropertyDefinition | null> {
    await this.initialize();

    const manifest = this.databases.get(databaseId);
    if (!manifest) return null;

    const propIndex = manifest.schema.properties.findIndex(p => p.id === propertyId);
    if (propIndex === -1) return null;

    manifest.schema.properties[propIndex] = {
      ...manifest.schema.properties[propIndex],
      ...updates
    };

    manifest.schema.updatedAt = new Date().toISOString();
    manifest.lastSync = new Date().toISOString();

    await this.saveToStorage();
    this.emit('schema:updated', databaseId, { property: manifest.schema.properties[propIndex] });
    
    return manifest.schema.properties[propIndex];
  }

  /**
   * Delete a property
   */
  async deleteProperty(databaseId: string, propertyId: string): Promise<boolean> {
    await this.initialize();

    const manifest = this.databases.get(databaseId);
    if (!manifest) return false;

    // Remove from schema
    manifest.schema.properties = manifest.schema.properties.filter(p => p.id !== propertyId);

    // Remove from views
    for (const view of manifest.schema.views) {
      view.visibleProperties = view.visibleProperties.filter(id => id !== propertyId);
      if (view.groupBy === propertyId) view.groupBy = undefined;
      if (view.calendarProperty === propertyId) view.calendarProperty = undefined;
      if (view.galleryProperty === propertyId) view.galleryProperty = undefined;
    }

    // Remove from all rows
    for (const rowIndex of manifest.rowIndex) {
      const row = this.rowCache.get(rowIndex.id);
      if (row) {
        delete row.properties[propertyId];
      }
    }

    manifest.schema.updatedAt = new Date().toISOString();
    manifest.lastSync = new Date().toISOString();

    await this.saveToStorage();
    await this.saveRowCache(databaseId);

    this.emit('schema:updated', databaseId, { deletedPropertyId: propertyId });

    return true;
  }

  /**
   * Add an option to a select/multiSelect property
   */
  async addSelectOption(
    databaseId: string,
    propertyId: string,
    option: SelectOption
  ): Promise<SelectOption | null> {
    await this.initialize();

    const manifest = this.databases.get(databaseId);
    if (!manifest) return null;

    const property = manifest.schema.properties.find(p => p.id === propertyId);
    if (!property || (property.type !== 'select' && property.type !== 'multiSelect')) {
      return null;
    }

    if (!property.options) {
      property.options = [];
    }

    // Ensure unique ID
    if (!option.id) {
      option.id = `opt_${Date.now()}_${generateId().slice(0, 8)}`;
    }

    property.options.push(option);

    manifest.schema.updatedAt = new Date().toISOString();
    manifest.lastSync = new Date().toISOString();

    await this.saveToStorage();
    return option;
  }

  /**
   * Remove an option from a select/multiSelect property
   */
  async removeSelectOption(
    databaseId: string,
    propertyId: string,
    optionId: string
  ): Promise<boolean> {
    await this.initialize();

    const manifest = this.databases.get(databaseId);
    if (!manifest) return false;

    const property = manifest.schema.properties.find(p => p.id === propertyId);
    if (!property || !property.options) return false;

    property.options = property.options.filter(o => o.id !== optionId);

    // Clear this option from all rows
    for (const rowIndex of manifest.rowIndex) {
      const row = this.rowCache.get(rowIndex.id);
      if (row) {
        const propValue = row.properties[propertyId];
        if (propValue?.type === 'select' && propValue.value === optionId) {
          propValue.value = null;
        } else if (propValue?.type === 'multiSelect') {
          propValue.value = propValue.value.filter(v => v !== optionId);
        }
      }
    }

    manifest.schema.updatedAt = new Date().toISOString();
    manifest.lastSync = new Date().toISOString();

    await this.saveToStorage();
    await this.saveRowCache(databaseId);
    
    return true;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getDefaultPropertyValue(property: PropertyDefinition): PropertyValue {
    switch (property.type) {
      case 'text':
        return { type: 'text', value: '' };
      case 'number':
        return { type: 'number', value: null };
      case 'date':
        return { type: 'date', value: null };
      case 'checkbox':
        return { type: 'checkbox', value: false };
      case 'select':
        return { type: 'select', value: null };
      case 'multiSelect':
        return { type: 'multiSelect', value: [] };
      case 'url':
      case 'email':
      case 'phone':
        return { type: 'url', value: null };
      case 'relation':
        return { type: 'relation', value: [] };
      case 'createdTime':
      case 'lastEditedTime':
        return { type: 'timestamp', value: new Date().toISOString() };
      case 'createdBy':
      case 'lastEditedBy':
        return { type: 'user', value: 'local' };
      case 'files':
        return { type: 'files', value: [] };
      case 'person':
        return { type: 'person', value: [] };
      default:
        return { type: 'text', value: '' };
    }
  }

  private extractTitle(row: DatabaseRow, schema: DatabaseSchema): string {
    // Find the first text property (usually "Name" or "Title")
    const titleProp = schema.properties.find(p => p.type === 'text');
    if (titleProp) {
      const value = row.properties[titleProp.id];
      if (value?.type === 'text') {
        return value.value || 'Untitled';
      }
    }
    return 'Untitled';
  }

  private extractIndexedProperties(
    row: DatabaseRow,
    schema: DatabaseSchema
  ): Record<string, string | number | boolean | string[]> {
    const indexed: Record<string, string | number | boolean | string[]> = {};

    for (const prop of schema.properties) {
      const value = row.properties[prop.id];
      if (!value) continue;

      switch (value.type) {
        case 'text':
          indexed[prop.id] = value.value;
          break;
        case 'number':
          if (value.value !== null) indexed[prop.id] = value.value;
          break;
        case 'checkbox':
          indexed[prop.id] = value.value;
          break;
        case 'select':
          if (value.value) indexed[prop.id] = value.value;
          break;
        case 'multiSelect':
          indexed[prop.id] = value.value;
          break;
        case 'timestamp':
          indexed[prop.id] = value.value;
          break;
      }
    }

    return indexed;
  }

  private matchesFilter(
    row: DatabaseRow,
    filter: FilterGroup,
    schema: DatabaseSchema
  ): boolean {
    if (filter.conditions.length === 0) return true;

    const results = filter.conditions.map(condition => {
      if ('operator' in condition && 'conditions' in condition) {
        // Nested filter group
        return this.matchesFilter(row, condition as FilterGroup, schema);
      }
      return this.matchesCondition(row, condition as FilterCondition, schema);
    });

    if (filter.operator === 'and') {
      return results.every(r => r);
    } else {
      return results.some(r => r);
    }
  }

  private matchesCondition(
    row: DatabaseRow,
    condition: FilterCondition,
    schema: DatabaseSchema
  ): boolean {
    const propValue = row.properties[condition.propertyId];
    if (!propValue) return condition.operator === 'isEmpty';

    switch (condition.operator) {
      case 'isEmpty':
        return this.isValueEmpty(propValue);
      case 'isNotEmpty':
        return !this.isValueEmpty(propValue);
      case 'equals':
        return this.getComparableValue(propValue) === condition.value;
      case 'notEquals':
        return this.getComparableValue(propValue) !== condition.value;
      case 'contains':
        if (propValue.type === 'text') {
          return propValue.value.toLowerCase().includes(String(condition.value).toLowerCase());
        }
        if (propValue.type === 'multiSelect') {
          return propValue.value.includes(String(condition.value));
        }
        return false;
      case 'notContains':
        if (propValue.type === 'text') {
          return !propValue.value.toLowerCase().includes(String(condition.value).toLowerCase());
        }
        if (propValue.type === 'multiSelect') {
          return !propValue.value.includes(String(condition.value));
        }
        return true;
      case 'startsWith':
        if (propValue.type === 'text') {
          return propValue.value.toLowerCase().startsWith(String(condition.value).toLowerCase());
        }
        return false;
      case 'endsWith':
        if (propValue.type === 'text') {
          return propValue.value.toLowerCase().endsWith(String(condition.value).toLowerCase());
        }
        return false;
      case 'greaterThan':
        return Number(this.getComparableValue(propValue)) > Number(condition.value);
      case 'lessThan':
        return Number(this.getComparableValue(propValue)) < Number(condition.value);
      case 'greaterOrEqual':
        return Number(this.getComparableValue(propValue)) >= Number(condition.value);
      case 'lessOrEqual':
        return Number(this.getComparableValue(propValue)) <= Number(condition.value);
      case 'isChecked':
        return propValue.type === 'checkbox' && propValue.value === true;
      case 'isNotChecked':
        return propValue.type === 'checkbox' && propValue.value === false;
      case 'before':
        if (propValue.type === 'date' && propValue.value) {
          return new Date(propValue.value.start) < new Date(String(condition.value));
        }
        return false;
      case 'after':
        if (propValue.type === 'date' && propValue.value) {
          return new Date(propValue.value.start) > new Date(String(condition.value));
        }
        return false;
      default:
        return true;
    }
  }

  private isValueEmpty(value: PropertyValue): boolean {
    switch (value.type) {
      case 'text':
        return !value.value || value.value.trim() === '';
      case 'number':
        return value.value === null;
      case 'date':
        return value.value === null;
      case 'select':
        return value.value === null;
      case 'multiSelect':
        return value.value.length === 0;
      case 'relation':
        return value.value.length === 0;
      case 'checkbox':
        return false; // Checkbox is never "empty"
      case 'url':
        return value.value === null || value.value === '';
      case 'files':
        return value.value.length === 0;
      case 'person':
        return value.value.length === 0;
      default:
        return true;
    }
  }

  private getComparableValue(value: PropertyValue): string | number | boolean {
    switch (value.type) {
      case 'text':
        return value.value;
      case 'number':
        return value.value ?? 0;
      case 'checkbox':
        return value.value;
      case 'select':
        return value.value ?? '';
      case 'date':
        return value.value?.start ?? '';
      case 'timestamp':
        return value.value;
      case 'url':
        return value.value ?? '';
      default:
        return '';
    }
  }

  private sortRows(
    rows: DatabaseRow[],
    sorts: SortRule[],
    schema: DatabaseSchema
  ): DatabaseRow[] {
    return [...rows].sort((a, b) => {
      for (const sort of sorts) {
        const aValue = this.getComparableValue(a.properties[sort.propertyId] || { type: 'text', value: '' });
        const bValue = this.getComparableValue(b.properties[sort.propertyId] || { type: 'text', value: '' });

        let comparison = 0;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
          comparison = (aValue ? 1 : 0) - (bValue ? 1 : 0);
        }

        if (comparison !== 0) {
          return sort.direction === 'desc' ? -comparison : comparison;
        }
      }
      return 0;
    });
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  private async saveToStorage(): Promise<void> {
    const data: Record<string, DatabaseManifest> = {};
    for (const [id, manifest] of this.databases) {
      data[id] = manifest;
    }
    localStorage.setItem(DATABASES_STORAGE_KEY, JSON.stringify(data));
  }

  private async saveRowCache(databaseId: string): Promise<void> {
    const rows = Array.from(this.rowCache.values())
      .filter(row => row.databaseId === databaseId);
    localStorage.setItem(`${DATABASE_CACHE_PREFIX}${databaseId}_rows`, JSON.stringify(rows));
  }

  // ============================================================================
  // Storacha Integration
  // ============================================================================

  /**
   * Sync database to Storacha
   */
  async syncToStoracha(databaseId: string): Promise<string | null> {
    await this.initialize();

    if (this.syncInProgress.has(databaseId)) {
      console.log('Sync already in progress for database:', databaseId);
      return null;
    }

    const manifest = this.databases.get(databaseId);
    if (!manifest) {
      console.error('Database not found:', databaseId);
      return null;
    }

    this.syncInProgress.add(databaseId);
    this.emit('sync:started', databaseId, {});

    try {
      // Check if Storacha client is ready
      if (!storachaClient.isReady()) {
        console.warn('Storacha client not ready, skipping cloud sync');
        this.syncInProgress.delete(databaseId);
        return null;
      }

      // 1. Upload each row as individual document
      const updatedRowIndex: DatabaseRowIndex[] = [];
      
      for (const rowIndex of manifest.rowIndex) {
        const row = this.rowCache.get(rowIndex.id);
        if (!row) continue;

        const serializedRow: SerializedDatabaseRow = {
          row,
          blocks: row.content
        };

        const rowJson = JSON.stringify(serializedRow);
        const rowContent = new TextEncoder().encode(rowJson);
        
        try {
          const rowCid = await storachaClient.uploadContent(
            rowContent,
            `db_${databaseId}_row_${row.id}.json`
          );
          
          updatedRowIndex.push({
            ...rowIndex,
            cid: rowCid
          });
          
          // Update row with CID
          row.storachaCID = rowCid;
        } catch (error) {
          console.error('Failed to upload row:', row.id, error);
          // Keep the old CID if upload fails
          updatedRowIndex.push(rowIndex);
        }
      }

      // 2. Update manifest with new CIDs
      manifest.rowIndex = updatedRowIndex;
      manifest.lastSync = new Date().toISOString();

      // 3. Upload manifest
      // Fetch share configs
      const shareConfigs = await shareService.getShareConfigs(databaseId);

      const serializedDb: SerializedDatabase = {
        manifest,
        shareConfigs
      };

      const manifestJson = JSON.stringify(serializedDb);
      const manifestContent = new TextEncoder().encode(manifestJson);
      
      const manifestCid = await storachaClient.uploadContent(
        manifestContent,
        `database_${databaseId}_manifest.json`
      );

      manifest.storachaCID = manifestCid;
      manifest.schema.storachaCID = manifestCid;

      // 4. Save updated manifest locally
      await this.saveToStorage();
      await this.saveRowCache(databaseId);

      // 5. Store sync info
      const syncInfo = JSON.parse(localStorage.getItem(DATABASES_SYNC_KEY) || '{}');
      syncInfo[databaseId] = {
        cid: manifestCid,
        syncedAt: new Date().toISOString()
      };
      localStorage.setItem(DATABASES_SYNC_KEY, JSON.stringify(syncInfo));

      console.log(`Database ${databaseId} synced to Storacha with CID: ${manifestCid}`);
      
      // 6. Update user data service with new CID
      try {
        await userDataService.initialize();
        await userDataService.updateDatabaseCid(databaseId, manifestCid);
      } catch (error) {
        console.error('Failed to update database CID in user data:', error);
      }
      
      this.emit('sync:completed', databaseId, { cid: manifestCid });
      this.syncInProgress.delete(databaseId);
      
      return manifestCid;
    } catch (error) {
      console.error('Failed to sync database to Storacha:', error);
      this.emit('sync:failed', databaseId, { error });
      this.syncInProgress.delete(databaseId);
      return null;
    }
  }

  /**
   * Load database from Storacha CID
   */
  async loadFromStoracha(cid: string): Promise<DatabaseManifest | null> {
    try {
      // Check if Storacha client is ready
      if (!storachaClient.isReady()) {
        console.warn('Storacha client not ready');
        return null;
      }

      // 1. Fetch manifest from Storacha
      const manifestContent = await storachaClient.retrieveContent(cid);
      const manifestJson = new TextDecoder().decode(manifestContent);
      const serializedDb: SerializedDatabase = JSON.parse(manifestJson);
      
      const manifest = serializedDb.manifest;

      // 2. Load all rows
      for (const rowIndex of manifest.rowIndex) {
        if (!rowIndex.cid) continue;

        try {
          const rowContent = await storachaClient.retrieveContent(rowIndex.cid);
          const rowJson = new TextDecoder().decode(rowContent);
          const serializedRow: SerializedDatabaseRow = JSON.parse(rowJson);
          
          this.rowCache.set(serializedRow.row.id, serializedRow.row);
        } catch (error) {
          console.error('Failed to load row:', rowIndex.id, error);
        }
      }

      // 3. Store locally
      this.databases.set(manifest.schema.id, manifest);
      await this.saveToStorage();
      await this.saveRowCache(manifest.schema.id);

      console.log(`Database loaded from Storacha CID: ${cid}`);
      return manifest;
    } catch (error) {
      console.error('Failed to load database from Storacha:', error);
      return null;
    }
  }



  /**
   * Check if sync is in progress
   */
  isSyncing(databaseId: string): boolean {
    return this.syncInProgress.has(databaseId);
  }

  // ============================================================================
  // Import/Export
  // ============================================================================

  /**
   * Export database to JSON
   */
  async exportToJSON(databaseId: string): Promise<string | null> {
    await this.initialize();

    const manifest = this.databases.get(databaseId);
    if (!manifest) return null;

    const rows = Array.from(this.rowCache.values())
      .filter(row => row.databaseId === databaseId);

    const exportData = {
      manifest,
      rows,
      exportedAt: new Date().toISOString()
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import database from JSON
   */
  async importFromJSON(jsonData: string): Promise<DatabaseSchema | null> {
    try {
      const importData = JSON.parse(jsonData);
      
      if (!importData.manifest || !importData.rows) {
        throw new Error('Invalid import data format');
      }

      // Generate new IDs to avoid conflicts
      const oldDbId = importData.manifest.schema.id;
      const newDbId = `db_${Date.now()}_${generateId().slice(0, 8)}`;
      
      // Update manifest with new ID
      importData.manifest.schema.id = newDbId;
      importData.manifest.schema.name = `${importData.manifest.schema.name} (Imported)`;
      importData.manifest.schema.createdAt = new Date().toISOString();
      importData.manifest.schema.updatedAt = new Date().toISOString();
      importData.manifest.lastSync = new Date().toISOString();
      importData.manifest.storachaCID = undefined;

      // Update row IDs and references
      const idMap = new Map<string, string>();
      
      for (const row of importData.rows) {
        const oldRowId = row.id;
        const newRowId = `row_${Date.now()}_${generateId().slice(0, 8)}`;
        idMap.set(oldRowId, newRowId);
        
        row.id = newRowId;
        row.databaseId = newDbId;
        row.storachaCID = undefined;
        
        this.rowCache.set(newRowId, row);
      }

      // Update row index
      importData.manifest.rowIndex = importData.manifest.rowIndex.map((idx: DatabaseRowIndex) => ({
        ...idx,
        id: idMap.get(idx.id) || idx.id,
        cid: ''
      }));

      // Store manifest
      this.databases.set(newDbId, importData.manifest);
      await this.saveToStorage();
      await this.saveRowCache(newDbId);

      return importData.manifest.schema;
    } catch (error) {
      console.error('Failed to import database:', error);
      return null;
    }
  }

  /**
   * Duplicate a database
   */
  async duplicateDatabase(databaseId: string, newName?: string): Promise<DatabaseSchema | null> {
    const jsonData = await this.exportToJSON(databaseId);
    if (!jsonData) return null;

    const importData = JSON.parse(jsonData);
    importData.manifest.schema.name = newName || `${importData.manifest.schema.name} (Copy)`;

    return this.importFromJSON(JSON.stringify(importData));
  }

  // ============================================================================
  // Sync & Conflict Resolution
  // ============================================================================
  
  async syncDatabase(databaseId: string): Promise<SyncMetadata> {
    await this.syncToStoracha(databaseId);
    return this.getSyncStatus(databaseId);
  }
  
  async syncRow(rowId: string): Promise<SyncMetadata> {
    const row = await this.getRow(rowId);
    if (row) {
      await this.syncToStoracha(row.databaseId);
      return this.getSyncStatus(row.databaseId);
    }
    return { 
      status: 'error', 
      retryCount: 0,
      error: 'Row not found'
    };
  }
  
  getSyncStatus(databaseId: string): SyncMetadata {
    const syncInfo = JSON.parse(localStorage.getItem(DATABASES_SYNC_KEY) || '{}');
    const info = syncInfo[databaseId];
    
    if (!info) {
      return { 
        status: 'pending',
        retryCount: 0
      };
    }

    return {
      status: this.syncInProgress.has(databaseId) ? 'syncing' : 'synced',
      lastSyncedAt: info.syncedAt,
      remoteCID: info.cid,
      retryCount: 0
    };
  }
  
  async resolveConflict(conflict: SyncConflict, resolution: ConflictResolution): Promise<boolean> {
    // TODO: Implement conflict resolution logic
    // For now, we just acknowledge the conflict
    this.syncConflicts = this.syncConflicts.filter(c => 
      c.resourceId !== conflict.resourceId
    );
    return true;
  }
  
  async getConflicts(): Promise<SyncConflict[]> {
    return this.syncConflicts;
  }
  
  queueForSync(databaseId: string): void {
    this.syncQueue.add(databaseId);
    this.processOfflineQueue();
  }
  
  async processOfflineQueue(): Promise<{ synced: number; failed: number; pending: number }> {
    if (this.isSyncingFlag || this.syncQueue.size === 0) {
      return { synced: 0, failed: 0, pending: this.syncQueue.size };
    }

    this.isSyncingFlag = true;
    let synced = 0;
    let failed = 0;

    try {
      const queue = Array.from(this.syncQueue);
      for (const dbId of queue) {
        const result = await this.syncToStoracha(dbId);
        if (result) {
          this.syncQueue.delete(dbId);
          synced++;
        } else {
          failed++;
        }
      }
    } finally {
      this.isSyncingFlag = false;
    }

    return { synced, failed, pending: this.syncQueue.size };
  }

  async exportDatabase(databaseId: string, format: 'json' | 'csv'): Promise<Blob> {
    const json = await this.exportToJSON(databaseId);
    if (!json) throw new Error('Export failed');
    
    return new Blob([json], { type: 'application/json' });
  }
  
  async importDatabase(data: Blob, format: 'json' | 'csv', options?: { merge?: boolean }): Promise<DatabaseSchema> {
    const text = await data.text();
    const result = await this.importFromJSON(text);
    if (!result) throw new Error('Import failed');
    return result;
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
export { DatabaseService };

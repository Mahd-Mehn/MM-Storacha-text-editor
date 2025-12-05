// Page and Workspace types for hierarchical document structure
// Implements Notion-like page nesting and workspace organization

import type { ShareLink } from './index.js';
import type { Block, SerializedBlock } from './blocks.js';

/**
 * Page type determines the page's primary content and behavior
 */
export type PageType = 
  | 'page'      // Standard rich-text page with blocks
  | 'database'  // Database with properties and views
  | 'kanban'    // Kanban board view (shortcut for database with board view)
  | 'calendar'  // Calendar view (shortcut for database with calendar view)
  | 'gallery';  // Gallery view (shortcut for database with gallery view)

/**
 * Page icon can be an emoji or a custom image URL
 */
export interface PageIcon {
  type: 'emoji' | 'image' | 'lucide';
  value: string; // Emoji character, image URL, or Lucide icon name
}

/**
 * Page cover image settings
 */
export interface PageCover {
  type: 'color' | 'gradient' | 'image';
  value: string; // Color hex, gradient CSS, or image URL
  position?: number; // Vertical position percentage (0-100)
}

/**
 * Page metadata for tracking and management
 */
export interface PageMetadata {
  /** Timestamp when the page was created */
  created: Date;
  /** Timestamp when the page was last modified */
  modified: Date;
  /** Current version number */
  version: number;
  /** Storacha CID for this page's data */
  storachaCID: string;
  /** Share links for this page */
  shareLinks: ShareLink[];
  /** Whether this page is in trash */
  isDeleted: boolean;
  /** Timestamp when moved to trash (for auto-cleanup) */
  deletedAt?: Date;
  /** Whether this page is a template */
  isTemplate: boolean;
  /** Favorite status */
  isFavorite: boolean;
  /** Last viewed timestamp */
  lastViewed?: Date;
  /** View count */
  viewCount: number;
}

/**
 * Core Page interface
 * Represents a document page that can contain blocks and child pages
 */
export interface Page {
  /** Unique identifier for the page */
  id: string;
  
  /** Page title */
  title: string;
  
  /** Page type */
  type: PageType;
  
  /** Optional page icon */
  icon?: PageIcon;
  
  /** Optional page cover */
  cover?: PageCover;
  
  /** Parent page ID (null for root pages) */
  parentId: string | null;
  
  /** Workspace ID this page belongs to */
  workspaceId: string;
  
  /** Ordered array of child page IDs */
  childPages: string[];
  
  /** Ordered array of root-level block IDs */
  blocks: string[];
  
  /** Page metadata */
  metadata: PageMetadata;
  
  /** Database schema (only for database-type pages) */
  databaseSchema?: DatabaseSchema;
}

/**
 * Page tree node for navigation (resolved children)
 */
export interface PageTreeNode {
  page: Page;
  children: PageTreeNode[];
  depth: number;
  isExpanded: boolean;
}

/**
 * Database property types
 */
export type PropertyType =
  | 'title'       // Primary title property (always exists)
  | 'text'        // Rich text
  | 'number'      // Numeric value
  | 'select'      // Single select from options
  | 'multiSelect' // Multiple select from options
  | 'date'        // Date or date range
  | 'person'      // User reference
  | 'files'       // File attachments
  | 'checkbox'    // Boolean checkbox
  | 'url'         // URL link
  | 'email'       // Email address
  | 'phone'       // Phone number
  | 'formula'     // Computed formula
  | 'relation'    // Relation to another database
  | 'rollup'      // Rollup from relation
  | 'createdTime' // Auto-generated created timestamp
  | 'createdBy'   // Auto-generated creator
  | 'lastEditedTime' // Auto-generated last edit timestamp
  | 'lastEditedBy';  // Auto-generated last editor

/**
 * Select option for select/multi-select properties
 */
export interface SelectOption {
  id: string;
  name: string;
  color: string;
}

/**
 * Database property definition
 */
export interface PropertyDefinition {
  id: string;
  name: string;
  type: PropertyType;
  
  // Select/MultiSelect options
  options?: SelectOption[];
  
  // Number formatting
  numberFormat?: 'number' | 'currency' | 'percent';
  
  // Date formatting
  dateFormat?: 'full' | 'short' | 'relative';
  includeTime?: boolean;
  
  // Relation configuration
  relatedDatabaseId?: string;
  
  // Formula expression
  formula?: string;
  
  // Rollup configuration
  rollupRelationId?: string;
  rollupPropertyId?: string;
  rollupFunction?: 'count' | 'sum' | 'average' | 'min' | 'max' | 'showOriginal';
  
  // Display options
  isVisible: boolean;
  width?: number;
}

/**
 * Property value (varies by property type)
 */
export type PropertyValue =
  | string
  | number
  | boolean
  | Date
  | string[]  // Multi-select, files
  | { start: Date; end?: Date }  // Date range
  | { id: string; name: string }[];  // Relation

/**
 * Database entry (row in a database)
 */
export interface DatabaseEntry {
  id: string;
  pageId: string; // Each entry is also a page
  properties: Record<string, PropertyValue>;
  createdAt: Date;
  modifiedAt: Date;
}

/**
 * Filter operator types
 */
export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'before'
  | 'after'
  | 'onOrBefore'
  | 'onOrAfter';

/**
 * Database filter
 */
export interface Filter {
  propertyId: string;
  operator: FilterOperator;
  value?: PropertyValue;
}

/**
 * Filter group (AND/OR logic)
 */
export interface FilterGroup {
  type: 'and' | 'or';
  filters: (Filter | FilterGroup)[];
}

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Database sort
 */
export interface Sort {
  propertyId: string;
  direction: SortDirection;
}

/**
 * Database view types
 */
export type ViewType = 'table' | 'board' | 'calendar' | 'gallery' | 'timeline' | 'list';

/**
 * Database view configuration
 */
export interface DatabaseView {
  id: string;
  name: string;
  type: ViewType;
  
  // Filtering
  filter?: FilterGroup;
  
  // Sorting
  sorts: Sort[];
  
  // Grouping (for board view)
  groupBy?: string; // Property ID
  
  // Visible properties (column order for table)
  visibleProperties: string[];
  
  // Calendar specific
  dateProperty?: string; // Property ID for calendar date
  
  // Board specific
  showEmptyGroups?: boolean;
  
  // Gallery specific
  cardCover?: string; // Property ID for cover image
  cardPreview?: 'page' | 'content' | 'none';
  
  // Timeline specific
  startDateProperty?: string;
  endDateProperty?: string;
}

/**
 * Database schema
 */
export interface DatabaseSchema {
  /** Ordered property definitions */
  properties: PropertyDefinition[];
  
  /** Database views */
  views: DatabaseView[];
  
  /** Default view ID */
  defaultViewId: string;
  
  /** Template pages for new entries */
  templates: string[]; // Page IDs
}

/**
 * Workspace for organizing pages
 */
export interface Workspace {
  /** Unique identifier */
  id: string;
  
  /** Workspace name */
  name: string;
  
  /** Optional workspace icon */
  icon?: PageIcon;
  
  /** Root page IDs (pages with no parent in this workspace) */
  rootPages: string[];
  
  /** Workspace owner DID */
  ownerDID: string;
  
  /** Member DIDs with their roles */
  members: WorkspaceMember[];
  
  /** Workspace settings */
  settings: WorkspaceSettings;
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Last modified timestamp */
  modifiedAt: Date;
  
  /** Storacha CID for workspace data */
  storachaCID?: string;
}

/**
 * Workspace member with role
 */
export interface WorkspaceMember {
  did: string;
  role: 'owner' | 'admin' | 'editor' | 'commenter' | 'viewer';
  joinedAt: Date;
  displayName?: string;
  avatarUrl?: string;
}

/**
 * Workspace settings
 */
export interface WorkspaceSettings {
  /** Default page icon for new pages */
  defaultIcon?: PageIcon;
  
  /** Whether to show deleted pages in sidebar */
  showTrash: boolean;
  
  /** Auto-delete trash items after days (0 = never) */
  trashRetentionDays: number;
  
  /** Default sharing permissions */
  defaultSharePermission: 'read' | 'write';
  
  /** Whether members can invite others */
  allowMemberInvites: boolean;
}

/**
 * Serialized page for storage
 */
export interface SerializedPage {
  id: string;
  title: string;
  type: PageType;
  icon?: PageIcon;
  cover?: PageCover;
  parentId: string | null;
  workspaceId: string;
  childPages: string[];
  blocks: string[];
  metadata: {
    created: string;
    modified: string;
    version: number;
    storachaCID: string;
    shareLinks: ShareLink[];
    isDeleted: boolean;
    deletedAt?: string;
    isTemplate: boolean;
    isFavorite: boolean;
    lastViewed?: string;
    viewCount: number;
  };
  databaseSchema?: DatabaseSchema;
}

/**
 * Stored page data (for Storacha)
 */
export interface StoredPageData {
  page: SerializedPage;
  blocks: SerializedBlock[];
}

/**
 * Serialized workspace for storage
 */
export interface SerializedWorkspace {
  id: string;
  name: string;
  icon?: PageIcon;
  rootPages: string[];
  ownerDID: string;
  members: WorkspaceMember[];
  settings: WorkspaceSettings;
  createdAt: string;
  modifiedAt: string;
  storachaCID?: string;
}

/**
 * Page creation input
 */
export interface CreatePageInput {
  title?: string;
  type?: PageType;
  icon?: PageIcon;
  cover?: PageCover;
  parentId?: string | null;
  workspaceId: string;
  isTemplate?: boolean;
  databaseSchema?: Partial<DatabaseSchema>;
}

/**
 * Page update input
 */
export interface UpdatePageInput {
  id: string;
  title?: string;
  icon?: PageIcon;
  cover?: PageCover;
  isFavorite?: boolean;
}

/**
 * Page move input
 */
export interface MovePageInput {
  pageId: string;
  targetParentId: string | null;
  targetWorkspaceId?: string;
  insertAfter?: string; // Page ID to insert after
}

/**
 * Workspace creation input
 */
export interface CreateWorkspaceInput {
  name: string;
  icon?: PageIcon;
}

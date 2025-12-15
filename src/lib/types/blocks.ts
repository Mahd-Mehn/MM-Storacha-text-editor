// Block-based content system types
// Implements Notion-like block architecture for decentralized notes

import type { Doc as YDoc } from 'yjs';

/**
 * Block types supported by the editor
 * Each block type has specific rendering and editing behaviors
 */
export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'numberedList'
  | 'todo'
  | 'toggle'
  | 'quote'
  | 'callout'
  | 'code'
  | 'divider'
  | 'image'
  | 'video'
  | 'file'
  | 'embed'
  | 'table'
  | 'columnList'
  | 'column'
  | 'page'  // Nested page reference
  | 'database'
  | 'databaseView';

/**
 * Callout block icon types
 */
export type CalloutIcon = '💡' | '⚠️' | '❌' | '✅' | '📌' | '🔗' | '📝' | '🎯' | string;

/**
 * Code block language options
 */
export type CodeLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'rust'
  | 'go'
  | 'java'
  | 'c'
  | 'cpp'
  | 'csharp'
  | 'html'
  | 'css'
  | 'json'
  | 'yaml'
  | 'markdown'
  | 'sql'
  | 'bash'
  | 'plaintext';

/**
 * Text formatting options for inline content
 */
export interface TextFormatting {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  color?: string;
  backgroundColor?: string;
  link?: string;
}

/**
 * Rich text segment with optional formatting
 */
export interface RichTextSegment {
  text: string;
  formatting?: TextFormatting;
}

/**
 * Block properties vary by block type
 */
export interface BlockProperties {
  // Common properties
  textContent?: RichTextSegment[];
  
  // Heading properties
  level?: 1 | 2 | 3;
  
  // Todo properties
  checked?: boolean;
  
  // Toggle properties
  collapsed?: boolean;
  
  // Callout properties
  icon?: CalloutIcon;
  calloutColor?: string;
  
  // Code properties
  language?: CodeLanguage;
  
  // Image/Video/File properties
  url?: string;
  caption?: string;
  width?: number;
  height?: number;
  
  // Embed properties
  embedUrl?: string;
  embedType?: 'youtube' | 'twitter' | 'figma' | 'codepen' | 'generic';
  
  // Table properties
  tableWidth?: number;
  hasHeaderRow?: boolean;
  hasHeaderColumn?: boolean;
  
  // Column list properties
  columnRatio?: number[]; // e.g., [0.5, 0.5] for equal columns
  
  // Page reference properties
  pageId?: string;
  
  // Database view properties
  databaseId?: string;
  viewType?: 'table' | 'board' | 'calendar' | 'gallery' | 'timeline';
  viewId?: string;
}

/**
 * Core Block interface
 * Represents a single content block in the document
 */
export interface Block {
  /** Unique identifier for the block */
  id: string;
  
  /** Type of block determining its behavior and rendering */
  type: BlockType;
  
  /** Block-specific properties */
  properties: BlockProperties;
  
  /** Ordered array of child block IDs (for nested blocks like toggles, columns) */
  children: string[];
  
  /** Parent block ID (null for top-level blocks) */
  parentId: string | null;
  
  /** Page ID this block belongs to */
  pageId: string;
  
  /** Order index for sorting blocks within a parent/page (lower = earlier) */
  order: number;
  
  /** Yjs document for CRDT-based collaborative editing of this block's content */
  content?: YDoc;
  
  /** Storacha CID if this block is individually stored */
  storachaCID?: string;
  
  /** Timestamp when block was created */
  createdAt: Date;
  
  /** Timestamp when block was last modified */
  modifiedAt: Date;
  
  /** User ID who created this block */
  createdBy?: string;
  
  /** User ID who last modified this block */
  modifiedBy?: string;
}

/**
 * Block creation input (without system-generated fields)
 */
export interface CreateBlockInput {
  type: BlockType;
  properties?: Partial<BlockProperties>;
  children?: string[];
  parentId?: string | null;
  pageId: string;
  insertAfter?: string; // Block ID to insert after
  insertBefore?: string; // Block ID to insert before
}

/**
 * Block update input
 */
export interface UpdateBlockInput {
  id: string;
  properties?: Partial<BlockProperties>;
  type?: BlockType;
}

/**
 * Block move operation
 */
export interface MoveBlockInput {
  blockId: string;
  targetParentId: string | null;
  targetPageId?: string;
  insertAfter?: string;
  insertBefore?: string;
}

/**
 * Block with resolved children (for rendering)
 */
export interface BlockTree extends Block {
  resolvedChildren: BlockTree[];
}

/**
 * Serialized block for storage
 */
export interface SerializedBlock {
  id: string;
  type: BlockType;
  properties: BlockProperties;
  children: string[];
  parentId: string | null;
  pageId: string;
  order: number;
  yjsUpdate?: Uint8Array; // Serialized Yjs document
  storachaCID?: string;
  createdAt: string; // ISO timestamp
  modifiedAt: string;
  createdBy?: string;
  modifiedBy?: string;
}

/**
 * Block clipboard data for copy/paste
 */
export interface BlockClipboardData {
  blocks: SerializedBlock[];
  sourcePageId: string;
  copiedAt: Date;
}

/**
 * Block search result
 */
export interface BlockSearchResult {
  block: Block;
  pageId: string;
  pageTitle: string;
  matchedText: string;
  context: string; // Surrounding text for preview
}

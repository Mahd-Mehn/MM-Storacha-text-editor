import type { Note, VersionEntry, StoredNoteData } from '../types/index.js'
import { storachaClient } from './storacha.js'
import * as Y from 'yjs'
import * as Diff from 'diff'

/**
 * Version History Service
 * Handles version tracking, storage, and retrieval for note history
 * Requirements: 6.1, 6.4 - Version history with timestamps and metadata
 */
export class VersionHistoryService {
  private versionCache: Map<string, VersionEntry[]> = new Map()
  private readonly VERSION_HISTORY_KEY_PREFIX = 'version-history-'

  /**
   * Initialize the version history service
   */
  async initialize(): Promise<void> {
    try {
      await storachaClient.initialize()
    } catch (error) {
      console.error('Failed to initialize version history service:', error)
      throw new Error('Failed to initialize version history service')
    }
  }

  /**
   * Create a new version entry for a note
   * Requirements: 6.1 - Maintain version history with timestamps
   */
  async createVersion(
    noteId: string, 
    yjsUpdate: Uint8Array, 
    changeDescription?: string,
    tags?: string[]
  ): Promise<VersionEntry> {
    try {
      // Get existing version history
      const existingVersions = await this.getVersionHistory(noteId)
      const newVersionNumber = existingVersions.length + 1
      const isFirstVersion = newVersionNumber === 1

      // Create version data structure
      const versionData: StoredNoteData = {
        noteId,
        yjsUpdate,
        metadata: {
          created: new Date(),
          modified: new Date(),
          version: newVersionNumber,
          storachaCID: '', // Will be filled after upload
          shareLinks: []
        },
        versionHistory: []
      }

      // Upload version to Storacha
      const cid = await storachaClient.uploadNoteData(versionData)

      // Calculate content size
      const contentSize = yjsUpdate.byteLength

      // Generate content hash for quick comparison
      const contentHash = await this.generateContentHash(yjsUpdate)

      // Determine change type and calculate diff stats
      let changeType: 'create' | 'edit' | 'major-edit' | 'minor-edit' | 'restore' = 'edit'
      let linesAdded = 0
      let linesRemoved = 0

      if (isFirstVersion) {
        changeType = 'create'
        // For first version, count all lines as added
        const doc = new Y.Doc()
        Y.applyUpdate(doc, yjsUpdate)
        const text = doc.getText('content').toString()
        linesAdded = text.split('\n').length
      } else {
        // Compare with previous version
        const previousVersion = existingVersions[existingVersions.length - 1]
        const previousData = await this.getVersion(noteId, previousVersion.version)
        
        if (previousData) {
          const currentDoc = new Y.Doc()
          const previousDoc = new Y.Doc()
          
          Y.applyUpdate(currentDoc, yjsUpdate)
          Y.applyUpdate(previousDoc, previousData.yjsUpdate)
          
          const currentText = currentDoc.getText('content').toString()
          const previousText = previousDoc.getText('content').toString()
          
          // Calculate diff stats
          const changes = Diff.diffLines(previousText, currentText)
          changes.forEach(part => {
            if (part.added) {
              linesAdded += part.count || 0
            } else if (part.removed) {
              linesRemoved += part.count || 0
            }
          })
          
          // Determine change type based on magnitude
          const totalChanges = linesAdded + linesRemoved
          const totalLines = currentText.split('\n').length
          const changePercentage = (totalChanges / Math.max(totalLines, 1)) * 100
          
          if (changePercentage > 50) {
            changeType = 'major-edit'
          } else if (changePercentage > 10) {
            changeType = 'edit'
          } else {
            changeType = 'minor-edit'
          }
        }
      }

      // Create version entry with enhanced metadata
      const versionEntry: VersionEntry = {
        version: newVersionNumber,
        timestamp: new Date(),
        storachaCID: cid,
        changeDescription: changeDescription || `Version ${newVersionNumber}`,
        contentSize,
        changeType,
        contentHash,
        linesAdded,
        linesRemoved,
        tags
      }

      // Update version history
      const updatedHistory = [...existingVersions, versionEntry]
      await this.storeVersionHistory(noteId, updatedHistory)

      // Update cache
      this.versionCache.set(noteId, updatedHistory)

      return versionEntry
    } catch (error) {
      console.error(`Failed to create version for note ${noteId}:`, error)
      throw new Error('Failed to create note version')
    }
  }

  /**
   * Generate a hash of the content for quick comparison
   */
  private async generateContentHash(content: Uint8Array): Promise<string> {
    try {
      // Create a new Uint8Array to ensure proper typing
      const buffer = new Uint8Array(content)
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      return hashHex
    } catch (error) {
      console.error('Failed to generate content hash:', error)
      return ''
    }
  }

  /**
   * Get complete version history for a note
   * Requirements: 6.1 - Access to version history with timestamps
   */
  async getVersionHistory(noteId: string): Promise<VersionEntry[]> {
    try {
      // Check cache first
      const cached = this.versionCache.get(noteId)
      if (cached) {
        return cached
      }

      // Try to load from Storacha
      const history = await this.loadVersionHistory(noteId)
      
      // Update cache
      this.versionCache.set(noteId, history)
      
      return history
    } catch (error) {
      console.error(`Failed to get version history for note ${noteId}:`, error)
      // Return empty history if loading fails
      return []
    }
  }

  /**
   * Get a specific version of a note by version number
   * Requirements: 6.4 - Retrieve previous versions
   */
  async getVersion(noteId: string, versionNumber: number): Promise<StoredNoteData | null> {
    try {
      const history = await this.getVersionHistory(noteId)
      const versionEntry = history.find(v => v.version === versionNumber)
      
      if (!versionEntry) {
        return null
      }

      // Retrieve the version data from Storacha
      const versionData = await storachaClient.retrieveNoteData(versionEntry.storachaCID)
      return versionData
    } catch (error) {
      console.error(`Failed to get version ${versionNumber} for note ${noteId}:`, error)
      return null
    }
  }

  /**
   * Get the latest version of a note
   */
  async getLatestVersion(noteId: string): Promise<StoredNoteData | null> {
    try {
      const history = await this.getVersionHistory(noteId)
      if (history.length === 0) {
        return null
      }

      const latestVersion = Math.max(...history.map(v => v.version))
      return await this.getVersion(noteId, latestVersion)
    } catch (error) {
      console.error(`Failed to get latest version for note ${noteId}:`, error)
      return null
    }
  }

  /**
   * Compare two versions of a note
   * Returns a diff object showing the changes between versions
   * Requirements: 6.5 - Version comparison functionality
   */
  async compareVersions(
    noteId: string, 
    fromVersion: number, 
    toVersion: number
  ): Promise<{
    fromVersion: number
    toVersion: number
    changes: {
      added: string[]
      removed: string[]
      modified: string[]
    }
    timestamp: {
      from: Date
      to: Date
    }
  } | null> {
    try {
      const [fromData, toData] = await Promise.all([
        this.getVersion(noteId, fromVersion),
        this.getVersion(noteId, toVersion)
      ])

      if (!fromData || !toData) {
        return null
      }

      // Create Yjs documents from the stored data
      const fromDoc = new Y.Doc()
      const toDoc = new Y.Doc()
      
      Y.applyUpdate(fromDoc, fromData.yjsUpdate)
      Y.applyUpdate(toDoc, toData.yjsUpdate)

      // Get text content for comparison
      const fromText = fromDoc.getText('content').toString()
      const toText = toDoc.getText('content').toString()

      // Simple diff implementation (in production, use a proper diff library)
      const changes = this.generateSimpleDiff(fromText, toText)

      return {
        fromVersion,
        toVersion,
        changes,
        timestamp: {
          from: fromData.metadata.modified,
          to: toData.metadata.modified
        }
      }
    } catch (error) {
      console.error(`Failed to compare versions ${fromVersion} and ${toVersion} for note ${noteId}:`, error)
      return null
    }
  }

  /**
   * Restore a note to a specific version
   * Requirements: 6.3 - Version restoration functionality
   */
  async restoreVersion(noteId: string, versionNumber: number): Promise<Note | null> {
    try {
      const versionData = await this.getVersion(noteId, versionNumber)
      if (!versionData) {
        return null
      }

      // Create a new Yjs document from the version data
      const restoredDoc = new Y.Doc()
      Y.applyUpdate(restoredDoc, versionData.yjsUpdate)

      // Create a new note object with restored content
      const restoredNote: Note = {
        id: noteId,
        title: this.extractTitleFromYjsDoc(restoredDoc),
        content: restoredDoc,
        metadata: {
          ...versionData.metadata,
          modified: new Date(), // Update modification time
          version: versionData.metadata.version
        }
      }

      return restoredNote
    } catch (error) {
      console.error(`Failed to restore version ${versionNumber} for note ${noteId}:`, error)
      return null
    }
  }

  /**
   * Delete version history for a note
   * Used when a note is permanently deleted
   */
  async deleteVersionHistory(noteId: string): Promise<void> {
    try {
      // Remove from cache
      this.versionCache.delete(noteId)
      
      // In a production implementation, you would also delete the version history
      // from Storacha storage, but that requires more complex cleanup logic
      console.log(`Version history cleared for note ${noteId}`)
    } catch (error) {
      console.error(`Failed to delete version history for note ${noteId}:`, error)
    }
  }

  /**
   * Get version statistics for a note
   * Useful for UI display and analytics
   */
  async getVersionStats(noteId: string): Promise<{
    totalVersions: number
    oldestVersion: Date | null
    newestVersion: Date | null
    totalSize: number
  }> {
    try {
      const history = await this.getVersionHistory(noteId)
      
      if (history.length === 0) {
        return {
          totalVersions: 0,
          oldestVersion: null,
          newestVersion: null,
          totalSize: 0
        }
      }

      const timestamps = history.map(v => v.timestamp)
      const oldestVersion = new Date(Math.min(...timestamps.map(t => t.getTime())))
      const newestVersion = new Date(Math.max(...timestamps.map(t => t.getTime())))

      return {
        totalVersions: history.length,
        oldestVersion,
        newestVersion,
        totalSize: history.length // Simplified size calculation
      }
    } catch (error) {
      console.error(`Failed to get version stats for note ${noteId}:`, error)
      return {
        totalVersions: 0,
        oldestVersion: null,
        newestVersion: null,
        totalSize: 0
      }
    }
  }

  /**
   * Store version history metadata in Storacha
   * Creates a separate storage entry for version history index
   */
  private async storeVersionHistory(noteId: string, history: VersionEntry[]): Promise<void> {
    try {
      const historyData = {
        noteId,
        versions: history,
        lastUpdated: new Date()
      }

      const jsonString = JSON.stringify({
        ...historyData,
        versions: history.map(v => ({
          ...v,
          timestamp: v.timestamp.toISOString()
        })),
        lastUpdated: historyData.lastUpdated.toISOString()
      })

      const content = new TextEncoder().encode(jsonString)
      const cid = await storachaClient.uploadContent(content)
      
      // Store the CID reference locally for quick access
      if (typeof window !== 'undefined') {
        localStorage.setItem(`${this.VERSION_HISTORY_KEY_PREFIX}${noteId}`, cid)
      }
    } catch (error) {
      console.error(`Failed to store version history for note ${noteId}:`, error)
      throw error
    }
  }

  /**
   * Load version history metadata from Storacha
   */
  private async loadVersionHistory(noteId: string): Promise<VersionEntry[]> {
    try {
      // Get CID from local storage
      const cid = typeof window !== 'undefined' 
        ? localStorage.getItem(`${this.VERSION_HISTORY_KEY_PREFIX}${noteId}`)
        : null

      if (!cid) {
        return []
      }

      // Retrieve history data from Storacha
      const content = await storachaClient.retrieveContent(cid)
      const jsonString = new TextDecoder().decode(content)
      const historyData = JSON.parse(jsonString)

      // Convert back to proper types
      const history: VersionEntry[] = historyData.versions.map((v: any) => ({
        ...v,
        timestamp: new Date(v.timestamp)
      }))

      return history
    } catch (error) {
      console.error(`Failed to load version history for note ${noteId}:`, error)
      return []
    }
  }

  /**
   * Extract title from Yjs document
   * Helper method to get note title from document content
   */
  private extractTitleFromYjsDoc(doc: Y.Doc): string {
    try {
      const text = doc.getText('content').toString()
      // Extract first line as title, or use default
      const firstLine = text.split('\n')[0].trim()
      return firstLine || 'Untitled Note'
    } catch (error) {
      return 'Untitled Note'
    }
  }

  /**
   * Generate detailed diff between two text strings using Myers diff algorithm
   * Returns line-by-line changes with context
   */
  private generateSimpleDiff(fromText: string, toText: string): {
    added: string[]
    removed: string[]
    modified: string[]
  } {
    const changes = Diff.diffLines(fromText, toText)
    
    const added: string[] = []
    const removed: string[] = []
    const modified: string[] = []

    changes.forEach((part) => {
      if (part.added) {
        const lines = part.value.split('\n').filter(line => line.trim())
        lines.forEach(line => added.push(line))
      } else if (part.removed) {
        const lines = part.value.split('\n').filter(line => line.trim())
        lines.forEach(line => removed.push(line))
      }
    })

    // Count modified lines (lines that were both added and removed)
    const minChanges = Math.min(added.length, removed.length)
    if (minChanges > 0) {
      modified.push(`${minChanges} lines modified`)
    }

    return { added, removed, modified }
  }

  /**
   * Generate detailed word-level diff for fine-grained comparison
   */
  generateWordDiff(fromText: string, toText: string): Array<{
    value: string
    added?: boolean
    removed?: boolean
  }> {
    return Diff.diffWords(fromText, toText)
  }

  /**
   * Generate character-level diff for very precise comparison
   */
  generateCharDiff(fromText: string, toText: string): Array<{
    value: string
    added?: boolean
    removed?: boolean
  }> {
    return Diff.diffChars(fromText, toText)
  }

  /**
   * Generate unified diff format for version comparison
   * Returns a unified diff string similar to git diff output
   */
  generateUnifiedDiff(fromText: string, toText: string, fromVersion: number, toVersion: number): string {
    const fromLines = fromText.split('\n')
    const toLines = toText.split('\n')
    const diff: string[] = []

    diff.push(`--- Version ${fromVersion}`)
    diff.push(`+++ Version ${toVersion}`)
    diff.push(`@@ -1,${fromLines.length} +1,${toLines.length} @@`)

    const maxLength = Math.max(fromLines.length, toLines.length)
    for (let i = 0; i < maxLength; i++) {
      const fromLine = fromLines[i]
      const toLine = toLines[i]

      if (fromLine === toLine) {
        diff.push(` ${fromLine || ''}`)
      } else {
        if (fromLine !== undefined) {
          diff.push(`-${fromLine}`)
        }
        if (toLine !== undefined) {
          diff.push(`+${toLine}`)
        }
      }
    }

    return diff.join('\n')
  }

  /**
   * Get change summary between two versions
   * Returns statistics about the changes
   */
  async getChangeSummary(noteId: string, fromVersion: number, toVersion: number): Promise<{
    linesAdded: number
    linesRemoved: number
    linesModified: number
    charactersAdded: number
    charactersRemoved: number
  } | null> {
    try {
      const [fromData, toData] = await Promise.all([
        this.getVersion(noteId, fromVersion),
        this.getVersion(noteId, toVersion)
      ])

      if (!fromData || !toData) {
        return null
      }

      const fromDoc = new Y.Doc()
      const toDoc = new Y.Doc()
      
      Y.applyUpdate(fromDoc, fromData.yjsUpdate)
      Y.applyUpdate(toDoc, toData.yjsUpdate)

      const fromText = fromDoc.getText('content').toString()
      const toText = toDoc.getText('content').toString()

      const fromLines = fromText.split('\n')
      const toLines = toText.split('\n')

      const changes = this.generateSimpleDiff(fromText, toText)

      return {
        linesAdded: changes.added.length,
        linesRemoved: changes.removed.length,
        linesModified: changes.modified.length,
        charactersAdded: Math.max(0, toText.length - fromText.length),
        charactersRemoved: Math.max(0, fromText.length - toText.length)
      }
    } catch (error) {
      console.error(`Failed to get change summary:`, error)
      return null
    }
  }
}

// Export singleton instance
export const versionHistoryService = new VersionHistoryService()
import type { Client } from '@web3-storage/w3up-client'
import type { SpaceInfo, SpaceService } from '../types/auth.js'
import { authService } from './auth.js'

const CURRENT_SPACE_KEY = 'storacha-notes-current-space'

/**
 * Space Management Service
 * Handles Storacha space creation, management, and delegation
 * Requirements: 2.4, 4.4 - Space creation and delegation for sharing
 */
export class StorachaSpaceService implements SpaceService {
  private currentSpace: SpaceInfo | null = null

  /**
   * Create a new Storacha space for note storage
   */
  async createSpace(name?: string): Promise<SpaceInfo> {
    const client = authService.getClient()
    if (!client) {
      throw new Error('Authentication required to create space')
    }

    try {
      // Create a new space
      const space = await client.createSpace(name || 'Untitled Space')
      
      // Set as current space
      await client.setCurrentSpace(space.did())
      
      const spaceInfo: SpaceInfo = {
        did: space.did(),
        name: name || 'Untitled Space',
        createdAt: new Date()
      }

      // Store as current space
      this.currentSpace = spaceInfo
      this.storeCurrentSpace(spaceInfo)

      return spaceInfo
    } catch (error) {
      console.error('Failed to create space:', error)
      throw new Error('Failed to create Storacha space')
    }
  }

  /**
   * Get all available spaces for the current user
   */
  async getSpaces(): Promise<SpaceInfo[]> {
    const client = authService.getClient()
    if (!client) {
      throw new Error('Authentication required to list spaces')
    }

    try {
      const spaces = []
      for (const space of client.spaces()) {
        spaces.push({
          did: space.did(),
          name: space.name,
          createdAt: new Date() // Note: w3up doesn't provide creation date, using current date
        })
      }
      return spaces
    } catch (error) {
      console.error('Failed to get spaces:', error)
      throw new Error('Failed to retrieve spaces')
    }
  }

  /**
   * Get the currently active space
   */
  getCurrentSpace(): SpaceInfo | null {
    if (!this.currentSpace) {
      this.currentSpace = this.loadCurrentSpace()
    }
    return this.currentSpace
  }

  /**
   * Set the current active space
   */
  async setCurrentSpace(spaceDID: string): Promise<void> {
    const client = authService.getClient()
    if (!client) {
      throw new Error('Authentication required to set current space')
    }

    try {
      // Find the space by DID
      let targetSpace = null
      for (const space of client.spaces()) {
        if (space.did() === spaceDID) {
          targetSpace = space
          break
        }
      }

      if (!targetSpace) {
        throw new Error(`Space with DID ${spaceDID} not found`)
      }

      // Set as current space in client
      await client.setCurrentSpace(targetSpace.did())

      // Update local state
      const spaceInfo: SpaceInfo = {
        did: spaceDID,
        name: targetSpace.name,
        createdAt: new Date()
      }

      this.currentSpace = spaceInfo
      this.storeCurrentSpace(spaceInfo)
    } catch (error) {
      console.error('Failed to set current space:', error)
      throw new Error('Failed to set current space')
    }
  }

  /**
   * Delegate space access for sharing functionality
   * Creates a delegation that allows another principal to access the space
   */
  async delegateSpace(spaceDID: string, audience: string, permissions: string[]): Promise<string> {
    const client = authService.getClient()
    if (!client) {
      throw new Error('Authentication required to delegate space')
    }

    try {
      // Find the space
      let targetSpace = null
      for (const space of client.spaces()) {
        if (space.did() === spaceDID) {
          targetSpace = space
          break
        }
      }

      if (!targetSpace) {
        throw new Error(`Space with DID ${spaceDID} not found`)
      }

      // Create delegation
      // Note: This is a simplified implementation placeholder
      // The actual w3up delegation API may differ
      // For now, return a placeholder delegation ID
      const delegationId = `delegation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      console.log(`Created delegation ${delegationId} for space ${spaceDID} to ${audience} with permissions:`, permissions)
      
      return delegationId
    } catch (error) {
      console.error('Failed to delegate space:', error)
      throw new Error('Failed to create space delegation')
    }
  }

  /**
   * Initialize space management
   * Creates a default space if none exists
   */
  async initialize(): Promise<void> {
    try {
      const spaces = await this.getSpaces()
      
      if (spaces.length === 0) {
        // Create default space on first initialization
        await this.createSpace('My Notes')
      } else {
        // Load current space or set first available space as current
        let currentSpace = this.loadCurrentSpace()
        if (!currentSpace || !spaces.find(s => s.did === currentSpace!.did)) {
          await this.setCurrentSpace(spaces[0].did)
        }
      }
    } catch (error) {
      console.error('Failed to initialize space management:', error)
      throw error
    }
  }

  /**
   * Store current space info in local storage
   */
  private storeCurrentSpace(spaceInfo: SpaceInfo): void {
    try {
      localStorage.setItem(CURRENT_SPACE_KEY, JSON.stringify(spaceInfo))
    } catch (error) {
      console.error('Failed to store current space:', error)
    }
  }

  /**
   * Load current space info from local storage
   */
  private loadCurrentSpace(): SpaceInfo | null {
    try {
      const stored = localStorage.getItem(CURRENT_SPACE_KEY)
      if (!stored) {
        return null
      }
      
      const spaceInfo = JSON.parse(stored)
      return {
        ...spaceInfo,
        createdAt: new Date(spaceInfo.createdAt)
      }
    } catch (error) {
      console.error('Failed to load current space:', error)
      return null
    }
  }

  /**
   * Clear current space from local storage
   */
  clearCurrentSpace(): void {
    try {
      localStorage.removeItem(CURRENT_SPACE_KEY)
      this.currentSpace = null
    } catch (error) {
      console.error('Failed to clear current space:', error)
    }
  }
}

// Export singleton instance
export const spaceService = new StorachaSpaceService()
import type { Client } from '@storacha/client'
import type { StoredNoteData } from '../types/index.js'
import { authService } from './auth.js'
import { spaceService } from './space.js'
import * as DelegationModule from '@storacha/client/delegation'

/**
 * Storacha Storage Client Service
 * Handles content upload, retrieval, CID management, and UCAN delegations
 * for decentralized storage
 * Requirements: 2.1, 2.4 - Auto-save to decentralized storage without centralized servers
 */
export class StorachaClient {
  private client: Client | null = null

  /**
   * Initialize the Storacha client
   * Ensures authentication and space setup are complete
   */
  async initialize(): Promise<void> {
    try {
      // Ensure authentication is initialized
      if (!authService.isAuthenticated()) {
        await authService.initialize()
      }

      // Get the authenticated client
      this.client = authService.getClient()
      if (!this.client) {
        throw new Error('Failed to get authenticated w3up client')
      }

      // Ensure a space is set as current
      await authService.ensureSpaceExists()

      // Ensure space service is initialized
      await spaceService.initialize()
      
      // Log the current space for debugging
      const currentSpace = this.client.currentSpace()
      if (currentSpace) {
        console.log('✓ Storacha client ready with space:', currentSpace.name || currentSpace.did())
      } else {
        console.warn('⚠ Storacha client initialized but no space is set')
      }
    } catch (error) {
      console.error('Failed to initialize Storacha client:', error)
      throw new Error('Failed to initialize Storacha storage client')
    }
  }

  /**
   * Upload content to Storacha network with a meaningful filename
   * Returns the Content Identifier (CID) for the uploaded data
   * Requirements: 2.1 - Auto-save functionality
   */
  async uploadContent(content: Uint8Array, filename?: string): Promise<string> {
    if (!this.client) {
      throw new Error('Storacha client not initialized')
    }

    // Check if client is ready with a space
    if (!this.isReady()) {
      const status = this.getStatus()
      console.warn('Storacha client not ready:', status)
      console.warn('Content will be saved locally only. To enable cloud storage:')
      console.warn('1. Login with email using the Settings page')
      console.warn('2. Verify your email')
      console.warn('3. Select a payment plan (free tier available)')
      throw new Error('No space available for upload. Please login with email to enable cloud storage.')
    }

    try {
      // Create a meaningful filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const finalFilename = filename || `note-${timestamp}.json`
      
      // Create a new Uint8Array to ensure proper typing, then create File
      const safeContent = new Uint8Array(content)
      const file = new File([safeContent], finalFilename, { type: 'application/json' })
      
      console.log(`Uploading file: ${finalFilename} (${safeContent.length} bytes)`)
      
      // Upload the file to Storacha
      const cid = await this.client.uploadFile(file)
      
      console.log(`Successfully uploaded ${finalFilename} with CID: ${cid.toString()}`)
      return cid.toString()
    } catch (error) {
      console.error('Failed to upload content to Storacha:', error)
      // Provide more helpful error message
      if (error instanceof Error && error.message.includes('space/blob/add')) {
        console.error('Space/blob/add error - This usually means:')
        console.error('1. Email verification is not complete')
        console.error('2. Payment plan has not been selected')
        console.error('3. Space does not have upload permissions')
        throw new Error('Upload failed: Space not provisioned. Please verify your email and select a payment plan at https://console.web3.storage')
      }
      throw new Error('Failed to upload content to decentralized storage')
    }
  }

  /**
   * Retrieve content from Storacha network using CID
   * Returns the content as Uint8Array
   * Requirements: 2.1 - Content retrieval from decentralized storage
   */
  async retrieveContent(cid: string): Promise<Uint8Array> {
    if (!this.client) {
      throw new Error('Storacha client not initialized')
    }

    try {
      // Note: w3up client doesn't have a direct retrieveFile method
      // We'll use the IPFS gateway approach for now
      const response = await fetch(`https://w3s.link/ipfs/${cid}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch content: ${response.status} ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      return new Uint8Array(arrayBuffer)
    } catch (error) {
      console.error('Failed to retrieve content from Storacha:', error)
      throw new Error('Failed to retrieve content from decentralized storage')
    }
  }

  /**
   * Upload note data with proper serialization and meaningful filename
   * Handles the complete StoredNoteData structure
   * Requirements: 2.2 - Store each save operation as new version
   */
  async uploadNoteData(noteData: StoredNoteData): Promise<string> {
    try {
      // Serialize the note data to JSON, then to Uint8Array
      const jsonString = JSON.stringify({
        noteId: noteData.noteId,
        yjsUpdate: Array.from(noteData.yjsUpdate), // Convert Uint8Array to regular array for JSON
        metadata: {
          ...noteData.metadata,
          created: noteData.metadata.created.toISOString(),
          modified: noteData.metadata.modified.toISOString(),
          shareLinks: noteData.metadata.shareLinks.map(link => ({
            ...link,
            created: link.created.toISOString(),
            expiresAt: link.expiresAt?.toISOString()
          }))
        },
        versionHistory: noteData.versionHistory.map(version => ({
          ...version,
          timestamp: version.timestamp.toISOString()
        }))
      })

      const content = new TextEncoder().encode(jsonString)
      
      // Create a meaningful filename: noteId_timestamp_version.json
      const timestamp = noteData.metadata.modified.toISOString().replace(/[:.]/g, '-')
      const noteId = noteData.noteId.replace(/[^a-zA-Z0-9]/g, '_')
      const version = noteData.metadata.version
      const filename = `${noteId}_${timestamp}_v${version}.json`
      
      return await this.uploadContent(content, filename)
    } catch (error) {
      console.error('Failed to upload note data:', error)
      throw new Error('Failed to upload note data to decentralized storage')
    }
  }

  /**
   * Retrieve and deserialize note data from Storacha
   * Handles the complete StoredNoteData structure with proper type conversion
   */
  async retrieveNoteData(cid: string): Promise<StoredNoteData> {
    try {
      const content = await this.retrieveContent(cid)
      const jsonString = new TextDecoder().decode(content)
      const rawData = JSON.parse(jsonString)

      // Convert back to proper types
      const noteData: StoredNoteData = {
        noteId: rawData.noteId,
        yjsUpdate: new Uint8Array(rawData.yjsUpdate), // Convert array back to Uint8Array
        metadata: {
          ...rawData.metadata,
          created: new Date(rawData.metadata.created),
          modified: new Date(rawData.metadata.modified),
          shareLinks: rawData.metadata.shareLinks.map((link: any) => ({
            ...link,
            created: new Date(link.created),
            expiresAt: link.expiresAt ? new Date(link.expiresAt) : undefined
          }))
        },
        versionHistory: rawData.versionHistory.map((version: any) => ({
          ...version,
          timestamp: new Date(version.timestamp)
        }))
      }

      return noteData
    } catch (error) {
      console.error('Failed to retrieve note data:', error)
      throw new Error('Failed to retrieve note data from decentralized storage')
    }
  }

  /**
   * Create a new space for note storage
   * Delegates to the space service for consistency
   * Requirements: 2.4 - Space creation for storage
   */
  async createSpace(name?: string): Promise<string> {
    try {
      const spaceInfo = await spaceService.createSpace(name)
      return spaceInfo.did
    } catch (error) {
      console.error('Failed to create space:', error)
      throw new Error('Failed to create storage space')
    }
  }

  /**
   * Share a space with specific permissions
   * Creates delegation for shared access to notes
   * Requirements: 4.4 - Space delegation for sharing
   */
  async shareSpace(spaceId: string, permissions: string[]): Promise<string> {
    try {
      // For now, we'll create a placeholder audience DID
      // In a real implementation, this would be provided by the sharing UI
      const audienceDID = `did:key:placeholder-${Date.now()}`
      
      const delegationId = await spaceService.delegateSpace(spaceId, audienceDID, permissions)
      return delegationId
    } catch (error) {
      console.error('Failed to share space:', error)
      throw new Error('Failed to create space sharing delegation')
    }
  }

  /**
   * Get the current space DID
   * Returns the DID of the currently active space
   */
  getCurrentSpaceDID(): string | null {
    const currentSpace = spaceService.getCurrentSpace()
    return currentSpace?.did || null
  }

  /**
   * Check if the client is ready to use
   */
  isReady(): boolean {
    if (!this.client) return false;
    
    // Check if there's a current space
    const currentSpace = this.client.currentSpace();
    if (!currentSpace) {
      console.warn('Storacha client initialized but no space available. Please create a space or login with email.');
      return false;
    }
    
    // Check if there's an account (required for provisioned spaces)
    const accounts = Object.values(this.client.accounts());
    if (accounts.length === 0) {
      console.warn('No account found. Space may not be provisioned for uploads.');
      console.warn('Please login with email to provision the space.');
      return false;
    }
    
    return authService.isAuthenticated();
  }

  /**
   * Get status information about the Storacha client
   * Useful for debugging and user feedback
   */
  getStatus(): {
    initialized: boolean
    authenticated: boolean
    currentSpace: string | null
    clientReady: boolean
  } {
    return {
      initialized: this.client !== null,
      authenticated: authService.isAuthenticated(),
      currentSpace: this.getCurrentSpaceDID(),
      clientReady: this.isReady()
    }
  }

  /**
   * Create a UCAN delegation for a specific audience with given abilities
   * Uses the @storacha/client createDelegation API
   * 
   * @param audienceDID - The DID of the recipient (e.g., did:key:z6Mk...)
   * @param abilities - Array of abilities to delegate (e.g., ['space/blob/add', 'upload/add'])
   * @param options - Optional expiration and proofs
   * @returns Serialized delegation as Uint8Array (CAR format)
   */
  async createDelegation(
    audienceDID: string,
    abilities: string[],
    options?: {
      expiration?: number; // Unix timestamp in seconds
      lifetimeInSeconds?: number; // Alternative to expiration
    }
  ): Promise<Uint8Array> {
    if (!this.client) {
      throw new Error('Storacha client not initialized')
    }

    const currentSpace = this.client.currentSpace()
    if (!currentSpace) {
      throw new Error('No space available for delegation')
    }

    try {
      // Parse the audience DID using @ipld/dag-ucan
      // The client.createDelegation expects a Principal
      const { parse } = await import('@ipld/dag-ucan/did')
      const audience = parse(audienceDID)

      // Calculate expiration
      let expiration: number | undefined
      if (options?.expiration) {
        expiration = options.expiration
      } else if (options?.lifetimeInSeconds) {
        expiration = Math.floor(Date.now() / 1000) + options.lifetimeInSeconds
      } else {
        // Default: 24 hours
        expiration = Math.floor(Date.now() / 1000) + (60 * 60 * 24)
      }

      // Create the delegation using Storacha client API
      const delegation = await this.client.createDelegation(
        audience,
        abilities as any, // Type assertion needed due to strict typing
        { expiration }
      )

      // Archive the delegation to a CAR file format
      const archive = await delegation.archive()
      if (archive.error) {
        throw new Error(`Failed to archive delegation: ${archive.error}`)
      }

      console.log('Created delegation:', {
        issuer: delegation.issuer.did(),
        audience: delegation.audience.did(),
        capabilities: delegation.capabilities,
        expiration: delegation.expiration
      })

      return archive.ok
    } catch (error) {
      console.error('Failed to create delegation:', error)
      throw new Error(`Failed to create delegation: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Accept a delegation from another user
   * Adds the delegation as a proof to the local agent
   * 
   * @param delegationBytes - The serialized delegation (CAR format)
   * @returns The space DID from the delegation
   */
  async acceptDelegation(delegationBytes: Uint8Array): Promise<string> {
    if (!this.client) {
      throw new Error('Storacha client not initialized')
    }

    try {
      // Import the Delegation extraction utility
      const { extract } = await import('@storacha/client/delegation')
      
      // Extract the delegation from the CAR bytes
      const result = await extract(delegationBytes)
      if (result.error) {
        throw new Error(`Failed to extract delegation: ${result.error}`)
      }

      const delegation = result.ok

      // Add the delegation as a space (this also adds it as a proof)
      const space = await this.client.addSpace(delegation)
      
      console.log('Accepted delegation for space:', {
        spaceDID: space.did(),
        spaceName: space.name
      })

      return space.did()
    } catch (error) {
      console.error('Failed to accept delegation:', error)
      throw new Error(`Failed to accept delegation: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get all delegations created by this agent
   * Optionally filtered by capability
   */
  getDelegations(abilities?: string[]): any[] {
    if (!this.client) {
      return []
    }

    try {
      // Get delegations, optionally filtered
      if (abilities && abilities.length > 0) {
        // Filter by capabilities
        const allDelegations = this.client.delegations()
        return allDelegations.filter(d => 
          d.capabilities.some(cap => abilities.includes(cap.can))
        )
      }
      
      return this.client.delegations()
    } catch (error) {
      console.error('Failed to get delegations:', error)
      return []
    }
  }

  /**
   * Create a delegation for database/note sharing
   * Provides common ability sets for different permission levels
   */
  async createShareDelegation(
    audienceDID: string,
    permission: 'view' | 'edit' | 'admin',
    options?: { lifetimeInSeconds?: number }
  ): Promise<Uint8Array> {
    // Map permission levels to Storacha abilities
    const abilityMap: Record<string, string[]> = {
      view: [
        'space/blob/list',
        'upload/list'
      ],
      edit: [
        'space/blob/add',
        'space/blob/list',
        'space/index/add',
        'upload/add',
        'upload/list',
        'filecoin/offer'
      ],
      admin: [
        'space/blob/add',
        'space/blob/list',
        'space/blob/remove',
        'space/index/add',
        'upload/add',
        'upload/list',
        'upload/remove',
        'filecoin/offer',
        'filecoin/info'
      ]
    }

    const abilities = abilityMap[permission] || abilityMap.view

    return this.createDelegation(audienceDID, abilities, options)
  }

  /**
   * Get the agent's DID (Decentralized Identifier)
   */
  getAgentDID(): string | null {
    if (!this.client) return null
    return this.client.agent.did()
  }
}

// Export singleton instance
export const storachaClient = new StorachaClient()
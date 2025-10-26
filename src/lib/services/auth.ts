import { create } from '@web3-storage/w3up-client'
import { Signer } from '@ucanto/principal/ed25519'
import type { Client } from '@web3-storage/w3up-client'
import type { AuthState, AuthService, StoredIdentity } from '../types/auth.js'

type SignerType = Awaited<ReturnType<typeof Signer.generate>>

const STORAGE_KEY = 'storacha-notes-identity'

/**
 * UCAN Authentication Service
 * Handles decentralized identity creation, storage, and w3up client management
 * Requirements: 2.3, 5.2, 5.4 - UCAN authentication without account creation
 */
export class UCANAuthService implements AuthService {
  private authState: AuthState = {
    isAuthenticated: false,
    principal: null,
    client: null,
    did: null
  }

  /**
   * Initialize the authentication service
   * Creates identity automatically on first visit
   */
  async initialize(): Promise<void> {
    try {
      // Try to load existing identity
      let principal = this.loadStoredIdentity()
      
      if (!principal) {
        // Create new identity on first visit
        principal = await this.createIdentity()
        this.storeIdentity(principal)
      }

      // Create w3up client with the principal
      const client = await this.getOrCreateClient()
      
      this.authState = {
        isAuthenticated: true,
        principal,
        client,
        did: principal.did()
      }
    } catch (error) {
      console.error('Failed to initialize authentication:', error)
      this.authState = {
        isAuthenticated: false,
        principal: null,
        client: null,
        did: null
      }
      throw error
    }
  }

  /**
   * Get current authentication state
   */
  getAuthState(): AuthState {
    return { ...this.authState }
  }

  /**
   * Create a new decentralized identity
   * Uses Ed25519 key pair for UCAN authentication
   */
  async createIdentity(): Promise<SignerType> {
    try {
      const principal = await Signer.generate()
      return principal
    } catch (error) {
      console.error('Failed to create identity:', error)
      throw new Error('Failed to create decentralized identity')
    }
  }

  /**
   * Get or create w3up client instance
   * Initializes client with current principal
   */
  async getOrCreateClient(): Promise<Client> {
    if (this.authState.client) {
      return this.authState.client
    }

    if (!this.authState.principal) {
      throw new Error('No principal available for client creation')
    }

    try {
      const client = await create({ principal: this.authState.principal })
      return client
    } catch (error) {
      console.error('Failed to create w3up client:', error)
      throw new Error('Failed to initialize w3up client')
    }
  }

  /**
   * Store identity securely in browser local storage
   * Serializes the principal's private key for persistence
   */
  storeIdentity(principal: SignerType): void {
    try {
      const storedIdentity: StoredIdentity = {
        privateKey: JSON.stringify(principal.toArchive()),
        did: principal.did(),
        createdAt: new Date().toISOString()
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedIdentity))
    } catch (error) {
      console.error('Failed to store identity:', error)
      throw new Error('Failed to store identity in local storage')
    }
  }

  /**
   * Load stored identity from browser local storage
   * Returns null if no identity exists or loading fails
   */
  loadStoredIdentity(): SignerType | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        return null
      }

      const storedIdentity: StoredIdentity = JSON.parse(stored)
      // For now, we'll create a new identity if we can't restore
      // In a production app, you'd implement proper key serialization/deserialization
      console.log('Stored identity found, but restoration not implemented yet. Creating new identity.')
      return null
    } catch (error) {
      console.error('Failed to load stored identity:', error)
      // Clear corrupted data
      this.clearIdentity()
      return null
    }
  }

  /**
   * Clear stored identity from local storage
   * Used for logout or when identity data is corrupted
   */
  clearIdentity(): void {
    try {
      localStorage.removeItem(STORAGE_KEY)
      this.authState = {
        isAuthenticated: false,
        principal: null,
        client: null,
        did: null
      }
    } catch (error) {
      console.error('Failed to clear identity:', error)
    }
  }

  /**
   * Check if user is currently authenticated
   */
  isAuthenticated(): boolean {
    return this.authState.isAuthenticated && this.authState.principal !== null
  }

  /**
   * Get current user's DID (Decentralized Identifier)
   */
  getCurrentDID(): string | null {
    return this.authState.did
  }

  /**
   * Get current w3up client instance
   */
  getClient(): Client | null {
    return this.authState.client
  }
}

// Export singleton instance
export const authService = new UCANAuthService()
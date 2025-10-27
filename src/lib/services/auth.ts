import { create } from '@storacha/client'
import type { Client } from '@storacha/client'
import type { AuthState, AuthService } from '../types/auth.js'

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
      // Create client - it will automatically create or load identity from its store
      const client = await create()

      // Get the agent (principal) from the client
      const principal = client.agent

      this.authState = {
        isAuthenticated: true,
        principal,
        client,
        did: principal.did()
      }

      console.log('Authentication initialized successfully with DID:', principal.did())

      // Check if user has logged in with email before
      const hasEmailLogin = this.checkEmailLoginStatus()
      if (!hasEmailLogin) {
        console.log('No email login found. User needs to login to enable cloud storage.')
      } else {
        // If user has logged in before, ensure space exists
        await this.ensureSpaceExists()
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
   * Login with email to provision storage space
   */
  async loginWithEmail(email: string): Promise<void> {
    const client = this.authState.client
    if (!client) {
      throw new Error('Client not initialized')
    }

    try {
      console.log('Logging in with email:', email)

      // Validate email format
      if (!email.includes('@')) {
        throw new Error('Invalid email format')
      }

      // Authorize with email - cast to the expected format
      await client.login(email as `${string}@${string}`)

      // Store email login status
      if (typeof window !== 'undefined') {
        localStorage.setItem('storacha-email-login', email)
        localStorage.setItem('storacha-login-timestamp', new Date().toISOString())
      }

      console.log('Email login successful. Waiting for account provisioning...')

      // Automatically create or use a space
      await this.ensureSpaceExists()

      // The user will receive an email and need to click the verification link
      // After verification, they need to select a payment plan
    } catch (error) {
      console.error('Email login failed:', error)
      throw new Error('Failed to login with email')
    }
  }

  /**
   * Ensure a space exists and is set as current
   * Creates a unique space per user: storacha-text-editor-{uniqueId}
   */
  async ensureSpaceExists(): Promise<void> {
    const client = this.authState.client
    if (!client) return

    try {
      // Check if there's already a current space
      const currentSpace = client.currentSpace()
      if (currentSpace) {
        // Verify it's a storacha-text-editor space
        if (currentSpace.name?.startsWith('storacha-text-editor-')) {
          console.log('✓ Current space active:', currentSpace.did())
          console.log('  Space name:', currentSpace.name)
          return
        }
      }

      // Look for existing storacha-text-editor space
      const spaces = Array.from(client.spaces())
      console.log(`Found ${spaces.length} existing space(s)`)

      const appSpace = spaces.find(s =>
        s.name?.startsWith('storacha-text-editor-')
      )

      if (appSpace) {
        // Use existing app space
        await client.setCurrentSpace(appSpace.did())
        console.log('✓ Using existing app space:', appSpace.name)
        console.log('  DID:', appSpace.did())
        return
      }

      // Get the account to provision the space
      const accounts = Object.values(client.accounts())
      const account = accounts.length > 0 ? accounts[0] : null
      
      if (!account) {
        console.warn('⚠ No account available. Cannot create space without email login.')
        console.warn('  Please login with email to create a provisioned space.')
        console.warn('  Notes will be saved locally only until you login.')
        return // Don't create unprovisionable spaces
      }

      // Create a new unique space for this user
      const uniqueId = this.generateUniqueId()
      const spaceName = `storacha-text-editor-${uniqueId}`

      console.log(`Creating new space: ${spaceName}`)
      
      // Create space with account parameter for provisioning
      const space = await client.createSpace(spaceName, { account })
      await client.setCurrentSpace(space.did())

      // Check if payment plan already exists, otherwise wait
      console.log('Checking payment plan status...')
      try {
        // Check if plan already exists
        const currentPlan = account.plan.get()
        if (currentPlan) {
          console.log('✓ Payment plan already active:', currentPlan)
        } else {
          console.log('Waiting for payment plan selection...')
          // Wait for payment plan with 1 second polling, 15 minute timeout
          await account.plan.wait()
          console.log('✓ Payment plan selected, space is provisioned')
        }
      } catch (error) {
        console.warn('⚠ Payment plan check/wait failed:', error)
        console.warn('  If you already have a plan, the space should still work')
        console.warn('  Otherwise, visit https://console.web3.storage to select a payment plan')
      }

      // Store the space name for future reference
      if (typeof window !== 'undefined') {
        localStorage.setItem('storacha-text-editor-space', spaceName)
      }

      console.log('✓ Created and set new space:', spaceName)
      console.log('  DID:', space.did())
    } catch (error) {
      console.error('Failed to ensure space exists:', error)
      // Don't throw - this is a best-effort operation
    }
  }

  /**
   * Recreate space with proper account provisioning
   * Use this if you have an old unprovisionable space
   */
  async recreateSpace(): Promise<void> {
    const client = this.authState.client
    if (!client) {
      throw new Error('Client not initialized')
    }

    try {
      // Get the account
      const accounts = Object.values(client.accounts())
      const account = accounts.length > 0 ? accounts[0] : null
      
      if (!account) {
        throw new Error('Email login required. Please login with email first.')
      }

      // Find and remove old storacha-text-editor spaces
      const spaces = Array.from(client.spaces())
      const oldSpaces = spaces.filter(s => s.name?.startsWith('storacha-text-editor-'))
      
      console.log(`Found ${oldSpaces.length} old space(s) to remove`)
      
      // Note: Storacha doesn't have a delete API, but we can just create a new space
      // and set it as current. The old space will remain but won't be used.
      
      // Create a new unique space
      const uniqueId = this.generateUniqueId()
      const spaceName = `storacha-text-editor-${uniqueId}`
      
      console.log(`Creating new provisioned space: ${spaceName}`)
      
      // Create space with account parameter
      const space = await client.createSpace(spaceName, { account })
      await client.setCurrentSpace(space.did())
      
      // Check payment plan
      console.log('Checking payment plan status...')
      const currentPlan = account.plan.get()
      if (currentPlan) {
        console.log('✓ Payment plan already active:', currentPlan)
      } else {
        console.log('Waiting for payment plan selection...')
        await account.plan.wait()
        console.log('✓ Payment plan selected')
      }
      
      // Store the new space name
      if (typeof window !== 'undefined') {
        localStorage.setItem('storacha-text-editor-space', spaceName)
      }
      
      console.log('✓ New provisioned space created:', spaceName)
      console.log('  DID:', space.did())
      console.log('  This space is now ready for uploads!')
    } catch (error) {
      console.error('Failed to recreate space:', error)
      throw error
    }
  }

  /**
   * Generate a unique ID for the space name
   */
  private generateUniqueId(): string {
    // Use timestamp + random string for uniqueness
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 9)
    return `${timestamp}-${random}`
  }

  /**
   * Check if user has completed email login
   */
  checkEmailLoginStatus(): boolean {
    if (typeof window === 'undefined') return false

    const email = localStorage.getItem('storacha-email-login')
    return !!email
  }

  /**
   * Get stored email if available
   */
  getStoredEmail(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('storacha-email-login')
  }

  /**
   * Check if user has verified their email and selected a plan
   */
  async checkAccountStatus(): Promise<{
    hasAccount: boolean
    hasSpace: boolean
    email: string | null
  }> {
    const client = this.authState.client
    if (!client) {
      return { hasAccount: false, hasSpace: false, email: null }
    }

    const email = this.getStoredEmail()
    const accounts = client.accounts()
    const hasAccount = Object.keys(accounts).length > 0
    const currentSpace = client.currentSpace()
    const hasSpace = !!currentSpace

    return { hasAccount, hasSpace, email }
  }

  /**
   * Get current authentication state
   */
  getAuthState(): AuthState {
    return { ...this.authState }
  }

  /**
   * Get the w3up client instance
   */
  getClient(): Client | null {
    return this.authState.client
  }

  /**
   * Clear stored identity
   * Note: The @storacha/client manages its own store
   */
  clearIdentity(): void {
    this.authState = {
      isAuthenticated: false,
      principal: null,
      client: null,
      did: null
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
}

// Export singleton instance
export const authService = new UCANAuthService()
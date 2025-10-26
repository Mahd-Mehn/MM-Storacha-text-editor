import { writable, derived } from 'svelte/store'
import type { AuthState } from '../types/auth.js'
import { authService } from '../services/auth.js'

/**
 * Authentication state store
 * Manages reactive authentication state across the application
 */
export const authState = writable<AuthState>({
  isAuthenticated: false,
  principal: null,
  client: null,
  did: null
})

/**
 * Derived store for authentication status
 */
export const isAuthenticated = derived(
  authState,
  ($authState) => $authState.isAuthenticated
)

/**
 * Derived store for current user DID
 */
export const currentDID = derived(
  authState,
  ($authState) => $authState.did
)

/**
 * Initialize authentication and update store
 */
export async function initializeAuth(): Promise<void> {
  try {
    await authService.initialize()
    const state = authService.getAuthState()
    authState.set(state)
  } catch (error) {
    console.error('Authentication initialization failed:', error)
    authState.set({
      isAuthenticated: false,
      principal: null,
      client: null,
      did: null
    })
    throw error
  }
}

/**
 * Clear authentication and reset store
 */
export function clearAuth(): void {
  authService.clearIdentity()
  authState.set({
    isAuthenticated: false,
    principal: null,
    client: null,
    did: null
  })
}
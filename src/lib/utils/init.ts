import { initializeAuth } from '../stores/auth.js'
import { initializeSpaces } from '../stores/space.js'

/**
 * Initialize the complete authentication and space management system
 * This should be called when the application starts
 */
export async function initializeApp(): Promise<void> {
  try {
    // Initialize authentication first
    await initializeAuth()
    
    // Then initialize spaces
    await initializeSpaces()
    
    console.log('Application initialized successfully')
  } catch (error) {
    console.error('Failed to initialize application:', error)
    throw error
  }
}

/**
 * Check if the application is properly initialized
 */
export function isAppInitialized(): boolean {
  // This is a simple check - in a real app you might want more sophisticated checks
  return typeof window !== 'undefined' && 
         localStorage.getItem('storacha-notes-identity') !== null
}
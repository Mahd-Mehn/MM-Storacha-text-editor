import { writable, derived } from 'svelte/store'
import type { SpaceInfo } from '../types/auth.js'
import { spaceService } from '../services/space.js'

/**
 * Available spaces store
 */
export const availableSpaces = writable<SpaceInfo[]>([])

/**
 * Current active space store
 */
export const currentSpace = writable<SpaceInfo | null>(null)

/**
 * Derived store for current space DID
 */
export const currentSpaceDID = derived(
  currentSpace,
  ($currentSpace) => $currentSpace?.did || null
)

/**
 * Initialize space management and update stores
 */
export async function initializeSpaces(): Promise<void> {
  try {
    await spaceService.initialize()
    await refreshSpaces()
  } catch (error) {
    console.error('Space initialization failed:', error)
    throw error
  }
}

/**
 * Refresh spaces list and current space
 */
export async function refreshSpaces(): Promise<void> {
  try {
    const spaces = await spaceService.getSpaces()
    availableSpaces.set(spaces)
    
    const current = spaceService.getCurrentSpace()
    currentSpace.set(current)
  } catch (error) {
    console.error('Failed to refresh spaces:', error)
    throw error
  }
}

/**
 * Create a new space and refresh stores
 */
export async function createSpace(name?: string): Promise<SpaceInfo> {
  try {
    const newSpace = await spaceService.createSpace(name)
    await refreshSpaces()
    return newSpace
  } catch (error) {
    console.error('Failed to create space:', error)
    throw error
  }
}

/**
 * Set current space and update stores
 */
export async function setCurrentSpace(spaceDID: string): Promise<void> {
  try {
    await spaceService.setCurrentSpace(spaceDID)
    const current = spaceService.getCurrentSpace()
    currentSpace.set(current)
  } catch (error) {
    console.error('Failed to set current space:', error)
    throw error
  }
}

/**
 * Clear space data
 */
export function clearSpaces(): void {
  spaceService.clearCurrentSpace()
  availableSpaces.set([])
  currentSpace.set(null)
}
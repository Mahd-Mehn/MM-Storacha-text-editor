import type { Client } from '@storacha/client'
import type { Agent } from '@storacha/client/types'

export interface AuthState {
  isAuthenticated: boolean
  principal: Agent | null
  client: Client | null
  did: string | null
}

export interface AuthService {
  initialize(): Promise<void>
  getAuthState(): AuthState
  getClient(): Client | null
  clearIdentity(): void
  isAuthenticated(): boolean
  getCurrentDID(): string | null
  loginWithEmail(email: string): Promise<void>
  checkEmailLoginStatus(): boolean
  getStoredEmail(): string | null
  checkAccountStatus(): Promise<{
    hasAccount: boolean
    hasSpace: boolean
    email: string | null
  }>
}

export interface SpaceInfo {
  did: string
  name?: string
  createdAt: Date
}

export interface SpaceService {
  createSpace(name?: string): Promise<SpaceInfo>
  getSpaces(): Promise<SpaceInfo[]>
  getCurrentSpace(): SpaceInfo | null
  setCurrentSpace(spaceDID: string): Promise<void>
  delegateSpace(spaceDID: string, audience: string, permissions: string[]): Promise<string>
}
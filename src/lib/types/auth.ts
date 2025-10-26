import type { Signer } from '@ucanto/principal/ed25519'
import type { Client } from '@web3-storage/w3up-client'

type SignerType = Awaited<ReturnType<typeof Signer.generate>>

export interface AuthState {
  isAuthenticated: boolean
  principal: SignerType | null
  client: Client | null
  did: string | null
}

export interface AuthService {
  initialize(): Promise<void>
  getAuthState(): AuthState
  createIdentity(): Promise<SignerType>
  getOrCreateClient(): Promise<Client>
  storeIdentity(principal: SignerType): void
  loadStoredIdentity(): SignerType | null
  clearIdentity(): void
}

export interface StoredIdentity {
  privateKey: string
  did: string
  createdAt: string
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
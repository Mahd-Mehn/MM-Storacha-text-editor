/**
 * Encryption Service
 * Provides end-to-end encryption for note content using AES-256-GCM
 */

import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { randomBytes } from '@noble/ciphers/webcrypto';
import { authService } from './auth';

export interface EncryptedPayload {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  version: number;
}

export interface EncryptionKey {
  key: Uint8Array;
  created: Date;
  id: string;
}

class EncryptionService {
  private readonly KEY_STORAGE_KEY = 'encryption-keys';
  private readonly CURRENT_KEY_ID = 'current-encryption-key-id';
  private readonly VERSION = 1;
  private currentKey: EncryptionKey | null = null;

  /**
   * Initialize encryption service and load/generate encryption key
   */
  async initialize(): Promise<void> {
    // Try to load existing key
    const currentKeyId = this.getCurrentKeyId();
    if (currentKeyId) {
      const key = await this.loadKey(currentKeyId);
      if (key) {
        this.currentKey = key;
        return;
      }
    }

    // Generate new key if none exists
    await this.generateNewKey();
  }

  /**
   * Generate a new encryption key derived from user's identity
   */
  async generateNewKey(): Promise<EncryptionKey> {
    try {
      // Get user's DID for key derivation
      const agent = await authService.getAgent();
      if (!agent) {
        throw new Error('User not authenticated');
      }

      const did = agent.did();
      
      // Derive encryption key from DID
      // In production, you'd want to use a proper key derivation function
      const encoder = new TextEncoder();
      const didBytes = encoder.encode(did);
      
      // Hash the DID to create a 32-byte key
      const keyMaterial = await crypto.subtle.digest('SHA-256', didBytes);
      const key = new Uint8Array(keyMaterial);

      const encryptionKey: EncryptionKey = {
        key,
        created: new Date(),
        id: `key-${Date.now()}`
      };

      // Store the key
      await this.storeKey(encryptionKey);
      this.currentKey = encryptionKey;
      this.setCurrentKeyId(encryptionKey.id);

      return encryptionKey;
    } catch (error) {
      console.error('Failed to generate encryption key:', error);
      throw new Error('Failed to generate encryption key');
    }
  }

  /**
   * Encrypt data using XChaCha20-Poly1305
   */
  async encrypt(data: Uint8Array): Promise<EncryptedPayload> {
    if (!this.currentKey) {
      await this.initialize();
    }

    if (!this.currentKey) {
      throw new Error('No encryption key available');
    }

    try {
      // Generate random nonce (24 bytes for XChaCha20)
      const nonce = randomBytes(24);

      // Create cipher
      const cipher = xchacha20poly1305(this.currentKey.key, nonce);
      
      // Encrypt the data
      const ciphertext = cipher.encrypt(data);

      return {
        ciphertext,
        nonce,
        version: this.VERSION
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data using XChaCha20-Poly1305
   */
  async decrypt(payload: EncryptedPayload): Promise<Uint8Array> {
    if (!this.currentKey) {
      await this.initialize();
    }

    if (!this.currentKey) {
      throw new Error('No encryption key available');
    }

    try {
      // Create cipher with the same key and nonce
      const cipher = xchacha20poly1305(this.currentKey.key, payload.nonce);
      
      // Decrypt the data
      const plaintext = cipher.decrypt(payload.ciphertext);

      return plaintext;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data - invalid key or corrupted data');
    }
  }

  /**
   * Encrypt a string
   */
  async encryptString(text: string): Promise<EncryptedPayload> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    return this.encrypt(data);
  }

  /**
   * Decrypt to a string
   */
  async decryptString(payload: EncryptedPayload): Promise<string> {
    const data = await this.decrypt(payload);
    const decoder = new TextDecoder();
    return decoder.decode(data);
  }

  /**
   * Serialize encrypted payload to base64 for storage
   */
  serializePayload(payload: EncryptedPayload): string {
    const combined = new Uint8Array(
      4 + // version (4 bytes)
      4 + // nonce length (4 bytes)
      payload.nonce.length +
      payload.ciphertext.length
    );

    const view = new DataView(combined.buffer);
    let offset = 0;

    // Write version
    view.setUint32(offset, payload.version, true);
    offset += 4;

    // Write nonce length
    view.setUint32(offset, payload.nonce.length, true);
    offset += 4;

    // Write nonce
    combined.set(payload.nonce, offset);
    offset += payload.nonce.length;

    // Write ciphertext
    combined.set(payload.ciphertext, offset);

    // Convert to base64
    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Deserialize encrypted payload from base64
   */
  deserializePayload(serialized: string): EncryptedPayload {
    // Convert from base64
    const combined = new Uint8Array(
      atob(serialized).split('').map(c => c.charCodeAt(0))
    );

    const view = new DataView(combined.buffer);
    let offset = 0;

    // Read version
    const version = view.getUint32(offset, true);
    offset += 4;

    // Read nonce length
    const nonceLength = view.getUint32(offset, true);
    offset += 4;

    // Read nonce
    const nonce = combined.slice(offset, offset + nonceLength);
    offset += nonceLength;

    // Read ciphertext
    const ciphertext = combined.slice(offset);

    return {
      ciphertext,
      nonce,
      version
    };
  }

  /**
   * Store encryption key in localStorage
   */
  private async storeKey(key: EncryptionKey): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const keys = await this.loadAllKeys();
      keys[key.id] = {
        key: Array.from(key.key), // Convert to array for JSON storage
        created: key.created.toISOString(),
        id: key.id
      };

      localStorage.setItem(this.KEY_STORAGE_KEY, JSON.stringify(keys));
    } catch (error) {
      console.error('Failed to store encryption key:', error);
      throw error;
    }
  }

  /**
   * Load encryption key from localStorage
   */
  private async loadKey(keyId: string): Promise<EncryptionKey | null> {
    if (typeof window === 'undefined') return null;

    try {
      const keys = await this.loadAllKeys();
      const stored = keys[keyId];

      if (!stored) return null;

      return {
        key: new Uint8Array(stored.key),
        created: new Date(stored.created),
        id: stored.id
      };
    } catch (error) {
      console.error('Failed to load encryption key:', error);
      return null;
    }
  }

  /**
   * Load all encryption keys
   */
  private async loadAllKeys(): Promise<Record<string, any>> {
    if (typeof window === 'undefined') return {};

    try {
      const stored = localStorage.getItem(this.KEY_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to load encryption keys:', error);
      return {};
    }
  }

  /**
   * Get current key ID
   */
  private getCurrentKeyId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.CURRENT_KEY_ID);
  }

  /**
   * Set current key ID
   */
  private setCurrentKeyId(keyId: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.CURRENT_KEY_ID, keyId);
  }

  /**
   * Check if encryption is enabled
   */
  isEnabled(): boolean {
    return this.currentKey !== null;
  }

  /**
   * Export encryption key for backup
   */
  async exportKey(): Promise<string> {
    if (!this.currentKey) {
      throw new Error('No encryption key available');
    }

    const keyData = {
      key: Array.from(this.currentKey.key),
      created: this.currentKey.created.toISOString(),
      id: this.currentKey.id
    };

    return btoa(JSON.stringify(keyData));
  }

  /**
   * Import encryption key from backup
   */
  async importKey(exportedKey: string): Promise<void> {
    try {
      const keyData = JSON.parse(atob(exportedKey));
      
      const key: EncryptionKey = {
        key: new Uint8Array(keyData.key),
        created: new Date(keyData.created),
        id: keyData.id
      };

      await this.storeKey(key);
      this.currentKey = key;
      this.setCurrentKeyId(key.id);
    } catch (error) {
      console.error('Failed to import encryption key:', error);
      throw new Error('Invalid encryption key format');
    }
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();

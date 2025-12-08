/**
 * Cryptographic Utilities Service
 * 
 * Provides real encryption/decryption using Web Crypto API.
 * Uses AES-GCM for content encryption and ECDH for key agreement.
 * 
 * Flow:
 * 1. Generate symmetric key (AES-GCM 256-bit)
 * 2. Encrypt content with symmetric key
 * 3. For each recipient, wrap the symmetric key using their public key
 * 4. Store encrypted content + wrapped keys
 */

// Encryption algorithm constants
const AES_GCM_KEY_LENGTH = 256;
const AES_GCM_IV_LENGTH = 12; // 96 bits recommended for GCM
const ECDH_CURVE = 'P-256';

// Types
export interface EncryptedPayload {
  /** Base64-encoded ciphertext */
  ciphertext: string;
  /** Base64-encoded initialization vector */
  iv: string;
  /** Algorithm used */
  algorithm: 'AES-GCM-256';
  /** Version for future compatibility */
  version: 1;
  /** Salt used for key derivation (if applicable) */
  salt?: string;
}

export interface WrappedKey {
  /** The DID of the recipient */
  recipientDID: string;
  /** Base64-encoded wrapped symmetric key */
  wrappedKey: string;
  /** The ephemeral public key used for ECDH (JWK format) */
  ephemeralPublicKey: JsonWebKey;
  /** Algorithm used for key wrapping */
  algorithm: 'ECDH-ES+A256KW';
}

export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export interface ExportedKeyPair {
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}

/**
 * CryptoUtils - Web Crypto API based encryption utilities
 */
export class CryptoUtils {
  /**
   * Generate a random AES-GCM symmetric key
   */
  async generateSymmetricKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: AES_GCM_KEY_LENGTH
      },
      true, // extractable for wrapping
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Generate a random initialization vector for AES-GCM
   */
  generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH));
  }

  /**
   * Encrypt data with AES-GCM
   */
  async encryptWithSymmetricKey(
    data: Uint8Array,
    key: CryptoKey,
    iv: Uint8Array
  ): Promise<ArrayBuffer> {
    return crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource
      },
      key,
      data as BufferSource
    );
  }

  /**
   * Decrypt data with AES-GCM
   */
  async decryptWithSymmetricKey(
    ciphertext: ArrayBuffer,
    key: CryptoKey,
    iv: Uint8Array
  ): Promise<ArrayBuffer> {
    return crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource
      },
      key,
      ciphertext
    );
  }

  /**
   * Generate an ECDH key pair for key agreement
   */
  async generateECDHKeyPair(): Promise<KeyPair> {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: ECDH_CURVE
      },
      true,
      ['deriveBits', 'deriveKey']
    );

    return {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey
    };
  }

  /**
   * Export key pair to JWK format for storage
   */
  async exportKeyPair(keyPair: KeyPair): Promise<ExportedKeyPair> {
    const [publicKey, privateKey] = await Promise.all([
      crypto.subtle.exportKey('jwk', keyPair.publicKey),
      crypto.subtle.exportKey('jwk', keyPair.privateKey)
    ]);

    return { publicKey, privateKey };
  }

  /**
   * Import ECDH public key from JWK
   */
  async importECDHPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
    return crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'ECDH',
        namedCurve: ECDH_CURVE
      },
      true,
      []
    );
  }

  /**
   * Import ECDH private key from JWK
   */
  async importECDHPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
    return crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'ECDH',
        namedCurve: ECDH_CURVE
      },
      true,
      ['deriveBits', 'deriveKey']
    );
  }

  /**
   * Derive a shared secret using ECDH and use it to wrap a key
   * Uses ECDH-ES+A256KW scheme
   */
  async wrapKeyForRecipient(
    symmetricKey: CryptoKey,
    recipientPublicKey: CryptoKey
  ): Promise<{ wrappedKey: ArrayBuffer; ephemeralKeyPair: KeyPair }> {
    // Generate ephemeral key pair for this wrapping operation
    const ephemeralKeyPair = await this.generateECDHKeyPair();

    // Derive shared secret using ECDH
    const sharedSecret = await crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: recipientPublicKey
      },
      ephemeralKeyPair.privateKey,
      256
    );

    // Derive a key-wrapping key from the shared secret
    const wrappingKey = await crypto.subtle.importKey(
      'raw',
      sharedSecret,
      { name: 'AES-KW', length: 256 },
      false,
      ['wrapKey']
    );

    // Wrap the symmetric key
    const wrappedKey = await crypto.subtle.wrapKey(
      'raw',
      symmetricKey,
      wrappingKey,
      { name: 'AES-KW' }
    );

    return { wrappedKey, ephemeralKeyPair };
  }

  /**
   * Unwrap a symmetric key using ECDH
   */
  async unwrapKeyFromSender(
    wrappedKey: ArrayBuffer,
    ephemeralPublicKey: CryptoKey,
    recipientPrivateKey: CryptoKey
  ): Promise<CryptoKey> {
    // Derive shared secret using ECDH
    const sharedSecret = await crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: ephemeralPublicKey
      },
      recipientPrivateKey,
      256
    );

    // Derive the unwrapping key from the shared secret
    const unwrappingKey = await crypto.subtle.importKey(
      'raw',
      sharedSecret,
      { name: 'AES-KW', length: 256 },
      false,
      ['unwrapKey']
    );

    // Unwrap the symmetric key
    return crypto.subtle.unwrapKey(
      'raw',
      wrappedKey,
      unwrappingKey,
      { name: 'AES-KW' },
      { name: 'AES-GCM', length: AES_GCM_KEY_LENGTH },
      true,
      ['decrypt']
    );
  }

  /**
   * High-level: Encrypt content for multiple recipients
   * Returns encrypted payload and wrapped keys for each recipient
   */
  async encryptForRecipients(
    content: Uint8Array,
    recipientPublicKeys: Map<string, JsonWebKey> // DID -> public key
  ): Promise<{
    encryptedPayload: EncryptedPayload;
    wrappedKeys: WrappedKey[];
  }> {
    // Generate a new symmetric key for this content
    const symmetricKey = await this.generateSymmetricKey();
    const iv = this.generateIV();

    // Encrypt the content
    const ciphertext = await this.encryptWithSymmetricKey(content, symmetricKey, iv);

    // Wrap the key for each recipient
    const wrappedKeys: WrappedKey[] = [];

    for (const [did, publicKeyJwk] of recipientPublicKeys) {
      try {
        const recipientPublicKey = await this.importECDHPublicKey(publicKeyJwk);
        const { wrappedKey, ephemeralKeyPair } = await this.wrapKeyForRecipient(
          symmetricKey,
          recipientPublicKey
        );

        const ephemeralPublicKeyJwk = await crypto.subtle.exportKey(
          'jwk',
          ephemeralKeyPair.publicKey
        );

        wrappedKeys.push({
          recipientDID: did,
          wrappedKey: this.arrayBufferToBase64(wrappedKey),
          ephemeralPublicKey: ephemeralPublicKeyJwk,
          algorithm: 'ECDH-ES+A256KW'
        });
      } catch (error) {
        console.error(`Failed to wrap key for recipient ${did}:`, error);
        // Continue with other recipients
      }
    }

    return {
      encryptedPayload: {
        ciphertext: this.arrayBufferToBase64(ciphertext),
        iv: this.arrayBufferToBase64(iv.buffer),
        algorithm: 'AES-GCM-256',
        version: 1
      },
      wrappedKeys
    };
  }

  /**
   * High-level: Decrypt content using a wrapped key
   */
  async decryptWithWrappedKey(
    encryptedPayload: EncryptedPayload,
    wrappedKey: WrappedKey,
    recipientPrivateKey: JsonWebKey
  ): Promise<Uint8Array> {
    // Import the ephemeral public key
    const ephemeralPublicKey = await this.importECDHPublicKey(wrappedKey.ephemeralPublicKey);

    // Import the recipient's private key
    const privateKey = await this.importECDHPrivateKey(recipientPrivateKey);

    // Decode the wrapped key
    const wrappedKeyBuffer = this.base64ToArrayBuffer(wrappedKey.wrappedKey);

    // Unwrap the symmetric key
    const symmetricKey = await this.unwrapKeyFromSender(
      wrappedKeyBuffer,
      ephemeralPublicKey,
      privateKey
    );

    // Decode the ciphertext and IV
    const ciphertext = this.base64ToArrayBuffer(encryptedPayload.ciphertext);
    const iv = new Uint8Array(this.base64ToArrayBuffer(encryptedPayload.iv));

    // Decrypt the content
    const plaintext = await this.decryptWithSymmetricKey(ciphertext, symmetricKey, iv);

    return new Uint8Array(plaintext);
  }

  /**
   * Simple password-based encryption using PBKDF2 + AES-GCM
   * Useful for password-protected share links
   */
  async encryptWithPassword(
    content: Uint8Array,
    password: string
  ): Promise<{ encrypted: EncryptedPayload; salt: string }> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = this.generateIV();

    // Derive key from password using PBKDF2
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: AES_GCM_KEY_LENGTH },
      false,
      ['encrypt']
    );

    // Encrypt the content
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      derivedKey,
      content as BufferSource
    );

    return {
      encrypted: {
        ciphertext: this.arrayBufferToBase64(ciphertext),
        iv: this.arrayBufferToBase64(iv.buffer),
        algorithm: 'AES-GCM-256',
        version: 1,
        salt: this.arrayBufferToBase64(salt.buffer)
      },
      salt: this.arrayBufferToBase64(salt.buffer)
    };
  }

  /**
   * Decrypt password-protected content
   */
  async decryptWithPassword(
    encryptedPayload: EncryptedPayload,
    password: string
  ): Promise<Uint8Array> {
    if (!encryptedPayload.salt) {
      throw new Error('Missing salt for password-based decryption');
    }

    const salt = new Uint8Array(this.base64ToArrayBuffer(encryptedPayload.salt));
    const iv = new Uint8Array(this.base64ToArrayBuffer(encryptedPayload.iv));
    const ciphertext = this.base64ToArrayBuffer(encryptedPayload.ciphertext);

    // Derive key from password
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: AES_GCM_KEY_LENGTH },
      false,
      ['decrypt']
    );

    // Decrypt
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      derivedKey,
      ciphertext
    );

    return new Uint8Array(plaintext);
  }

  /**
   * Hash a password using SHA-256 (for storage comparison)
   */
  async hashPassword(password: string): Promise<string> {
    const data = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return this.arrayBufferToBase64(hashBuffer);
  }

  /**
   * Verify a password against a stored hash
   */
  async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const computedHash = await this.hashPassword(password);
    return computedHash === storedHash;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferLike): string {
    const bytes = new Uint8Array(buffer as ArrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer as ArrayBuffer;
  }

  /**
   * Generate a secure random token (for share links, etc.)
   */
  generateSecureToken(length: number = 32): string {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

// Export singleton instance
export const cryptoUtils = new CryptoUtils();

// Export types
export type { EncryptedPayload as CryptoEncryptedPayload, WrappedKey as CryptoWrappedKey };

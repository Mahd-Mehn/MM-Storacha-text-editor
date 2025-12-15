/**
 * File Upload Service
 * Handles file uploads to Storacha with support for images, documents, and other media
 */

import { storachaClient } from './storacha';
import { notificationService } from './notification';
import { errorHandler } from './error-handler';

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  cid: string; // Content ID from Storacha
  url: string; // Gateway URL for accessing the file
  uploadedAt: Date;
  thumbnail?: string; // For images
}

export interface UploadProgress {
  fileId: string;
  fileName: string;
  loaded: number;
  total: number;
  percentage: number;
}

class FileUploadService {
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  private readonly SUPPORTED_DOCUMENT_TYPES = ['application/pdf', 'text/plain', 'text/markdown'];
  
  private uploadProgressCallbacks: Map<string, (progress: UploadProgress) => void> = new Map();

  /**
   * Upload a file to Storacha
   */
  async uploadFile(
    file: File,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadedFile> {
    try {
      // Validate file size
      if (file.size > this.MAX_FILE_SIZE) {
        throw new Error(`File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
      }

      const fileId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Register progress callback
      if (onProgress) {
        this.uploadProgressCallbacks.set(fileId, onProgress);
      }

      // Convert file to Uint8Array
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Upload to Storacha
      notificationService.info('Uploading file...', file.name);
      
      const cid = await storachaClient.uploadContent(uint8Array, file.name);

      // Generate gateway URL
      const url = `https://w3s.link/ipfs/${cid}`;

      // Generate thumbnail for images
      let thumbnail: string | undefined;
      if (this.isImage(file.type)) {
        thumbnail = await this.generateThumbnail(file);
      }

      const uploadedFile: UploadedFile = {
        id: fileId,
        name: file.name,
        type: file.type,
        size: file.size,
        cid,
        url,
        uploadedAt: new Date(),
        thumbnail
      };

      // Clean up progress callback
      this.uploadProgressCallbacks.delete(fileId);

      notificationService.success('File uploaded successfully', file.name);

      return uploadedFile;
    } catch (error) {
      await errorHandler.handleError(
        error instanceof Error ? error : new Error('Failed to upload file'),
        { operation: 'upload_file', fileName: file.name }
      );
      throw error;
    }
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(
    files: File[],
    onProgress?: (fileId: string, progress: UploadProgress) => void
  ): Promise<UploadedFile[]> {
    const uploadPromises = files.map((file) =>
      this.uploadFile(file, onProgress ? (progress) => onProgress(progress.fileId, progress) : undefined)
    );

    return Promise.all(uploadPromises);
  }

  /**
   * Check if file type is an image
   */
  isImage(mimeType: string): boolean {
    return this.SUPPORTED_IMAGE_TYPES.includes(mimeType);
  }

  /**
   * Check if file type is a document
   */
  isDocument(mimeType: string): boolean {
    return this.SUPPORTED_DOCUMENT_TYPES.includes(mimeType);
  }

  /**
   * Check if file type is supported
   */
  isSupported(mimeType: string): boolean {
    return this.isImage(mimeType) || this.isDocument(mimeType);
  }

  /**
   * Generate thumbnail for an image
   */
  private async generateThumbnail(file: File, maxWidth = 200, maxHeight = 200): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Compress image before upload
   */
  async compressImage(file: File, maxWidth = 1920, maxHeight = 1080, quality = 0.8): Promise<File> {
    if (!this.isImage(file.type)) {
      return file;
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }
              
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              
              resolve(compressedFile);
            },
            'image/jpeg',
            quality
          );
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get file icon based on type
   */
  getFileIcon(mimeType: string): string {
    if (this.isImage(mimeType)) return '🖼️';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.startsWith('text/')) return '📝';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    return '📎';
  }
}

// Export singleton instance
export const fileUploadService = new FileUploadService();

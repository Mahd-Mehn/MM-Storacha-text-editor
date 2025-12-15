<script lang="ts">
  import {
    fileUploadService,
    type UploadedFile,
  } from "$lib/services/file-upload";

  interface Props {
    onUploadComplete: (files: UploadedFile[]) => void;
    accept?: string;
    multiple?: boolean;
    maxSize?: number;
  }

  let {
    onUploadComplete,
    accept = "image/*,application/pdf,.txt,.md",
    multiple = true,
    maxSize = 100 * 1024 * 1024,
  }: Props = $props();

  let isDragging = $state(false);
  let isUploading = $state(false);
  let uploadProgress = $state<Map<string, number>>(new Map());
  let fileInputElement: HTMLInputElement;

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragging = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    isDragging = false;
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging = false;

    const files = Array.from(event.dataTransfer?.files || []);
    await uploadFiles(files);
  }

  async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    await uploadFiles(files);

    // Reset input
    input.value = "";
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;

    // Validate file sizes
    const oversizedFiles = files.filter((f) => f.size > maxSize);
    if (oversizedFiles.length > 0) {
      alert(
        `Some files exceed the maximum size of ${fileUploadService.formatFileSize(maxSize)}`
      );
      return;
    }

    isUploading = true;
    uploadProgress = new Map();

    try {
      const uploadedFiles: UploadedFile[] = [];

      for (const file of files) {
        try {
          // Compress images before upload
          let fileToUpload = file;
          if (fileUploadService.isImage(file.type)) {
            fileToUpload = await fileUploadService.compressImage(file);
          }

          const uploaded = await fileUploadService.uploadFile(
            fileToUpload,
            (progress) => {
              uploadProgress.set(progress.fileId, progress.percentage);
              uploadProgress = new Map(uploadProgress);
            }
          );

          uploadedFiles.push(uploaded);
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
        }
      }

      if (uploadedFiles.length > 0) {
        onUploadComplete(uploadedFiles);
      }
    } finally {
      isUploading = false;
      uploadProgress = new Map();
    }
  }

  function openFilePicker() {
    fileInputElement?.click();
  }
</script>

<div class="file-upload-container">
  <input
    bind:this={fileInputElement}
    type="file"
    {accept}
    {multiple}
    onchange={handleFileSelect}
    style="display: none;"
  />

  <div
    class="drop-zone"
    class:dragging={isDragging}
    class:uploading={isUploading}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
    onclick={openFilePicker}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === "Enter" && openFilePicker()}
  >
    {#if isUploading}
      <div class="upload-status">
        <div class="spinner"></div>
        <p>Uploading files...</p>
        {#if uploadProgress.size > 0}
          <div class="progress-list">
            {#each Array.from(uploadProgress.entries()) as [fileId, percentage]}
              <div class="progress-item">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: {percentage}%"></div>
                </div>
                <span class="progress-text">{Math.round(percentage)}%</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <div class="drop-zone-content">
        <svg
          class="upload-icon"
          width="48"
          height="48"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            d="M4 16v1a3 3 0 003 3h6a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m0-4v12"
          />
        </svg>
        <p class="drop-zone-title">
          {#if isDragging}
            Drop files here
          {:else}
            Drag and drop files here
          {/if}
        </p>
        <p class="drop-zone-subtitle">or click to browse</p>
        <p class="drop-zone-hint">
          Supports images, PDFs, and text files up to {fileUploadService.formatFileSize(
            maxSize
          )}
        </p>
      </div>
    {/if}
  </div>
</div>

<style>
  .file-upload-container {
    width: 100%;
  }

  .drop-zone {
    border: 2px dashed #d1d5db;
    border-radius: 12px;
    padding: 48px 24px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
    background: #f9fafb;
  }

  .drop-zone:hover {
    border-color: #4f46e5;
    background: #f3f4f6;
  }

  .drop-zone.dragging {
    border-color: #4f46e5;
    background: #eef2ff;
    transform: scale(1.02);
  }

  .drop-zone.uploading {
    cursor: not-allowed;
    border-color: #9ca3af;
  }

  .drop-zone-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .upload-icon {
    color: #6b7280;
    margin-bottom: 8px;
  }

  .drop-zone.dragging .upload-icon {
    color: #4f46e5;
    animation: bounce 0.5s ease infinite;
  }

  @keyframes bounce {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-10px);
    }
  }

  .drop-zone-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #111827;
  }

  .drop-zone-subtitle {
    margin: 0;
    font-size: 14px;
    color: #6b7280;
  }

  .drop-zone-hint {
    margin: 0;
    font-size: 12px;
    color: #9ca3af;
  }

  .upload-status {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #e5e7eb;
    border-top-color: #4f46e5;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .upload-status p {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #111827;
  }

  .progress-list {
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .progress-item {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .progress-bar {
    flex: 1;
    height: 8px;
    background: #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #4f46e5, #6366f1);
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    min-width: 40px;
    text-align: right;
  }

  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    .drop-zone {
      background: #111827;
      border-color: #374151;
    }

    .drop-zone:hover {
      border-color: #6366f1;
      background: #1f2937;
    }

    .drop-zone.dragging {
      border-color: #6366f1;
      background: #1e1b4b;
    }

    .upload-icon {
      color: #9ca3af;
    }

    .drop-zone.dragging .upload-icon {
      color: #6366f1;
    }

    .drop-zone-title {
      color: #f9fafb;
    }

    .drop-zone-subtitle {
      color: #9ca3af;
    }

    .drop-zone-hint {
      color: #6b7280;
    }

    .upload-status p {
      color: #f9fafb;
    }

    .spinner {
      border-color: #374151;
      border-top-color: #6366f1;
    }

    .progress-bar {
      background: #374151;
    }

    .progress-fill {
      background: linear-gradient(90deg, #6366f1, #818cf8);
    }

    .progress-text {
      color: #9ca3af;
    }
  }
</style>

<script lang="ts">
  import FileUpload from "$lib/components/FileUpload.svelte";
  import {
    fileUploadService,
    type UploadedFile,
  } from "$lib/services/file-upload";
  import { goto } from "$app/navigation";

  let uploadedFiles = $state<UploadedFile[]>([]);
  let isLoading = $state(false);

  async function handleFilesUploaded(files: UploadedFile[]) {
    uploadedFiles = [...uploadedFiles, ...files];
  }

  function formatFileSize(bytes: number): string {
    return fileUploadService.formatFileSize(bytes);
  }

  function formatDate(date: Date): string {
    return new Date(date).toLocaleString();
  }

  async function handleDeleteFile(fileId: string) {
    if (confirm("Delete this file?")) {
      uploadedFiles = uploadedFiles.filter((f) => f.id !== fileId);
    }
  }
</script>

<div class="files-page">
  <div class="page-header">
    <div class="header-content">
      <button class="back-btn" onclick={() => goto("/dashboard")}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>
      <div>
        <h1>Files & Uploads</h1>
        <p>Upload and manage your files</p>
      </div>
    </div>
  </div>

  <div class="page-content">
    <!-- Upload Section -->
    <div class="upload-section">
      <h2>Upload Files</h2>
      <FileUpload onUploadComplete={handleFilesUploaded} />
    </div>

    <!-- Files List -->
    {#if uploadedFiles.length > 0}
      <div class="files-section">
        <h2>Your Files ({uploadedFiles.length})</h2>
        <div class="files-grid">
          {#each uploadedFiles as file}
            <div class="file-card">
              <div class="file-icon">
                {fileUploadService.getFileIcon(file.type)}
              </div>
              <div class="file-info">
                <h3 class="file-name">{file.name}</h3>
                <p class="file-meta">
                  {formatFileSize(file.size)} • {formatDate(file.uploadedAt)}
                </p>
                {#if file.thumbnail}
                  <img
                    src={file.thumbnail}
                    alt={file.name}
                    class="file-thumbnail"
                  />
                {/if}
              </div>
              <div class="file-actions">
                <a
                  href={file.url}
                  target="_blank"
                  class="action-btn"
                  title="View"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path d="M2 10s3-7 8-7 8 7 8 7-3 7-8 7-8-7-8-7z" />
                  </svg>
                </a>
                <button
                  class="action-btn"
                  onclick={() => navigator.clipboard.writeText(file.url)}
                  title="Copy link"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      d="M8 5H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M12 1h6m0 0v6m0-6L8 11"
                    />
                  </svg>
                </button>
                <button
                  class="action-btn danger"
                  onclick={() => handleDeleteFile(file.id)}
                  title="Delete"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M6 6l8 8M14 6l-8 8" />
                  </svg>
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <div class="empty-state">
        <svg
          width="64"
          height="64"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            d="M4 16v1a3 3 0 003 3h6a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m0-4v12"
          />
        </svg>
        <h3>No files uploaded yet</h3>
        <p>Upload your first file using the form above</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .files-page {
    min-height: 100vh;
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .page-header {
    background: var(--bg-card);
    border-bottom: 1px solid var(--border-color);
    padding: 24px;
  }

  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .back-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 8px;
    border-radius: 6px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
  }

  .back-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .page-header h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .page-header p {
    margin: 4px 0 0 0;
    font-size: 14px;
    color: var(--text-secondary);
  }

  .page-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px 24px;
  }

  .upload-section,
  .files-section {
    margin-bottom: 48px;
  }

  .upload-section h2,
  .files-section h2 {
    margin: 0 0 20px 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .files-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }

  .file-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    gap: 12px;
    transition: all 0.2s;
  }

  .file-card:hover {
    border-color: var(--accent-color);
    box-shadow: var(--shadow-md);
  }

  .file-icon {
    font-size: 32px;
    flex-shrink: 0;
  }

  .file-info {
    flex: 1;
    min-width: 0;
  }

  .file-name {
    margin: 0 0 4px 0;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-meta {
    margin: 0;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .file-thumbnail {
    margin-top: 8px;
    max-width: 100%;
    height: auto;
    border-radius: 4px;
  }

  .file-actions {
    display: flex;
    gap: 4px;
    align-items: flex-start;
  }

  .action-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 6px;
    border-radius: 4px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    text-decoration: none;
  }

  .action-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .action-btn.danger:hover {
    background: #dc2626;
    color: white;
  }

  .empty-state {
    text-align: center;
    padding: 80px 20px;
    color: var(--text-tertiary);
  }

  .empty-state svg {
    margin-bottom: 16px;
    color: var(--text-secondary);
  }

  .empty-state h3 {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .empty-state p {
    margin: 0;
    font-size: 14px;
    color: var(--text-tertiary);
  }
</style>

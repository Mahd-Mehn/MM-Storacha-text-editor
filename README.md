# Storacha Notes

A privacy-first, offline-capable note-taking application built with Svelte, Tiptap, and decentralized storage via Storacha.

## Features

- **Rich Text Editing**: Powered by Tiptap with formatting options (headings, bold, italic, lists)
- **Decentralized Storage**: Notes stored on Storacha network for privacy and data ownership
- **Offline Capability**: Continue editing offline with automatic sync when reconnected
- **No Account Required**: Uses UCAN authentication for decentralized identity
- **Version History**: Track and restore previous versions of your notes
- **Secure Sharing**: Share notes with read-only or editable permissions

## Development

Install dependencies:

```bash
bun install
```

Start the development server:

```bash
bun run dev
```

## Building

To create a production version:

```bash
bun run build
```

Preview the production build:

```bash
bun run preview
```

## Architecture

- **Frontend**: Svelte with TypeScript
- **Rich Text Editor**: Tiptap with Yjs for collaborative editing
- **Storage**: Storacha decentralized network
- **Authentication**: UCAN/w3up for decentralized identity
- **Offline Sync**: Yjs CRDTs for conflict-free synchronization

## Project Structure

```
src/
├── lib/
│   ├── components/     # Reusable Svelte components
│   ├── services/       # Business logic and managers
│   ├── stores/         # Svelte stores for state management
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Utility functions and helpers
├── routes/             # SvelteKit routes
└── app.html           # HTML template
```
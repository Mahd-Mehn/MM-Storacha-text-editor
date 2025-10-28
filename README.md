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

### Prerequisites

- Node.js 22+ and npm 7+
- Modern browser with IndexedDB support

### Installation

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Building

To create a production version:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

### Testing

Install Playwright for end-to-end testing:

```bash
npm install -D @playwright/test
npx playwright install
```

Run tests:

```bash
# Run all tests
npm test

# Run tests in UI mode
npm run test:ui

# Run tests in headed mode (see browser)
npm run test:headed

# Debug tests
npm run test:debug

# View test report
npm run test:report
```

### Code Quality

Check TypeScript types and Svelte components:

```bash
npm run check
```

Watch mode for continuous checking:

```bash
npm run check:watch
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
│   ├── components/          # Reusable Svelte components
│   │   ├── RichTextEditor.svelte
│   │   ├── VersionHistorySidebar.svelte
│   │   ├── VersionComparisonView.svelte
│   │   ├── ToastNotification.svelte
│   │   ├── ConnectionStatusIndicator.svelte
│   │   └── SyncStatusIndicator.svelte
│   ├── services/            # Business logic and managers
│   │   ├── auth.ts          # UCAN authentication
│   │   ├── space.ts         # Storacha space management
│   │   ├── storacha.ts      # Storacha client
│   │   ├── yjs-document.ts  # Yjs document management
│   │   ├── autosave.ts      # Auto-save functionality
│   │   ├── version-history.ts  # Version tracking
│   │   ├── offline-detection.ts  # Network monitoring
│   │   ├── offline-sync.ts  # Sync queue management
│   │   ├── local-storage.ts # IndexedDB operations
│   │   ├── hybrid-storage.ts  # Combined storage
│   │   ├── note-manager.ts  # Note CRUD operations
│   │   ├── error-handler.ts # Error handling
│   │   └── notification.ts  # Toast notifications
│   ├── stores/              # Svelte stores for state management
│   │   ├── auth.ts
│   │   ├── space.ts
│   │   ├── connectivity.ts
│   │   └── sync.ts
│   ├── types/               # TypeScript type definitions
│   │   ├── index.ts
│   │   └── auth.ts
│   └── utils/               # Utility functions and helpers
├── routes/                  # SvelteKit routes
│   ├── +layout.svelte       # App shell with initialization
│   ├── +page.svelte         # Home page
│   └── notes/
│       └── +page.svelte     # Notes list page
├── tests/
│   └── e2e/
│       └── app.test.ts      # End-to-end tests
└── app.html                 # HTML template
```

## Key Features Implementation

### 1. Decentralized Identity (UCAN)
- Automatic identity creation on first visit
- Ed25519 key pair generation
- No email or password required
- Identity stored securely in browser

### 2. Decentralized Storage (Storacha)
- Content-addressed storage via IPFS
- Automatic upload to Storacha network
- CID-based content retrieval
- Space management for organization

### 3. Offline-First Architecture
- IndexedDB for local storage
- Automatic sync when online
- Operation queuing during offline periods
- Conflict-free synchronization with Yjs CRDTs

### 4. Version History
- Automatic version creation on save with detailed metadata
- Advanced version comparison with side-by-side, inline, and unified diff views
- One-click version restoration
- Version metadata including change type, file size, and diff statistics
- Content hashing for quick comparison
- Tag-based version organization

See [VERSIONING.md](./VERSIONING.md) for detailed documentation on the versioning system.

### 5. Rich Text Editing
- Tiptap editor with extensions
- Markdown shortcuts
- Collaborative editing support (Yjs)
- Auto-save with debouncing

### 6. Error Handling & Recovery
- Automatic retry with exponential backoff
- Error categorization and severity levels
- Recovery strategies for common errors
- User-friendly error notifications

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive deployment instructions including:
- Vercel deployment
- Netlify deployment
- GitHub Pages deployment
- Cloudflare Pages deployment
- Self-hosted Docker deployment

## Performance Optimizations

- **Code Splitting**: Vendor chunks for better caching
- **Lazy Loading**: Components and routes loaded on demand
- **Minification**: esbuild for fast, efficient builds
- **Caching**: Aggressive caching of static assets
- **Tree Shaking**: Unused code elimination
- **Optimized Dependencies**: Pre-bundled vendor libraries

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers with IndexedDB support

## Security

- Client-side encryption for sensitive data
- No server-side data storage
- Decentralized identity (no central authority)
- Content-addressed storage (tamper-proof)
- HTTPS required for production

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- [Storacha](https://storacha.network) for decentralized storage
- [Tiptap](https://tiptap.dev) for the rich text editor
- [Yjs](https://yjs.dev) for CRDT synchronization
- [SvelteKit](https://kit.svelte.dev) for the framework
- [UCAN](https://ucan.xyz) for decentralized authentication

## Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Check the [documentation](./DEPLOYMENT.md)
- Review the [Storacha docs](https://docs.storacha.network)

---

Built with ❤️ using Svelte, Storacha, and modern web technologies.
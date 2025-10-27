import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	
	build: {
		// Code splitting and chunk optimization
		rollupOptions: {
			output: {
				manualChunks: {
					// Vendor chunks for better caching
					'vendor-svelte': ['svelte'],
					'vendor-yjs': ['yjs', 'y-websocket'],
					'vendor-tiptap': [
						'@tiptap/core',
						'@tiptap/starter-kit',
						'@tiptap/extension-collaboration',
						'@tiptap/extension-collaboration-cursor',
						'@tiptap/extension-typography'
					],
					'vendor-storacha': [
						'@storacha/client',
						'@web3-storage/w3up-client',
						'@ucanto/client',
						'@ucanto/principal'
					]
				}
			}
		},
		// Optimize chunk size
		chunkSizeWarningLimit: 1000,
		// Enable minification
		minify: 'esbuild',
		// Source maps for debugging (disable in production if needed)
		sourcemap: false
	},

	// Optimize dependencies
	optimizeDeps: {
		include: [
			'yjs',
			'@tiptap/core',
			'@tiptap/starter-kit',
			'@storacha/client'
		],
		exclude: ['@ucanto/principal/ed25519']
	},

	// Performance optimizations
	server: {
		fs: {
			// Allow serving files from project root
			strict: true
		}
	}
});

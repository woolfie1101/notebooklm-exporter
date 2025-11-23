import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        emptyOutDir: false, // Don't delete dist, as the main build runs first
        rollupOptions: {
            input: {
                content: resolve(__dirname, 'src/content/index.js')
            },
            output: {
                entryFileNames: 'assets/[name].js',
                format: 'iife', // IIFE for content script to avoid export issues
                name: 'NotebookLMExporterContent' // Global variable name for IIFE (required)
            }
        },
        outDir: 'dist'
    },
    // Ensure dependencies are bundled
    resolve: {
        alias: {
            // Add aliases if needed
        }
    }
});

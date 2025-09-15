import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig(() => ({
    plugins: [react(), tailwindcss()],

    // Environment-specific settings
    define: {
        // Make environment info available at build time
        __APP_VERSION__: JSON.stringify('1.0.0'),
        __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    build: {
        // Enable source maps for debugging in production (optional)
        sourcemap: false,

        // Optimize chunk size warnings
        chunkSizeWarningLimit: 200, // 200KB warning threshold

        rollupOptions: {
            output: {
                // Manual chunk splitting for better caching and loading
                manualChunks: {
                    // Core React dependencies
                    'react-vendor': ['react', 'react-dom'],

                    // Map-related dependencies (large libraries)
                    maps: ['leaflet', 'react-leaflet'],

                    // Chart dependencies
                    charts: ['recharts'],

                    // GPX processing utilities
                    'gpx-utils': ['@mapbox/togeojson', 'xml2js'],

                    // Utility libraries
                    utils: ['es-toolkit', 'file-saver'],

                    // UI components and icons
                    ui: ['lucide-react'],
                },

                // Generate consistent chunk names for better caching
                chunkFileNames: chunkInfo => {
                    const facadeModuleId = chunkInfo.facadeModuleId
                        ? chunkInfo.facadeModuleId
                              .split('/')
                              .pop()
                              ?.replace('.tsx', '')
                              .replace('.ts', '')
                        : 'chunk';
                    return `assets/${facadeModuleId}-[hash].js`;
                },

                // Optimize asset file names
                assetFileNames: assetInfo => {
                    const info = assetInfo.name?.split('.') ?? [];
                    const ext = info[info.length - 1];
                    if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext ?? '')) {
                        return `assets/images/[name]-[hash][extname]`;
                    }
                    return `assets/[name]-[hash][extname]`;
                },
            },
        },

        // Enable esbuild minification for better compression and speed
        minify: 'esbuild',

        // Optimize CSS
        cssMinify: true,
    },

    // Optimize dependency pre-bundling
    optimizeDeps: {
        include: [
            'react',
            'react-dom',
            'leaflet',
            'react-leaflet',
            'recharts',
            '@mapbox/togeojson',
            'es-toolkit',
            'file-saver',
            'lucide-react',
        ],
    },
}));

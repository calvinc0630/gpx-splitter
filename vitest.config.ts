/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

const commitSha = (() => {
    try {
        return execSync('git rev-parse --short HEAD').toString().trim();
    } catch {
        return 'test';
    }
})();

export default defineConfig({
    plugins: [react()],
    define: {
        __APP_VERSION__: JSON.stringify(commitSha),
        __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        coverage: {
            // Exclude unnecessary files from coverage
            exclude: [
                // Configuration files
                'tailwind.config.js',
                'eslint.config.js',
                'vite.config.ts',
                'vitest.config.ts',

                // Entry points (not testable in isolation)
                'src/main.tsx',

                // Type-only files
                'src/types/**',
                'src/**/*.d.ts',

                // Server-only configuration (not used in client)
                'src/config/security-headers.ts',

                // Re-export index files
                'src/**/index.ts',

                // Test files
                'src/test/**',
                'src/**/*.test.{ts,tsx}',

                // Build and config directories
                'dist/**',
                'node_modules/**',
                '.next/**',
            ],

            // Coverage thresholds for production quality
            thresholds: {
                global: {
                    lines: 90,
                    functions: 85,
                    branches: 85,
                    statements: 90,
                },
            },

            // Coverage reporting
            reporter: ['text', 'html', 'json-summary'],
            reportsDirectory: './coverage',
        },
    },
});

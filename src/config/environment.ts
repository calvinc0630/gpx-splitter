/**
 * Environment configuration for GPX Editor
 * Handles development vs production settings without external services
 */

export const CONFIG = {
    // Build environment
    NODE_ENV: import.meta.env.MODE,
    IS_PRODUCTION: import.meta.env.PROD,
    IS_DEVELOPMENT: import.meta.env.DEV,

    // Application settings
    APP_NAME: 'GPX Track Splitter',
    APP_VERSION: (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev') as string,

    // Feature flags for production optimization
    FEATURES: {
        // Enable detailed logging in development only
        VERBOSE_LOGGING: import.meta.env.DEV,

        // Enable React strict mode warnings in development
        REACT_STRICT_MODE: import.meta.env.DEV,

        // Enable performance profiling in development
        PERFORMANCE_PROFILING: import.meta.env.DEV,

        // Enable source maps in development only
        SOURCE_MAPS: import.meta.env.DEV,
    },

    // Security settings
    SECURITY: {
        // Content Security Policy settings
        CSP_ENABLED: import.meta.env.PROD,

        // Disable console in production (handled by build config)
        DISABLE_CONSOLE: import.meta.env.PROD,

        // Enable secure headers in production
        SECURE_HEADERS: import.meta.env.PROD,
    },

    // Performance settings
    PERFORMANCE: {
        // Preload critical resources in production
        PRELOAD_ASSETS: import.meta.env.PROD,

        // Enable service worker in production (future enhancement)
        SERVICE_WORKER: false, // Disabled for now

        // Cache strategy
        CACHE_STRATEGY: import.meta.env.PROD ? 'aggressive' : 'minimal',
    },
} as const;

/**
 * Utility function to check if we're in production
 */
export const isProduction = (): boolean => CONFIG.IS_PRODUCTION;

/**
 * Utility function to check if we're in development
 */
export const isDevelopment = (): boolean => CONFIG.IS_DEVELOPMENT;

/**
 * Safe console logging that respects environment
 * In production, only errors and warnings are logged
 */
export const logger = {
    error: (message: string, ...args: unknown[]) => {
        console.error(`[${CONFIG.APP_NAME}] ERROR:`, message, ...args);
    },

    warn: (message: string, ...args: unknown[]) => {
        console.warn(`[${CONFIG.APP_NAME}] WARN:`, message, ...args);
    },

    info: (message: string, ...args: unknown[]) => {
        if (CONFIG.FEATURES.VERBOSE_LOGGING) {
            // eslint-disable-next-line no-console
            console.info(`[${CONFIG.APP_NAME}] INFO:`, message, ...args);
        }
    },

    debug: (message: string, ...args: unknown[]) => {
        if (CONFIG.FEATURES.VERBOSE_LOGGING) {
            // eslint-disable-next-line no-console
            console.debug(`[${CONFIG.APP_NAME}] DEBUG:`, message, ...args);
        }
    },
};

/**
 * Environment-specific error handling
 * In production: Clean, user-friendly messages
 * In development: Detailed error information
 */
export const handleEnvironmentError = (error: Error, context: string): string => {
    if (CONFIG.IS_DEVELOPMENT) {
        logger.error(`${context}:`, error.stack || error.message);
        return `[DEV] ${context}: ${error.message}`;
    } else {
        logger.error(`${context}:`, error.message);
        return 'An unexpected error occurred. Please try again.';
    }
};

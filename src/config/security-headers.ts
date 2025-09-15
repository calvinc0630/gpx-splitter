/**
 * Content Security Policy configuration for production security
 * Helps prevent XSS, clickjacking, and other injection attacks
 * Minimal configuration for hobby project without external services
 */

import { CONFIG } from './environment';

/**
 * Generate CSP directives based on environment
 */
export const getCSPDirectives = (): string => {
    const baseDirectives = [
        // Default source - only allow same origin
        "default-src 'self'",

        // Scripts - allow self and inline for Vite in dev
        CONFIG.IS_DEVELOPMENT
            ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
            : "script-src 'self'",

        // Styles - allow self and inline for Tailwind
        "style-src 'self' 'unsafe-inline'",

        // Images - allow self, data URLs for icons, and HTTPS for map tiles
        "img-src 'self' data: https:",

        // Fonts - allow self and data URLs
        "font-src 'self' data:",

        // Connect - allow self only (no external APIs)
        "connect-src 'self'",

        // Media - allow self for potential audio/video features
        "media-src 'self'",

        // Objects - disallow all plugins for security
        "object-src 'none'",

        // Base URI - restrict base tag to same origin
        "base-uri 'self'",

        // Forms - only allow posting to same origin
        "form-action 'self'",

        // Frame ancestors - prevent clickjacking
        "frame-ancestors 'none'",

        // Block mixed content in production
        ...(CONFIG.IS_PRODUCTION ? ['block-all-mixed-content'] : []),

        // Upgrade insecure requests in production
        ...(CONFIG.IS_PRODUCTION ? ['upgrade-insecure-requests'] : []),
    ];

    return baseDirectives.join('; ');
};

/**
 * Additional security headers for production
 */
export const getSecurityHeaders = (): Record<string, string> => {
    if (!CONFIG.SECURITY.SECURE_HEADERS) {
        return {};
    }

    return {
        // Content Security Policy
        'Content-Security-Policy': getCSPDirectives(),

        // Prevent MIME type sniffing
        'X-Content-Type-Options': 'nosniff',

        // Enable XSS protection
        'X-XSS-Protection': '1; mode=block',

        // Prevent clickjacking
        'X-Frame-Options': 'DENY',

        // Control referrer information
        'Referrer-Policy': 'strict-origin-when-cross-origin',

        // Require HTTPS in production
        ...(CONFIG.IS_PRODUCTION && {
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        }),

        // Permissions policy (formerly Feature Policy)
        'Permissions-Policy': [
            'camera=()',
            'microphone=()',
            'geolocation=()',
            'notifications=()',
            'push=()',
            'sync-xhr=()',
            'magnetometer=()',
            'gyroscope=()',
            'accelerometer=()',
        ].join(', '),
    };
};

/**
 * Apply security headers to HTML template (for static hosting)
 */
export const getMetaSecurityTags = (): string => {
    if (!CONFIG.SECURITY.SECURE_HEADERS) {
        return '';
    }

    const headers = getSecurityHeaders();

    return Object.entries(headers)
        .map(([name, value]) => `<meta http-equiv="${name}" content="${value}">`)
        .join('\n    ');
};

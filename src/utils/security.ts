/**
 * Security utilities for GPX file processing
 *
 * CLIENT-SIDE SECURITY MODEL:
 * Since this is a client-side React app, we protect against:
 * 1. XSS: Malicious content in GPX files that could execute in the browser
 * 2. XXE: XML External Entity attacks that could leak data or cause requests
 * 3. Browser Performance Issues: Large files that could crash/freeze the browser
 *
 * Note: Traditional server-side DoS protection doesn't apply here since:
 * - Files are processed locally in the user's browser
 * - No server resources are consumed
 * - User can only affect their own browser performance
 */

export class SecurityError extends Error {
    public readonly type: 'XSS' | 'XXE' | 'PERFORMANCE';

    constructor(message: string, type: 'XSS' | 'XXE' | 'PERFORMANCE') {
        super(message);
        this.name = 'SecurityError';
        this.type = type;
    }
}

// Configuration for client-side performance and security limits
export const SECURITY_LIMITS = {
    // File size limits (in bytes) - to prevent browser memory exhaustion
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB - reasonable for client-side processing
    MAX_POINTS: 50000, // Maximum track points - to keep UI responsive
    MAX_WAYPOINTS: 1000, // Maximum waypoints - to keep map rendering smooth
    MAX_STRING_LENGTH: 1000, // Maximum length for text fields

    // Processing timeouts (in milliseconds) - to prevent UI freezing
    PARSE_TIMEOUT: 10000, // 10 seconds - reasonable for client-side parsing

    // XSS prevention
    ALLOWED_HTML_TAGS: [], // No HTML tags allowed
    MAX_TEXT_FIELD_LENGTH: 500, // Max length for user-visible text
} as const;

/**
 * Sanitizes text content to prevent XSS attacks
 * Removes HTML tags, scripts, and potentially dangerous content
 */
export const sanitizeText = (input: string | null | undefined): string => {
    if (!input) return '';

    let sanitized = String(input).trim();

    // Limit length to prevent excessive content
    if (sanitized.length > SECURITY_LIMITS.MAX_TEXT_FIELD_LENGTH) {
        sanitized = sanitized.substring(0, SECURITY_LIMITS.MAX_TEXT_FIELD_LENGTH) + '...';
    }

    // Remove HTML tags and entities
    sanitized = sanitized
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/javascript:/gi, '') // Remove javascript: protocols
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers like onclick="..."
        .replace(/on\w+\s*=\s*[^"'\s]+/gi, '') // Remove event handlers without quotes
        .replace(/data:/gi, '') // Remove data: URLs
        .replace(/vbscript:/gi, ''); // Remove vbscript: protocols

    // Remove control characters except newlines and tabs
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized;
};

/**
 * Validates and sanitizes waypoint data to prevent XSS
 */
export const sanitizeWaypoint = (waypoint: {
    name?: string;
    description?: string;
    symbol?: string;
    [key: string]: unknown;
}): {
    name?: string;
    description?: string;
    symbol?: string;
    [key: string]: unknown;
} => {
    const sanitized = { ...waypoint };

    if (sanitized.name) {
        sanitized.name = sanitizeText(sanitized.name);
    }

    if (sanitized.description) {
        sanitized.description = sanitizeText(sanitized.description);
    }

    if (sanitized.symbol) {
        sanitized.symbol = sanitizeText(sanitized.symbol);
    }

    return sanitized;
};

/**
 * Checks for XXE (XML External Entity) attacks in XML content
 */
export const validateXmlSecurity = (xmlContent: string): void => {
    // Check for external entity declarations
    const xxePatterns = [
        {
            pattern: /<!ENTITY\s+\w+\s+SYSTEM/i,
            message:
                'XML contains SYSTEM entity references which are not allowed for security reasons',
        },
        {
            pattern: /<!ENTITY\s+\w+\s+PUBLIC/i,
            message:
                'XML contains PUBLIC entity references which are not allowed for security reasons',
        },
        {
            pattern: /<!ENTITY\s+%\s*\w+/i,
            message:
                'XML contains parameter entity references which are not allowed for security reasons',
        },
        {
            pattern: /&\w+;/,
            message:
                'XML contains external entity references which are not allowed for security reasons',
        },
    ];

    for (const { pattern, message } of xxePatterns) {
        if (pattern.test(xmlContent)) {
            throw new SecurityError(message, 'XXE');
        }
    }

    // Check for DOCTYPE declarations with external references
    const doctypeMatch = xmlContent.match(/<!DOCTYPE[^>]*>/i);
    if (doctypeMatch) {
        const doctype = doctypeMatch[0];
        if (doctype.includes('SYSTEM') || doctype.includes('PUBLIC')) {
            throw new SecurityError('XML DOCTYPE with external references is not allowed', 'XXE');
        }
    }
};

/**
 * Validates file size to prevent browser memory exhaustion
 * Client-side apps can crash the browser tab with extremely large files
 */
export const validateFileSize = (file: File): void => {
    if (file.size > SECURITY_LIMITS.MAX_FILE_SIZE) {
        throw new SecurityError(
            `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds maximum allowed size of ${SECURITY_LIMITS.MAX_FILE_SIZE / 1024 / 1024}MB. Large files can cause browser performance issues or crashes.`,
            'PERFORMANCE'
        );
    }
};

/**
 * Validates parsed GPX data to prevent UI performance issues
 * Large datasets can make the browser unresponsive
 */
export const validateGpxData = (data: { points: unknown[]; waypoints?: unknown[] }): void => {
    if (data.points.length > SECURITY_LIMITS.MAX_POINTS) {
        throw new SecurityError(
            `Track contains ${data.points.length} points, which exceeds the maximum allowed ${SECURITY_LIMITS.MAX_POINTS} points. Large tracks can cause browser performance issues.`,
            'PERFORMANCE'
        );
    }

    if (data.waypoints && data.waypoints.length > SECURITY_LIMITS.MAX_WAYPOINTS) {
        throw new SecurityError(
            `Track contains ${data.waypoints.length} waypoints, which exceeds the maximum allowed ${SECURITY_LIMITS.MAX_WAYPOINTS} waypoints. Many waypoints can slow down map rendering.`,
            'PERFORMANCE'
        );
    }
};

/**
 * Creates a secure XML parser with timeout protection
 */
export const createSecureParser = (): {
    parseFromString: (xmlString: string, mimeType: DOMParserSupportedType) => Document;
} => {
    const parser = new DOMParser();

    return {
        parseFromString: (xmlString: string, mimeType: DOMParserSupportedType): Document => {
            // Validate security before parsing
            validateXmlSecurity(xmlString);

            // Parse with timeout protection
            const startTime = Date.now();
            const doc = parser.parseFromString(xmlString, mimeType);
            const parseTime = Date.now() - startTime;

            if (parseTime > SECURITY_LIMITS.PARSE_TIMEOUT) {
                throw new SecurityError(
                    `XML parsing took ${parseTime}ms, which exceeds the timeout of ${SECURITY_LIMITS.PARSE_TIMEOUT}ms`,
                    'PERFORMANCE'
                );
            }

            return doc;
        },
    };
};

/**
 * Wraps an async operation with timeout protection to prevent UI freezing
 * Long-running operations can make the browser unresponsive
 */
export const withTimeout = <T>(
    operation: Promise<T>,
    timeoutMs: number = SECURITY_LIMITS.PARSE_TIMEOUT
): Promise<T> => {
    return Promise.race([
        operation,
        new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(
                    new SecurityError(
                        `Operation timed out after ${timeoutMs}ms. This prevents the browser from freezing during long operations.`,
                        'PERFORMANCE'
                    )
                );
            }, timeoutMs);
        }),
    ]);
};

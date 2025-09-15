import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    CONFIG,
    isProduction,
    isDevelopment,
    logger,
    handleEnvironmentError,
} from '../config/environment';

describe('Environment Configuration', () => {
    describe('CONFIG constants', () => {
        it('has correct app information', () => {
            expect(CONFIG.APP_NAME).toBe('GPX Track Splitter');
            expect(CONFIG.APP_VERSION).toBe('1.0.0');
            expect(typeof CONFIG.NODE_ENV).toBe('string');
            expect(typeof CONFIG.IS_PRODUCTION).toBe('boolean');
            expect(typeof CONFIG.IS_DEVELOPMENT).toBe('boolean');
        });

        it('has feature flags', () => {
            expect(typeof CONFIG.FEATURES.VERBOSE_LOGGING).toBe('boolean');
            expect(typeof CONFIG.FEATURES.REACT_STRICT_MODE).toBe('boolean');
            expect(typeof CONFIG.FEATURES.PERFORMANCE_PROFILING).toBe('boolean');
            expect(typeof CONFIG.FEATURES.SOURCE_MAPS).toBe('boolean');
        });

        it('has security settings', () => {
            expect(typeof CONFIG.SECURITY.CSP_ENABLED).toBe('boolean');
            expect(typeof CONFIG.SECURITY.DISABLE_CONSOLE).toBe('boolean');
            expect(typeof CONFIG.SECURITY.SECURE_HEADERS).toBe('boolean');
        });

        it('has performance settings', () => {
            expect(typeof CONFIG.PERFORMANCE.PRELOAD_ASSETS).toBe('boolean');
            expect(CONFIG.PERFORMANCE.SERVICE_WORKER).toBe(false);
            expect(['aggressive', 'minimal']).toContain(CONFIG.PERFORMANCE.CACHE_STRATEGY);
        });
    });

    describe('Utility functions', () => {
        it('isProduction returns boolean', () => {
            expect(typeof isProduction()).toBe('boolean');
            expect(isProduction()).toBe(CONFIG.IS_PRODUCTION);
        });

        it('isDevelopment returns boolean', () => {
            expect(typeof isDevelopment()).toBe('boolean');
            expect(isDevelopment()).toBe(CONFIG.IS_DEVELOPMENT);
        });
    });

    describe('Logger', () => {
        beforeEach(() => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            vi.spyOn(console, 'info').mockImplementation(() => {});
            vi.spyOn(console, 'debug').mockImplementation(() => {});
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('always logs errors and warnings', () => {
            logger.error('Test error', 'arg1');
            logger.warn('Test warning', 'arg2');

            expect(console.error).toHaveBeenCalledWith(
                `[${CONFIG.APP_NAME}] ERROR:`,
                'Test error',
                'arg1'
            );
            expect(console.warn).toHaveBeenCalledWith(
                `[${CONFIG.APP_NAME}] WARN:`,
                'Test warning',
                'arg2'
            );
        });

        it('logs info and debug based on verbose setting', () => {
            logger.info('Test info');
            logger.debug('Test debug');

            if (CONFIG.FEATURES.VERBOSE_LOGGING) {
                // eslint-disable-next-line no-console
                expect(console.info).toHaveBeenCalledWith(
                    `[${CONFIG.APP_NAME}] INFO:`,
                    'Test info'
                );
                // eslint-disable-next-line no-console
                expect(console.debug).toHaveBeenCalledWith(
                    `[${CONFIG.APP_NAME}] DEBUG:`,
                    'Test debug'
                );
            } else {
                // eslint-disable-next-line no-console
                expect(console.info).not.toHaveBeenCalled();
                // eslint-disable-next-line no-console
                expect(console.debug).not.toHaveBeenCalled();
            }
        });
    });

    describe('handleEnvironmentError', () => {
        beforeEach(() => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('handles errors with environment-specific messages', () => {
            const testError = new Error('Test error message');
            const context = 'Test Context';

            const result = handleEnvironmentError(testError, context);

            expect(console.error).toHaveBeenCalled();

            if (CONFIG.IS_DEVELOPMENT) {
                expect(result).toContain('[DEV]');
                expect(result).toContain('Test error message');
            } else {
                expect(result).toBe('An unexpected error occurred. Please try again.');
            }
        });
    });
});

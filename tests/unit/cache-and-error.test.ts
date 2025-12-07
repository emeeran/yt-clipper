/**
 * Tests for PersistentCacheService
 */

import { PersistentCacheService } from '../../src/services/cache/persistent-cache';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: jest.fn((key: string) => store[key] || null),
        setItem: jest.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            store = {};
        }),
        get length() {
            return Object.keys(store).length;
        },
        key: jest.fn((index: number) => Object.keys(store)[index] || null),
    };
})();

Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
});

describe('PersistentCacheService', () => {
    let cache: PersistentCacheService;

    beforeEach(() => {
        localStorageMock.clear();
        jest.clearAllMocks();
        cache = new PersistentCacheService({
            namespace: 'test',
            maxItems: 10,
            defaultTTL: 60000,
        });
    });

    describe('basic operations', () => {
        it('should set and get items', () => {
            cache.set('key1', { data: 'test' });
            const result = cache.get<{ data: string }>('key1');
            expect(result).toEqual({ data: 'test' });
        });

        it('should return null for non-existent keys', () => {
            const result = cache.get('nonexistent');
            expect(result).toBeNull();
        });

        it('should delete items', () => {
            cache.set('key1', 'value1');
            expect(cache.has('key1')).toBe(true);
            
            cache.delete('key1');
            expect(cache.has('key1')).toBe(false);
        });

        it('should clear all items', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            
            cache.clear();
            
            expect(cache.size()).toBe(0);
        });
    });

    describe('expiration', () => {
        it('should return null for expired items', () => {
            // Set item with 1ms TTL
            cache.set('expiring', 'data', 1);
            
            // Wait for expiration
            return new Promise<void>(resolve => {
                setTimeout(() => {
                    const result = cache.get('expiring');
                    expect(result).toBeNull();
                    resolve();
                }, 10);
            });
        });
    });

    describe('capacity management', () => {
        it('should evict oldest items when at capacity', () => {
            // Fill cache to capacity
            for (let i = 0; i < 10; i++) {
                cache.set(`key${i}`, `value${i}`);
            }
            
            expect(cache.size()).toBe(10);
            
            // Add one more item
            cache.set('key10', 'value10');
            
            // First item should be evicted
            expect(cache.has('key0')).toBe(false);
            expect(cache.has('key10')).toBe(true);
        });
    });

    describe('metrics', () => {
        it('should track hits and misses', () => {
            cache.set('key1', 'value1');
            
            cache.get('key1'); // hit
            cache.get('key2'); // miss
            cache.get('key1'); // hit
            
            const metrics = cache.getMetrics();
            expect(metrics.hits).toBe(2);
            expect(metrics.misses).toBe(1);
            expect(metrics.hitRate).toBeCloseTo(0.67, 1);
        });
    });

    describe('storage stats', () => {
        it('should return storage statistics', () => {
            cache.set('key1', { data: 'test data' });
            cache.set('key2', { data: 'more data' });
            
            const stats = cache.getStorageStats();
            expect(stats.itemCount).toBe(2);
            expect(stats.estimatedBytes).toBeGreaterThan(0);
            expect(stats.maxItems).toBe(10);
        });
    });
});

describe('ErrorHandler', () => {
    // Import after mocking
    const { ErrorHandler, ErrorCategory } = require('../../src/services/error-handler');

    describe('classifyError', () => {
        it('should classify network errors', () => {
            const error = new Error('Network error: fetch failed');
            const result = ErrorHandler.classifyError(error);
            
            expect(result.category).toBe(ErrorCategory.NETWORK);
            expect(result.retryable).toBe(true);
        });

        it('should classify quota errors', () => {
            const error = new Error('API quota exceeded');
            const result = ErrorHandler.classifyError(error);
            
            expect(result.category).toBe(ErrorCategory.QUOTA);
        });

        it('should classify auth errors', () => {
            const error = new Error('401 Unauthorized - Invalid API key');
            const result = ErrorHandler.classifyError(error);
            
            expect(result.category).toBe(ErrorCategory.AUTH);
            expect(result.retryable).toBe(false);
        });

        it('should classify rate limit errors as retryable', () => {
            const error = new Error('Rate limit exceeded');
            const result = ErrorHandler.classifyError(error);
            
            expect(result.category).toBe(ErrorCategory.QUOTA);
            expect(result.retryable).toBe(true);
        });
    });

    describe('isQuotaError', () => {
        it('should detect quota errors', () => {
            expect(ErrorHandler.isQuotaError(new Error('quota exceeded'))).toBe(true);
            expect(ErrorHandler.isQuotaError(new Error('rate limit'))).toBe(true);
            expect(ErrorHandler.isQuotaError(new Error('429 Too Many Requests'))).toBe(true);
        });

        it('should not detect non-quota errors', () => {
            expect(ErrorHandler.isQuotaError(new Error('Invalid URL'))).toBe(false);
            expect(ErrorHandler.isQuotaError(new Error('Network error'))).toBe(false);
        });
    });

    describe('extractProviderName', () => {
        it('should extract provider from error message', () => {
            expect(ErrorHandler.extractProviderName(new Error('Gemini API error'))).toBe('Google Gemini');
            expect(ErrorHandler.extractProviderName(new Error('Groq rate limit'))).toBe('Groq');
            expect(ErrorHandler.extractProviderName(new Error('OpenAI error'))).toBe('OpenAI');
        });

        it('should return default for unknown providers', () => {
            expect(ErrorHandler.extractProviderName(new Error('Unknown error'), 'Custom')).toBe('Custom');
        });
    });
});

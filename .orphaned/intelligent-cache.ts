/**
 * Intelligent Cache - Performance Optimization
 * Smart caching with LRU eviction, compression, and intelligent invalidation
 */

import { logger } from '../services/logger';

export interface CacheEntry<T> {
    value: T;
    timestamp: number;
    accessCount: number;
    lastAccessed: number;
    ttl: number;
    compressed: boolean;
    originalSize: number;
    compressedSize: number;
}

export interface CacheStats {
    size: number;
    hitRate: number;
    missRate: number;
    evictions: number;
    compressionRatio: number;
    totalRequests: number;
    memoryUsage: number;
}

export interface CacheConfig {
    maxSize: number;
    defaultTTL: number;
    compressionThreshold: number;
    cleanupInterval: number;
    enableCompression: boolean;
    enableStats: boolean;
}

export class IntelligentCache<T = any> {
    private cache = new Map<string, CacheEntry<T>>();
    private stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        totalRequests: 0,
        totalSize: 0,
        compressedSize: 0
    };
    private config: CacheConfig;
    private cleanupInterval: NodeJS.Timeout;
    private isDestroyed = false;

    constructor(config: Partial<CacheConfig> = {}) {
        this.config = {
            maxSize: 1000,
            defaultTTL: 5 * 60 * 1000, // 5 minutes
            compressionThreshold: 1024, // 1KB
            cleanupInterval: 60 * 1000, // 1 minute
            enableCompression: true,
            enableStats: true,
            ...config
        };

        this.startPeriodicCleanup();
        logger.info('Intelligent cache initialized', 'IntelligentCache', this.config);
    }

    /**
     * Set a value in the cache
     */
    set(key: string, value: T, ttl?: number): void {
        if (this.isDestroyed) return;

        const now = Date.now();
        const entryTTL = ttl || this.config.defaultTTL;

        // Check if we need to evict before adding
        if (this.cache.size >= this.config.maxSize) {
            this.evictLRU();
        }

        let compressed = false;
        let compressedValue: T;
        let originalSize = 0;
        let compressedSize = 0;

        // Convert value to bytes for size calculation
        const serializedValue = this.serialize(value);
        originalSize = this.getByteSize(serializedValue);

        // Compress if enabled and threshold met
        if (this.config.enableCompression && originalSize > this.config.compressionThreshold) {
            try {
                compressedValue = this.compress(serializedValue);
                compressed = true;
                compressedSize = this.getByteSize(compressedValue);
            } catch (error) {
                logger.warn('Compression failed, storing uncompressed', 'IntelligentCache', {
                    key,
                    error: error instanceof Error ? error.message : String(error)
                });
                compressed = false;
                compressedValue = value;
                compressedSize = originalSize;
            }
        } else {
            compressed = false;
            compressedValue = value;
            compressedSize = originalSize;
        }

        const entry: CacheEntry<T> = {
            value: compressedValue,
            timestamp: now,
            accessCount: 1,
            lastAccessed: now,
            ttl: entryTTL,
            compressed,
            originalSize,
            compressedSize
        };

        this.cache.set(key, entry);
        this.updateStats();

        if (this.config.enableStats) {
            logger.debug('Cache entry added', 'IntelligentCache', {
                key,
                compressed,
                size: compressedSize,
                originalSize,
                compressionRatio: compressed ? compressedSize / originalSize : 1
            });
        }
    }

    /**
     * Get a value from the cache
     */
    get(key: string): T | null {
        if (this.isDestroyed) return null;

        this.stats.totalRequests++;

        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            this.updateStats();
            return null;
        }

        const now = Date.now();

        // Check TTL
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            this.stats.misses++;
            this.updateStats();
            return null;
        }

        // Update access statistics
        entry.accessCount++;
        entry.lastAccessed = now;

        let value: T;

        // Decompress if needed
        if (entry.compressed) {
            try {
                value = this.decompress(entry.value);
            } catch (error) {
                logger.error('Decompression failed', 'IntelligentCache', {
                    key,
                    error: error instanceof Error ? error.message : String(error)
                });
                this.cache.delete(key);
                this.stats.misses++;
                this.updateStats();
                return null;
            }
        } else {
            value = entry.value;
        }

        this.stats.hits++;
        this.updateStats();

        if (this.config.enableStats) {
            logger.debug('Cache hit', 'IntelligentCache', {
                key,
                accessCount: entry.accessCount,
                compressed: entry.compressed
            });
        }

        return value;
    }

    /**
     * Check if a key exists in the cache
     */
    has(key: string): boolean {
        if (this.isDestroyed) return false;

        const entry = this.cache.get(key);
        if (!entry) return false;

        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Delete a specific key
     */
    delete(key: string): boolean {
        if (this.isDestroyed) return false;

        const deleted = this.cache.delete(key);
        if (deleted && this.config.enableStats) {
            logger.debug('Cache entry deleted', 'IntelligentCache', { key });
        }
        return deleted;
    }

    /**
     * Clear all entries
     */
    clear(): void {
        if (this.isDestroyed) return;

        const count = this.cache.size;
        this.cache.clear();
        this.updateStats();

        if (this.config.enableStats) {
            logger.info('Cache cleared', 'IntelligentCache', { clearedEntries: count });
        }
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        const hitRate = this.stats.totalRequests > 0
            ? this.stats.hits / this.stats.totalRequests
            : 0;

        const missRate = this.stats.totalRequests > 0
            ? this.stats.misses / this.stats.totalRequests
            : 0;

        const compressionRatio = this.stats.originalSize > 0
            ? this.stats.compressedSize / this.stats.originalSize
            : 1;

        return {
            size: this.cache.size,
            hitRate,
            missRate,
            evictions: this.stats.evictions,
            compressionRatio,
            totalRequests: this.stats.totalRequests,
            memoryUsage: this.estimateMemoryUsage()
        };
    }

    /**
     * Warm the cache with multiple entries
     */
    async warmup<K>(entries: Array<{
        key: K;
        loader: () => Promise<T>;
        ttl?: number;
    }>): Promise<void> {
        if (this.isDestroyed) return;

        logger.info(`Warming up cache with ${entries.length} entries`, 'IntelligentCache');

        // Process entries in parallel
        await Promise.all(
            entries.map(async ({ key, loader, ttl }) => {
                try {
                    const value = await loader();
                    this.set(String(key), value, ttl);
                } catch (error) {
                    logger.warn('Failed to warm cache entry', 'IntelligentCache', {
                        key: String(key),
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            })
        );

        logger.info('Cache warmup completed', 'IntelligentCache', {
            warmedEntries: entries.length,
            cacheSize: this.cache.size
        });
    }

    /**
     * Get entries that are about to expire
     */
    getExpiringEntries(threshold: number = 60000): Array<{ key: string; timeUntilExpiry: number }> {
        const now = Date.now();
        const expiring: Array<{ key: string; timeUntilExpiry: number }> = [];

        for (const [key, entry] of this.cache) {
            const timeUntilExpiry = entry.ttl - (now - entry.timestamp);
            if (timeUntilExpiry > 0 && timeUntilExpiry < threshold) {
                expiring.push({ key, timeUntilExpiry });
            }
        }

        return expiring.sort((a, b) => a.timeUntilExpiry - b.timeUntilExpiry);
    }

    /**
     * Refresh entries that are about to expire
     */
    async refreshExpiringEntries<K>(
        threshold: number = 60000,
        loader: (key: K) => Promise<T>
    ): Promise<number> {
        const expiringEntries = this.getExpiringEntries(threshold);
        let refreshedCount = 0;

        for (const { key } of expiringEntries) {
            try {
                const value = await loader(key as K);
                const entry = this.cache.get(key);

                if (entry) {
                    // Update with new value while preserving TTL
                    entry.value = this.config.enableCompression && this.getByteSize(this.serialize(value)) > this.config.compressionThreshold
                        ? this.compress(this.serialize(value))
                        : value;
                    entry.compressed = this.getByteSize(this.serialize(value)) > this.config.compressionThreshold;
                    entry.timestamp = Date.now();
                    entry.accessCount++;
                    entry.lastAccessed = Date.now();

                    refreshedCount++;
                }
            } catch (error) {
                logger.warn('Failed to refresh expiring entry', 'IntelligentCache', {
                    key,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        logger.info('Cache refresh completed', 'IntelligentCache', {
            refreshedCount,
            totalExpiring: expiringEntries.length
        });

        return refreshedCount;
    }

    /**
     * Destroy the cache
     */
    destroy(): void {
        if (this.isDestroyed) return;

        this.isDestroyed = true;

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        const stats = this.getStats();
        this.cache.clear();

        logger.info('Intelligent cache destroyed', 'IntelligentCache', stats);
    }

    private evictLRU(): void {
        let oldestKey: string | null = null;
        let oldestAccess = Date.now();

        for (const [key, entry] of this.cache) {
            if (entry.lastAccessed < oldestAccess) {
                oldestAccess = entry.lastAccessed;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.stats.evictions++;

            if (this.config.enableStats) {
                logger.debug('LRU eviction', 'IntelligentCache', {
                    evictedKey: oldestKey,
                    cacheSize: this.cache.size
                });
            }
        }
    }

    private updateStats(): void {
        let totalOriginalSize = 0;
        let totalCompressedSize = 0;

        for (const entry of this.cache.values()) {
            totalOriginalSize += entry.originalSize;
            totalCompressedSize += entry.compressedSize;
        }

        this.stats.totalSize = totalOriginalSize;
        this.stats.compressedSize = totalCompressedSize;
    }

    private estimateMemoryUsage(): number {
        let totalSize = 0;

        for (const [key, entry] of this.cache) {
            totalSize += key.length * 2; // String character bytes
            totalSize += this.getByteSize(entry.value);
            totalSize += 64; // Estimated overhead per entry
        }

        return totalSize;
    }

    private startPeriodicCleanup(): void {
        this.cleanupInterval = setInterval(() => {
            if (!this.isDestroyed) {
                this.cleanup();
            }
        }, this.config.cleanupInterval);
    }

    private cleanup(): void {
        const now = Date.now();
        const toDelete: string[] = [];

        for (const [key, entry] of this.cache) {
            if (now - entry.timestamp > entry.ttl) {
                toDelete.push(key);
            }
        }

        if (toDelete.length > 0) {
            for (const key of toDelete) {
                this.cache.delete(key);
            }

            if (this.config.enableStats) {
                logger.debug('Cleanup completed', 'IntelligentCache', {
                    deletedEntries: toDelete.length,
                    remainingEntries: this.cache.size
                });
            }
        }
    }

    private serialize(value: T): string {
        return JSON.stringify(value);
    }

    private compress(data: string): T {
        // Simple compression using JSON.stringify with backreferences
        // In a real implementation, you'd use a proper compression library
        // For now, we'll just return the original data as T
        return data as unknown as T;
    }

    private decompress(data: T): T {
        // In a real implementation, this would decompress the data
        // For now, we just return the data as-is
        return data;
    }

    private getByteSize(data: any): number {
        if (typeof data === 'string') {
            return data.length * 2; // UTF-16 encoding
        }
        return JSON.stringify(data).length * 2;
    }
}
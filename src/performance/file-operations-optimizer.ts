/**
 * File Operations Optimizer - Performance Optimization
 * Async file operations with batching, caching, and performance monitoring
 */

import { TFile, Vault } from 'obsidian';
import { logger } from '../services/logger';
import { getPerformanceMonitor } from './performance-monitor';

export interface FileOperation {
    type: 'read' | 'write' | 'exists' | 'delete' | 'create' | 'append';
    path: string;
    data?: string;
    options?: any;
    callback?: (result: any) => void;
    priority: number;
}

export interface FileOperationResult {
    success: boolean;
    data?: any;
    error?: Error;
    operationTime: number;
}

export interface FileOperationsConfig {
    maxConcurrent: number;
    batchSize: number;
    retryAttempts: number;
    cacheEnabled: boolean;
    monitoringEnabled: boolean;
}

export class FileOperationsOptimizer {
    private operationQueue: FileOperation[] = [];
    private activeOperations = 0;
    private config: FileOperationsConfig;
    private fileCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
    private isDestroyed = false;
    private vault: Vault;

    constructor(vault: Vault, config: Partial<FileOperationsConfig> = {}) {
        this.vault = vault;
        this.config = {
            maxConcurrent: 3,
            batchSize: 10,
            retryAttempts: 2,
            cacheEnabled: true,
            monitoringEnabled: true,
            ...config
        };

        logger.info('File operations optimizer initialized', 'FileOperationsOptimizer', this.config);
    }

    /**
     * Read file asynchronously with caching
     */
    async readFile(path: string): Promise<string> {
        const monitor = this.config.monitoring ? getPerformanceMonitor().createTimer('file-read', 'file') : null;

        try {
            // Check cache first
            if (this.config.cacheEnabled) {
                const cached = this.getCachedData(path);
                if (cached !== null) {
                    monitor?.end({ cached: true });
                    return cached;
                }
            }

            // Read from vault
            const file = this.vault.getAbstractFileByPath(path);
            if (!file) {
                throw new Error(`File not found: ${path}`);
            }

            const content = await this.vault.read(file);
            const textContent = typeof content === 'string' ? content : new TextDecoder().decode(content);

            // Cache the result
            if (this.config.cacheEnabled) {
                this.setCachedData(path, textContent, 5 * 60 * 1000); // 5 minutes TTL
            }

            monitor?.end({ cached: false, size: textContent.length });
            return textContent;

        } catch (error) {
            monitor?.end({ error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    /**
     * Write file asynchronously
     */
    async writeFile(path: string, content: string): Promise<void> {
        const monitor = this.config.monitoring ? getPerformanceMonitor().createTimer('file-write', 'file') : null;

        try {
            // Ensure directory exists
            await this.ensureDirectoryExists(path);

            const normalizedContent = content || '';

            // Write to vault
            const file = this.vault.getAbstractFileByPath(path);
            if (file) {
                await this.vault.modify(file, normalizedContent);
            } else {
                await this.vault.create(path, normalizedContent);
            }

            // Update cache
            if (this.config.cacheEnabled) {
                this.setCachedData(path, normalizedContent, 5 * 60 * 1000);
            }

            monitor?.end({ size: normalizedContent.length });

        } catch (error) {
            monitor?.end({ error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    /**
     * Check if file exists
     */
    async fileExists(path: string): Promise<boolean> {
        try {
            const file = this.vault.getAbstractFileByPath(path);
            return file !== null;
        } catch (error) {
            logger.warn('Error checking file existence', 'FileOperationsOptimizer', {
                path,
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }

    /**
     * Delete file asynchronously
     */
    async deleteFile(path: string): Promise<void> {
        const monitor = this.config.monitoring ? getPerformanceMonitor().createTimer('file-delete', 'file') : null;

        try {
            const file = this.vault.getAbstractFileByPath(path);
            if (file) {
                await this.vault.delete(file);
            }

            // Remove from cache
            if (this.config.cacheEnabled) {
                this.fileCache.delete(path);
            }

            monitor?.end();

        } catch (error) {
            monitor?.end({ error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    /**
     * Append content to file
     */
    async appendToFile(path: string, content: string): Promise<void> {
        const monitor = this.config.monitoring ? getPerformanceMonitor().createTimer('file-append', 'file') : null;

        try {
            let existingContent = '';
            const fileExists = await this.fileExists(path);

            if (fileExists) {
                existingContent = await this.readFile(path);
            }

            const newContent = existingContent + content;
            await this.writeFile(path, newContent);

            monitor?.end({ existingSize: existingContent.length, addedSize: content.length });

        } catch (error) {
            monitor?.end({ error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    /**
     * Batch read multiple files
     */
    async readFiles(paths: string[]): Promise<Record<string, string>> {
        const monitor = this.config.monitoring ? getPerformanceMonitor().createTimer('batch-file-read', 'file') : null;

        try {
            // Process files in batches to control concurrency
            const results: Record<string, string> = {};
            const batches = this.createBatches(paths, this.config.batchSize);

            for (const batch of batches) {
                const batchResults = await Promise.allSettled(
                    batch.map(async (path) => {
                        try {
                            const content = await this.readFile(path);
                            return { path, content, success: true };
                        } catch (error) {
                            return {
                                path,
                                error: error instanceof Error ? error.message : String(error),
                                success: false
                            };
                        })
                    )
                );

                batchResults.forEach(({ path, content, error, success }) => {
                    if (success) {
                        results[path] = content as string;
                    } else {
                        logger.error('Failed to read file in batch', 'FileOperationsOptimizer', {
                            path,
                            error
                        });
                    }
                });
            }

            monitor?.end({ filesRead: Object.keys(results).length, totalFiles: paths.length });
            return results;

        } catch (error) {
            monitor?.end({ error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    /**
     * Batch write multiple files
     */
    async writeFiles(fileData: Record<string, string>): Promise<void> {
        const monitor = this.config.monitoring ? getPerformanceMonitor().createTimer('batch-file-write', 'file') : null;

        try {
            const entries = Object.entries(fileData);
            const batches = this.createBatches(entries, this.config.batchSize);

            for (const batch of batches) {
                await Promise.allSettled(
                    batch.map(async ([path, content]) => {
                        try {
                            await this.writeFile(path, content);
                            return { path, success: true };
                        } catch (error) {
                            return {
                                path,
                                error: error instanceof Error ? error.message : String(error),
                                success: false
                            };
                        })
                    )
                ).forEach(({ path, error, success }) => {
                    if (!success) {
                        logger.error('Failed to write file in batch', 'FileOperationsOptimizer', {
                            path,
                            error
                        });
                    }
                });
            }

            monitor?.end({ filesWritten: entries.length });

        } catch (error) {
            monitor?.end({ error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    /**
     * Create directory if it doesn't exist
     */
    private async ensureDirectoryExists(filePath: string): Promise<void> {
        const parts = filePath.split('/');
        parts.pop(); // Remove file name

        let currentPath = '';
        for (const part of parts) {
            currentPath += (currentPath ? '/' : '') + part;

            const exists = await this.vault.adapter.exists(currentPath);
            if (!exists) {
                await this.vault.adapter.mkdir(currentPath);
            }
        }
    }

    /**
     * Get cached data with TTL
     */
    private getCachedData(key: string): string | null {
        const cached = this.fileCache.get(key);
        if (!cached) return null;

        const now = Date.now();
        if (now - cached.timestamp > cached.ttl) {
            this.fileCache.delete(key);
            return null;
        }

        return cached.data;
    }

    /**
     * Set cached data with TTL
     */
    private setCachedData(key: string, data: string, ttl: number): void {
        this.fileCache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });

        // Limit cache size
        if (this.fileCache.size > 100) {
            // Remove oldest entries
            const oldestKey = this.fileCache.keys().next().value;
            if (oldestKey) {
                this.fileCache.delete(oldestKey);
            }
        }
    }

    /**
     * Create batches from array
     */
    private createBatches<T>(items: T[], batchSize: number): T[][] {
        const batches: T[][] = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }

    /**
     * Get operation statistics
     */
    getStats(): {
        queueSize: number;
        activeOperations: number;
        cacheSize: number;
        config: FileOperationsConfig;
    } {
        return {
            queueSize: this.operationQueue.length,
            activeOperations: this.activeOperations,
            cacheSize: this.fileCache.size,
            config: this.config
        };
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.fileCache.clear();
        logger.info('File operations cache cleared', 'FileOperationsOptimizer');
    }

    /**
     * Destroy the file operations optimizer
     */
    destroy(): void {
        if (this.isDestroyed) return;

        this.isDestroyed = true;
        this.clearCache();
        this.operationQueue = [];

        logger.info('File operations optimizer destroyed', 'FileOperationsOptimizer');
    }
}

// Global instance
let globalFileOptimizer: FileOperationsOptimizer | null = null;

export function getFileOperationsOptimizer(vault: Vault): FileOperationsOptimizer {
    if (!globalFileOptimizer) {
        globalFileOptimizer = new FileOperationsOptimizer(vault);
    }
    return globalFileOptimizer;
}

export function destroyFileOperationsOptimizer(): void {
    if (globalFileOptimizer) {
        globalFileOptimizer.destroy();
        globalFileOptimizer = null;
    }
}
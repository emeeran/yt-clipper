/**
 * Bundle Optimizer - Performance Optimization
 * Implements code splitting, lazy loading, and bundle analysis
 */

import { logger } from '../services/logger';

export interface BundleChunk {
    name: string;
    path: string;
    size: number;
    loaded: boolean;
    loadingPromise?: Promise<any>;
    dependencies: string[];
}

export interface BundleStats {
    totalSize: number;
    loadedChunks: number;
    totalChunks: number;
    compressionRatio: number;
    lazyLoadSavings: number;
}

export interface LoadingStrategy {
    preload: boolean;
    priority: number;
    timeout: number;
    retryAttempts: number;
}

export class BundleOptimizer {
    private chunks = new Map<string, BundleChunk>();
    private loadingStrategies = new Map<string, LoadingStrategy>();
    private bundleStats: BundleStats = {
        totalSize: 0,
        loadedChunks: 0,
        totalChunks: 0,
        compressionRatio: 1,
        lazyLoadSavings: 0
    };

    constructor() {
        this.registerDefaultChunks();
        logger.info('Bundle optimizer initialized', 'BundleOptimizer');
    }

    /**
     * Register a chunk with loading strategy
     */
    registerChunk(
        name: string,
        path: string,
        strategy: Partial<LoadingStrategy> = {}
    ): void {
        const fullStrategy: LoadingStrategy = {
            preload: false,
            priority: 0,
            timeout: 10000,
            retryAttempts: 3,
            ...strategy
        };

        const chunk: BundleChunk = {
            name,
            path,
            size: 0, // Will be estimated
            loaded: false,
            dependencies: []
        };

        this.chunks.set(name, chunk);
        this.loadingStrategies.set(name, fullStrategy);
        this.bundleStats.totalChunks++;

        logger.debug('Bundle chunk registered', 'BundleOptimizer', {
            name,
            path,
            preload: fullStrategy.preload,
            priority: fullStrategy.priority
        });
    }

    /**
     * Load a chunk dynamically
     */
    async loadChunk<T = any>(name: string): Promise<T> {
        const chunk = this.chunks.get(name);
        if (!chunk) {
            throw new Error(`Chunk '${name}' not registered`);
        }

        if (chunk.loaded) {
            logger.debug('Chunk already loaded', 'BundleOptimizer', { name });
            return chunk.loadingPromise;
        }

        if (chunk.loadingPromise) {
            logger.debug('Chunk already loading', 'BundleOptimizer', { name });
            return chunk.loadingPromise;
        }

        const strategy = this.loadingStrategies.get(name)!;
        chunk.loadingPromise = this.loadChunkWithRetry(chunk, strategy);

        try {
            const result = await chunk.loadingPromise;
            chunk.loaded = true;
            this.bundleStats.loadedChunks++;

            logger.info('Chunk loaded successfully', 'BundleOptimizer', {
                name,
                size: chunk.size,
                priority: strategy.priority
            });

            return result;
        } catch (error) {
            chunk.loadingPromise = undefined;
            logger.error('Failed to load chunk', 'BundleOptimizer', {
                name,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Preload critical chunks
     */
    async preloadCriticalChunks(): Promise<void> {
        const criticalChunks = Array.from(this.chunks.entries())
            .filter(([_, chunk]) => this.loadingStrategies.get(chunk.name)?.preload)
            .sort(([_, chunkA], [__, chunkB]) =>
                this.loadingStrategies.get(chunkA.name)!.priority -
                this.loadingStrategies.get(chunkB.name)!.priority
            );

        logger.info(`Preloading ${criticalChunks.length} critical chunks`, 'BundleOptimizer');

        await Promise.allSettled(
            criticalChunks.map(([name]) =>
                this.loadChunk(name).catch(error => {
                    logger.warn('Failed to preload chunk', 'BundleOptimizer', {
                        name,
                        error: error instanceof Error ? error.message : String(error)
                    });
                })
            )
        );
    }

    /**
     * Load chunk with retry logic
     */
    private async loadChunkWithRetry<T>(
        chunk: BundleChunk,
        strategy: LoadingStrategy
    ): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= strategy.retryAttempts; attempt++) {
            try {
                logger.debug(`Loading chunk (attempt ${attempt}/${strategy.retryAttempts})`, 'BundleOptimizer', {
                    name: chunk.name
                });

                const result = await this.loadChunkInternal<T>(chunk, strategy);
                return result;

            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                logger.warn(`Chunk load attempt ${attempt} failed`, 'BundleOptimizer', {
                    name: chunk.name,
                    error: lastError.message
                });

                if (attempt < strategy.retryAttempts) {
                    // Exponential backoff
                    const delay = Math.pow(2, attempt - 1) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError || new Error('Unknown loading error');
    }

    /**
     * Internal chunk loading implementation
     */
    private async loadChunkInternal<T>(
        chunk: BundleChunk,
        strategy: LoadingStrategy
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            // Create timeout
            const timeoutId = setTimeout(() => {
                reject(new Error(`Chunk loading timeout after ${strategy.timeout}ms`));
            }, strategy.timeout);

            // In a real implementation, this would use dynamic import()
            // For demo purposes, we'll simulate the loading
            this.simulateChunkLoad<T>(chunk.path)
                .then(result => {
                    clearTimeout(timeoutId);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
        });
    }

    /**
     * Simulate chunk loading (replace with real dynamic import)
     */
    private async simulateChunkLoad<T>(path: string): Promise<T> {
        // In a real implementation, this would be:
        // return import(path);

        // For demonstration, we'll simulate loading
        const delay = Math.random() * 1000 + 500; // 500-1500ms
        await new Promise(resolve => setTimeout(resolve, delay));

        // Simulate loaded module
        return {} as T;
    }

    /**
     * Create a lazy-loaded component
     */
    createLazyComponent<T>(
        chunkName: string,
        componentPath: string,
        strategy: Partial<LoadingStrategy> = {}
    ): () => Promise<T> {
        return async () => {
            const module = await this.loadChunk(chunkName);
            // In a real implementation, extract component from module
            return module.default || module;
        };
    }

    /**
     * Create a lazy-loaded service
     */
    createLazyService<T>(
        chunkName: string,
        serviceName: string,
        strategy: Partial<LoadingStrategy> = {}
    ): () => Promise<T> {
        return async () => {
            const module = await this.loadChunk(chunkName);
            // In a real implementation, extract service from module
            return new module[serviceName]();
        };
    }

    /**
     * Get loading progress
     */
    getLoadingProgress(): {
        loaded: number;
        total: number;
        percentage: number;
        loadingChunks: string[];
    } {
        const loading = Array.from(this.chunks.entries())
            .filter(([_, chunk]) => !chunk.loaded && chunk.loadingPromise)
            .map(([name]) => name);

        return {
            loaded: this.bundleStats.loadedChunks,
            total: this.bundleStats.totalChunks,
            percentage: this.bundleStats.totalChunks > 0
                ? (this.bundleStats.loadedChunks / this.bundleStats.totalChunks) * 100
                : 0,
            loadingChunks: loading
        };
    }

    /**
     * Get bundle statistics
     */
    getBundleStats(): BundleStats {
        const totalSize = Array.from(this.chunks.values())
            .reduce((sum, chunk) => sum + chunk.size, 0);

        const loadedSize = Array.from(this.chunks.values())
            .filter(chunk => chunk.loaded)
            .reduce((sum, chunk) => sum + chunk.size, 0);

        return {
            ...this.bundleStats,
            totalSize,
            loadedSize,
            lazyLoadSavings: totalSize - loadedSize
        };
    }

    /**
     * Analyze bundle for optimization opportunities
     */
    analyzeBundle(): {
        recommendations: string[];
        unusedChunks: string[];
        largeChunks: Array<{ name: string; size: number; path: string }>;
        dependencies: Record<string, string[]>;
    } {
        const recommendations: string[] = [];
        const largeChunks: Array<{ name: string; size: number; path: string }> = [];
        const dependencies: Record<string, string[]> = {};

        // Analyze chunk sizes
        for (const [name, chunk] of this.chunks) {
            if (chunk.size > 100000) { // 100KB threshold
                largeChunks.push({
                    name,
                    size: chunk.size,
                    path: chunk.path
                });
                recommendations.push(`Consider splitting large chunk '${name}' (${(chunk.size / 1024).toFixed(1)}KB)`);
            }

            dependencies[name] = chunk.dependencies;
        }

        // Check for unused chunks
        const unusedChunks = Array.from(this.chunks.keys())
            .filter(name => !this.chunks.get(name)?.loaded && !this.loadingStrategies.get(name)?.preload);

        if (unusedChunks.length > 0) {
            recommendations.push(`Consider removing ${unusedChunks.length} unused chunks: ${unusedChunks.join(', ')}`);
        }

        // Check loading strategy
        const highPriorityChunks = Array.from(this.chunks.entries())
            .filter(([_, chunk]) => this.loadingStrategies.get(chunk.name)?.priority! > 5)
            .filter(([_, chunk]) => !chunk.loaded);

        if (highPriorityChunks.length > 0) {
            recommendations.push(`${highPriorityChunks.length} high-priority chunks not loaded: ${highPriorityChunks.map(([name]) => name).join(', ')}`);
        }

        return {
            recommendations,
            unusedChunks,
            largeChunks,
            dependencies
        };
    }

    /**
     * Generate bundle analysis report
     */
    generateReport(): string {
        const stats = this.getBundleStats();
        const progress = this.getLoadingProgress();
        const analysis = this.analyzeBundle();

        return `
# Bundle Analysis Report
Generated: ${new Date().toISOString()}

## Bundle Statistics
- Total Chunks: ${stats.totalChunks}
- Loaded Chunks: ${stats.loadedChunks}
- Loading Progress: ${progress.percentage.toFixed(1)}%
- Bundle Size: ${(stats.totalSize / 1024).toFixed(1)}KB
- Lazy Load Savings: ${(stats.lazyLoadSavings / 1024).toFixed(1)}KB

## Loading Status
${progress.loadingChunks.length > 0
    ? `Currently loading: ${progress.loadingChunks.join(', ')}`
    : 'No chunks currently loading'
}

## Large Chunks (>100KB)
${analysis.largeChunks.length > 0
    ? analysis.largeChunks.map(chunk =>
        `- ${chunk.name}: ${(chunk.size / 1024).toFixed(1)}KB (${chunk.path})`
    ).join('\n')
    : 'No oversized chunks detected'
}

## Optimization Recommendations
${analysis.recommendations.length > 0
    ? analysis.recommendations.map(rec => `- ${rec}`).join('\n')
    : 'No optimization recommendations at this time'
}

## Dependencies
${Object.entries(analysis.dependencies).length > 0
    ? Object.entries(analysis.dependencies).map(([name, deps]) =>
        `${name}: ${deps.length > 0 ? deps.join(', ') : 'no dependencies'}`
    ).join('\n')
    : 'No dependency information available'
        `.trim();
    }

    /**
     * Destroy the bundle optimizer
     */
    destroy(): void {
        this.chunks.clear();
        this.loadingStrategies.clear();
        logger.info('Bundle optimizer destroyed', 'BundleOptimizer');
    }

    private registerDefaultChunks(): void {
        // Register commonly used chunks
        this.registerChunk('ai-gemini', './ai/gemini', { preload: false, priority: 3 });
        this.registerChunk('ai-groq', './ai/groq', { preload: false, priority: 3 });
        this.registerChunk('ai-ollama', './ai/ollama', { preload: false, priority: 2 });
        this.registerChunk('youtube-modal', './components/features/youtube/youtube-url-modal', { preload: false, priority: 5 });
        this.registerChunk('settings-tab', './settings-tab', { preload: false, priority: 1 });
        this.registerChunk('video-processor', './core/video-processor', { preload: true, priority: 4 });
        this.registerChunk('ui-components', './ui', { preload: false, priority: 2 });
    }
}

// Global instance
let globalBundleOptimizer: BundleOptimizer | null = null;

export function getBundleOptimizer(): BundleOptimizer {
    if (!globalBundleOptimizer) {
        globalBundleOptimizer = new BundleOptimizer();
    }
    return globalBundleOptimizer;
}

export function destroyBundleOptimizer(): void {
    if (globalBundleOptimizer) {
        globalBundleOptimizer.destroy();
        globalBundleOptimizer = null;
    }
}
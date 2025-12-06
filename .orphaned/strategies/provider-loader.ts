/**
 * AI Provider Loader - Lazy Loading Implementation
 * Implements dynamic loading of AI providers to reduce initial bundle size
 */

import { AIProviderStrategy, AIProviderConfig } from './ai-provider-strategy';
import { getBundleOptimizer } from '../performance/bundle-optimizer';
import { getIntelligentCache } from '../performance/intelligent-cache';
import { getPerformanceMonitor } from '../performance/performance-monitor';
import { logger } from '../services/logger';

interface ProviderModule {
    default: new (config: AIProviderConfig) => AIProviderStrategy;
}

interface ProviderLoaderConfig {
    enablePreloading: boolean;
    preloadDelay: number;
    cacheProviderModules: boolean;
}

export class AIProviderLoader {
    private bundleOptimizer = getBundleOptimizer();
    private cache = getIntelligentCache();
    private performanceMonitor = getPerformanceMonitor();
    private config: ProviderLoaderConfig;
    private loadedProviders: Map<string, AIProviderStrategy> = new Map();
    private providerModules: Map<string, ProviderModule> = new Map();
    private loadingPromises: Map<string, Promise<AIProviderStrategy>> = new Map();

    constructor(config: Partial<ProviderLoaderConfig> = {}) {
        this.config = {
            enablePreloading: true,
            preloadDelay: 2000,
            cacheProviderModules: true,
            ...config
        };

        if (this.config.enablePreloading) {
            this.schedulePreloading();
        }

        logger.info('AI Provider Loader initialized', 'AIProviderLoader');
    }

    /**
     * Load a provider strategy on-demand
     */
    async loadProvider(
        providerType: string,
        config: AIProviderConfig
    ): Promise<AIProviderStrategy> {
        const timerId = this.performanceMonitor.startTiming('provider-load', 'resource-loading');

        try {
            // Check if already loaded
            if (this.loadedProviders.has(providerType)) {
                const provider = this.loadedProviders.get(providerType)!;
                this.performanceMonitor.end(timerId, {
                    providerType,
                    cacheHit: true,
                    success: true
                });
                return provider;
            }

            // Check if currently loading
            if (this.loadingPromises.has(providerType)) {
                const provider = await this.loadingPromises.get(providerType)!;
                this.performanceMonitor.end(timerId, {
                    providerType,
                    cacheHit: false,
                    success: true
                });
                return provider;
            }

            // Load provider
            const loadingPromise = this.loadProviderModule(providerType, config);
            this.loadingPromises.set(providerType, loadingPromise);

            const provider = await loadingPromise;

            // Cache the loaded provider
            this.loadedProviders.set(providerType, provider);
            this.loadingPromises.delete(providerType);

            this.performanceMonitor.end(timerId, {
                providerType,
                cacheHit: false,
                success: true
            });

            return provider;

        } catch (error) {
            this.performanceMonitor.end(timerId, {
                providerType,
                error: error instanceof Error ? error.message : String(error),
                success: false
            });

            this.loadingPromises.delete(providerType);
            throw error;
        }
    }

    /**
     * Load multiple providers in parallel
     */
    async loadProviders(
        providerConfigs: Array<{ type: string; config: AIProviderConfig }>
    ): Promise<Map<string, AIProviderStrategy>> {
        const timerId = this.performanceMonitor.startTiming('multiple-providers-load', 'resource-loading');

        try {
            const loadPromises = providerConfigs.map(({ type, config }) =>
                this.loadProvider(type, config).catch(error => {
                    logger.warn(`Failed to load provider: ${type}`, 'AIProviderLoader', {
                        error: error instanceof Error ? error.message : String(error)
                    });
                    return null;
                })
            );

            const providers = await Promise.allSettled(loadPromises);
            const providerMap = new Map<string, AIProviderStrategy>();

            providers.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    const { type } = providerConfigs[index];
                    providerMap.set(type, result.value);
                }
            });

            this.performanceMonitor.end(timerId, {
                totalProviders: providerConfigs.length,
                successfulProviders: providerMap.size,
                success: true
            });

            return providerMap;

        } catch (error) {
            this.performanceMonitor.end(timerId, {
                error: error instanceof Error ? error.message : String(error),
                success: false
            });
            throw error;
        }
    }

    /**
     * Preload commonly used providers
     */
    async preloadProviders(providerTypes: string[]): Promise<void> {
        logger.debug(`Preloading ${providerTypes.length} providers`, 'AIProviderLoader');

        const preloadPromises = providerTypes.map(async (providerType) => {
            try {
                // Load module without creating instance
                await this.loadProviderModuleOnly(providerType);
                logger.debug(`Preloaded provider module: ${providerType}`, 'AIProviderLoader');
            } catch (error) {
                logger.warn(`Failed to preload provider: ${providerType}`, 'AIProviderLoader', {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        });

        await Promise.allSettled(preloadPromises);
    }

    /**
     * Get available provider types
     */
    getAvailableProviderTypes(): string[] {
        return [
            'gemini',
            'groq',
            'ollama',
            'openai',
            'anthropic',
            'cohere'
        ];
    }

    /**
     * Check if a provider is loaded
     */
    isProviderLoaded(providerType: string): boolean {
        return this.loadedProviders.has(providerType);
    }

    /**
     * Get loaded provider
     */
    getProvider(providerType: string): AIProviderStrategy | null {
        return this.loadedProviders.get(providerType) || null;
    }

    /**
     * Unload a provider to free memory
     */
    unloadProvider(providerType: string): void {
        const provider = this.loadedProviders.get(providerType);
        if (provider) {
            // Cleanup provider resources
            if ('destroy' in provider && typeof provider.destroy === 'function') {
                provider.destroy();
            }

            this.loadedProviders.delete(providerType);
            this.loadingPromises.delete(providerType);

            logger.debug(`Unloaded provider: ${providerType}`, 'AIProviderLoader');
        }
    }

    /**
     * Unload all providers
     */
    unloadAllProviders(): void {
        for (const providerType of this.loadedProviders.keys()) {
            this.unloadProvider(providerType);
        }
    }

    /**
     * Get loader statistics
     */
    getStatistics(): {
        loadedProviders: number;
        cachedModules: number;
        activeLoadingOperations: number;
        availableProviderTypes: number;
        memoryUsage: number;
    } {
        return {
            loadedProviders: this.loadedProviders.size,
            cachedModules: this.providerModules.size,
            activeLoadingOperations: this.loadingPromises.size,
            availableProviderTypes: this.getAvailableProviderTypes().length,
            memoryUsage: this.estimateMemoryUsage()
        };
    }

    /**
     * Clear all cached modules and providers
     */
    clearCache(): void {
        this.unloadAllProviders();
        this.providerModules.clear();
        this.cache.clear();
        logger.info('Provider loader cache cleared', 'AIProviderLoader');
    }

    /**
     * Destroy the provider loader
     */
    destroy(): void {
        this.unloadAllProviders();
        this.providerModules.clear();
        this.cache.clear();
        logger.info('AI Provider Loader destroyed', 'AIProviderLoader');
    }

    private async loadProviderModule(
        providerType: string,
        config: AIProviderConfig
    ): Promise<AIProviderStrategy> {
        const module = await this.loadProviderModuleOnly(providerType);
        const ProviderClass = module.default;
        return new ProviderClass(config);
    }

    private async loadProviderModuleOnly(providerType: string): Promise<ProviderModule> {
        // Check cache first
        if (this.config.cacheProviderModules && this.providerModules.has(providerType)) {
            return this.providerModules.get(providerType)!;
        }

        let module: ProviderModule;

        // Load the appropriate provider module
        switch (providerType) {
            case 'gemini':
                module = await this.bundleOptimizer.loadChunk(() => import('./gemini-strategy'));
                break;
            case 'groq':
                module = await this.bundleOptimizer.loadChunk(() => import('./groq-strategy'));
                break;
            case 'ollama':
                module = await this.bundleOptimizer.loadChunk(() => import('./ollama-strategy'));
                break;
            case 'openai':
                module = await this.bundleOptimizer.loadChunk(() => import('./openai-strategy'));
                break;
            case 'anthropic':
                module = await this.bundleOptimizer.loadChunk(() => import('./anthropic-strategy'));
                break;
            case 'cohere':
                module = await this.bundleOptimizer.loadChunk(() => import('./cohere-strategy'));
                break;
            default:
                throw new Error(`Unknown provider type: ${providerType}`);
        }

        // Cache module if enabled
        if (this.config.cacheProviderModules) {
            this.providerModules.set(providerType, module);
        }

        return module;
    }

    private schedulePreloading(): void {
        setTimeout(() => {
            // Preload most commonly used providers
            const commonProviders = ['gemini', 'groq'];
            this.preloadProviders(commonProviders).catch(error => {
                logger.warn('Provider preloading failed', 'AIProviderLoader', {
                    error: error instanceof Error ? error.message : String(error)
                });
            });
        }, this.config.preloadDelay);
    }

    private estimateMemoryUsage(): number {
        let totalSize = 0;

        // Estimate loaded providers size
        totalSize += this.loadedProviders.size * 1024; // ~1KB per provider estimate

        // Estimate cached modules size
        totalSize += this.providerModules.size * 5120; // ~5KB per module estimate

        return totalSize;
    }
}

// Global instance
let globalProviderLoader: AIProviderLoader | null = null;

export function getAIProviderLoader(config?: Partial<ProviderLoaderConfig>): AIProviderLoader {
    if (!globalProviderLoader) {
        globalProviderLoader = new AIProviderLoader(config);
    }
    return globalProviderLoader;
}

export function destroyAIProviderLoader(): void {
    if (globalProviderLoader) {
        globalProviderLoader.destroy();
        globalProviderLoader = null;
    }
}
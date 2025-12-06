/**
 * Memory Leak Preventer - Performance Optimization
 * Prevents memory leaks by automatically cleaning up resources
 */

import { logger } from '../services/logger';

export interface ResourceCleanup {
    type: 'event' | 'timer' | 'observer' | 'dom' | 'cache';
    resource: any;
    cleanup: () => void;
    description: string;
    location: string;
    timestamp: number;
}

export interface MemoryStats {
    totalResources: number;
    resourcesByType: Record<string, number>;
    oldestResource: number;
    memoryUsage?: number;
}

export class MemoryLeakPreventer {
    private resources = new Set<ResourceCleanup>();
    private maxAge = 5 * 60 * 1000; // 5 minutes
    private cleanupInterval: NodeJS.Timeout;
    private isDestroyed = false;

    constructor() {
        this.startPeriodicCleanup();
        logger.info('Memory leak preventer initialized', 'MemoryLeakPreventer');
    }

    /**
     * Register an event listener for automatic cleanup
     */
    registerEventListener(
        target: EventTarget,
        type: string,
        listener: EventListener,
        options?: AddEventListenerOptions,
        location: string = 'unknown'
    ): () => void {
        const wrappedListener = this.wrapEventListener(listener, location);
        target.addEventListener(type, wrappedListener, options);

        const cleanup = () => {
            target.removeEventListener(type, wrappedListener, options);
            logger.debug(`Cleaned up event listener: ${type}`, 'MemoryLeakPreventer', { location });
        };

        const resource: ResourceCleanup = {
            type: 'event',
            resource: { target, type, listener: wrappedListener, options },
            cleanup,
            description: `Event listener: ${type} on ${target.constructor.name}`,
            location,
            timestamp: Date.now()
        };

        this.resources.add(resource);

        // Return cleanup function for manual cleanup
        return () => this.removeResource(resource);
    }

    /**
     * Register a timer for automatic cleanup
     */
    registerTimer(
        timerId: NodeJS.Timeout,
        location: string = 'unknown'
    ): void {
        const cleanup = () => {
            clearTimeout(timerId);
            logger.debug(`Cleaned up timer`, 'MemoryLeakPreventer', { location });
        };

        const resource: ResourceCleanup = {
            type: 'timer',
            resource: timerId,
            cleanup,
            description: 'Timeout timer',
            location,
            timestamp: Date.now()
        };

        this.resources.add(resource);
    }

    /**
     * Register an interval for automatic cleanup
     */
    registerInterval(
        intervalId: NodeJS.Timeout,
        location: string = 'unknown'
    ): void {
        const cleanup = () => {
            clearInterval(intervalId);
            logger.debug(`Cleaned up interval`, 'MemoryLeakPreventer', { location });
        };

        const resource: ResourceCleanup = {
            type: 'timer',
            resource: intervalId,
            cleanup,
            description: 'Interval timer',
            location,
            timestamp: Date.now()
        };

        this.resources.add(resource);
    }

    /**
     * Register a MutationObserver for automatic cleanup
     */
    registerObserver(
        observer: MutationObserver,
        location: string = 'unknown'
    ): void {
        const cleanup = () => {
            observer.disconnect();
            logger.debug(`Cleaned up MutationObserver`, 'MemoryLeakPreventer', { location });
        };

        const resource: ResourceCleanup = {
            type: 'observer',
            resource: observer,
            cleanup,
            description: 'MutationObserver',
            location,
            timestamp: Date.now()
        };

        this.resources.add(resource);
    }

    /**
     * Register a DOM element for cleanup
     */
    registerDOMElement(
        element: HTMLElement,
        cleanupCallback?: () => void,
        location: string = 'unknown'
    ): void {
        const cleanup = () => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
            cleanupCallback?.();
            logger.debug(`Cleaned up DOM element: ${element.tagName}`, 'MemoryLeakPreventer', { location });
        };

        const resource: ResourceCleanup = {
            type: 'dom',
            resource: element,
            cleanup,
            description: `DOM element: ${element.tagName.toLowerCase()}`,
            location,
            timestamp: Date.now()
        };

        this.resources.add(resource);
    }

    /**
     * Register a cache entry for cleanup
     */
    registerCacheEntry(
        key: string,
        cleanupCallback: () => void,
        location: string = 'unknown'
    ): void {
        const cleanup = () => {
            cleanupCallback();
            logger.debug(`Cleaned up cache entry: ${key}`, 'MemoryLeakPreventer', { location });
        };

        const resource: ResourceCleanup = {
            type: 'cache',
            resource: key,
            cleanup,
            description: `Cache entry: ${key}`,
            location,
            timestamp: Date.now()
        };

        this.resources.add(resource);
    }

    /**
     * Manually remove a specific resource
     */
    removeResource(resource: ResourceCleanup): void {
        if (this.resources.has(resource)) {
            try {
                resource.cleanup();
                this.resources.delete(resource);
                logger.debug(`Manually removed resource: ${resource.description}`, 'MemoryLeakPreventer');
            } catch (error) {
                logger.error(`Failed to cleanup resource: ${resource.description}`, 'MemoryLeakPreventer', {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
    }

    /**
     * Get current memory statistics
     */
    getMemoryStats(): MemoryStats {
        const resourcesByType: Record<string, number> = {};
        let oldestResource = Date.now();

        for (const resource of this.resources) {
            resourcesByType[resource.type] = (resourcesByType[resource.type] || 0) + 1;
            oldestResource = Math.min(oldestResource, resource.timestamp);
        }

        return {
            totalResources: this.resources.size,
            resourcesByType,
            oldestResource: Date.now() - oldestResource
        };
    }

    /**
     * Force cleanup of all resources
     */
    cleanupAll(): void {
        logger.info(`Starting cleanup of ${this.resources.size} resources`, 'MemoryLeakPreventer');

        let cleanedCount = 0;
        for (const resource of this.resources) {
            try {
                resource.cleanup();
                cleanedCount++;
            } catch (error) {
                logger.error(`Failed to cleanup resource: ${resource.description}`, 'MemoryLeakPreventer', {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        this.resources.clear();
        logger.info(`Cleanup completed: ${cleanedCount}/${this.resources.size} resources`, 'MemoryLeakPreventer');
    }

    /**
     * Force cleanup of old resources
     */
    cleanupOldResources(): void {
        const now = Date.now();
        const toRemove: ResourceCleanup[] = [];

        for (const resource of this.resources) {
            if (now - resource.timestamp > this.maxAge) {
                toRemove.push(resource);
            }
        }

        if (toRemove.length > 0) {
            logger.info(`Cleaning up ${toRemove.length} old resources`, 'MemoryLeakPreventer');
            for (const resource of toRemove) {
                this.removeResource(resource);
            }
        }
    }

    /**
     * Destroy the memory leak preventer
     */
    destroy(): void {
        if (this.isDestroyed) return;

        this.isDestroyed = true;

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        this.cleanupAll();
        logger.info('Memory leak preventer destroyed', 'MemoryLeakPreventer');
    }

    private wrapEventListener(listener: EventListener, location: string): EventListener {
        return (event) => {
            try {
                return listener(event);
            } catch (error) {
                logger.error(`Event listener error`, 'MemoryLeakPreventer', {
                    location,
                    error: error instanceof Error ? error.message : String(error),
                    eventType: event.type
                });
            }
        };
    }

    private startPeriodicCleanup(): void {
        this.cleanupInterval = setInterval(() => {
            if (!this.isDestroyed) {
                this.cleanupOldResources();
            }
        }, 60 * 1000); // Cleanup every minute
    }
}

// Global instance for easy access
let globalMemoryLeakPreventer: MemoryLeakPreventer | null = null;

export function getMemoryLeakPreventer(): MemoryLeakPreventer {
    if (!globalMemoryLeakPreventer) {
        globalMemoryLeakPreventer = new MemoryLeakPreventer();
    }
    return globalMemoryLeakPreventer;
}

export function destroyMemoryLeakPreventer(): void {
    if (globalMemoryLeakPreventer) {
        globalMemoryLeakPreventer.destroy();
        globalMemoryLeakPreventer = null;
    }
}
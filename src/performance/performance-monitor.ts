/**
 * Performance Monitor - Performance Optimization
 * Tracks performance metrics and provides insights
 */

import { logger } from '../services/logger';

export interface PerformanceMetric {
    name: string;
    value: number;
    unit: string;
    timestamp: number;
    category: 'render' | 'network' | 'memory' | 'computation' | 'file' | 'cache';
    metadata?: Record<string, any>;
}

export interface PerformanceStats {
    totalMetrics: number;
    metricsByCategory: Record<string, number>;
    averageValues: Record<string, number>;
    slowestOperations: Array<{ name: string; value: number; unit: string }>;
    recentMetrics: PerformanceMetric[];
}

export class PerformanceMonitor {
    private metrics: PerformanceMetric[] = [];
    private observers: PerformanceObserver[] = [];
    private maxMetrics = 1000;
    private isDestroyed = false;

    constructor() {
        this.setupPerformanceObservers();
        logger.info('Performance monitor initialized', 'PerformanceMonitor');
    }

    /**
     * Start timing an operation
     */
    startTiming(operationName: string, category: PerformanceMetric['category'] = 'computation'): string {
        const id = `${operationName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        if (typeof performance !== 'undefined' && performance.mark) {
            performance.mark(`start_${id}`);
        }

        logger.debug(`Started timing: ${operationName}`, 'PerformanceMonitor', { id, category });
        return id;
    }

    /**
     * End timing an operation and record the metric
     */
    endTiming(id: string, metadata?: Record<string, any>): number {
        const operationName = id.split('_')[0];
        const category = this.extractCategoryFromId(id);

        let duration = 0;

        if (typeof performance !== 'undefined' && performance.mark && performance.measure) {
            try {
                performance.mark(`end_${id}`);
                performance.measure(operationName, `start_${id}`, `end_${id}`);

                const measures = performance.getEntriesByName(operationName, 'measure');
                const latestMeasure = measures[measures.length - 1];

                if (latestMeasure) {
                    duration = latestMeasure.duration;
                }

                // Clean up performance marks
                performance.clearMarks(`start_${id}`);
                performance.clearMarks(`end_${id}`);
                performance.clearMeasures(operationName);
            } catch (error) {
                logger.warn('Performance measurement failed', 'PerformanceMonitor', {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        this.recordMetric({
            name: operationName,
            value: duration,
            unit: 'ms',
            timestamp: Date.now(),
            category,
            metadata
        });

        logger.debug(`Ended timing: ${operationName}`, 'PerformanceMonitor', {
            id,
            duration,
            category
        });

        return duration;
    }

    /**
     * Record a custom metric
     */
    recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
        if (this.isDestroyed) return;

        const fullMetric: PerformanceMetric = {
            ...metric,
            timestamp: Date.now()
        };

        this.metrics.push(fullMetric);

        // Keep only the most recent metrics
        if (this.metrics.length > this.maxMetrics) {
            this.metrics = this.metrics.slice(-this.maxMetrics);
        }

        // Log slow operations
        if (this.isSlowOperation(fullMetric)) {
            logger.warn(`Slow operation detected: ${metric.name}`, 'PerformanceMonitor', {
                value: metric.value,
                unit: metric.unit,
                category: metric.category
            });
        }
    }

    /**
     * Get performance statistics
     */
    getStats(): PerformanceStats {
        const metricsByCategory: Record<string, number> = {};
        const categoryTotals: Record<string, number[]> = {};
        const slowestOperations: Array<{ name: string; value: number; unit: string }> = [];

        for (const metric of this.metrics) {
            // Count by category
            metricsByCategory[metric.category] = (metricsByCategory[metric.category] || 0) + 1;

            // Calculate category totals for averages
            if (!categoryTotals[metric.category]) {
                categoryTotals[metric.category] = [];
            }
            categoryTotals[metric.category].push(metric.value);

            // Track slowest operations
            if (this.isSlowOperation(metric)) {
                slowestOperations.push({
                    name: metric.name,
                    value: metric.value,
                    unit: metric.unit
                });
            }
        }

        // Calculate averages
        const averageValues: Record<string, number> = {};
        for (const [category, values] of Object.entries(categoryTotals)) {
            if (values.length > 0) {
                averageValues[category] = values.reduce((sum, val) => sum + val, 0) / values.length;
            }
        }

        // Sort slowest operations
        slowestOperations.sort((a, b) => b.value - a.value);

        return {
            totalMetrics: this.metrics.length,
            metricsByCategory,
            averageValues,
            slowestOperations: slowestOperations.slice(0, 10),
            recentMetrics: this.metrics.slice(-20)
        };
    }

    /**
     * Create a performance timer
     */
    createTimer(operationName: string, category: PerformanceMetric['category'] = 'computation') {
        const startTime = Date.now();
        const id = this.startTiming(operationName, category);

        return {
            end: (metadata?: Record<string, any>) => {
                const duration = Date.now() - startTime;
                this.recordMetric({
                    name: operationName,
                    value: duration,
                    unit: 'ms',
                    category,
                    metadata
                });
                this.endTiming(id, metadata);
                return duration;
            }
        };
    }

    /**
     * Monitor memory usage
     */
    monitorMemory(): PerformanceMetric | null {
        if (typeof performance !== 'undefined' && 'memory' in performance) {
            const memory = (performance as any).memory;
            return {
                name: 'memory-usage',
                value: memory.usedJSHeapSize,
                unit: 'bytes',
                timestamp: Date.now(),
                category: 'memory',
                metadata: {
                    total: memory.totalJSHeapSize,
                    limit: memory.jsHeapSizeLimit,
                    usedMB: Math.round(memory.usedJSHeapSize / 1024 / 1024)
                }
            };
        }
        return null;
    }

    /**
     * Get current memory usage in MB
     */
    getMemoryUsageMB(): number {
        const metric = this.monitorMemory();
        return metric ? metric.metadata?.usedMB || 0 : 0;
    }

    /**
     * Create a debounced function with performance tracking
     */
    createDebouncedFunction<T extends (...args: any[]) => any>(
        fn: T,
        delay: number,
        operationName: string
    ): T {
        let timeoutId: NodeJS.Timeout;
        let lastCallTime = 0;

        return ((...args: Parameters<T>) => {
            const now = Date.now();
            const timeSinceLastCall = now - lastCallTime;

            if (timeSinceLastCall < delay) {
                clearTimeout(timeoutId);
            }

            lastCallTime = now;

            timeoutId = setTimeout(() => {
                const timer = this.createTimer(operationName, 'computation');
                try {
                    const result = fn(...args);
                    if (result instanceof Promise) {
                        result.finally(() => timer.end());
                    } else {
                        timer.end();
                    }
                    return result;
                } catch (error) {
                    timer.end({ error: error instanceof Error ? error.message : String(error) });
                    throw error;
                }
            }, delay);
        }) as T;
    }

    /**
     * Create a throttled function with performance tracking
     */
    createThrottledFunction<T extends (...args: any[]) => any>(
        fn: T,
        limit: number,
        operationName: string
    ): T {
        let inThrottle = false;
        let lastExecutionTime = 0;

        return ((...args: Parameters<T>) => {
            if (!inThrottle) {
                const timer = this.createTimer(operationName, 'computation');

                try {
                    const result = fn(...args);
                    lastExecutionTime = Date.now();

                    if (result instanceof Promise) {
                        result.finally(() => timer.end({
                            executionGap: Date.now() - lastExecutionTime
                        }));
                    } else {
                        timer.end({
                            executionGap: Date.now() - lastExecutionTime
                        });
                    }

                    return result;
                } catch (error) {
                    timer.end({ error: error instanceof Error ? error.message : String(error) });
                    throw error;
                }

                inThrottle = true;
                setTimeout(() => {
                    inThrottle = false;
                }, limit);
            }
        }) as T;
    }

    /**
     * Monitor render performance
     */
    monitorRender(componentName: string, renderFn: () => void): void {
        const timer = this.createTimer(`render-${componentName}`, 'render');

        requestAnimationFrame(() => {
            try {
                const startTime = performance.now();
                renderFn();
                const endTime = performance.now();

                timer.end({
                    renderMethod: 'requestAnimationFrame',
                    duration: endTime - startTime
                });
            } catch (error) {
                timer.end({ error: error instanceof Error ? error.message : String(error) });
            }
        });
    }

    /**
     * Export performance report
     */
    exportReport(): string {
        const stats = this.getStats();
        const memoryMetric = this.monitorMemory();

        const report = `
# Performance Report
Generated: ${new Date().toISOString()}

## Summary
- Total Metrics: ${stats.totalMetrics}
- Memory Usage: ${memoryMetric ? `${memoryMetric.metadata?.usedMB} MB` : 'N/A'}

## Metrics by Category
${Object.entries(stats.metricsByCategory).map(([category, count]) =>
    `- ${category}: ${count} metrics`
).join('\n')}

## Average Performance (ms)
${Object.entries(stats.averageValues).map(([category, avg]) =>
    `- ${category}: ${avg.toFixed(2)}ms`
).join('\n')}

## Slowest Operations
${stats.slowestOperations.slice(0, 5).map((op, index) =>
    `${index + 1}. ${op.name}: ${op.value}${op.unit}`
).join('\n')}

## Recent Metrics
${stats.recentMetrics.slice(-5).map(metric =>
    `- ${metric.name}: ${metric.value}${metric.unit} (${new Date(metric.timestamp).toISOString()})`
).join('\n')}
        `.trim();

        return report;
    }

    /**
     * Clear all metrics
     */
    clearMetrics(): void {
        this.metrics = [];
        logger.info('Performance metrics cleared', 'PerformanceMonitor');
    }

    /**
     * Destroy the performance monitor
     */
    destroy(): void {
        if (this.isDestroyed) return;

        this.isDestroyed = true;

        // Disconnect performance observers
        for (const observer of this.observers) {
            observer.disconnect();
        }

        this.observers = [];
        this.metrics = [];

        logger.info('Performance monitor destroyed', 'PerformanceMonitor');
    }

    private setupPerformanceObservers(): void {
        if (typeof PerformanceObserver === 'undefined') {
            logger.debug('PerformanceObserver not available', 'PerformanceMonitor');
            return;
        }

        try {
            // Observe navigation timing
            const navObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'navigation') {
                        this.recordMetric({
                            name: 'page-navigation',
                            value: entry.duration,
                            unit: 'ms',
                            category: 'render',
                            metadata: {
                                type: entry.name,
                                transferSize: (entry as any).transferSize
                            }
                        });
                    }
                }
            });

            navObserver.observe({ entryTypes: ['navigation'] });
            this.observers.push(navObserver);

        } catch (error) {
            logger.warn('Failed to setup navigation observer', 'PerformanceMonitor', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private extractCategoryFromId(id: string): PerformanceMetric['category'] {
        const parts = id.split('_');
        const lastPart = parts[parts.length - 1];

        // Try to parse category from the last part of the ID
        const categoryMap: Record<string, PerformanceMetric['category']> = {
            'render': 'render',
            'network': 'network',
            'memory': 'memory',
            'computation': 'computation',
            'file': 'file',
            'cache': 'cache'
        };

        return categoryMap[lastPart] || 'computation';
    }

    private isSlowOperation(metric: PerformanceMetric): boolean {
        const thresholds: Record<PerformanceMetric['category'], number> = {
            render: 16,      // 60fps = 16ms per frame
            network: 1000,   // 1 second
            memory: 100,     // 100ms
            computation: 100, // 100ms
            file: 500,       // 500ms
            cache: 50       // 50ms
        };

        const threshold = thresholds[metric.category] || 100;
        return metric.value > threshold;
    }
}

// Global instance
let globalPerformanceMonitor: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
    if (!globalPerformanceMonitor) {
        globalPerformanceMonitor = new PerformanceMonitor();
    }
    return globalPerformanceMonitor;
}

export function destroyPerformanceMonitor(): void {
    if (globalPerformanceMonitor) {
        globalPerformanceMonitor.destroy();
        globalPerformanceMonitor = null;
    }
}
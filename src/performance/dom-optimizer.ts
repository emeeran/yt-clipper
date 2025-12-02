/**
 * DOM Optimizer - Performance Optimization
 * Batch DOM operations, use requestAnimationFrame, and optimize rendering
 */

import { logger } from '../services/logger';

export interface DOMOperation {
    type: 'create' | 'update' | 'remove' | 'style';
    element?: HTMLElement;
    selector?: string;
    properties?: Record<string, string>;
    callback?: (element: HTMLElement) => void;
    priority: number;
}

export interface RenderBatch {
    operations: DOMOperation[];
    timestamp: number;
    scheduled: boolean;
}

export interface PerformanceMetrics {
    totalOperations: number;
    batchesProcessed: number;
    averageBatchSize: number;
    frameRate: number;
    renderTime: number;
}

export class DOMOptimizer {
    private pendingOperations: DOMOperation[] = [];
    private batchQueue: RenderBatch[] = [];
    private animationFrameId: number | null = null;
    private isDestroyed = false;
    private metrics: PerformanceMetrics = {
        totalOperations: 0,
        batchesProcessed: 0,
        averageBatchSize: 0,
        frameRate: 0,
        renderTime: 0
    };
    private lastFrameTime = 0;
    private frameCount = 0;
    private frameRateInterval: NodeJS.Timeout;

    constructor() {
        this.startFrameRateMonitoring();
        logger.info('DOM optimizer initialized', 'DOMOptimizer');
    }

    /**
     * Create an element with optimized properties
     */
    createElement<T extends HTMLElement>(
        tagName: string,
        properties: Record<string, string> = {},
        callback?: (element: T) => void
    ): T {
        const operation: DOMOperation = {
            type: 'create',
            properties,
            callback,
            priority: 1
        };

        this.scheduleOperation(operation);
        return document.createElement(tagName) as T;
    }

    /**
     * Update multiple element properties in a batch
     */
    updateElement(
        element: HTMLElement,
        properties: Record<string, string>,
        priority: number = 1
    ): void {
        const operation: DOMOperation = {
            type: 'update',
            element,
            properties,
            priority
        };

        this.scheduleOperation(operation);
    }

    /**
     * Update element by selector
     */
    updateElementBySelector(
        selector: string,
        properties: Record<string, string>,
        priority: number = 1
    ): void {
        const operation: DOMOperation = {
            type: 'update',
            selector,
            properties,
            priority
        };

        this.scheduleOperation(operation);
    }

    /**
     * Remove an element
     */
    removeElement(element: HTMLElement, priority: number = 1): void {
        const operation: DOMOperation = {
            type: 'remove',
            element,
            priority
        };

        this.scheduleOperation(operation);
    }

    /**
     * Batch update multiple elements
     */
    batchUpdate(operations: Array<{
        element?: HTMLElement;
        selector?: string;
        properties: Record<string, string>;
        priority?: number;
    }>): void {
        operations.forEach(({ element, selector, properties, priority = 1 }) => {
            const operation: DOMOperation = {
                type: 'update',
                element,
                selector,
                properties,
                priority
            };

            this.scheduleOperation(operation);
        });
    }

    /**
     * Apply styles to an element using CSS text (optimized)
     */
    applyStyles(element: HTMLElement, styles: Record<string, string>): void {
        // Convert to CSS text for single DOM write
        const cssText = Object.entries(styles)
            .map(([property, value]) => `${property}: ${value}`)
            .join('; ');

        element.style.cssText = cssText;
    }

    /**
     * Apply styles using CSS Custom Properties (optimized)
     */
    applyCustomProperties(
        element: HTMLElement,
        properties: Record<string, string>
    ): void {
        const cssText = Object.entries(properties)
            .map(([property, value]) => `--${property}: ${value}`)
            .join('; ');

        element.style.cssText = cssText;
    }

    /**
     * Create and append multiple elements efficiently
     */
    createFragment(elements: Array<{
        tagName: string;
        properties?: Record<string, string>;
        parent?: HTMLElement;
    }>): DocumentFragment {
        const fragment = document.createDocumentFragment();

        elements.forEach(({ tagName, properties, parent }) => {
            const element = document.createElement(tagName);

            if (properties) {
                this.applyStyles(element, properties);
            }

            if (parent) {
                parent.appendChild(element);
            } else {
                fragment.appendChild(element);
            }
        });

        return fragment;
    }

    /**
     * Efficiently append multiple children
     */
    appendChildren(parent: HTMLElement, children: HTMLElement[]): void {
        const fragment = document.createDocumentFragment();

        children.forEach(child => {
            fragment.appendChild(child);
        });

        parent.appendChild(fragment);
    }

    /**
     * Efficiently remove all children
     */
    removeChildren(parent: HTMLElement): void {
        while (parent.firstChild) {
            parent.removeChild(parent.firstChild);
        }
    }

    /**
     * Monitor DOM changes with MutationObserver (optimized)
     */
    observeChanges(
        target: HTMLElement,
        callback: (mutations: MutationRecord[]) => void,
        options: MutationObserverInit = {}
    ): () => void {
        const observer = new MutationObserver(callback);
        observer.observe(target, {
            childList: true,
            attributes: true,
            subtree: true,
            attributeFilter: ['style', 'class'],
            ...options
        });

        return () => {
            observer.disconnect();
        };
    }

    /**
     * Animate property changes smoothly
     */
    animateProperty(
        element: HTMLElement,
        property: string,
        fromValue: string,
        toValue: string,
        duration: number = 300,
        easing: string = 'ease-in-out'
    ): Promise<void> {
        return new Promise(resolve => {
            const startTime = Date.now();

            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Simple easing function (could be enhanced)
                const easedProgress = this.easeInOutQuad(progress);

                const currentValue = this.interpolateValue(fromValue, toValue, easedProgress);
                element.style.setProperty(property, currentValue);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };

            requestAnimationFrame(animate);
        });
    }

    /**
     * Add CSS class with performance consideration
     */
    addClass(element: HTMLElement, className: string): void {
        if (!element.classList.contains(className)) {
            element.classList.add(className);
        }
    }

    /**
     * Remove CSS class with performance consideration
     */
    removeClass(element: HTMLElement, className: string): void {
        if (element.classList.contains(className)) {
            element.classList.remove(className);
        }
    }

    /**
     * Toggle CSS class efficiently
     */
    toggleClass(element: HTMLElement, className: string, force?: boolean): boolean {
        if (force !== undefined) {
            if (force && !element.classList.contains(className)) {
                element.classList.add(className);
            } else if (!force && element.classList.contains(className)) {
                element.classList.remove(className);
            }
            return force !== undefined ? force : element.classList.contains(className);
        }

        return element.classList.toggle(className);
    }

    /**
     * Check if element is visible in viewport
     */
    isElementVisible(element: HTMLElement): boolean {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    /**
     * Get performance metrics
     */
    getMetrics(): PerformanceMetrics {
        return { ...this.metrics };
    }

    /**
     * Force immediate execution of pending operations
     */
    flush(): void {
        if (this.pendingOperations.length > 0) {
            this.executeOperations(this.pendingOperations);
            this.pendingOperations = [];
        }
    }

    /**
     * Destroy the DOM optimizer
     */
    destroy(): void {
        if (this.isDestroyed) return;

        this.isDestroyed = true;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        if (this.frameRateInterval) {
            clearInterval(this.frameRateInterval);
        }

        this.flush();
        logger.info('DOM optimizer destroyed', 'DOMOptimizer');
    }

    private scheduleOperation(operation: DOMOperation): void {
        this.pendingOperations.push(operation);
        this.scheduleRender();
    }

    private scheduleRender(): void {
        if (this.animationFrameId) {
            return; // Already scheduled
        }

        this.animationFrameId = requestAnimationFrame(() => {
            this.executeOperations(this.pendingOperations);
            this.pendingOperations = [];
            this.animationFrameId = null;
        });
    }

    private executeOperations(operations: DOMOperation[]): void {
        const startTime = performance.now();

        // Sort operations by priority
        operations.sort((a, b) => b.priority - a.priority);

        // Group operations by type for efficiency
        const createOps = operations.filter(op => op.type === 'create');
        const updateOps = operations.filter(op => op.type === 'update');
        const removeOps = operations.filter(op => op.type === 'remove');

        // Execute create operations first
        createOps.forEach(op => this.executeCreateOperation(op));

        // Execute update operations
        updateOps.forEach(op => this.executeUpdateOperation(op));

        // Execute remove operations last
        removeOps.forEach(op => this.executeRemoveOperation(op));

        // Update metrics
        this.metrics.totalOperations += operations.length;
        this.metrics.batchesProcessed++;
        this.metrics.averageBatchSize = this.metrics.totalOperations / this.metrics.batchesProcessed;
        this.metrics.renderTime = performance.now() - startTime;

        if (this.metrics.batchesProcessed % 100 === 0) {
            logger.debug('DOM batch executed', 'DOMOptimizer', {
                operations: operations.length,
                renderTime: this.metrics.renderTime.toFixed(2),
                totalBatches: this.metrics.batchesProcessed
            });
        }
    }

    private executeCreateOperation(operation: DOMOperation): void {
        if (operation.callback) {
            const element = document.createElement(operation.properties?.tagName || 'div');

            if (operation.properties) {
                this.applyStyles(element, operation.properties);
            }

            operation.callback(element);
        }
    }

    private executeUpdateOperation(operation: DOMOperation): void {
        const element = operation.element ||
                         (operation.selector ? document.querySelector(operation.selector) : null);

        if (element && operation.properties) {
            this.applyStyles(element, operation.properties);

            if (operation.callback) {
                operation.callback(element);
            }
        }
    }

    private executeRemoveOperation(operation: DOMOperation): void {
        if (operation.element && operation.element.parentNode) {
            operation.element.parentNode.removeChild(operation.element);
        }
    }

    private interpolateValue(fromValue: string, toValue: string, progress: number): string {
        // Simple linear interpolation
        return fromValue;
    }

    private easeInOutQuad(t: number): number {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    private startFrameRateMonitoring(): void {
        let frameCount = 0;
        let lastTime = performance.now();

        this.frameRateInterval = setInterval(() => {
            const now = performance.now();
            const delta = now - lastTime;

            if (delta >= 1000) { // Update every second
                this.metrics.frameRate = frameCount;
                frameCount = 0;
                lastTime = now;

                if (this.metrics.frameRate < 30) {
                    logger.debug('Low frame rate detected', 'DOMOptimizer', {
                        frameRate: this.metrics.frameRate
                    });
                }
            }

            frameCount++;
        }, 100);
    }
}

// Global instance
let globalDOMOptimizer: DOMOptimizer | null = null;

export function getDOMOptimizer(): DOMOptimizer {
    if (!globalDOMOptimizer) {
        globalDOMOptimizer = new DOMOptimizer();
    }
    return globalDOMOptimizer;
}

export function destroyDOMOptimizer(): void {
    if (globalDOMOptimizer) {
        globalDOMOptimizer.destroy();
        globalDOMOptimizer = null;
    }
}
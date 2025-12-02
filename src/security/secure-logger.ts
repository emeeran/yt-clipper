/**
 * Secure Logger Implementation
 * Prevents sensitive data exposure in logs and provides secure logging
 */

export interface LogEntry {
    timestamp: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    context?: string;
    metadata?: Record<string, any>;
    userId?: string;
    sessionId?: string;
}

export interface LogFilter {
    removeKeys: string[];
    removePatterns: RegExp[];
    maxFieldLength?: number;
}

export class SecureLogger {
    private static instance: SecureLogger;
    private logBuffer: LogEntry[] = [];
    private readonly maxBufferSize = 1000;
    private readonly isProduction = process.env.NODE_ENV === 'production';

    // Patterns to detect and redact sensitive information
    private readonly sensitivePatterns: RegExp[] = [
        // API keys
        /api[_-]?key["\s]*[:=]["\s]*([a-zA-Z0-9_-]{20,})/gi,
        /bearer["\s]*[:=]["\s]*([a-zA-Z0-9._-]{20,})/gi,
        /authorization["\s]*[:=]["\s]*([a-zA-Z0-9._-]{20,})/gi,

        // Generic keys and tokens
        /["']?([a-zA-Z0-9_-]*key[a-zA-Z0-9_-]*)["\s]*[:=]["\s]*([a-zA-Z0-9._-]{10,})/gi,
        /["']?([a-zA-Z0-9_-]*token[a-zA-Z0-9_-]*)["\s]*[:=]["\s]*([a-zA-Z0-9._-]{10,})/gi,
        /["']?([a-zA-Z0-9_-]*secret[a-zA-Z0-9_-]*)["\s]*[:=]["\s]*([a-zA-Z0-9._-]{10,})/gi,

        // Passwords
        /password["\s]*[:=]["\s]*([^\s"'}]+)/gi,
        /pwd["\s]*[:=]["\s]*([^\s"'}]+)/gi,

        // Email addresses
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

        // IP addresses (optional - uncomment if needed)
        // /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,

        // URLs with sensitive parameters
        /(https?:\/\/[^?]*\?[^#]*(?:api[_-]?key|token|secret)=[^&#]*)/gi
    ];

    private constructor() {
        // Initialize logger
        this.setupErrorHandlers();
    }

    static getInstance(): SecureLogger {
        if (!SecureLogger.instance) {
            SecureLogger.instance = new SecureLogger();
        }
        return SecureLogger.instance;
    }

    /**
     * Setup global error handlers for secure logging
     */
    private setupErrorHandlers(): void {
        if (typeof window !== 'undefined') {
            // Browser environment
            window.addEventListener('error', (event) => {
                this.error('Unhandled Error', {
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    error: event.error
                }, 'GlobalErrorHandler');
            });

            window.addEventListener('unhandledrejection', (event) => {
                this.error('Unhandled Promise Rejection', {
                    reason: event.reason,
                    promise: event.promise
                }, 'PromiseErrorHandler');
            });
        }
    }

    /**
     * Sanitize log data by removing sensitive information
     */
    sanitizeData(data: any, filter?: LogFilter): any {
        if (data === null || data === undefined) {
            return data;
        }

        if (typeof data === 'string') {
            return this.sanitizeString(data);
        }

        if (typeof data === 'object') {
            if (data instanceof Error) {
                return this.sanitizeError(data);
            }

            try {
                const cloned = JSON.parse(JSON.stringify(data));
                return this.sanitizeObject(cloned, filter);
            } catch {
                return '[Object cannot be serialized]';
            }
        }

        return data;
    }

    /**
     * Sanitize string by removing sensitive patterns
     */
    private sanitizeString(str: string): string {
        let sanitized = str;

        for (const pattern of this.sensitivePatterns) {
            sanitized = sanitized.replace(pattern, (match, ...groups) => {
                if (groups.length > 0) {
                    // Replace sensitive value with redacted version
                    const sensitiveValue = groups[groups.length - 1];
                    const redactedValue = sensitiveValue ?
                        `${sensitiveValue.substring(0, 4)}${'*'.repeat(sensitiveValue.length - 4)}` :
                        '[REDACTED]';
                    return match.replace(sensitiveValue, redactedValue);
                }
                return match.replace(/([a-zA-Z0-9._-]{10,})/, '[REDACTED]');
            });
        }

        return sanitized;
    }

    /**
     * Sanitize error object
     */
    private sanitizeError(error: Error): any {
        return {
            name: error.name,
            message: this.sanitizeString(error.message),
            stack: this.sanitizeString(error.stack || ''),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Sanitize object recursively
     */
    private sanitizeObject(obj: any, filter?: LogFilter): any {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item, filter));
        }

        const sanitized: any = {};

        for (const [key, value] of Object.entries(obj)) {
            // Check if key should be removed
            if (filter?.removeKeys.includes(key)) {
                continue;
            }

            // Check patterns for key removal
            if (filter?.removePatterns.some(pattern => pattern.test(key))) {
                continue;
            }

            // Sanitize key name
            const sanitizedKey = this.sanitizeString(key);

            // Process value
            if (typeof value === 'string') {
                let sanitizedValue = this.sanitizeString(value);

                // Apply field length limit
                if (filter?.maxFieldLength && sanitizedValue.length > filter.maxFieldLength) {
                    sanitizedValue = sanitizedValue.substring(0, filter.maxFieldLength) + '...[TRUNCATED]';
                }

                sanitized[sanitizedKey] = sanitizedValue;
            } else if (typeof value === 'object') {
                sanitized[sanitizedKey] = this.sanitizeObject(value, filter);
            } else {
                sanitized[sanitizedKey] = value;
            }
        }

        return sanitized;
    }

    /**
     * Create log entry with sensitive data removed
     */
    private createLogEntry(
        level: LogEntry['level'],
        message: string,
        metadata?: any,
        context?: string
    ): LogEntry {
        const sanitizedMetadata = metadata ? this.sanitizeData(metadata) : undefined;
        const sanitizedMessage = this.sanitizeString(message);

        return {
            timestamp: new Date().toISOString(),
            level,
            message: sanitizedMessage,
            context,
            metadata: sanitizedMetadata,
            sessionId: this.getSessionId(),
            userId: this.getUserId()
        };
    }

    /**
     * Get session ID for tracking
     */
    private getSessionId(): string {
        if (typeof sessionStorage !== 'undefined') {
            let sessionId = sessionStorage.getItem('yt-clipper-session-id');
            if (!sessionId) {
                sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                sessionStorage.setItem('yt-clipper-session-id', sessionId);
            }
            return sessionId;
        }
        return `session_${Date.now()}`;
    }

    /**
     * Get user ID for tracking
     */
    private getUserId(): string {
        // In a real implementation, this would come from user authentication
        return 'anonymous_user';
    }

    /**
     * Add log entry to buffer
     */
    private addToBuffer(entry: LogEntry): void {
        this.logBuffer.push(entry);

        // Maintain buffer size
        if (this.logBuffer.length > this.maxBufferSize) {
            this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
        }
    }

    /**
     * Output log entry based on environment
     */
    private outputLog(entry: LogEntry): void {
        if (this.isProduction) {
            // In production, send to secure logging service
            this.sendToSecureLoggingService(entry);
        } else {
            // In development, use console with appropriate level
            const logMessage = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`;

            switch (entry.level) {
                case 'debug':
                    console.debug(logMessage, entry.metadata);
                    break;
                case 'info':
                    console.info(logMessage, entry.metadata);
                    break;
                case 'warn':
                    console.warn(logMessage, entry.metadata);
                    break;
                case 'error':
                    console.error(logMessage, entry.metadata);
                    break;
            }
        }
    }

    /**
     * Send log to secure logging service
     */
    private async sendToSecureLoggingService(entry: LogEntry): Promise<void> {
        try {
            // In a real implementation, this would send to a secure logging endpoint
            // For now, we'll just add to buffer for potential retrieval
            this.addToBuffer(entry);

            // Example implementation (commented out):
            /*
            await fetch('/api/logs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + this.getLoggingToken()
                },
                body: JSON.stringify(entry)
            });
            */
        } catch (error) {
            // Fallback to console if secure logging fails
            console.error('Failed to send log to secure service:', error);
        }
    }

    /**
     * Debug level logging
     */
    debug(message: string, metadata?: any, context?: string): void {
        const entry = this.createLogEntry('debug', message, metadata, context);
        this.outputLog(entry);
    }

    /**
     * Info level logging
     */
    info(message: string, metadata?: any, context?: string): void {
        const entry = this.createLogEntry('info', message, metadata, context);
        this.outputLog(entry);
    }

    /**
     * Warning level logging
     */
    warn(message: string, metadata?: any, context?: string): void {
        const entry = this.createLogEntry('warn', message, metadata, context);
        this.outputLog(entry);
    }

    /**
     * Error level logging
     */
    error(message: string, metadata?: any, context?: string): void {
        const entry = this.createLogEntry('error', message, metadata, context);
        this.outputLog(entry);
    }

    /**
     * Get log buffer (for debugging)
     */
    getLogBuffer(): LogEntry[] {
        return [...this.logBuffer];
    }

    /**
     * Clear log buffer
     */
    clearLogBuffer(): void {
        this.logBuffer = [];
    }

    /**
     * Export logs for analysis
     */
    exportLogs(): string {
        return JSON.stringify(this.logBuffer, null, 2);
    }

    /**
     * Filter logs by criteria
     */
    filterLogs(criteria: {
        level?: LogEntry['level'];
        context?: string;
        since?: Date;
        until?: Date;
    }): LogEntry[] {
        return this.logBuffer.filter(entry => {
            if (criteria.level && entry.level !== criteria.level) {
                return false;
            }
            if (criteria.context && entry.context !== criteria.context) {
                return false;
            }
            if (criteria.since && new Date(entry.timestamp) < criteria.since) {
                return false;
            }
            if (criteria.until && new Date(entry.timestamp) > criteria.until) {
                return false;
            }
            return true;
        });
    }

    /**
     * Create custom log filter
     */
    createLogFilter(config: {
        removeKeys?: string[];
        removePatterns?: RegExp[];
        maxFieldLength?: number;
    }): LogFilter {
        return {
            removeKeys: config.removeKeys || [],
            removePatterns: config.removePatterns || [],
            maxFieldLength: config.maxFieldLength
        };
    }
}

/**
 * Global secure logger instance
 */
export const logger = SecureLogger.getInstance();

/**
 * Convenience functions for common logging tasks
 */
export const log = {
    debug: (message: string, metadata?: any, context?: string) => logger.debug(message, metadata, context),
    info: (message: string, metadata?: any, context?: string) => logger.info(message, metadata, context),
    warn: (message: string, metadata?: any, context?: string) => logger.warn(message, metadata, context),
    error: (message: string, metadata?: any, context?: string) => logger.error(message, metadata, context),

    // Security-specific logging
    security: (event: string, details?: any) => {
        logger.error(`SECURITY: ${event}`, details, 'SecurityEvent');
    },

    // Performance logging
    performance: (operation: string, duration: number, details?: any) => {
        logger.info(`PERFORMANCE: ${operation} took ${duration}ms`, { duration, ...details }, 'Performance');
    },

    // API logging
    api: (method: string, url: string, status: number, duration?: number) => {
        logger.info(`API: ${method} ${url} -> ${status}`, {
            method,
            url: url.replace(/\?.*$/, '?[REDACTED]'), // Remove query params
            status,
            duration
        }, 'APICall');
    }
};

/**
 * Decorator for automatic secure logging of method calls
 */
export function secureLog(options: {
    level?: LogEntry['level'];
    includeArgs?: boolean;
    includeResult?: boolean;
    logErrors?: boolean;
} = {}) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;

        descriptor.value = function (...args: any[]) {
            const startTime = Date.now();
            const context = `${target.constructor.name}.${propertyName}`;

            // Log method call
            if (options.logErrors !== false) {
                const logLevel = options.level || 'debug';
                logger[logLevel](`Calling ${context}`,
                    options.includeArgs ? { args: logger.sanitizeData(args) } : undefined,
                    'MethodCall'
                );
            }

            try {
                const result = method.apply(this, args);

                // Handle async methods
                if (result && typeof result.then === 'function') {
                    return result
                        .then((res: any) => {
                            if (options.includeResult) {
                                logger.info(`${context} completed`, {
                                    duration: Date.now() - startTime,
                                    result: logger.sanitizeData(res)
                                }, 'MethodResult');
                            }
                            return res;
                        })
                        .catch((error: Error) => {
                            logger.error(`${context} failed`, {
                                duration: Date.now() - startTime,
                                error: logger.sanitizeData(error)
                            }, 'MethodError');
                            throw error;
                        });
                } else {
                    // Handle sync methods
                    if (options.includeResult) {
                        logger.info(`${context} completed`, {
                            duration: Date.now() - startTime,
                            result: logger.sanitizeData(result)
                        }, 'MethodResult');
                    }
                    return result;
                }
            } catch (error) {
                logger.error(`${context} failed`, {
                    duration: Date.now() - startTime,
                    error: logger.sanitizeData(error)
                }, 'MethodError');
                throw error;
            }
        };

        return descriptor;
    };
}
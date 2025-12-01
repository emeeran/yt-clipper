/**
 * Enhanced logging service that combines structured logging with comprehensive error handling
 */

import { Notice } from 'obsidian';
import { ErrorHandlerInterface } from '../types/types';
import { MESSAGES } from '../utils/messages';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    SILENT = 4
}

export interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    message: string;
    context?: string;
    data?: Record<string, unknown>;
}

export interface LoggerConfig {
    level: LogLevel;
    enableConsole: boolean;
    enableFile: boolean;
    maxLogEntries: number;
    enableTimestamps: boolean;
}

export interface ErrorContext {
    operation?: string;
    provider?: string;
    userAction?: string;
    additionalData?: Record<string, unknown>;
}

export interface QuotaErrorInfo {
    isQuotaError: boolean;
    provider: string;
    errorType: 'rate_limit' | 'billing' | 'credit' | 'general_quota';
    canRetry: boolean;
    suggestedAction: string;
}

export class LoggingService implements ErrorHandlerInterface {
    private static instance: LoggingService;
    private logs: LogEntry[] = [];
    private config: LoggerConfig = {
        level: LogLevel.INFO,
        enableConsole: true,
        enableFile: false,
        maxLogEntries: 1000,
        enableTimestamps: true
    };

    private constructor() {
        this.logs = [];
    }

    static getInstance(): LoggingService {
        if (!LoggingService.instance) {
            LoggingService.instance = new LoggingService();
        }
        return LoggingService.instance;
    }

    updateConfig(newConfig: Partial<LoggerConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    debug(message: string, context?: string, data?: Record<string, unknown>): void {
        this.log(LogLevel.DEBUG, message, context, data);
    }

    info(message: string, context?: string, data?: Record<string, unknown>): void {
        this.log(LogLevel.INFO, message, context, data);
    }

    warn(message: string, context?: string, data?: Record<string, unknown>): void {
        this.log(LogLevel.WARN, message, context, data);
    }

    error(message: string, context?: string, data?: Record<string, unknown>): void {
        this.log(LogLevel.ERROR, message, context, data);
    }

    plugin(message: string): void {
        console.log(`[PLUGIN] ${message}`);
    }

    private log(level: LogLevel, message: string, context?: string, data?: Record<string, unknown>): void {
        if (level < this.config.level) return;

        const entry: LogEntry = {
            timestamp: new Date(),
            level,
            message,
            context,
            data
        };

        this.logs.push(entry);
        this.trimLogs();

        if (this.config.enableConsole) {
            this.outputToConsole(entry);
        }
    }

    private trimLogs(): void {
        if (this.logs.length > this.config.maxLogEntries) {
            this.logs = this.logs.slice(-this.config.maxLogEntries);
        }
    }

    private outputToConsole(entry: LogEntry): void {
        const timestamp = this.config.enableTimestamps
            ? `[${entry.timestamp.toISOString()}] `
            : '';

        const context = entry.context ? `[${entry.context}]` : '';
        const levelName = LogLevel[entry.level].padEnd(5);

        const message = `${timestamp}${context}${levelName}${entry.message}`;

        switch (entry.level) {
            case LogLevel.DEBUG:
                console.debug(message, entry.data);
                break;
            case LogLevel.INFO:
                console.info(message, entry.data);
                break;
            case LogLevel.WARN:
                console.warn(message, entry.data);
                break;
            case LogLevel.ERROR:
                console.error(message, entry.data);
                break;
        }
    }

    getLogs(): LogEntry[] {
        return [...this.logs];
    }

    clear(): void {
        this.logs = [];
    }

    getStatistics(): Record<string, number> {
        const stats: Record<string, number> = {};
        for (const entry of this.logs) {
            const level = LogLevel[entry.level];
            stats[level] = (stats[level] || 0) + 1;
        }
        return stats;
    }

    exportLogs(): string {
        return JSON.stringify({
            timestamp: new Date().toISOString(),
            config: this.config,
            logs: this.logs,
            statistics: this.getLogStatistics()
        }, null, 2);
    }

    handle(error: Error, context?: string, errorContext?: ErrorContext): void {
        const errorData = {
            message: error.message,
            stack: error.stack,
            context,
            timestamp: new Date().toISOString()
        };

        if (errorContext) {
            Object.assign(errorData, errorContext);
        }

        this.error(error.message, context, errorData);

        // Show notice for user-facing errors
        if (context !== 'Plugin initialization' && context !== 'Internal') {
            const userMessage = this.getUserFriendlyErrorMessage(error, context);
            new Notice(userMessage);
        }
    }

    private getUserFriendlyErrorMessage(error: Error, context?: string): string {
        if (error.message.includes('network') || error.message.includes('fetch')) {
            return MESSAGES.ERRORS.NETWORK_ERROR;
        }

        if (error.message.includes('401') || error.message.includes('403')) {
            return MESSAGES.ERRORS.API_KEY_INVALID;
        }

        if (error.message.includes('429')) {
            return MESSAGES.ERRORS.RATE_LIMIT;
        }

        if (error.message.includes('timeout')) {
            return MESSAGES.ERRORS.TIMEOUT_ERROR;
        }

        return `${MESSAGES.ERRORS.GENERIC_ERROR}: ${error.message}`;
    }

    detectQuotaError(error: any, provider: string): QuotaErrorInfo {
        const errorMessage = error.message || error.toString().toLowerCase();

        if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
            return {
                isQuotaError: true,
                provider,
                errorType: errorMessage.includes('rate') ? 'rate_limit' : 'general_quota',
                canRetry: true,
                suggestedAction: `Check your ${provider} account status and billing settings`
            };
        }

        return {
            isQuotaError: false,
            provider,
            errorType: 'general_quota',
            canRetry: false,
            suggestedAction: 'Please try again later'
        };
    }
}

// Export singleton instance for easy usage
let _logger: LoggingService | null = null;

export const logger = new Proxy({} as LoggingService, {
    get(target, prop) {
        if (!_logger) {
            // Fallback to console if logger not initialized
            const fallback = {
                info: (msg: string, ctx?: string, data?: any) => console.log(`[INFO] ${ctx ? ctx + ': ' : ''}${msg}`, data || ''),
                error: (msg: string, ctx?: string, data?: any) => console.error(`[ERROR] ${ctx ? ctx + ': ' : ''}${msg}`, data || ''),
                debug: (msg: string, ctx?: string, data?: any) => console.log(`[DEBUG] ${ctx ? ctx + ': ' : ''}${msg}`, data || ''),
                warn: (msg: string, ctx?: string, data?: any) => console.warn(`[WARN] ${ctx ? ctx + ': ' : ''}${msg}`, data || ''),
                plugin: (msg: string) => console.log(`[PLUGIN] ${msg}`)
            };
            return fallback[prop as keyof typeof fallback];
        }
        return _logger[prop as keyof LoggingService];
    }
});

// Function to initialize the logger properly
export function initializeLogger(config?: Partial<LoggerConfig>): LoggingService {
    _logger = LoggingService.getInstance();
    if (config) {
        _logger.updateConfig(config);
    }
    return _logger;
}

// Export backward compatible class
export class Logger {
    static getInstance(config?: Partial<LoggerConfig>): LoggingService {
        return initializeLogger(config);
    }
}

// Export backward compatible static methods
export class ErrorHandler implements ErrorHandlerInterface {
    handle(error: Error, context?: string, errorContext?: ErrorContext): void {
        const instance = initializeLogger();
        instance.handle(error, context, errorContext);
    }

    handleEnhanced(error: Error, context?: string, provider?: string): void {
        const instance = initializeLogger();

        let errorContext: ErrorContext = {};
        if (provider) {
            errorContext.provider = provider;
        }

        instance.handle(error, context, errorContext);
    }
}
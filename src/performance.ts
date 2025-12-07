import { PerformancePreset, CustomTimeoutSettings } from './types';

/**
 * Performance presets configuration
 */

type PerformanceMode = 'fast' | 'balanced' | 'quality';

export const PERFORMANCE_PRESETS: Record<PerformanceMode, PerformancePreset> & { [key: string]: PerformancePreset } = {
    fast: {
        name: 'Fast',
        description: 'Maximum speed with optimized models',
        timeouts: {
            geminiTimeout: 15000,
            groqTimeout: 10000,
            metadataTimeout: 5000
        },
        enableParallel: true,
        preferMultimodal: false,
        modelStrategy: {
            briefFormat: 'llama-3.1-8b-instant',
            executiveSummary: 'llama-3.3-70b-versatile',
            detailedGuide: 'gemini-2.0-flash-lite',
            fallbackModel: 'llama-3.1-8b-instant'
        }
    },
    balanced: {
        name: 'Balanced',
        description: 'Balanced speed and quality',
        timeouts: {
            geminiTimeout: 30000,
            groqTimeout: 20000,
            metadataTimeout: 10000
        },
        enableParallel: true,
        preferMultimodal: true,
        modelStrategy: {
            briefFormat: 'llama-3.1-8b-instant',
            executiveSummary: 'gemini-2.0-flash-lite',
            detailedGuide: 'gemini-2.5-flash',
            fallbackModel: 'llama-3.3-70b-versatile'
        }
    },
    quality: {
        name: 'Quality',
        description: 'Maximum quality with comprehensive analysis',
        timeouts: {
            geminiTimeout: 60000,
            groqTimeout: 30000,
            metadataTimeout: 15000
        },
        enableParallel: false,
        preferMultimodal: true,
        modelStrategy: {
            briefFormat: 'gemini-2.0-flash-lite',
            executiveSummary: 'gemini-2.5-flash',
            detailedGuide: 'gemini-2.5-pro',
            fallbackModel: 'gemini-2.0-flash'
        }
    }
};

export const DEFAULT_TIMEOUTS: CustomTimeoutSettings = {
    geminiTimeout: 30000,
    groqTimeout: 20000,
    metadataTimeout: 10000
};

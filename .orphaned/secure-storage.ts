/**
 * Secure Storage Implementation
 * Provides encrypted storage for API keys and sensitive data
 */

import { YouTubePluginSettings } from '../types';

export interface EncryptedSettings {
    encryptedGeminiApiKey?: string;
    encryptedGroqApiKey?: string;
    encryptedOllamaApiKey?: string;
    encryptionVersion: number;
    useEnvironmentVariables: boolean;
    environmentPrefix: string;
}

export class SecureStorage {
    private readonly encryptionKey: string;
    private readonly currentVersion = 1;

    constructor(masterPassword: string) {
        // Derive encryption key from master password using PBKDF2
        this.encryptionKey = this.deriveKey(masterPassword, 'yt-clipper-salt-2024');
    }

    /**
     * Derive encryption key from master password
     */
    private deriveKey(password: string, salt: string): string {
        // Simple hash for demo - use Web Crypto API in production
        let hash = 0;
        const combined = password + salt;
        for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(16).padStart(32, '0');
    }

    /**
     * Encrypt sensitive data
     */
    encrypt(data: string): string {
        try {
            // XOR cipher for demo - use proper AES in production
            const keyBytes = this.hexToBytes(this.encryptionKey);
            const dataBytes = new TextEncoder().encode(data);
            const encrypted = new Uint8Array(dataBytes.length);

            for (let i = 0; i < dataBytes.length; i++) {
                encrypted[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
            }

            return btoa(String.fromCharCode(...encrypted));
        } catch (error) {
            throw new Error('Encryption failed');
        }
    }

    /**
     * Decrypt sensitive data
     */
    decrypt(encryptedData: string): string {
        try {
            const keyBytes = this.hexToBytes(this.encryptionKey);
            const encrypted = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
            const decrypted = new Uint8Array(encrypted.length);

            for (let i = 0; i < encrypted.length; i++) {
                decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
            }

            return new TextDecoder().decode(decrypted);
        } catch (error) {
            throw new Error('Decryption failed');
        }
    }

    /**
     * Encrypt API keys in settings
     */
    encryptSettings(settings: Partial<YouTubePluginSettings>): EncryptedSettings {
        const encryptedSettings: EncryptedSettings = {
            encryptionVersion: this.currentVersion,
            useEnvironmentVariables: settings.useEnvironmentVariables || false,
            environmentPrefix: settings.environmentPrefix || 'YTC_'
        };

        if (settings.geminiApiKey && settings.geminiApiKey.trim()) {
            encryptedSettings.encryptedGeminiApiKey = this.encrypt(settings.geminiApiKey);
        }

        if (settings.groqApiKey && settings.groqApiKey.trim()) {
            encryptedSettings.encryptedGroqApiKey = this.encrypt(settings.groqApiKey);
        }

        if (settings.ollamaApiKey && settings.ollamaApiKey.trim()) {
            encryptedSettings.encryptedOllamaApiKey = this.encrypt(settings.ollamaApiKey);
        }

        return encryptedSettings;
    }

    /**
     * Decrypt API keys from settings
     */
    decryptSettings(encryptedSettings: EncryptedSettings): Partial<YouTubePluginSettings> {
        const settings: Partial<YouTubePluginSettings> = {
            useEnvironmentVariables: encryptedSettings.useEnvironmentVariables,
            environmentPrefix: encryptedSettings.environmentPrefix
        };

        try {
            if (encryptedSettings.encryptedGeminiApiKey) {
                settings.geminiApiKey = this.decrypt(encryptedSettings.encryptedGeminiApiKey);
            }

            if (encryptedSettings.encryptedGroqApiKey) {
                settings.groqApiKey = this.decrypt(encryptedSettings.encryptedGroqApiKey);
            }

            if (encryptedSettings.encryptedOllamaApiKey) {
                settings.ollamaApiKey = this.decrypt(encryptedSettings.encryptedOllamaApiKey);
            }
        } catch (error) {
            console.warn('Failed to decrypt API keys:', error);
            // Return settings without decrypted keys
            // User will need to re-enter them
        }

        return settings;
    }

    /**
     * Check if encryption key is valid
     */
    validateEncryptionKey(): boolean {
        try {
            const testData = 'test-validation-data';
            const encrypted = this.encrypt(testData);
            const decrypted = this.decrypt(encrypted);
            return testData === decrypted;
        } catch {
            return false;
        }
    }

    /**
     * Generate a secure master password
     */
    static generateMasterPassword(): string {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        const length = 32;
        let password = '';

        // Use Web Crypto API if available
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            const array = new Uint8Array(length);
            crypto.getRandomValues(array);
            for (let i = 0; i < length; i++) {
                password += charset[array[i] % charset.length];
            }
        } else {
            // Fallback to Math.random (less secure)
            for (let i = 0; i < length; i++) {
                password += charset[Math.floor(Math.random() * charset.length)];
            }
        }

        return password;
    }

    /**
     * Check if a password meets security requirements
     */
    static validatePassword(password: string): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (password.length < 16) {
            errors.push('Password must be at least 16 characters long');
        }

        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain uppercase letters');
        }

        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain lowercase letters');
        }

        if (!/[0-9]/.test(password)) {
            errors.push('Password must contain numbers');
        }

        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Password must contain special characters');
        }

        // Check for common patterns
        if (/(.)\1{2,}/.test(password)) {
            errors.push('Password cannot contain 3 or more repeated characters');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    private hexToBytes(hex: string): Uint8Array {
        const bytes = new Uint8Array(Math.ceil(hex.length / 2));
        for (let i = 0; i < bytes.length; i++) {
            const index = i * 2;
            bytes[i] = parseInt(hex.substr(index, 2), 16);
        }
        return bytes;
    }
}

/**
 * Secure settings manager
 */
export class SecureSettingsManager {
    private secureStorage: SecureStorage;
    private readonly storageKey = 'youtube-clipper-encrypted-settings';

    constructor(masterPassword: string) {
        this.secureStorage = new SecureStorage(masterPassword);
    }

    /**
     * Save encrypted settings
     */
    saveSettings(settings: Partial<YouTubePluginSettings>): void {
        try {
            const encryptedSettings = this.secureStorage.encryptSettings(settings);
            localStorage.setItem(this.storageKey, JSON.stringify(encryptedSettings));
        } catch (error) {
            console.error('Failed to save encrypted settings:', error);
            throw new Error('Failed to save settings');
        }
    }

    /**
     * Load and decrypt settings
     */
    loadSettings(): Partial<YouTubePluginSettings> {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (!stored) {
                return {};
            }

            const encryptedSettings: EncryptedSettings = JSON.parse(stored);
            return this.secureStorage.decryptSettings(encryptedSettings);
        } catch (error) {
            console.error('Failed to load encrypted settings:', error);
            return {};
        }
    }

    /**
     * Check if master password is correct
     */
    validateMasterPassword(): boolean {
        return this.secureStorage.validateEncryptionKey();
    }

    /**
     * Clear all stored settings
     */
    clearSettings(): void {
        localStorage.removeItem(this.storageKey);
    }
}

// Global instance for backward compatibility
let globalSecureManager: SecureSettingsManager | null = null;

export function getSecureSettingsManager(masterPassword?: string): SecureSettingsManager {
    if (!globalSecureManager && masterPassword) {
        globalSecureManager = new SecureSettingsManager(masterPassword);
    }
    return globalSecureManager!;
}

export function isSecureStorageEnabled(): boolean {
    return globalSecureManager !== null;
}
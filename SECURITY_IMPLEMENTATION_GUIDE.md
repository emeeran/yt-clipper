# Security Implementation Guide

**Purpose:** Step-by-step guide to implement security fixes identified in the audit
**Timeline:** 1-2 weeks for complete implementation
**Priority:** Critical fixes should be implemented immediately

---

## 🚨 **IMMEDIATE ACTION REQUIRED**

### **Priority 1: Fix Critical Vulnerabilities (24 hours)**

These vulnerabilities pose immediate security risks and must be fixed immediately.

---

### **1. Fix API Key Exposure in URLs**
**Risk:** 🔴 Critical - API keys exposed in logs, history, and proxies

#### **Current Vulnerable Code:**
```typescript
// VULNERABLE: API key in URL
const response = await fetch(`${API_ENDPOINTS.GEMINI}?key=${this.apiKey}`, {
    method: 'POST',
    headers: this.createHeaders(),
    body: JSON.stringify(this.createRequestBody(prompt))
});
```

#### **Step 1: Update API Provider Classes**

**File:** `src/gemini.ts`
```typescript
import { SecureHTTPClient, APIKeySecurity } from './security/secure-http-client';
import { logger } from './security/secure-logger';

export class GeminiProvider extends BaseAIProvider {
    readonly name = 'Google Gemini';

    constructor(apiKey: string, model?: string, timeout?: number) {
        super(apiKey, model || AI_MODELS.GEMINI, timeout);

        // Validate API key format
        const keyValidation = APIKeySecurity.validateAPIKey(apiKey, 'gemini');
        if (!keyValidation.isValid) {
            throw new Error(keyValidation.error);
        }
    }

    async process(prompt: string): Promise<string> {
        const startTime = Date.now();

        try {
            // Validate inputs
            if (!this.apiKey || this.apiKey.trim().length === 0) {
                throw new Error(MESSAGES.ERRORS.GEMINI_INVALID_KEY);
            }

            // SECURE: API key in header, not URL
            const { url, options } = APIKeySecurity.secureAPIRequest(
                API_ENDPOINTS.GEMINI_BASE,
                this.apiKey,
                'generateContent',
                this.createRequestBody(prompt)
            );

            const response = await SecureHTTPClient.secureFetch(url, options, {
                timeout: this.timeout,
                retries: 3,
                rateLimitKey: `gemini-${this.getUserId()}`
            });

            log.api('POST', API_ENDPOINTS.GEMINI, response.status, Date.now() - startTime);

            // Handle specific Gemini errors
            if (response.status === 400) {
                const errorData = await this.safeJsonParse(response);
                const errorMessage = errorData?.error?.message || 'Bad request';
                throw new Error(`Gemini API error: ${errorMessage}. Try checking the model configuration.`);
            }

            if (response.status === 401) {
                logger.error('Gemini API authentication failed', {
                    status: response.status,
                    endpoint: API_ENDPOINTS.GEMINI
                }, 'GeminiProvider');
                throw new Error(MESSAGES.ERRORS.GEMINI_INVALID_KEY);
            }

            if (response.status === 403) {
                throw new Error('Gemini API quota exceeded or billing required. Please check your plan and billing details.');
            }

            if (response.status === 429) {
                const errorData = await response.json();
                const errorMessage = errorData.error?.message || errorData.message || '';

                if (errorMessage.toLowerCase().includes('quota')) {
                    throw new Error(`Gemini API quota exceeded. ${errorMessage}`);
                } else {
                    throw new Error(`Gemini API rate limited: ${errorMessage}`);
                }
            }

            const data = await response.json();

            if (!this.validateResponse(data, ['candidates', '0', 'content', 'parts', '0', 'text'])) {
                throw new Error('Invalid Gemini API response format');
            }

            return data.candidates[0].content.parts[0].text;

        } catch (error) {
            logger.error('Gemini API request failed', {
                error: error instanceof Error ? error.message : String(error),
                duration: Date.now() - startTime,
                model: this.model
            }, 'GeminiProvider');
            throw error;
        }
    }

    private createRequestBody(prompt: string) {
        return {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: this._temperature,
                maxOutputTokens: this._maxTokens,
            }
        };
    }
}
```

**File:** `src/constants/api.ts`
```typescript
export const API_ENDPOINTS = {
    GEMINI_BASE: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro',
    GROQ: 'https://api.groq.com/openai/v1/chat/completions',
    YOUTUBE_OEMBED: 'https://www.youtube.com/oembed',
    CORS_PROXY: 'https://api.allorigins.win/raw'
} as const;
```

#### **Step 2: Update Groq Provider**
**File:** `src/groq.ts`
```typescript
import { SecureHTTPClient, APIKeySecurity } from './security/secure-http-client';
import { logger } from './security/secure-logger';

export class GroqProvider extends BaseAIProvider {
    readonly name = 'Groq';

    constructor(apiKey: string, model?: string, timeout?: number) {
        super(apiKey, model || AI_MODELS.GROQ, timeout);

        // Validate API key
        const keyValidation = APIKeySecurity.validateAPIKey(apiKey, 'groq');
        if (!keyValidation.isValid) {
            throw new Error(keyValidation.error);
        }
    }

    async process(prompt: string): Promise<string> {
        const startTime = Date.now();

        try {
            const { url, options } = APIKeySecurity.secureAPIRequest(
                API_ENDPOINTS.GROQ,
                this.apiKey,
                '',
                {
                    model: this.model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: this._temperature,
                    max_tokens: this._maxTokens,
                }
            );

            const response = await SecureHTTPClient.secureFetch(url, options, {
                timeout: this.timeout,
                retries: 3,
                rateLimitKey: `groq-${this.getUserId()}`
            });

            log.api('POST', API_ENDPOINTS.GROQ, response.status, Date.now() - startTime);

            if (response.status === 401) {
                throw new Error('Invalid Groq API key');
            }

            if (response.status === 429) {
                throw new Error('Groq API rate limit exceeded');
            }

            const data = await response.json();

            if (!this.validateResponse(data, ["choices", "0", "message"])) {
                throw new Error('Invalid Groq API response format');
            }

            return data.choices[0].message.content;

        } catch (error) {
            logger.error('Groq API request failed', {
                error: error instanceof Error ? error.message : String(error),
                duration: Date.now() - startTime,
                model: this.model
            }, 'GroqProvider');
            throw error;
        }
    }
}
```

---

### **2. Implement Encrypted API Key Storage**
**Risk:** 🔴 Critical - API keys stored in plaintext

#### **Step 1: Update Settings Interface**
**File:** `src/types.ts`
```typescript
export interface YouTubePluginSettings {
    // Remove plaintext API keys
    // geminiApiKey: string;
    // groqApiKey: string;
    // ollamaApiKey: string;

    // Add encrypted storage
    encryptedGeminiApiKey?: string;
    encryptedGroqApiKey?: string;
    encryptedOllamaApiKey?: string;
    encryptionVersion?: number;

    // Security settings
    useSecureStorage: boolean;
    masterPasswordHash?: string;

    // Existing settings remain unchanged
    outputPath: string;
    useEnvironmentVariables: boolean;
    environmentPrefix: string;
    modelOptionsCache?: Record<string, string[]>;
    customPrompts?: Record<OutputFormat, string>;
    performanceMode: PerformanceMode;
    customTimeouts?: CustomTimeoutSettings;
    enableParallelProcessing: boolean;
    preferMultimodal: boolean;
    defaultMaxTokens: number;
    defaultTemperature: number;
}
```

#### **Step 2: Create Secure Settings Manager**
**File:** `src/core/secure-settings-manager.ts`
```typescript
import { YouTubePluginSettings } from '../types';
import { SecureStorage, SecureSettingsManager } from '../security/secure-storage';
import { InputValidator } from '../security/input-validator';
import { logger } from '../security/secure-logger';

export class PluginSecureSettingsManager {
    private secureManager: SecureSettingsManager | null = null;
    private settings: Partial<YouTubePluginSettings> = {};

    constructor(private plugin: any) {}

    /**
     * Initialize secure storage with master password
     */
    async initializeSecureStorage(masterPassword: string): Promise<void> {
        try {
            this.secureManager = new SecureSettingsManager(masterPassword);

            // Validate master password
            if (!this.secureManager.validateMasterPassword()) {
                throw new Error('Invalid master password');
            }

            // Load existing settings
            this.settings = this.secureManager.loadSettings();

            logger.info('Secure storage initialized successfully', null, 'SettingsManager');
        } catch (error) {
            logger.error('Failed to initialize secure storage', { error }, 'SettingsManager');
            throw error;
        }
    }

    /**
     * Get decrypted API key
     */
    getAPIKey(provider: 'gemini' | 'groq' | 'ollama'): string | null {
        if (!this.secureManager) {
            return null;
        }

        const settings = this.secureManager.loadSettings();
        const keyMap = {
            'gemini': settings.geminiApiKey,
            'groq': settings.groqApiKey,
            'ollama': settings.ollamaApiKey
        };

        return keyMap[provider] || null;
    }

    /**
     * Set encrypted API key
     */
    async setAPIKey(provider: 'gemini' | 'groq' | 'ollama', apiKey: string): Promise<void> {
        if (!this.secureManager) {
            throw new Error('Secure storage not initialized');
        }

        // Validate API key format
        const validation = InputValidator.validateAPIKey(apiKey, provider);
        if (!validation.isValid) {
            throw new Error(validation.error);
        }

        try {
            const currentSettings = this.secureManager.loadSettings();
            currentSettings[`${provider}ApiKey` as keyof YouTubePluginSettings] = validation.sanitizedValue;

            this.secureManager.saveSettings(currentSettings);

            logger.info(`API key encrypted and saved for ${provider}`, { provider }, 'SettingsManager');
        } catch (error) {
            logger.error(`Failed to save API key for ${provider}`, { error, provider }, 'SettingsManager');
            throw error;
        }
    }

    /**
     * Migrate existing plaintext settings to encrypted storage
     */
    async migrateFromPlaintext(plaintextSettings: YouTubePluginSettings, masterPassword: string): Promise<void> {
        try {
            await this.initializeSecureStorage(masterPassword);

            const encryptedSettings: Partial<YouTubePluginSettings> = {};

            // Migrate API keys
            if (plaintextSettings.geminiApiKey) {
                await this.setAPIKey('gemini', plaintextSettings.geminiApiKey);
            }

            if (plaintextSettings.groqApiKey) {
                await this.setAPIKey('groq', plaintextSettings.groqApiKey);
            }

            if (plaintextSettings.ollamaApiKey) {
                await this.setAPIKey('ollama', plaintextSettings.ollamaApiKey);
            }

            // Copy other settings
            const { geminiApiKey, groqApiKey, ollamaApiKey, ...otherSettings } = plaintextSettings;
            Object.assign(encryptedSettings, otherSettings);
            encryptedSettings.useSecureStorage = true;
            encryptedSettings.encryptionVersion = 1;

            this.secureManager.saveSettings(encryptedSettings);

            logger.info('Successfully migrated to encrypted storage', null, 'SettingsManager');
        } catch (error) {
            logger.error('Failed to migrate to encrypted storage', { error }, 'SettingsManager');
            throw error;
        }
    }
}
```

#### **Step 3: Update Settings Tab**
**File:** `src/ui/settings/settings-tab.ts`
```typescript
import { PluginSecureSettingsManager } from '../core/secure-settings-manager';
import { InputValidator } from '../../security/input-validator';
import { SecureStorage } from '../../security/secure-storage';

export class YouTubeClipperSettingTab extends PluginSettingTab {
    private secureSettingsManager: PluginSecureSettingsManager;
    private masterPasswordSet: boolean = false;

    async display(): Promise<void> {
        this.containerEl.empty();
        this.containerEl.createEl('h2', { text: 'YouTube Clipper Settings' });

        // Add security section first
        this.addSecuritySettings();

        // Then add existing settings
        this.addExistingSettings();
    }

    private addSecuritySettings(): void {
        const securitySection = this.containerEl.createDiv('security-section');
        securitySection.createEl('h3', { text: '🔒 Security Settings' });

        // Master password setup
        if (!this.masterPasswordSet) {
            this.setupMasterPassword(securitySection);
        } else {
            this.showSecurityStatus(securitySection);
        }

        // API Key Management
        this.addSecureAPIKeyManagement(securitySection);
    }

    private setupMasterPassword(container: HTMLElement): void {
        const setupDiv = container.createDiv('master-password-setup');

        setupDiv.createEl('p', {
            text: 'Set up a master password to encrypt your API keys. This password will be required to access your API keys.'
        });

        let password1 = '';
        let password2 = '';

        // Password field 1
        new TextComponent(setupDiv)
            .setPlaceholder('Enter master password')
            .setInputEl(el => el.type = 'password')
            .onChange(value => {
                password1 = value;
            });

        // Password field 2
        new TextComponent(setupDiv)
            .setPlaceholder('Confirm master password')
            .setInputEl(el => el.type = 'password')
            .onChange(value => {
                password2 = value;
            });

        // Set password button
        const buttonContainer = setupDiv.createDiv('button-container');
        new ButtonComponent(buttonContainer)
            .setButtonText('Set Master Password')
            .setCta()
            .onClick(async () => {
                if (password1 !== password2) {
                    new Notice('Passwords do not match');
                    return;
                }

                const validation = SecureStorage.validatePassword(password1);
                if (!validation.isValid) {
                    new Notice('Password requirements: ' + validation.errors.join(', '));
                    return;
                }

                try {
                    await this.secureSettingsManager.initializeSecureStorage(password1);

                    // Check if migration is needed
                    const currentSettings = this.plugin.settings;
                    if (currentSettings.geminiApiKey || currentSettings.groqApiKey || currentSettings.ollamaApiKey) {
                        await this.migrateToSecureStorage(password1);
                    }

                    this.masterPasswordSet = true;
                    new Notice('Master password set successfully!');
                    this.display(); // Refresh settings display
                } catch (error) {
                    new Notice('Failed to set master password: ' + error.message);
                }
            });
    }

    private async migrateToSecureStorage(masterPassword: string): Promise<void> {
        const currentSettings = this.plugin.settings;

        if (currentSettings.geminiApiKey || currentSettings.groqApiKey || currentSettings.ollamaApiKey) {
            const confirmMigrate = confirm(
                'Existing API keys found. Migrate them to secure encrypted storage?'
            );

            if (confirmMigrate) {
                try {
                    await this.secureSettingsManager.migrateFromPlaintext(
                        currentSettings,
                        masterPassword
                    );

                    // Clear plaintext keys
                    const updatedSettings = { ...currentSettings };
                    delete updatedSettings.geminiApiKey;
                    delete updatedSettings.groqApiKey;
                    delete updatedSettings.ollamaApiKey;
                    updatedSettings.useSecureStorage = true;

                    await this.plugin.saveData(updatedSettings);
                    this.plugin.settings = updatedSettings;

                    new Notice('API keys migrated to secure storage');
                } catch (error) {
                    new Notice('Migration failed: ' + error.message);
                }
            }
        }
    }

    private addSecureAPIKeyManagement(container: HTMLElement): void {
        const keySection = container.createDiv('api-key-section');
        keySection.createEl('h4', { text: 'API Keys (Encrypted)' });

        // Gemini API Key
        this.addSecureAPIKeyInput(keySection, 'Gemini', 'gemini');

        // Groq API Key
        this.addSecureAPIKeyInput(keySection, 'Groq', 'groq');

        // Ollama API Key
        this.addSecureAPIKeyInput(keySection, 'Ollama', 'ollama');
    }

    private addSecureAPIKeyInput(container: HTMLElement, displayName: string, provider: string): void {
        const keyDiv = container.createDiv('api-key-input');
        keyDiv.createEl('label', { text: `${displayName} API Key:` });

        const currentKey = this.secureSettingsManager.getAPIKey(provider as any);
        const maskedKey = currentKey ? this.maskAPIKey(currentKey) : '';

        const inputComponent = new TextComponent(keyDiv)
            .setPlaceholder(`Enter ${displayName} API key`)
            .setValue(maskedKey)
            .setInputEl(el => el.type = 'password');

        new ButtonComponent(keyDiv)
            .setButtonText('Save')
            .onClick(async () => {
                const value = inputComponent.getValue();

                // Check if value changed (not masked)
                if (value && value !== maskedKey) {
                    const validation = InputValidator.validateAPIKey(value, provider as any);
                    if (!validation.isValid) {
                        new Notice(`Invalid ${displayName} API key: ${validation.error}`);
                        return;
                    }

                    try {
                        await this.secureSettingsManager.setAPIKey(provider as any, value);
                        new Notice(`${displayName} API key saved securely`);
                    } catch (error) {
                        new Notice(`Failed to save ${displayName} API key: ${error.message}`);
                    }
                }
            });
    }

    private maskAPIKey(apiKey: string): string {
        if (apiKey.length <= 8) return apiKey;
        return apiKey.substring(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4);
    }
}
```

---

### **3. Fix XSS Vulnerabilities**
**Risk:** 🔴 Critical - Remote code execution possible

#### **Step 1: Replace All innerHTML Usage**

**File:** Create `src/utils/safe-dom.ts`
```typescript
import { InputValidator, SafeDOM } from '../security/input-validator';

/**
 * Safe DOM utilities to replace innerHTML usage
 */
export class SafeDOMRenderer {
    /**
     * Safe alternative to element.innerHTML
     */
    static safeSetHTML(element: HTMLElement, content: string, allowBasicFormatting: boolean = false): void {
        if (allowBasicFormatting) {
            // Allow limited HTML formatting
            const validation = InputValidator.sanitizeHTML(content);
            if (validation.isValid) {
                element.innerHTML = validation.sanitizedValue!;
            } else {
                // Fallback to text content if HTML is invalid
                element.textContent = content;
            }
        } else {
            // Use text content for maximum security
            element.textContent = content;
        }
    }

    /**
     * Create safe HTML for progress indicators
     */
    static createProgressHTML(progress: number): string {
        return `
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
                <span class="progress-text">${progress.toFixed(1)}%</span>
            </div>
        `;
    }

    /**
     * Create safe modal content
     */
    static createModalContent(title: string, content: string): string {
        const sanitizedTitle = InputValidator.sanitizeUserInput(title).sanitizedValue || title;
        const sanitizedContent = InputValidator.sanitizeUserInput(content).sanitizedValue || content;

        return `
            <div class="modal-header">
                <h2>${sanitizedTitle}</h2>
            </div>
            <div class="modal-body">
                <p>${sanitizedContent}</p>
            </div>
        `;
    }

    /**
     * Safe button creation
     */
    static createSafeButton(text: string, onClick: () => void, className?: string): HTMLButtonElement {
        const button = SafeDOM.createElement('button', text, className);
        button.addEventListener('click', onClick);
        return button;
    }

    /**
     * Safe text input creation
     */
    static createSafeInput(placeholder: string, type: string = 'text'): HTMLInputElement {
        const input = SafeDOM.createElement('input') as HTMLInputElement;
        input.type = type;
        input.placeholder = InputValidator.sanitizeUserInput(placeholder).sanitizedValue || placeholder;
        return input;
    }
}
```

#### **Step 2: Update Modal Components**
**File:** `src/components/features/youtube/youtube-url-modal.ts`
```typescript
import { SafeDOMRenderer } from '../../utils/safe-dom';
import { InputValidator } from '../../security/input-validator';
import { logger } from '../../security/secure-logger';

export class YouTubeUrlModal extends Modal {
    async onOpen(): Promise<void> {
        try {
            logger.info('YouTube URL modal opened', null, 'YouTubeUrlModal');

            // Use safe DOM rendering
            const { containerEl } = this;
            containerEl.empty();

            // Safe modal header
            const header = SafeDOMRenderer.createElement('div', undefined, 'modal-header');
            SafeDOMRenderer.safeSetHTML(
                header,
                '<h1>📺 YouTube Clipper</h1>',
                true // Allow basic formatting
            );
            containerEl.appendChild(header);

            // Safe form creation
            const form = SafeDOMRenderer.createElement('form', undefined, 'youtube-form');

            // URL input
            const urlContainer = SafeDOMRenderer.createElement('div', undefined, 'form-group');
            const urlLabel = SafeDOMRenderer.createElement('label', 'YouTube URL:');
            const urlInput = SafeDOMRenderer.createSafeInput('Enter YouTube URL');
            urlInput.id = 'youtube-url';

            urlContainer.appendChild(urlLabel);
            urlContainer.appendChild(urlInput);
            form.appendChild(urlContainer);

            // Custom prompt
            const promptContainer = SafeDOMRenderer.createElement('div', undefined, 'form-group');
            const promptLabel = SafeDOMRenderer.createElement('label', 'Custom Prompt (Optional):');
            const promptInput = SafeDOMRenderer.createSafeInput('Enter custom prompt...');
            promptInput.id = 'custom-prompt';

            promptContainer.appendChild(promptLabel);
            promptContainer.appendChild(promptInput);
            form.appendChild(promptContainer);

            // Provider selection
            const providerContainer = SafeDOMRenderer.createElement('div', undefined, 'form-group');
            const providerLabel = SafeDOMRenderer.createElement('label', 'AI Provider:');
            const providerSelect = SafeDOMRenderer.createElement('select') as HTMLSelectElement;

            // Add provider options safely
            const providers = ['Google Gemini', 'Groq', 'Ollama'];
            providers.forEach(provider => {
                const option = SafeDOMRenderer.createElement('option', provider) as HTMLOptionElement;
                option.value = provider;
                providerSelect.appendChild(option);
            });

            providerContainer.appendChild(providerLabel);
            providerContainer.appendChild(providerSelect);
            form.appendChild(providerContainer);

            // Buttons
            const buttonContainer = SafeDOMRenderer.createElement('div', undefined, 'button-container');

            const processButton = SafeDOMRenderer.createSafeButton(
                '🎬 Process Video',
                async () => await this.handleProcessVideo(urlInput.value, promptInput.value, providerSelect.value),
                'primary-button'
            );

            const cancelButton = SafeDOMRenderer.createSafeButton(
                'Cancel',
                () => this.close(),
                'secondary-button'
            );

            buttonContainer.appendChild(processButton);
            buttonContainer.appendChild(cancelButton);

            form.appendChild(buttonContainer);
            containerEl.appendChild(form);

            // Add form submission handler
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleProcessVideo(urlInput.value, promptInput.value, providerSelect.value);
            });

        } catch (error) {
            logger.error('Failed to open YouTube URL modal', { error }, 'YouTubeUrlModal');
            this.showErrorModal('Failed to open modal: ' + error.message);
        }
    }

    private async handleProcessVideo(url: string, customPrompt: string, provider: string): Promise<void> {
        try {
            // Validate URL
            const urlValidation = InputValidator.validateYouTubeURL(url);
            if (!urlValidation.isValid) {
                new Notice(`Invalid URL: ${urlValidation.error}`);
                return;
            }

            // Validate custom prompt
            if (customPrompt) {
                const promptValidation = InputValidator.validatePrompt(customPrompt);
                if (!promptValidation.isValid) {
                    new Notice(`Invalid prompt: ${promptValidation.error}`);
                    return;
                }
            }

            logger.info('Processing YouTube video', {
                videoId: urlValidation.sanitizedValue,
                provider,
                hasCustomPrompt: !!customPrompt
            }, 'YouTubeUrlModal');

            // Close modal and start processing
            this.close();

            // Emit processing event
            this.plugin.app.workspace.trigger('youtube-clipper:process-video', {
                url: urlValidation.sanitizedValue,
                customPrompt: customPrompt || undefined,
                provider
            });

        } catch (error) {
            logger.error('Failed to process video', { error, url }, 'YouTubeUrlModal');
            new Notice(`Failed to process video: ${error.message}`);
        }
    }

    private showErrorModal(message: string): void {
        const errorModal = new Modal(this.app);
        errorModal.onOpen = () => {
            const { contentEl } = errorModal;
            SafeDOMRenderer.safeSetHTML(
                contentEl,
                `<h2>Error</h2><p>${InputValidator.sanitizeUserInput(message).sanitizedValue || message}</p>`,
                true
            );

            const closeButton = SafeDOMRenderer.createSafeButton('Close', () => errorModal.close());
            contentEl.appendChild(closeButton);
        };
        errorModal.open();
    }
}
```

#### **Step 3: Update All innerHTML Usage**

Search and replace all instances of `innerHTML`:

```bash
# Find all innerHTML usage
grep -r "innerHTML" src/ --include="*.ts" --include="*.js"

# Replace with safe alternatives
```

**Example replacements:**

```typescript
// BEFORE (VULNERABLE)
element.innerHTML = userInput;

// AFTER (SECURE)
SafeDOMRenderer.safeSetHTML(element, userInput);

// OR for pure text
element.textContent = InputValidator.sanitizeUserInput(userInput).sanitizedValue;
```

---

## 📋 **IMPLEMENTATION CHECKLIST**

### **Critical Fixes (24 hours)**
- [ ] **API Key URL Exposure** - Move all API keys to headers
  - [ ] Update Gemini provider
  - [ ] Update Groq provider
  - [ ] Update Ollama provider
  - [ ] Test API calls work correctly

- [ ] **Encrypted Storage** - Implement encrypted API key storage
  - [ ] Create secure storage system
  - [ ] Update settings interface
  - [ ] Create migration path
  - [ ] Test encryption/decryption

- [ ] **XSS Prevention** - Replace all innerHTML usage
  - [ ] Create safe DOM utilities
  - [ ] Update modal components
  - [ ] Update all innerHTML usage
  - [ ] Test for XSS protection

### **High Priority (1 week)**
- [ ] Input validation system
- [ ] CSRF protection
- [ ] Secure error handling
- [ ] Rate limiting
- [ ] Security headers

### **Medium Priority (2 weeks)**
- [ ] Secure logging
- [ ] Dependency updates
- [ ] Security monitoring
- [ ] Testing suite

---

## 🧪 **SECURITY TESTING**

### **1. XSS Testing**
```javascript
// Test these payloads in all input fields:
const xssPayloads = [
    '<script>alert("XSS")</script>',
    'javascript:alert("XSS")',
    '<img src="x" onerror="alert(\'XSS\')">',
    '<svg onload="alert(\'XSS\')">',
    '<iframe src="javascript:alert(\'XSS\')"></iframe>'
];

// None should execute - they should be safely escaped
```

### **2. API Key Security Testing**
```javascript
// Test that API keys are never exposed:
// 1. Check browser network tab - keys should be in headers, not URLs
// 2. Check browser console - no API keys should be logged
// 3. Check localStorage - keys should be encrypted
// 4. Check page source - no plaintext keys
```

### **3. Input Validation Testing**
```javascript
// Test malicious URLs:
const maliciousURLs = [
    'javascript:alert("XSS")',
    'data:text/html,<script>alert("XSS")</script>',
    'http://evil.com/phishing',
    'https://youtube.com/watch?v=valid<script>alert("XSS")</script>',
    '../../../etc/passwd'
];

// All should be rejected
```

---

## 🚀 **DEPLOYMENT STRATEGY**

### **Phase 1: Critical Fixes (Immediate)**
1. Deploy API key security fixes
2. Deploy encrypted storage
3. Deploy XSS prevention
4. Monitor for issues

### **Phase 2: High Priority (1 week)**
1. Deploy input validation
2. Deploy CSRF protection
3. Deploy secure error handling
4. Deploy rate limiting

### **Phase 3: Remaining Features (2 weeks)**
1. Deploy complete security suite
2. Security monitoring
3. Documentation updates
4. User communication

---

## ⚠️ **ROLLBACK PLAN**

If any security fix causes issues:

### **Immediate Rollback**
```bash
# Revert to previous version
git checkout <previous-commit-tag>
npm run build
# Deploy previous version
```

### **Partial Rollback**
```typescript
// Disable security features temporarily
const DISABLE_SECURITY = process.env.DISABLE_SECURITY === 'true';

if (!DISABLE_SECURITY) {
    // Apply security measures
}
```

---

## 📞 **SUPPORT**

If you encounter issues implementing these security fixes:

1. **Check the error logs** using the secure logger
2. **Verify API key format** using validation functions
3. **Test with simple cases** before complex ones
4. **Contact security team** for critical issues

**Remember:** Security fixes should never be skipped. If you encounter implementation challenges, seek help rather than deploying vulnerable code.

---

**Implementing these security fixes will protect your users and their data. Treat this as a critical priority.**
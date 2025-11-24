/**
 * Plugin settings tab component
 * Designed to prevent conflicts with other plugin settings
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import { YouTubePluginSettings, OutputFormat } from './types/types';
import { MESSAGES } from './messages';
import { ValidationUtils } from './validation';
import { ErrorHandler } from './services/error-handler';
import { SecureConfigService } from './secure-config';

// Unique CSS classes to prevent conflicts
const SETTINGS_CSS_CLASSES = {
    container: 'ytc-settings-container',
    section: 'ytc-settings-section',
    header: 'ytc-settings-header',
    validation: 'ytc-settings-validation'
} as const;

export interface SettingsTabOptions {
    plugin: any; // Plugin instance
    onSettingsChange: (settings: YouTubePluginSettings) => Promise<void>;
}

export class YouTubeSettingsTab extends PluginSettingTab {
    private settings: YouTubePluginSettings;
    private validationErrors: string[] = [];
    private secureConfig: SecureConfigService;

    constructor(
        app: App,
        private options: SettingsTabOptions
    ) {
        super(app, options.plugin);
        this.settings = { ...options.plugin.settings };
        this.secureConfig = new SecureConfigService(this.settings);
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // Add unique CSS class for conflict prevention
        containerEl.addClass(SETTINGS_CSS_CLASSES.container);
        containerEl.setAttribute('data-plugin', 'youtube-clipper');

        // Create simple working layout
        this.createSimpleWorkingLayout();
    }

    /**
     * Create simple working layout
     */
    private createSimpleWorkingLayout(): void {
        const { containerEl } = this;

        // Set container styles
        containerEl.style.display = 'flex';
        containerEl.style.flexDirection = 'column';
        containerEl.style.height = '100%';
        containerEl.style.gap = '12px';
        containerEl.style.padding = '12px';
        containerEl.style.overflow = 'hidden';
        containerEl.style.backgroundColor = 'var(--background-primary)';

        // Header
        this.createSimpleHeader();

        // Main content grid
        const mainContent = containerEl.createDiv();
        mainContent.style.display = 'grid';
        mainContent.style.gridTemplateColumns = '1fr 1fr';
        mainContent.style.gap = '16px';
        mainContent.style.flex = '1';
        mainContent.style.overflow = 'hidden';

        // Add responsive behavior
        const mediaQuery = window.matchMedia('(max-width: 800px)');
        const updateLayout = (e: MediaQueryListEvent | MediaQueryList) => {
            if (e.matches) {
                mainContent.style.gridTemplateColumns = '1fr';
                mainContent.style.gap = '12px';
            } else {
                mainContent.style.gridTemplateColumns = '1fr 1fr';
                mainContent.style.gap = '16px';
            }
        };
        mediaQuery.addEventListener('change', updateLayout as any);
        updateLayout(mediaQuery);

        // Create sections
        this.createAPISettingsSection(mainContent);
        this.createAIParametersSection(mainContent);
        this.createFileSettingsSection(mainContent);
        this.createQuickStartSection(mainContent);
    }

    /**
     * Create simple header
     */
    private createSimpleHeader(): void {
        const { containerEl } = this;

        const header = containerEl.createDiv();
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.justifyContent = 'space-between';
        header.style.padding = '8px 12px';
        header.style.background = 'var(--background-secondary)';
        header.style.borderRadius = '6px';
        header.style.border = '1px solid var(--background-modifier-border)';

        // Title
        const title = header.createEl('h2', {
            text: 'YouTubeClipper Settings',
            style: 'margin: 0; font-size: 1.1rem; font-weight: 600; color: var(--text-normal);'
        });

        // Status
        const hasValidConfig = this.validateConfiguration();
        const statusBadge = header.createDiv();
        statusBadge.style.padding = '4px 12px';
        statusBadge.style.borderRadius = '12px';
        statusBadge.style.fontSize = '0.75rem';
        statusBadge.style.fontWeight = '600';

        if (hasValidConfig) {
            statusBadge.style.background = 'var(--interactive-accent)';
            statusBadge.style.color = 'var(--text-on-accent)';
            statusBadge.textContent = '✓ Ready';
        } else {
            statusBadge.style.background = 'var(--text-warning)';
            statusBadge.style.color = 'var(--text-on-accent)';
            statusBadge.textContent = '⚠ Setup Needed';
        }
    }

    /**
     * Create API settings section
     */
    private createAPISettingsSection(mainContent: HTMLElement): void {
        const section = mainContent.createDiv();
        section.style.background = 'var(--background-secondary)';
        section.style.border = '1px solid var(--background-modifier-border)';
        section.style.borderRadius = '6px';
        section.style.padding = '12px';
        section.style.display = 'flex';
        section.style.flexDirection = 'column';
        section.style.gap = '8px';

        // Header
        const header = section.createEl('h3', {
            text: '🔑 API Configuration',
            style: 'margin: 0 0 6px 0; font-size: 0.9rem; font-weight: 600; color: var(--text-normal);'
        });

        // Use Obsidian's Setting component for consistency
        new Setting(section)
            .setName('Gemini API Key')
            .setDesc('Google Gemini API key for content processing')
            .addText(text => text
                .setPlaceholder('AIza...')
                .setValue(this.settings.geminiApiKey || '')
                .onChange(async (value) => {
                    await this.updateSetting('geminiApiKey', value);
                }));

        new Setting(section)
            .setName('Groq API Key')
            .setDesc('Groq API key for fast processing')
            .addText(text => text
                .setPlaceholder('gsk_...')
                .setValue(this.settings.groqApiKey || '')
                .onChange(async (value) => {
                    await this.updateSetting('groqApiKey', value);
                }));

        // Test button
        const testDiv = section.createDiv();
        testDiv.style.marginTop = '4px';
        new Setting(testDiv)
            .setName('Test Connection')
            .setDesc('Verify API keys')
            .addButton(btn => btn
                .setButtonText('Test')
                .onClick(async () => {
                    btn.setDisabled(true);
                    btn.setButtonText('Testing...');
                    try {
                        await this.testAPIKeys();
                        btn.setButtonText('✓ Success');
                        setTimeout(() => {
                            btn.setButtonText('Test');
                            btn.setDisabled(false);
                        }, 1500);
                    } catch (error) {
                        btn.setButtonText('✗ Failed');
                        ErrorHandler.handle(error as Error, 'API key test failed', true);
                        setTimeout(() => {
                            btn.setButtonText('Test');
                            btn.setDisabled(false);
                        }, 1500);
                    }
                }));
    }

    /**
     * Validate entire configuration
     */
    private validateConfiguration(): boolean {
        const hasApiKey = this.settings.geminiApiKey?.trim() || this.settings.groqApiKey?.trim();
        const hasValidPath = ValidationUtils.isValidPath(this.settings.outputPath);
        return Boolean(hasApiKey && hasValidPath);
    }

    /**
     * Show inline documentation
     */
    private showDocumentation(): void {
        window.open('https://github.com/youtube-clipper/obsidian-plugin#readme', '_blank');
    }    /**
     * Create API configuration settings
     */
    private createAPISettings(container: HTMLElement = this.containerEl): void {

        // API Keys section - compact header
        const apiHeader = container.createEl('h3', {
            text: 'API Keys',
            style: 'margin: 0 0 12px 0; font-size: 1rem; color: var(--text-normal);'
        });

        // Gemini API Key (password field)
        const geminiSetting = new Setting(container)
            .setName('Gemini API Key')
            .setDesc('Google Gemini API key')
            .addText(text => {
                // Use password-like input
                const inputEl = text
                    .setPlaceholder('sk-... (your key is encrypted)')
                    .setValue(this.settings.geminiApiKey || '')
                    .onChange(async (value) => {
                        await this.updateSetting('geminiApiKey', value);
                    })
                    .inputEl;
                
                // Make it password field
                inputEl.type = 'password';
                
                // Add toggle to show/hide
                inputEl.style.fontFamily = 'monospace';
                inputEl.style.letterSpacing = '0.1em';
                
                return text;
            });
        
        // Add show/hide toggle for Gemini key
        this.addKeyToggle(geminiSetting, this.settings.geminiApiKey);
        
        // Add clear button for Gemini key
        this.addKeyClearButton(geminiSetting, 'geminiApiKey');

        // Groq API Key (password field)
        const groqSetting = new Setting(container)
            .setName('Groq API Key')
            .setDesc('Groq API key (fast processing)')
            .addText(text => {
                // Use password-like input
                const inputEl = text
                    .setPlaceholder('gsk_... (your key is encrypted)')
                    .setValue(this.settings.groqApiKey || '')
                    .onChange(async (value) => {
                        await this.updateSetting('groqApiKey', value);
                    })
                    .inputEl;
                
                // Make it password field
                inputEl.type = 'password';
                
                // Add visual feedback
                inputEl.style.fontFamily = 'monospace';
                inputEl.style.letterSpacing = '0.1em';
                
                return text;
            });
        
        // Add show/hide toggle for Groq key
        this.addKeyToggle(groqSetting, this.settings.groqApiKey);
        
        // Add clear button for Groq key
        this.addKeyClearButton(groqSetting, 'groqApiKey');

        // Test Connectivity - compact
        const testSection = container.createDiv('ytc-test-connection');
        testSection.style.marginTop = '8px';
        testSection.style.paddingTop = '8px';
        testSection.style.borderTop = '1px solid var(--background-modifier-border)';

        new Setting(testSection)
            .setName('Test Connection')
            .setDesc('Verify API keys')
            .addButton(btn => btn
                .setButtonText('Test')
                .onClick(async () => {
                    btn.setDisabled(true);
                    btn.setButtonText('...');
                    try {
                        await this.testAPIKeys();
                        btn.setButtonText('✓ OK');
                        setTimeout(() => {
                            btn.setButtonText('Test');
                            btn.setDisabled(false);
                        }, 1500);
                    } catch (error) {
                        btn.setButtonText('✗ Error');
                        ErrorHandler.handle(error as Error, 'API key test failed', true);
                        setTimeout(() => {
                            btn.setButtonText('Test');
                            btn.setDisabled(false);
                        }, 1500);
                    }
                }));
    }

    /**
     * Add show/hide toggle for sensitive API keys
     */
    private addKeyToggle(setting: Setting, keyValue: string): void {
        // Always add toggle button, even if key is empty (user might be entering it now)
        const toggleBtn = setting.addButton(btn => btn
            .setButtonText('👁️ Show')
            .setTooltip('Toggle key visibility')
            .onClick((e) => {
                const inputs = setting.settingEl.querySelectorAll('input[type="password"], input[type="text"]');
                if (inputs.length === 0) return;

                const input = inputs[0] as HTMLInputElement;
                const isPassword = input.type === 'password';

                input.type = isPassword ? 'text' : 'password';
                btn.setButtonText(isPassword ? '👁️‍🗨️ Hide' : '👁️ Show');
            }));
    }

    /**
     * Add clear button to remove API key
     */
    private addKeyClearButton(setting: Setting, settingKey: 'geminiApiKey' | 'groqApiKey'): void {
        const clearBtn = setting.addButton(btn => btn
            .setButtonText('🗑️ Clear')
            .setTooltip('Remove this API key')
            .onClick(async () => {
                // Confirm before clearing
                const keyName = settingKey === 'geminiApiKey' ? 'Gemini' : 'Groq';
                if (confirm(`Are you sure you want to clear the ${keyName} API key?`)) {
                    await this.updateSetting(settingKey, '');
                    // Refresh the display to show empty field
                    this.display();
                }
            }));
    }

    /**
     * Test API keys for validity
     */
    private async testAPIKeys(): Promise<void> {
        const errors: string[] = [];

        if (this.settings.geminiApiKey) {
            try {
                const response = await fetch(
                    'https://generativelanguage.googleapis.com/v1beta/models?key=' + this.settings.geminiApiKey
                );
                if (!response.ok) {
                    errors.push(`Gemini API key invalid (${response.status})`);
                }
            } catch (error) {
                errors.push('Gemini API key test failed (network error)');
            }
        } else {
            errors.push('Gemini API key not configured');
        }

        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }
    }

    /**
     * Create AI parameters section
     */
    private createAIParametersSection(mainContent: HTMLElement): void {
        const section = mainContent.createDiv();
        section.style.background = 'var(--background-secondary)';
        section.style.border = '1px solid var(--background-modifier-border)';
        section.style.borderRadius = '6px';
        section.style.padding = '12px';
        section.style.display = 'flex';
        section.style.flexDirection = 'column';
        section.style.gap = '8px';

        // Header
        const header = section.createEl('h3', {
            text: '⚙️ AI Model Defaults',
            style: 'margin: 0 0 4px 0; font-size: 0.9rem; font-weight: 600; color: var(--text-normal);'
        });

        // Add global slider styles
        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
            .ytc-slider {
                width: 100% !important;
                height: 8px !important;
                border-radius: 4px !important;
                background: var(--interactive-normal) !important;
                outline: none !important;
                -webkit-appearance: none !important;
                appearance: none !important;
                cursor: pointer !important;
            }
            .ytc-slider:hover {
                background: var(--interactive-hover) !important;
            }
            .ytc-slider::-webkit-slider-thumb {
                -webkit-appearance: none !important;
                appearance: none !important;
                width: 18px !important;
                height: 18px !important;
                background: var(--interactive-accent) !important;
                border-radius: 50% !important;
                cursor: pointer !important;
                border: 2px solid var(--text-on-accent) !important;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
            }
            .ytc-slider::-moz-range-thumb {
                width: 18px !important;
                height: 18px !important;
                background: var(--interactive-accent) !important;
                border-radius: 50% !important;
                cursor: pointer !important;
                border: 2px solid var(--text-on-accent) !important;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
            }
            .ytc-slider::-webkit-slider-thumb:hover {
                transform: scale(1.1) !important;
            }
            .ytc-slider::-moz-range-thumb:hover {
                transform: scale(1.1) !important;
            }
        `;
        document.head.appendChild(styleSheet);

        // Compact slider container
        const createCompactSlider = (label: string, min: number, max: number, step: number, value: number, settingKey: string): HTMLElement => {
            const container = section.createDiv();
            container.style.marginBottom = '6px';

            const labelRow = container.createDiv();
            labelRow.style.display = 'flex';
            labelRow.style.justifyContent = 'space-between';
            labelRow.style.alignItems = 'center';
            labelRow.style.marginBottom = '4px';

            const labelText = labelRow.createSpan();
            labelText.textContent = label;
            labelText.style.fontSize = '0.85rem';
            labelText.style.fontWeight = '500';
            labelText.style.color = 'var(--text-normal)';

            const valueText = labelRow.createSpan();
            valueText.textContent = value.toString();
            valueText.style.fontSize = '0.8rem';
            valueText.style.fontWeight = '600';
            valueText.style.color = 'var(--interactive-accent)';
            valueText.style.padding = '2px 6px';
            valueText.style.background = 'var(--background-primary)';
            valueText.style.borderRadius = '4px';
            valueText.style.border = '1px solid var(--interactive-accent)';

            const slider = container.createEl('input', { type: 'range' });
            slider.className = 'ytc-slider';
            slider.min = min.toString();
            slider.max = max.toString();
            slider.step = step.toString();
            slider.value = value.toString();

            slider.addEventListener('input', () => {
                valueText.textContent = settingKey === 'defaultTemperature'
                    ? parseFloat(slider.value).toFixed(1)
                    : slider.value;
            });

            slider.addEventListener('change', async () => {
                const finalValue = settingKey === 'defaultTemperature'
                    ? parseFloat(slider.value)
                    : parseInt(slider.value);
                await this.updateSetting(settingKey, finalValue);
            });

            return container;
        };

        // Max Tokens slider
        createCompactSlider(
            'Max Tokens',
            256,
            8192,
            256,
            this.settings.defaultMaxTokens || 4096,
            'defaultMaxTokens'
        );

        // Temperature slider
        createCompactSlider(
            'Temperature',
            0,
            2,
            0.1,
            this.settings.defaultTemperature || 0.5,
            'defaultTemperature'
        );

        // Scale labels
        const scaleDiv = section.createDiv();
        scaleDiv.style.display = 'flex';
        scaleDiv.style.justifyContent = 'space-between';
        scaleDiv.style.fontSize = '0.7rem';
        scaleDiv.style.color = 'var(--text-muted)';
        scaleDiv.style.marginTop = '-4px';
        scaleDiv.style.padding = '0 4px';
        scaleDiv.createSpan({ text: 'Precise' });
        scaleDiv.createSpan({ text: 'Creative' });
    }

    /**
     * Create security configuration settings
     */
    private createSecuritySettings(container: HTMLElement = this.containerEl): void {
        
        // Security Settings section - compact header
        container.createEl('h3', {
            text: 'Security',
            style: 'margin: 0 0 12px 0; font-size: 1rem; color: var(--text-normal);'
        });

        // Use Environment Variables
        new Setting(container)
            .setName('Use Environment Variables')
            .setDesc('Load API keys from environment variables instead of storing them in configuration')
            .addToggle(toggle => toggle
                .setValue(this.settings.useEnvironmentVariables || false)
                .onChange(async (value) => {
                    await this.updateSetting('useEnvironmentVariables', value);
                    this.display(); // Refresh display to show/hide relevant settings
                }));

        // Environment Variable Prefix
        if (this.settings.useEnvironmentVariables) {
            new Setting(container)
                .setName('Environment Variable Prefix')
                .setDesc('Prefix for environment variable names')
                .addText(text => text
                    .setPlaceholder('YTC')
                    .setValue(this.settings.environmentPrefix || 'YTC')
                    .onChange(async (value) => {
                        await this.updateSetting('environmentPrefix', value || 'YTC');
                    }));

            // Environment Template - compact
            const envTemplate = this.secureConfig.getEnvironmentTemplate();
            const envSection = container.createDiv('ytc-env-template');
            envSection.style.marginTop = '8px';
            envSection.style.padding = '8px';
            envSection.style.backgroundColor = 'var(--background-primary)';
            envSection.style.borderRadius = '4px';
            envSection.style.border = '1px solid var(--background-modifier-border)';

            const envTitle = envSection.createEl('h4', {
                text: 'Environment Variables',
                style: 'margin: 0 0 4px 0; font-size: 0.8rem;'
            });

            const preEl = envSection.createEl('pre');
            preEl.style.margin = '0';
            preEl.style.fontSize = '0.7rem';
            preEl.style.lineHeight = '1.2';
            preEl.createEl('code', { text: envTemplate });

            // Copy button - compact
            const copyBtn = envSection.createEl('button', {
                text: '📋 Copy',
                style: 'margin-top: 6px; padding: 2px 6px; font-size: 0.7rem; border-radius: 3px; border: 1px solid var(--background-modifier-border); background: var(--interactive-normal); cursor: pointer;'
            });
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(envTemplate);
                copyBtn.textContent = '✓ Copied';
                setTimeout(() => copyBtn.textContent = '📋 Copy', 1500);
            });
        }

        // Security Validation - compact
        const validation = this.secureConfig.validateSecurityConfiguration();
        if (!validation.isSecure) {
            const warningEl = container.createDiv('ytc-security-warnings');
            warningEl.style.marginTop = '8px';
            warningEl.style.padding = '6px';
            warningEl.style.backgroundColor = 'var(--background-warning)';
            warningEl.style.borderRadius = '4px';
            warningEl.style.fontSize = '0.75rem';
            warningEl.style.color = 'var(--text-warning)';
            warningEl.createEl('div', { text: '⚠️ ' + validation.warnings.join(' ') });
        }
    }

    /**
     * Create file settings section
     */
    private createFileSettingsSection(mainContent: HTMLElement): void {
        const section = mainContent.createDiv();
        section.style.background = 'var(--background-secondary)';
        section.style.border = '1px solid var(--background-modifier-border)';
        section.style.borderRadius = '6px';
        section.style.padding = '12px';
        section.style.display = 'flex';
        section.style.flexDirection = 'column';
        section.style.gap = '8px';

        // Header
        const header = section.createEl('h3', {
            text: '📁 File Configuration',
            style: 'margin: 0 0 4px 0; font-size: 0.9rem; font-weight: 600; color: var(--text-normal);'
        });

        // Use Obsidian's Setting component
        new Setting(section)
            .setName('Output Path')
            .setDesc('Folder for processed videos (relative to vault root)')
            .addText(text => text
                .setPlaceholder('YouTube/Processed Videos')
                .setValue(this.settings.outputPath)
                .onChange(async (value) => {
                    await this.updateSetting('outputPath', value);
                }));
    }

    /**
     * Create validation status display
     */
    private createValidationStatus(): void {
        const { containerEl } = this;
        
        if (this.validationErrors.length > 0) {
            const errorSection = containerEl.createDiv();
            errorSection.style.marginTop = '20px';
            errorSection.style.padding = '10px';
            errorSection.style.backgroundColor = 'var(--background-modifier-error)';
            errorSection.style.borderRadius = '4px';
            
            errorSection.createEl('h4', { 
                text: '⚠️ Configuration Issues',
                attr: { style: 'color: var(--text-error); margin-top: 0;' }
            });
            
            const errorList = errorSection.createEl('ul');
            this.validationErrors.forEach(error => {
                errorList.createEl('li', { text: error });
            });
        } else {
            const successSection = containerEl.createDiv();
            successSection.style.marginTop = '20px';
            successSection.style.padding = '10px';
            successSection.style.backgroundColor = 'var(--background-modifier-success)';
            successSection.style.borderRadius = '4px';
            
            successSection.createEl('h4', { 
                text: '✅ Configuration Valid',
                attr: { style: 'color: var(--text-success); margin-top: 0;' }
            });
        }
    }

    /**
     * Create quick start section
     */
    private createQuickStartSection(mainContent: HTMLElement): void {
        const section = mainContent.createDiv();
        section.style.background = 'var(--background-secondary)';
        section.style.border = '1px solid var(--background-modifier-border)';
        section.style.borderRadius = '6px';
        section.style.padding = '12px';
        section.style.display = 'flex';
        section.style.flexDirection = 'column';
        section.style.gap = '8px';

        // Header
        const header = section.createEl('h3', {
            text: '🚀 Quick Start',
            style: 'margin: 0 0 4px 0; font-size: 0.9rem; font-weight: 600; color: var(--text-normal);'
        });

        // Steps
        const stepsDiv = section.createDiv();
        stepsDiv.style.fontSize = '0.8rem';
        stepsDiv.style.lineHeight = '1.4';

        const steps = [
            'Add API key (Gemini/Groq)',
            'Configure AI defaults',
            'Click video icon or paste URL',
            'Process video to create notes'
        ];

        steps.forEach((step, index) => {
            const stepDiv = stepsDiv.createDiv();
            stepDiv.style.marginBottom = '4px';
            stepDiv.style.display = 'flex';
            stepDiv.style.alignItems = 'flex-start';
            stepDiv.style.gap = '6px';

            const stepNumber = stepDiv.createSpan();
            stepNumber.textContent = (index + 1) + '.';
            stepNumber.style.color = 'var(--interactive-accent)';
            stepNumber.style.fontWeight = '600';
            stepNumber.style.minWidth = '16px';

            const stepText = stepDiv.createSpan();
            stepText.textContent = step;
        });

        // API links
        const linksDiv = section.createDiv();
        linksDiv.style.marginTop = '6px';
        linksDiv.style.paddingTop = '8px';
        linksDiv.style.borderTop = '1px solid var(--background-modifier-border)';
        linksDiv.style.fontSize = '0.75rem';
        linksDiv.style.color = 'var(--text-muted)';

        const linksLabel = linksDiv.createSpan();
        linksLabel.textContent = 'Get API Keys: ';
        linksLabel.style.fontWeight = '500';

        const geminiLink = linksDiv.createEl('a', {
            text: 'Gemini',
            href: 'https://aistudio.google.com/app/apikey',
            cls: 'external-link'
        });
        geminiLink.style.marginRight = '8px';
        geminiLink.style.color = 'var(--link-color)';

        const groqLink = linksDiv.createEl('a', {
            text: 'Groq',
            href: 'https://console.groq.com/keys',
            cls: 'external-link'
        });
        groqLink.style.color = 'var(--link-color)';
    }

    /**
     * Update a setting value
     */
    private async updateSetting(
        key: keyof YouTubePluginSettings, 
        value: string | boolean
    ): Promise<void> {
        try {
            (this.settings as any)[key] = value;
            await this.validateAndSaveSettings();
        } catch (error) {
            ErrorHandler.handle(error as Error, `Settings update for ${key}`);
        }
    }

    /**
     * Validate and save settings
     */
    private async validateAndSaveSettings(): Promise<void> {
        const validation = ValidationUtils.validateSettings(this.settings);
        this.validationErrors = validation.errors;
        
        if (validation.isValid) {
            await this.options.onSettingsChange(this.settings);
        }
        
        // Refresh display to show validation status
        this.display();
    }

    /**
     * Get current settings
     */
    getSettings(): YouTubePluginSettings {
        return { ...this.settings };
    }

    /**
     * Update settings from external source
     */
    updateSettings(newSettings: YouTubePluginSettings): void {
        this.settings = { ...newSettings };
        this.display();
    }
}

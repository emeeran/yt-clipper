/**
 * Tests for UserPreferencesService
 */

import { UserPreferencesService } from '../../src/services/user-preferences-service';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: jest.fn((key: string) => store[key] || null),
        setItem: jest.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            store = {};
        }),
    };
})();

Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
});

describe('UserPreferencesService', () => {
    beforeEach(() => {
        localStorageMock.clear();
        jest.clearAllMocks();
    });

    describe('loadPreferences', () => {
        it('should return default preferences when nothing stored', () => {
            const prefs = UserPreferencesService.loadPreferences();
            
            expect(prefs.autoSelectProvider).toBe(true);
            expect(prefs.showPreview).toBe(true);
            expect(prefs.enableKeyboardShortcuts).toBe(true);
        });

        it('should merge stored preferences with defaults', () => {
            localStorage.setItem('yt-clipper-user-preferences', JSON.stringify({
                lastFormat: 'brief',
                showPreview: false,
            }));
            
            const prefs = UserPreferencesService.loadPreferences();
            
            expect(prefs.lastFormat).toBe('brief');
            expect(prefs.showPreview).toBe(false);
            expect(prefs.autoSelectProvider).toBe(true); // default
        });
    });

    describe('savePreferences', () => {
        it('should save preferences to localStorage', () => {
            const prefs = {
                lastFormat: 'detailed-guide' as const,
                lastProvider: 'Groq',
            };
            
            UserPreferencesService.savePreferences(prefs);
            
            expect(localStorage.setItem).toHaveBeenCalledWith(
                'yt-clipper-user-preferences',
                expect.any(String)
            );
        });
    });

    describe('getPreference / setPreference', () => {
        it('should get and set individual preferences', () => {
            UserPreferencesService.setPreference('lastFormat', 'brief');
            
            const format = UserPreferencesService.getPreference('lastFormat');
            expect(format).toBe('brief');
        });
    });

    describe('updateLastUsed', () => {
        it('should update last used settings', () => {
            UserPreferencesService.updateLastUsed({
                format: 'executive-summary',
                provider: 'Google Gemini',
                model: 'gemini-pro',
            });
            
            const prefs = UserPreferencesService.loadPreferences();
            
            expect(prefs.lastFormat).toBe('executive-summary');
            expect(prefs.lastProvider).toBe('Google Gemini');
            expect(prefs.lastModel).toBe('gemini-pro');
        });

        it('should track format usage statistics', () => {
            UserPreferencesService.updateLastUsed({ format: 'brief' });
            UserPreferencesService.updateLastUsed({ format: 'brief' });
            UserPreferencesService.updateLastUsed({ format: 'detailed-guide' });
            
            const prefs = UserPreferencesService.loadPreferences();
            
            expect(prefs.formatUsage?.brief).toBe(2);
            expect(prefs.formatUsage?.['detailed-guide']).toBe(1);
        });

        it('should increment total processed count', () => {
            UserPreferencesService.updateLastUsed({ format: 'brief' });
            UserPreferencesService.updateLastUsed({ format: 'brief' });
            
            const prefs = UserPreferencesService.loadPreferences();
            expect(prefs.totalProcessed).toBe(2);
        });
    });

    describe('getSmartDefaultFormat', () => {
        it('should return most frequently used format', () => {
            // Use brief 3 times, executive-summary 1 time
            UserPreferencesService.updateLastUsed({ format: 'brief' });
            UserPreferencesService.updateLastUsed({ format: 'brief' });
            UserPreferencesService.updateLastUsed({ format: 'brief' });
            UserPreferencesService.updateLastUsed({ format: 'executive-summary' });
            
            const format = UserPreferencesService.getSmartDefaultFormat();
            expect(format).toBe('brief');
        });

        it('should return preferred format if set', () => {
            UserPreferencesService.setPreference('preferredFormat', 'detailed-guide');
            UserPreferencesService.updateLastUsed({ format: 'brief' });
            UserPreferencesService.updateLastUsed({ format: 'brief' });
            
            const format = UserPreferencesService.getSmartDefaultFormat();
            expect(format).toBe('detailed-guide');
        });
    });

    describe('getSmartDefaultProvider', () => {
        it('should return most frequently used provider', () => {
            // Reset first to clear any defaults
            UserPreferencesService.resetPreferences();
            
            UserPreferencesService.updateLastUsed({ provider: 'Groq' });
            UserPreferencesService.updateLastUsed({ provider: 'Groq' });
            UserPreferencesService.updateLastUsed({ provider: 'Groq' });
            UserPreferencesService.updateLastUsed({ provider: 'Google Gemini' });
            
            const provider = UserPreferencesService.getSmartDefaultProvider();
            expect(provider).toBe('Groq');
        });
    });

    describe('getUserInsights', () => {
        it('should return usage insights', () => {
            UserPreferencesService.updateLastUsed({ 
                format: 'brief',
                provider: 'Groq',
            });
            
            const insights = UserPreferencesService.getUserInsights();
            
            expect(insights.favoriteFormat).toBe('brief');
            expect(insights.favoriteProvider).toBe('Groq');
            expect(insights.usageLevel).toBe('light');
        });

        it('should classify usage level correctly', () => {
            // Add 20+ usages for heavy usage
            for (let i = 0; i < 25; i++) {
                UserPreferencesService.updateLastUsed({ format: 'brief' });
            }
            
            const insights = UserPreferencesService.getUserInsights();
            expect(insights.usageLevel).toBe('heavy');
        });
    });

    describe('resetPreferences', () => {
        it('should reset all preferences', () => {
            UserPreferencesService.setPreference('lastFormat', 'brief');
            UserPreferencesService.setPreference('lastProvider', 'Groq');
            
            UserPreferencesService.resetPreferences();
            
            expect(localStorage.removeItem).toHaveBeenCalledWith('yt-clipper-user-preferences');
        });
    });

    describe('export/import', () => {
        it('should export preferences as JSON', () => {
            UserPreferencesService.setPreference('lastFormat', 'brief');
            
            const exported = UserPreferencesService.exportPreferences();
            const parsed = JSON.parse(exported);
            
            expect(parsed.lastFormat).toBe('brief');
        });

        it('should import preferences from JSON', () => {
            const json = JSON.stringify({
                lastFormat: 'detailed-guide',
                lastProvider: 'Groq',
            });
            
            const result = UserPreferencesService.importPreferences(json);
            
            expect(result).toBe(true);
            expect(UserPreferencesService.getPreference('lastFormat')).toBe('detailed-guide');
        });

        it('should return false for invalid JSON', () => {
            const result = UserPreferencesService.importPreferences('invalid json');
            expect(result).toBe(false);
        });
    });
});

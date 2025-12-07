/**
 * URL Handler unit tests
 * Testing core URL handling functionality
 */

import { UrlHandler } from '../../src/services/url-handler';
import { YouTubePluginSettings } from '../../src/types/types';

// Mock Obsidian App
const createMockApp = () => ({
    vault: {
        read: jest.fn(),
        getAbstractFileByPath: jest.fn()
    },
    workspace: {
        getActiveFile: jest.fn()
    }
} as any);

// Mock TFile with all required properties
const createMockFile = (path: string, name: string, ctime: number = Date.now()) => ({
    path,
    name,
    basename: name.replace('.md', ''),
    extension: 'md',
    stat: { ctime, mtime: ctime, size: 100 },
    parent: null
} as any);

const createMockSettings = (): YouTubePluginSettings => ({
    geminiApiKey: '',
    groqApiKey: '',
    outputPath: 'YouTube/Processed Videos',
    useEnvironmentVariables: false,
    environmentPrefix: 'YTC',
    performanceMode: 'balanced',
    enableParallelProcessing: true,
    preferMultimodal: true
});

describe('UrlHandler', () => {
    describe('protocol handling', () => {
        let mockApp: any;
        let mockOnUrlDetected: jest.Mock;
        let urlHandler: UrlHandler;

        beforeEach(() => {
            jest.useFakeTimers();
            mockApp = createMockApp();
            mockOnUrlDetected = jest.fn();
            urlHandler = new UrlHandler(mockApp, createMockSettings(), mockOnUrlDetected, {
                noteMarker: '<!-- ytc-extension:youtube-clipper -->',
                urlHandlerDelay: 50,
                maxHandledFiles: 100,
                tempFileAgeThreshold: 5000
            });
        });

        afterEach(() => {
            jest.useRealTimers();
            urlHandler.clear();
        });

        it('should handle protocol with valid YouTube URL', () => {
            urlHandler.handleProtocol({ url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' });
            jest.runAllTimers();

            expect(mockOnUrlDetected).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
                    source: 'protocol'
                })
            );
        });

        it('should handle protocol with youtu.be short URL', () => {
            urlHandler.handleProtocol({ content: 'https://youtu.be/dQw4w9WgXcQ' });
            jest.runAllTimers();

            expect(mockOnUrlDetected).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: 'https://youtu.be/dQw4w9WgXcQ',
                    source: 'protocol'
                })
            );
        });

        it('should handle protocol with path parameter', () => {
            urlHandler.handleProtocol({ path: 'https://www.youtube.com/watch?v=abc12345678' });
            jest.runAllTimers();

            expect(mockOnUrlDetected).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: 'https://www.youtube.com/watch?v=abc12345678',
                    source: 'protocol'
                })
            );
        });

        it('should ignore invalid URLs in protocol', () => {
            urlHandler.handleProtocol({ url: 'https://example.com/not-youtube' });
            jest.runAllTimers();

            expect(mockOnUrlDetected).not.toHaveBeenCalled();
        });

        it('should ignore empty protocol params', () => {
            urlHandler.handleProtocol({});
            jest.runAllTimers();

            expect(mockOnUrlDetected).not.toHaveBeenCalled();
        });
    });

    describe('settings management', () => {
        let mockApp: any;
        let urlHandler: UrlHandler;

        beforeEach(() => {
            mockApp = createMockApp();
            urlHandler = new UrlHandler(mockApp, createMockSettings(), jest.fn());
        });

        it('should update settings without error', () => {
            const newSettings = { ...createMockSettings(), outputPath: 'New/Output/Path' };
            expect(() => urlHandler.updateSettings(newSettings)).not.toThrow();
        });

        it('should clear state without error', () => {
            expect(() => urlHandler.clear()).not.toThrow();
        });
    });

    describe('file path filtering', () => {
        let mockApp: any;
        let mockOnUrlDetected: jest.Mock;
        let urlHandler: UrlHandler;

        beforeEach(() => {
            jest.useFakeTimers();
            mockApp = createMockApp();
            mockOnUrlDetected = jest.fn();
            urlHandler = new UrlHandler(mockApp, createMockSettings(), mockOnUrlDetected, {
                noteMarker: '<!-- ytc-extension:youtube-clipper -->',
                urlHandlerDelay: 50,
                maxHandledFiles: 100,
                tempFileAgeThreshold: 5000
            });
        });

        afterEach(() => {
            jest.useRealTimers();
            urlHandler.clear();
        });

        it('should not process files in output path', async () => {
            const file = createMockFile('YouTube/Processed Videos/test.md', 'test.md');
            const content = 'https://youtube.com/watch?v=test123';
            
            mockApp.vault.read.mockResolvedValue(content);

            await urlHandler.handleFileCreate(file);
            jest.runAllTimers();

            expect(mockOnUrlDetected).not.toHaveBeenCalled();
        });

        it('should not process old files', async () => {
            // File created 10 seconds ago (outside 5s threshold)
            const file = createMockFile('test.md', 'test.md', Date.now() - 10000);
            const content = 'https://youtube.com/watch?v=test123';
            
            mockApp.vault.read.mockResolvedValue(content);

            await urlHandler.handleFileCreate(file);
            jest.runAllTimers();

            expect(mockOnUrlDetected).not.toHaveBeenCalled();
        });

        it('should not process files without YouTube URL', async () => {
            const file = createMockFile('test.md', 'test.md');
            const content = 'Just some regular text content';
            
            mockApp.vault.read.mockResolvedValue(content);

            await urlHandler.handleFileCreate(file);
            jest.runAllTimers();

            expect(mockOnUrlDetected).not.toHaveBeenCalled();
        });

        it('should not process null/undefined files', async () => {
            await urlHandler.handleFileCreate(null as any);
            jest.runAllTimers();

            expect(mockOnUrlDetected).not.toHaveBeenCalled();
        });
    });

    describe('active leaf handling', () => {
        let mockApp: any;
        let mockOnUrlDetected: jest.Mock;
        let urlHandler: UrlHandler;

        beforeEach(() => {
            jest.useFakeTimers();
            mockApp = createMockApp();
            mockOnUrlDetected = jest.fn();
            urlHandler = new UrlHandler(mockApp, createMockSettings(), mockOnUrlDetected, {
                noteMarker: '<!-- ytc-extension:youtube-clipper -->',
                urlHandlerDelay: 50,
                maxHandledFiles: 100,
                tempFileAgeThreshold: 5000
            });
        });

        afterEach(() => {
            jest.useRealTimers();
            urlHandler.clear();
        });

        it('should not process when no active file', async () => {
            mockApp.workspace.getActiveFile.mockReturnValue(null);

            await urlHandler.handleActiveLeafChange();
            jest.runAllTimers();

            expect(mockOnUrlDetected).not.toHaveBeenCalled();
        });

        it('should not process files in output path via active leaf', async () => {
            const file = createMockFile('YouTube/Processed Videos/test.md', 'test.md');
            const content = 'https://youtube.com/watch?v=test123';
            
            mockApp.workspace.getActiveFile.mockReturnValue(file);
            mockApp.vault.read.mockResolvedValue(content);

            await urlHandler.handleActiveLeafChange();
            jest.runAllTimers();

            expect(mockOnUrlDetected).not.toHaveBeenCalled();
        });
    });
});

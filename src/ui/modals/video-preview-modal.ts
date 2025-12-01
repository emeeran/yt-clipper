/**
 * Video preview modal with metadata display and quick analysis info
 */

import { App, Modal, Notice, Setting } from 'obsidian';
import { EnhancedVideoData } from './video-data';
import { VideoOptimizationEngine } from './video-optimization';
import { EnhancedAIService, OptimizedProcessingOptions } from './services/enhanced-ai-service';

export interface VideoPreviewOptions {
    videoData: EnhancedVideoData;
    videoUrl: string;
    performanceMode: string;
    format: string;
    onAnalyze: (options: any) => void;
    onCancel: () => void;
}

export class VideoPreviewModal extends Modal {
    private videoData: EnhancedVideoData;
    private videoUrl: string;
    private performanceMode: string;
    private format: string;
    private enhancedService: EnhancedAIService;

    constructor(
        app: App,
        private options: VideoPreviewOptions
    ) {
        super(app);
        this.videoData = options.videoData;
        this.videoUrl = options.videoUrl;
        this.performanceMode = options.performanceMode;
        this.format = options.format;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('youtube-clipper-preview-modal');

        // Header with video info
        this.createHeader(contentEl);

        // Video preview section
        this.createVideoPreview(contentEl);

        // Video metadata
        this.createMetadataSection(contentEl);

        // Analysis strategy info
        this.createStrategySection(contentEl);

        // Action buttons
        this.createActionButtons(contentEl);
    }

    onClose() {
        // Cleanup if needed
    }

    private createHeader(container: HTMLElement) {
        const headerEl = container.createDiv('preview-header');

        // Title
        headerEl.createEl('h2', {
            text: this.videoData.title || 'YouTube Video',
            cls: 'video-title'
        });

        // Duration and other quick info
        const infoEl = headerEl.createDiv('video-info');

        if (this.videoData.duration) {
            const duration = this.videoData.duration;
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            infoEl.createSpan({
                text: `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}`,
                cls: 'duration'
            });
        }

        if (this.videoData.hasTranscript) {
            infoEl.createSpan({
                text: '📝 Transcript Available',
                cls: 'transcript-badge'
            });
        }

        if (this.videoData.channelName) {
            infoEl.createSpan({
                text: `📺 ${this.videoData.channelName}`,
                cls: 'channel'
            });
        }
    }

    private createVideoPreview(container: HTMLElement) {
        const previewEl = container.createDiv('video-preview');

        // Thumbnail
        if (this.videoData.thumbnail && this.isValidImageUrl(this.videoData.thumbnail)) {
            // Use standard DOM createElement for better error handling
            const thumbnailEl = document.createElement('img');
            thumbnailEl.className = 'video-thumbnail';
            thumbnailEl.alt = this.videoData.title || 'Video thumbnail';
            thumbnailEl.style.cursor = 'pointer';
            thumbnailEl.style.maxWidth = '100%';
            thumbnailEl.style.borderRadius = '4px';

            // Start with placeholder, then try to load actual thumbnail
            thumbnailEl.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgwIiBoZWlnaHQ9IjE1NyIgdmlld0JveD0iMCAwIDI4MCAxNTciIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyODAiIGhlaWdodD0iMTU3IiBmaWxsPSIjMzMzMzMzIi8+Cjx0ZXh0IHg9IjE0MCIgeT0iNzgiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+VGh1bWJuYWlsPC90ZXh0Pgo8L3N2Zz4K';

            // Try to load the actual thumbnail
            const testImage = new Image();
            testImage.onload = () => {
                thumbnailEl.src = this.videoData.thumbnail;
            };
            testImage.onerror = () => {
                console.warn('Thumbnail validation failed, keeping placeholder');
            };
            testImage.src = this.videoData.thumbnail;

            // Handle image loading errors gracefully with enhanced error prevention
            thumbnailEl.onerror = (event) => {
                console.warn('Failed to load video thumbnail, showing placeholder', event);

                // Prevent Obsidian from showing "[Image #X]" error
                event.stopPropagation();
                event.preventDefault();

                // Remove the src attribute to stop any further loading attempts
                thumbnailEl.removeAttribute('src');

                // Set a fixed placeholder
                thumbnailEl.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgwIiBoZWlnaHQ9IjE1NyIgdmlld0JveD0iMCAwIDI4MCAxNTciIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyODAiIGhlaWdodD0iMTU3IiBmaWxsPSIjMzMzMzMzIi8+Cjx0ZXh0IHg9IjE0MCIgeT0iNzgiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+VGh1bWJuYWlsPC90ZXh0Pgo8L3N2Zz4K';
                thumbnailEl.alt = 'Failed to load thumbnail';
            };

            // Also handle onabort for when loading is interrupted
            thumbnailEl.onabort = () => {
                console.warn('Video thumbnail loading was aborted');
                thumbnailEl.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgwIiBoZWlnaHQ9IjE1NyIgdmlld0JveD0iMCAwIDI4MCAxNTciIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyODAiIGhlaWdodD0iMTU3IiBmaWxsPSIjMzMzMzMzIi8+Cjx0ZXh0IHg9IjE0MCIgeT0iNzgiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+VGh1bWJuYWlsPC90ZXh0Pgo8L3N2Zz4K';
            };

            thumbnailEl.onclick = () => {
                // Open video in new tab
                window.open(this.videoUrl, '_blank');
            };

            previewEl.appendChild(thumbnailEl);
        }

        // Embed player (small preview)
        const embedContainer = previewEl.createDiv('embed-container');

        const iframeEl = document.createElement('iframe');
        iframeEl.width = '280';
        iframeEl.height = '157';
        iframeEl.src = `https://www.youtube.com/embed/${this.extractVideoId()}`;
        iframeEl.title = this.videoData.title || 'YouTube video player';
        iframeEl.frameBorder = '0';
        iframeEl.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframeEl.allowFullscreen = '';

        // Handle iframe loading errors with more comprehensive error prevention
        iframeEl.onerror = (event) => {
            console.warn('Failed to load YouTube embed, showing placeholder', event);

            // Prevent Obsidian from showing "[Image #X]" error
            event.stopPropagation();
            event.preventDefault();

            // Immediately hide the iframe to prevent rendering issues
            iframeEl.style.display = 'none';
            iframeEl.removeAttribute('src'); // Remove src to stop further loading attempts

            // Create a robust placeholder div
            const placeholderEl = document.createElement('div');
            placeholderEl.style.cssText = 'width:280px;height:157px;background:#333;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:4px;overflow:hidden;';
            placeholderEl.innerHTML = `
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19.14 12.94c.94-.53.94-1.53.94-1.53s-1.23.45-1.56-.78l-4.12 3.12c-.73.73-1.92.73-2.65 0s-.67.65-1.56.79l2.41 1.32c.83.66 1.83.99 2.91.99 1.08 0 2.08-.33 2.91-.99l2.41 1.32c.73.73 1.23.79 1.56.78s-.45.53-.94.94L19.14 12.94zm-6.81-1.35L8.77 5.54c-.66-.36-1.48-.17-2.03.32l1.91-1.89c.2-.21.23-.5.16-.74l-2.44 1.37c-.27.48-.49-.1-.74-.1H5.78c-.25 0-.47-.02-.74-.1L3.37 7.83c-.21.21-.23.51-.16.74l1.89-1.91c.45-.5.49-1.21.17-2.03l-1.35 6.75zM8.77 8.5l-1.35 6.75c-.22.48-.1.91-.1 1.35v3.06c0 .86.49 1.91.49 2.65.49s2.08-.33 2.65-.49l2.41-1.37c.27-.48.11-.75.11-1.24H18.7c.25 0 .47-.02.74-.11l-2.41-1.37c-.45-.5-.48-1.21-.17-2.03z"/>
                    <text x="12" y="16" fill="white" font-size="10" text-anchor="middle">Video</text>
                </svg>
                <div style="color:#ccc;margin-top:8px;font-size:11px;">Video Unavailable</div>
            `;

            // Replace iframe with placeholder
            embedContainer.innerHTML = '';
            embedContainer.appendChild(placeholderEl);
        };

        // Also handle onload to ensure successful loading
        iframeEl.onload = () => {
            console.log('YouTube iframe loaded successfully in video preview');
        };

        embedContainer.appendChild(iframeEl);
    }

    private createMetadataSection(container: HTMLElement) {
        const metadataEl = container.createDiv('metadata-section');
        metadataEl.createEl('h3', { text: 'Video Details' });

        // Description preview
        if (this.videoData.description) {
            const descEl = metadataEl.createDiv('description-preview');
            descEl.createEl('h4', { text: 'Description' });

            const descText = this.videoData.description.length > 300 ?
                this.videoData.description.substring(0, 300) + '...' :
                this.videoData.description;

            descEl.createEl('p', { text: descText });
        }

        // Video statistics
        const statsEl = metadataEl.createDiv('video-stats');
        statsEl.createEl('h4', { text: 'Analysis Information' });

        const statsList = statsEl.createEl('ul');

        if (this.videoData.duration) {
            const duration = this.videoData.duration;
            let durationCategory = 'Short';
            if (duration > 600) durationCategory = 'Medium';
            if (duration > 1800) durationCategory = 'Long';

            statsList.createEl('li', { text: `Duration: ${durationCategory} (${Math.floor(duration / 60)}m ${duration % 60}s)` });
        }

        if (this.videoData.hasTranscript) {
            statsList.createEl('li', { text: '🚀 Fast transcript analysis available' });
        }

        // Add transcript availability check in background
        this.checkTranscriptAvailability();
    }

    private async checkTranscriptAvailability() {
        if (this.videoData.hasTranscript === undefined) {
            // This would be implemented with the actual transcript service
            // For now, simulate the check
            setTimeout(() => {
                this.videoData.hasTranscript = Math.random() > 0.3; // 70% chance of transcript
                this.createStrategySection(document.querySelector('.strategy-section') as HTMLElement);
            }, 1000);
        }
    }

    private createStrategySection(container: HTMLElement) {
        // Clear existing content if any
        container.empty();
        container.addClass('strategy-section');

        container.createEl('h3', { text: 'Analysis Strategy' });

        const strategy = VideoOptimizationEngine.selectOptimalStrategy(
            this.videoData.duration || 0,
            this.performanceMode,
            this.videoData.hasTranscript || false,
            this.format
        );

        // Strategy info
        const strategyInfoEl = container.createDiv('strategy-info');
        strategyInfoEl.createEl('div', {
            text: strategy.name,
            cls: 'strategy-name'
        });
        strategyInfoEl.createEl('p', {
            text: strategy.description,
            cls: 'strategy-description'
        });

        // Estimated processing time
        const timeEl = container.createDiv('processing-time');
        timeEl.createEl('h4', { text: 'Estimated Processing Time' });

        // Simulate processing time calculation
        const baseTime = Math.max(10, (this.videoData.duration || 300) / 30);
        const optimized = VideoOptimizationEngine.estimateOptimizedProcessingTime(
            this.videoData.duration || 0,
            strategy,
            baseTime
        );

        const timeInfoEl = timeEl.createDiv('time-estimate');
        timeInfoEl.createSpan({
            text: `⏱️ ${optimized.min}-${optimized.max} seconds`,
            cls: 'time-range'
        });
        timeInfoEl.createSpan({
            text: ` (${strategy.estimatedTimeReduction}% faster than standard)`,
            cls: 'time-improvement'
        });

        // Speed indicators
        const indicatorsEl = container.createDiv('speed-indicators');

        if (this.videoData.hasTranscript) {
            indicatorsEl.createDiv({
                text: '⚡ Transcript-based processing',
                cls: 'indicator fast'
            });
        }

        if (this.performanceMode === 'fast') {
            indicatorsEl.createDiv({
                text: '🚀 Fast mode enabled',
                cls: 'indicator fast'
            });
        }

        if (strategy.chunkProcessing) {
            indicatorsEl.createDiv({
                text: '🔧 Chunked processing',
                cls: 'indicator medium'
            });
        }
    }

    private createActionButtons(container: HTMLElement) {
        const actionsEl = container.createDiv('action-buttons');

        // Main analyze button
        const analyzeBtn = actionsEl.createEl('button', {
            text: '🚀 Analyze Video',
            cls: 'mod-cta primary-action'
        });

        analyzeBtn.onclick = () => {
            this.options.onAnalyze({
                videoData: this.videoData,
                videoUrl: this.videoUrl,
                performanceMode: this.performanceMode,
                format: this.format
            });
            this.close();
        };

        // Alternative analysis options
        const alternativesEl = actionsEl.createDiv('alternative-actions');

        // Fast analysis
        const fastBtn = alternativesEl.createEl('button', {
            text: '⚡ Quick Analysis',
            cls: 'mod-cta secondary-action'
        });

        fastBtn.onclick = () => {
            this.options.onAnalyze({
                videoData: this.videoData,
                videoUrl: this.videoUrl,
                performanceMode: 'fast',
                format: 'brief'
            });
            this.close();
        };

        // Cancel button
        const cancelBtn = actionsEl.createEl('button', {
            text: 'Cancel',
            cls: 'mod-cancel'
        });

        cancelBtn.onclick = () => {
            this.options.onCancel();
            this.close();
        };
    }

    private isValidImageUrl(url: string): boolean {
        if (!url || typeof url !== 'string') return false;

        try {
            const urlObj = new URL(url);
            const validProtocols = ['http:', 'https:'];
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

            if (!validProtocols.includes(urlObj.protocol)) return false;

            // Check if it has an image extension or is a YouTube thumbnail URL
            const hasImageExtension = imageExtensions.some(ext => urlObj.pathname.toLowerCase().endsWith(ext));
            const isYouTubeThumbnail = urlObj.hostname.includes('ytimg.com') ||
                                    urlObj.hostname.includes('youtube.com');

            return hasImageExtension || isYouTubeThumbnail;
        } catch {
            return false;
        }
    }

    private extractVideoId(): string {
        const match = this.videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
        return match ? match[1] : '';
    }

    /**
     * Static method to create and show the modal
     */
    static show(app: App, options: VideoPreviewOptions): VideoPreviewModal {
        const modal = new VideoPreviewModal(app, options);
        modal.open();
        return modal;
    }
}
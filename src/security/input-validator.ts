/**
 * Secure Input Validation and Sanitization
 * Prevents XSS, injection attacks, and validates user input
 */

export interface ValidationResult {
    isValid: boolean;
    sanitizedValue?: string;
    error?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

export class InputValidator {
    // Allowlist of safe HTML tags
    private static readonly ALLOWED_TAGS = [
        'b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code',
        'pre', 'hr'
    ];

    // Allowlist of safe attributes
    private static readonly ALLOWED_ATTRIBUTES = ['class', 'id'];

    // Malicious patterns to detect
    private static readonly MALICIOUS_PATTERNS = [
        /javascript:/gi,
        /data:text\/html/gi,
        /vbscript:/gi,
        /on\w+\s*=/gi,  // Event handlers like onclick, onerror
        /<script[^>]*>/gi,
        /<\/script>/gi,
        /<iframe[^>]*>/gi,
        /<object[^>]*>/gi,
        /<embed[^>]*>/gi,
        /expression\s*\(/gi,
        /@import/gi,
        /behavior:/gi,
        /binding:/gi,
        /-moz-binding/gi
    ];

    /**
     * Validate YouTube URL with comprehensive checks
     */
    static validateYouTubeURL(url: string): ValidationResult {
        try {
            if (!url || typeof url !== 'string') {
                return {
                    isValid: false,
                    error: 'URL is required',
                    severity: 'high'
                };
            }

            // Check for malicious patterns
            const maliciousCheck = this.detectMaliciousContent(url);
            if (!maliciousCheck.isValid) {
                return maliciousCheck;
            }

            // Parse URL
            let parsedUrl: URL;
            try {
                parsedUrl = new URL(url);
            } catch {
                return {
                    isValid: false,
                    error: 'Invalid URL format',
                    severity: 'high'
                };
            }

            // Check protocol
            if (parsedUrl.protocol !== 'https:') {
                return {
                    isValid: false,
                    error: 'Only HTTPS URLs are allowed',
                    severity: 'critical'
                };
            }

            // Check allowlist of domains
            const allowedDomains = [
                'youtube.com',
                'www.youtube.com',
                'youtu.be',
                'm.youtube.com',
                'music.youtube.com'
            ];

            if (!allowedDomains.includes(parsedUrl.hostname)) {
                return {
                    isValid: false,
                    error: 'Only YouTube URLs are allowed',
                    severity: 'high'
                };
            }

            // Extract video ID
            const videoIdResult = this.extractVideoId(parsedUrl);
            if (!videoIdResult.isValid) {
                return videoIdResult;
            }

            return {
                isValid: true,
                sanitizedValue: url,
                severity: 'low'
            };

        } catch (error) {
            return {
                isValid: false,
                error: 'URL validation failed',
                severity: 'high'
            };
        }
    }

    /**
     * Extract and validate YouTube video ID
     */
    private static extractVideoId(url: URL): ValidationResult {
        let videoId = '';

        if (url.hostname === 'youtu.be') {
            videoId = url.pathname.slice(1); // Remove leading slash
        } else if (url.hostname.includes('youtube.com')) {
            const searchParams = url.searchParams;
            videoId = searchParams.get('v') || '';
        }

        // Validate video ID format
        const videoIdRegex = /^[a-zA-Z0-9_-]{11,12}$/;
        if (!videoId || !videoIdRegex.test(videoId)) {
            return {
                isValid: false,
                error: 'Invalid YouTube video ID',
                severity: 'high'
            };
        }

        return {
            isValid: true,
            sanitizedValue: videoId,
            severity: 'low'
        };
    }

    /**
     * Detect malicious content in input
     */
    static detectMaliciousContent(input: string): ValidationResult {
        for (const pattern of this.MALICIOUS_PATTERNS) {
            if (pattern.test(input)) {
                return {
                    isValid: false,
                    error: 'Potentially malicious content detected',
                    severity: 'critical'
                };
            }
        }

        return {
            isValid: true,
            sanitizedValue: input,
            severity: 'low'
        };
    }

    /**
     * Sanitize user input for safe display
     */
    static sanitizeUserInput(input: string, maxLength: number = 1000): ValidationResult {
        if (!input || typeof input !== 'string') {
            return {
                isValid: false,
                error: 'Invalid input',
                severity: 'medium'
            };
        }

        // Check length
        if (input.length > maxLength) {
            return {
                isValid: false,
                error: `Input exceeds maximum length of ${maxLength} characters`,
                severity: 'medium'
            };
        }

        // Detect malicious content
        const maliciousCheck = this.detectMaliciousContent(input);
        if (!maliciousCheck.isValid) {
            return maliciousCheck;
        }

        // Escape HTML special characters
        let sanitized = input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;')
            .trim();

        // Remove control characters
        sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

        return {
            isValid: true,
            sanitizedValue: sanitized,
            severity: 'low'
        };
    }

    /**
     * Sanitize HTML content for safe display
     */
    static sanitizeHTML(html: string): ValidationResult {
        if (!html || typeof html !== 'string') {
            return {
                isValid: false,
                error: 'Invalid HTML content',
                severity: 'medium'
            };
        }

        // Detect malicious content
        const maliciousCheck = this.detectMaliciousContent(html);
        if (!maliciousCheck.isValid) {
            return maliciousCheck;
        }

        // Simple HTML sanitization (for production, use DOMPurify)
        let sanitized = html;

        // Remove disallowed tags
        const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
        sanitized = sanitized.replace(tagRegex, (match, tagName) => {
            const lowerTagName = tagName.toLowerCase();
            if (this.ALLOWED_TAGS.includes(lowerTagName)) {
                return match; // Keep allowed tags
            }
            return ''; // Remove disallowed tags
        });

        // Remove dangerous attributes
        const attrRegex = /(\w+)(\s*=\s*["'][^"']*["'])?/g;
        sanitized = sanitized.replace(/<(\w+)([^>]*)>/g, (match, tagName, attributes) => {
            const sanitizedAttrs = attributes.replace(attrRegex, (attrMatch, attrName, attrValue) => {
                const lowerAttrName = attrName.toLowerCase();
                if (this.ALLOWED_ATTRIBUTES.includes(lowerAttrName)) {
                    return attrMatch;
                }
                return ''; // Remove disallowed attributes
            });
            return `<${tagName}${sanitizedAttrs}>`;
        });

        return {
            isValid: true,
            sanitizedValue: sanitized,
            severity: 'low'
        };
    }

    /**
     * Validate API key format
     */
    static validateAPIKey(apiKey: string, provider: 'gemini' | 'groq' | 'ollama'): ValidationResult {
        if (!apiKey || typeof apiKey !== 'string') {
            return {
                isValid: false,
                error: 'API key is required',
                severity: 'high'
            };
        }

        const trimmedKey = apiKey.trim();
        if (trimmedKey.length === 0) {
            return {
                isValid: false,
                error: 'API key cannot be empty',
                severity: 'high'
            };
        }

        // Provider-specific validation
        switch (provider) {
            case 'gemini':
                if (!trimmedKey.startsWith('AIza') || trimmedKey.length < 30) {
                    return {
                        isValid: false,
                        error: 'Invalid Gemini API key format',
                        severity: 'high'
                    };
                }
                break;
            case 'groq':
                if (!trimmedKey.startsWith('gsk_') || trimmedKey.length < 40) {
                    return {
                        isValid: false,
                        error: 'Invalid Groq API key format',
                        severity: 'high'
                    };
                }
                break;
            case 'ollama':
                // Ollama keys vary in format, basic validation
                if (trimmedKey.length < 10) {
                    return {
                        isValid: false,
                        error: 'Invalid Ollama API key format',
                        severity: 'medium'
                    };
                }
                break;
        }

        return {
            isValid: true,
            sanitizedValue: trimmedKey,
            severity: 'low'
        };
    }

    /**
     * Validate file path to prevent path traversal
     */
    static validateFilePath(filePath: string): ValidationResult {
        if (!filePath || typeof filePath !== 'string') {
            return {
                isValid: false,
                error: 'File path is required',
                severity: 'high'
            };
        }

        // Check for path traversal attempts
        const pathTraversalPatterns = [
            /\.\.\//g,  // ../
            /\.\.\\/g,  // ..\
            /^\//,       // Absolute paths
            /[<>:"|?*]/ // Invalid characters
        ];

        for (const pattern of pathTraversalPatterns) {
            if (pattern.test(filePath)) {
                return {
                    isValid: false,
                    error: 'Invalid file path - potential path traversal detected',
                    severity: 'critical'
                };
            }
        }

        return {
            isValid: true,
            sanitizedValue: filePath,
            severity: 'low'
        };
    }

    /**
     * Validate and sanitize filename
     */
    static validateFileName(fileName: string, maxLength: number = 255): ValidationResult {
        if (!fileName || typeof fileName !== 'string') {
            return {
                isValid: false,
                error: 'Filename is required',
                severity: 'medium'
            };
        }

        if (fileName.length > maxLength) {
            return {
                isValid: false,
                error: `Filename exceeds maximum length of ${maxLength} characters`,
                severity: 'medium'
            };
        }

        // Check for invalid characters
        const invalidChars = /[<>:"|?*\\\/]/;
        if (invalidChars.test(fileName)) {
            return {
                isValid: false,
                error: 'Filename contains invalid characters',
                severity: 'medium'
            };
        }

        // Remove or replace invalid characters
        let sanitized = fileName
            .replace(/[<>:"|?*\\\/]/g, '_')
            .replace(/^\./, '_')  // Don't start with dot
            .trim()
            .substring(0, maxLength);

        return {
            isValid: true,
            sanitizedValue: sanitized,
            severity: 'low'
        };
    }

    /**
     * Validate prompt input for AI processing
     */
    static validatePrompt(prompt: string, maxLength: number = 10000): ValidationResult {
        if (!prompt || typeof prompt !== 'string') {
            return {
                isValid: false,
                error: 'Prompt is required',
                severity: 'medium'
            };
        }

        if (prompt.length > maxLength) {
            return {
                isValid: false,
                error: `Prompt exceeds maximum length of ${maxLength} characters`,
                severity: 'medium'
            };
        }

        // Check for prompt injection attempts
        const promptInjectionPatterns = [
            /ignore previous instructions/gi,
            /disregard/gi,
            /system:/gi,
            /assistant:/gi,
            /human:/gi,
            /\[\/INST\]/gi,
            /\[INST\]/gi
        ];

        for (const pattern of promptInjectionPatterns) {
            if (pattern.test(prompt)) {
                return {
                    isValid: false,
                    error: 'Invalid prompt content detected',
                    severity: 'high'
                };
            }
        }

        return {
            isValid: true,
            sanitizedValue: prompt.trim(),
            severity: 'low'
        };
    }

    /**
     * Rate limiting validation
     */
    static validateRateLimit(
        identifier: string,
        maxRequests: number,
        windowMs: number,
        storage: Map<string, number[]> = new Map()
    ): ValidationResult {
        const now = Date.now();
        const requests = storage.get(identifier) || [];

        // Remove old requests outside the window
        const validRequests = requests.filter(time => now - time < windowMs);

        if (validRequests.length >= maxRequests) {
            return {
                isValid: false,
                error: 'Rate limit exceeded. Please try again later.',
                severity: 'high'
            };
        }

        // Add current request
        validRequests.push(now);
        storage.set(identifier, validRequests);

        return {
            isValid: true,
            sanitizedValue: identifier,
            severity: 'low'
        };
    }
}

/**
 * Safe DOM operations to prevent XSS
 */
export class SafeDOM {
    /**
     * Safely set text content
     */
    static setText(element: HTMLElement, text: string): void {
        element.textContent = text;
    }

    /**
     * Safely set HTML content with sanitization
     */
    static setHTML(element: HTMLElement, html: string): void {
        const validation = InputValidator.sanitizeHTML(html);
        if (validation.isValid) {
            element.innerHTML = validation.sanitizedValue!;
        } else {
            // Fallback to text content if HTML is invalid
            element.textContent = html;
        }
    }

    /**
     * Create safe element with text content
     */
    static createElement(tagName: string, text?: string, className?: string): HTMLElement {
        const element = document.createElement(tagName);

        if (className) {
            element.className = className;
        }

        if (text !== undefined) {
            this.setText(element, text);
        }

        return element;
    }

    /**
     * Append safe HTML content
     */
    static appendHTML(parent: HTMLElement, html: string): void {
        const validation = InputValidator.sanitizeHTML(html);
        if (validation.isValid) {
            parent.insertAdjacentHTML('beforeend', validation.sanitizedValue!);
        } else {
            // Fallback: create text node
            parent.appendChild(document.createTextNode(html));
        }
    }
}
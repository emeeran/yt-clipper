/**
 * Secure HTTP Client Implementation
 * Provides secure API calls with proper headers, timeouts, and error handling
 */

export interface SecureRequestOptions {
    timeout?: number;
    retries?: number;
    validateSSL?: boolean;
    addSecurityHeaders?: boolean;
    rateLimitKey?: string;
}

export interface SecurityHeaders {
    [key: string]: string;
}

export class SecureHTTPClient {
    private static readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
    private static readonly MAX_RETRIES = 3;
    private static readonly RETRY_DELAY = 1000; // 1 second
    private static readonly RATE_LIMITS = new Map<string, { count: number; resetTime: number }>();

    /**
     * Make a secure HTTP request
     */
    static async secureFetch(
        url: string,
        options: RequestInit = {},
        secureOptions: SecureRequestOptions = {}
    ): Promise<Response> {
        const {
            timeout = this.DEFAULT_TIMEOUT,
            retries = this.MAX_RETRIES,
            validateSSL = true,
            addSecurityHeaders = true,
            rateLimitKey
        } = secureOptions;

        // Validate URL
        const urlValidation = this.validateURL(url, validateSSL);
        if (!urlValidation.isValid) {
            throw new Error(`URL validation failed: ${urlValidation.error}`);
        }

        // Rate limiting check
        if (rateLimitKey) {
            const rateLimitCheck = this.checkRateLimit(rateLimitKey);
            if (!rateLimitCheck.isValid) {
                throw new Error(`Rate limit exceeded: ${rateLimitCheck.error}`);
            }
        }

        // Prepare secure options
        const secureRequestOptions = this.prepareSecureOptions(options, addSecurityHeaders);

        let lastError: Error | null = null;

        // Retry logic
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const response = await this.executeRequest(url, secureRequestOptions, timeout);
                return response;
            } catch (error) {
                lastError = error as Error;

                // Don't retry on certain error types
                if (this.shouldNotRetry(error as Error)) {
                    throw error;
                }

                // Wait before retry (exponential backoff)
                if (attempt < retries) {
                    await this.delay(this.RETRY_DELAY * Math.pow(2, attempt));
                }
            }
        }

        throw lastError || new Error('Request failed after maximum retries');
    }

    /**
     * Validate URL for security
     */
    private static validateURL(url: string, validateSSL: boolean): { isValid: boolean; error?: string } {
        try {
            const urlObj = new URL(url);

            // Only allow HTTPS in production
            if (validateSSL && urlObj.protocol !== 'https:') {
                return {
                    isValid: false,
                    error: 'Only HTTPS URLs are allowed'
                };
            }

            // Block localhost access in production
            const hostname = urlObj.hostname;
            if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
                return {
                    isValid: false,
                    error: 'Access to local networks is not allowed'
                };
            }

            // Check for suspicious paths
            const suspiciousPatterns = [
                /\.\./,  // Path traversal
                /\/etc\//,  // System files
                /\/proc\//,  // Process files
                /\/sys\//   // System files
            ];

            for (const pattern of suspiciousPatterns) {
                if (pattern.test(urlObj.pathname)) {
                    return {
                        isValid: false,
                        error: 'Suspicious URL path detected'
                    };
                }
            }

            return { isValid: true };

        } catch (error) {
            return {
                isValid: false,
                error: 'Invalid URL format'
            };
        }
    }

    /**
     * Prepare secure request options
     */
    private static prepareSecureOptions(
        options: RequestInit,
        addSecurityHeaders: boolean
    ): RequestInit {
        const secureOptions: RequestInit = { ...options };

        // Add security headers
        if (addSecurityHeaders) {
            const securityHeaders: SecurityHeaders = {
                'User-Agent': 'YouTubeClipper/1.3.5 (+https://github.com/meeransethi/youtube-clipper)',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'X-XSS-Protection': '1; mode=block',
                'Referrer-Policy': 'strict-origin-when-cross-origin'
            };

            secureOptions.headers = {
                ...securityHeaders,
                ...options.headers
            };
        }

        // Set default content type for POST/PUT requests
        if ((options.method === 'POST' || options.method === 'PUT') &&
            !secureOptions.headers?.['Content-Type']) {
            secureOptions.headers = {
                ...secureOptions.headers,
                'Content-Type': 'application/json'
            };
        }

        return secureOptions;
    }

    /**
     * Execute the HTTP request with timeout
     */
    private static async executeRequest(
        url: string,
        options: RequestInit,
        timeout: number
    ): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Validate response
            this.validateResponse(response);

            return response;

        } catch (error) {
            clearTimeout(timeoutId);

            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    throw new Error(`Request timeout after ${timeout}ms`);
                }
                throw error;
            }

            throw new Error('Unknown request error');
        }
    }

    /**
     * Validate HTTP response
     */
    private static validateResponse(response: Response): void {
        // Check for HTTP status codes
        if (response.status === 0) {
            throw new Error('Network error: Unable to connect to server');
        }

        // Check for HTTP error status codes
        if (response.status >= 400) {
            const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            throw new Error(errorMessage);
        }

        // Validate content type if available
        const contentType = response.headers.get('content-type');
        if (contentType && !contentType.includes('application/json') && !contentType.includes('text/html')) {
            // Log warning but don't fail - could be binary data
            console.warn(`Unexpected content type: ${contentType}`);
        }
    }

    /**
     * Check if error should not be retried
     */
    private static shouldNotRetry(error: Error): boolean {
        const noRetryErrors = [
            'HTTP 400',  // Bad Request
            'HTTP 401',  // Unauthorized
            'HTTP 403',  // Forbidden
            'HTTP 404',  // Not Found
            'HTTP 422',  // Unprocessable Entity
            'URL validation failed',
            'Invalid URL format',
            'Only HTTPS URLs are allowed'
        ];

        return noRetryErrors.some(noRetryError =>
            error.message.includes(noRetryError)
        );
    }

    /**
     * Simple rate limiting implementation
     */
    private static checkRateLimit(key: string, maxRequests: number = 10, windowMs: number = 60000): { isValid: boolean; error?: string } {
        const now = Date.now();
        const rateLimit = this.RATE_LIMITS.get(key);

        if (!rateLimit || now > rateLimit.resetTime) {
            // Reset rate limit
            this.RATE_LIMITS.set(key, {
                count: 1,
                resetTime: now + windowMs
            });
            return { isValid: true };
        }

        if (rateLimit.count >= maxRequests) {
            const resetTime = Math.ceil((rateLimit.resetTime - now) / 1000);
            return {
                isValid: false,
                error: `Rate limit exceeded. Try again in ${resetTime} seconds.`
            };
        }

        rateLimit.count++;
        return { isValid: true };
    }

    /**
     * Delay helper function
     */
    private static delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Secure POST request for JSON data
     */
    static async securePostJSON<T = any>(
        url: string,
        data: any,
        options: SecureRequestOptions = {}
    ): Promise<T> {
        const response = await this.secureFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        }, options);

        return await response.json();
    }

    /**
     * Secure GET request
     */
    static async secureGet<T = any>(
        url: string,
        options: SecureRequestOptions = {}
    ): Promise<T> {
        const response = await this.secureFetch(url, {
            method: 'GET'
        }, options);

        return await response.json();
    }

    /**
     * Generate secure headers for API requests
     */
    static generateAPIHeaders(
        apiKey?: string,
        additionalHeaders?: SecurityHeaders
    ): SecurityHeaders {
        const headers: SecurityHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...additionalHeaders
        };

        // Add API key to Authorization header instead of URL
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        return headers;
    }

    /**
     * Create secure request with proper API key handling
     */
    static async secureAPIRequest<T = any>(
        url: string,
        apiKey: string,
        data?: any,
        method: 'GET' | 'POST' = 'POST',
        options: SecureRequestOptions = {}
    ): Promise<T> {
        const headers = this.generateAPIHeaders(apiKey);

        const requestOptions: RequestInit = {
            method,
            headers
        };

        if (data && method === 'POST') {
            requestOptions.body = JSON.stringify(data);
        }

        const response = await this.secureFetch(url, requestOptions, options);
        return await response.json();
    }
}

/**
 * API Key Security Handler
 */
export class APIKeySecurity {
    /**
     * Securely format API request to prevent key exposure
     */
    static secureAPIRequest(
        baseUrl: string,
        apiKey: string,
        endpoint: string,
        data?: any
    ): { url: string; options: RequestInit } {
        // Remove API key from URL to prevent exposure in logs/history
        const cleanUrl = `${baseUrl}${endpoint}`;

        const options: RequestInit = {
            method: data ? 'POST' : 'GET',
            headers: SecureHTTPClient.generateAPIHeaders(apiKey)
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        return { url: cleanUrl, options };
    }

    /**
     * Validate API key before use
     */
    static validateAPIKey(apiKey: string, provider: string): { isValid: boolean; error?: string } {
        if (!apiKey || typeof apiKey !== 'string') {
            return {
                isValid: false,
                error: 'API key is required'
            };
        }

        const trimmedKey = apiKey.trim();
        if (trimmedKey.length === 0) {
            return {
                isValid: false,
                error: 'API key cannot be empty'
            };
        }

        // Basic format validation for different providers
        const patterns = {
            'gemini': /^AIza[A-Za-z0-9_-]{35}$/,
            'groq': /^gsk_[A-Za-z0-9_-]{39}$/,
            'ollama': /^[A-Za-z0-9_-]{10,}$/
        };

        if (provider in patterns && !patterns[provider as keyof typeof patterns].test(trimmedKey)) {
            return {
                isValid: false,
                error: `Invalid ${provider} API key format`
            };
        }

        return { isValid: true };
    }
}
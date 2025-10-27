/**
 * Error Handling Service
 * Comprehensive error handling with retry logic, categorization, and recovery
 * Requirements: 2.1, 3.2, 4.4 - Network/storage failures, authentication, and permission errors
 */

export type ErrorCategory = 
  | 'network'
  | 'storage'
  | 'authentication'
  | 'permission'
  | 'validation'
  | 'unknown';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AppError {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  originalError?: Error;
  timestamp: Date;
  context?: Record<string, any>;
  recoverable: boolean;
  retryable: boolean;
  retryCount?: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
}

export interface ErrorHandlerConfig {
  enableLogging: boolean;
  enableNotifications: boolean;
  defaultRetryConfig: RetryConfig;
}

type ErrorCallback = (error: AppError) => void;
type RecoveryHandler = (error: AppError) => Promise<boolean>;

/**
 * Error Handler Service
 * Centralized error handling with retry logic and recovery strategies
 */
export class ErrorHandlerService {
  private errors: AppError[] = [];
  private errorCallbacks: Set<ErrorCallback> = new Set();
  private recoveryHandlers: Map<ErrorCategory, RecoveryHandler> = new Map();
  private config: ErrorHandlerConfig;

  constructor(config?: Partial<ErrorHandlerConfig>) {
    this.config = {
      enableLogging: true,
      enableNotifications: true,
      defaultRetryConfig: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2
      },
      ...config
    };
  }

  /**
   * Handle an error with automatic categorization and recovery
   */
  async handleError(
    error: Error | string,
    context?: Record<string, any>
  ): Promise<AppError> {
    const appError = this.createAppError(error, context);
    
    // Store error
    this.errors.push(appError);
    
    // Log error if enabled
    if (this.config.enableLogging) {
      this.logError(appError);
    }

    // Notify listeners
    this.notifyErrorCallbacks(appError);

    // Attempt recovery if possible
    if (appError.recoverable) {
      await this.attemptRecovery(appError);
    }

    return appError;
  }

  /**
   * Execute an operation with automatic retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    config?: Partial<RetryConfig>,
    context?: Record<string, any>
  ): Promise<T> {
    const retryConfig = { ...this.config.defaultRetryConfig, ...config };
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= retryConfig.maxRetries) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        if (attempt > retryConfig.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
          retryConfig.maxDelay
        );

        // Log retry attempt
        if (this.config.enableLogging) {
          console.log(
            `Retry attempt ${attempt}/${retryConfig.maxRetries} after ${delay}ms delay`,
            { context, error: lastError.message }
          );
        }

        // Wait before retry
        await this.delay(delay);
      }
    }

    // All retries failed, handle the error
    const appError = await this.handleError(lastError!, {
      ...context,
      retryCount: attempt,
      maxRetries: retryConfig.maxRetries
    });

    throw appError;
  }

  /**
   * Wrap an async operation with error handling
   */
  async wrap<T>(
    operation: () => Promise<T>,
    errorMessage?: string,
    context?: Record<string, any>
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      await this.handleError(
        error instanceof Error ? error : new Error(errorMessage || 'Operation failed'),
        context
      );
      return null;
    }
  }

  /**
   * Register an error callback
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  /**
   * Register a recovery handler for a specific error category
   */
  registerRecoveryHandler(category: ErrorCategory, handler: RecoveryHandler): void {
    this.recoveryHandlers.set(category, handler);
  }

  /**
   * Get all errors
   */
  getErrors(): AppError[] {
    return [...this.errors];
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: ErrorCategory): AppError[] {
    return this.errors.filter(error => error.category === category);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ErrorSeverity): AppError[] {
    return this.errors.filter(error => error.severity === severity);
  }

  /**
   * Clear all errors
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Clear errors by category
   */
  clearErrorsByCategory(category: ErrorCategory): void {
    this.errors = this.errors.filter(error => error.category !== category);
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recoverable: number;
    retryable: number;
  } {
    const stats = {
      total: this.errors.length,
      byCategory: {} as Record<ErrorCategory, number>,
      bySeverity: {} as Record<ErrorSeverity, number>,
      recoverable: 0,
      retryable: 0
    };

    this.errors.forEach(error => {
      // Count by category
      stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
      
      // Count by severity
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
      
      // Count recoverable and retryable
      if (error.recoverable) stats.recoverable++;
      if (error.retryable) stats.retryable++;
    });

    return stats;
  }

  /**
   * Create an AppError from a native Error or string
   */
  private createAppError(error: Error | string, context?: Record<string, any>): AppError {
    const errorMessage = error instanceof Error ? error.message : error;
    const originalError = error instanceof Error ? error : undefined;

    // Categorize the error
    const category = this.categorizeError(errorMessage, originalError);
    const severity = this.determineSeverity(category, errorMessage);
    const recoverable = this.isRecoverable(category);
    const retryable = this.isRetryable(category);

    return {
      id: this.generateErrorId(),
      category,
      severity,
      message: errorMessage,
      originalError,
      timestamp: new Date(),
      context,
      recoverable,
      retryable
    };
  }

  /**
   * Categorize an error based on its message and type
   */
  private categorizeError(message: string, error?: Error): ErrorCategory {
    const lowerMessage = message.toLowerCase();

    // Network errors
    if (
      lowerMessage.includes('network') ||
      lowerMessage.includes('fetch') ||
      lowerMessage.includes('timeout') ||
      lowerMessage.includes('connection') ||
      lowerMessage.includes('offline')
    ) {
      return 'network';
    }

    // Storage errors
    if (
      lowerMessage.includes('storage') ||
      lowerMessage.includes('indexeddb') ||
      lowerMessage.includes('quota') ||
      lowerMessage.includes('upload') ||
      lowerMessage.includes('retrieve')
    ) {
      return 'storage';
    }

    // Authentication errors
    if (
      lowerMessage.includes('auth') ||
      lowerMessage.includes('login') ||
      lowerMessage.includes('identity') ||
      lowerMessage.includes('principal') ||
      lowerMessage.includes('unauthenticated')
    ) {
      return 'authentication';
    }

    // Permission errors
    if (
      lowerMessage.includes('permission') ||
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('forbidden') ||
      lowerMessage.includes('access denied')
    ) {
      return 'permission';
    }

    // Validation errors
    if (
      lowerMessage.includes('invalid') ||
      lowerMessage.includes('validation') ||
      lowerMessage.includes('required') ||
      lowerMessage.includes('format')
    ) {
      return 'validation';
    }

    return 'unknown';
  }

  /**
   * Determine error severity
   */
  private determineSeverity(category: ErrorCategory, message: string): ErrorSeverity {
    // Critical errors
    if (
      category === 'authentication' ||
      message.toLowerCase().includes('critical') ||
      message.toLowerCase().includes('fatal')
    ) {
      return 'critical';
    }

    // High severity errors
    if (
      category === 'storage' ||
      category === 'permission' ||
      message.toLowerCase().includes('failed')
    ) {
      return 'high';
    }

    // Medium severity errors
    if (category === 'network' || category === 'validation') {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Check if an error is recoverable
   */
  private isRecoverable(category: ErrorCategory): boolean {
    return category === 'network' || category === 'storage';
  }

  /**
   * Check if an error is retryable
   */
  private isRetryable(category: ErrorCategory): boolean {
    return category === 'network' || category === 'storage';
  }

  /**
   * Attempt to recover from an error
   */
  private async attemptRecovery(error: AppError): Promise<boolean> {
    const handler = this.recoveryHandlers.get(error.category);
    
    if (!handler) {
      return false;
    }

    try {
      const recovered = await handler(error);
      
      if (recovered && this.config.enableLogging) {
        console.log(`Successfully recovered from error: ${error.id}`, error);
      }
      
      return recovered;
    } catch (recoveryError) {
      if (this.config.enableLogging) {
        console.error(`Failed to recover from error: ${error.id}`, recoveryError);
      }
      return false;
    }
  }

  /**
   * Log an error
   */
  private logError(error: AppError): void {
    const logMethod = error.severity === 'critical' || error.severity === 'high'
      ? console.error
      : console.warn;

    logMethod(
      `[${error.severity.toUpperCase()}] ${error.category} error:`,
      error.message,
      {
        id: error.id,
        timestamp: error.timestamp,
        context: error.context,
        recoverable: error.recoverable,
        retryable: error.retryable
      }
    );

    if (error.originalError) {
      console.error('Original error:', error.originalError);
    }
  }

  /**
   * Notify all error callbacks
   */
  private notifyErrorCallbacks(error: AppError): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError);
      }
    });
  }

  /**
   * Generate a unique error ID
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create and export singleton instance
export const errorHandler = new ErrorHandlerService();

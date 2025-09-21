import { chrome } from "chrome"

export enum ErrorType {
  AUTHENTICATION = "AUTHENTICATION",
  NETWORK = "NETWORK",
  RATE_LIMIT = "RATE_LIMIT",
  PARSING = "PARSING",
  CACHE = "CACHE",
  PERMISSION = "PERMISSION",
  TIMEOUT = "TIMEOUT",
  UNKNOWN = "UNKNOWN",
}

export interface ExtensionError {
  type: ErrorType
  message: string
  originalError?: Error
  context?: Record<string, any>
  timestamp: number
  recoverable: boolean
  userMessage: string
  suggestedAction?: string
}

export class ErrorHandler {
  private static errorLog: ExtensionError[] = []
  private static readonly MAX_LOG_SIZE = 100

  static createError(
    type: ErrorType,
    message: string,
    originalError?: Error,
    context?: Record<string, any>,
  ): ExtensionError {
    const error: ExtensionError = {
      type,
      message,
      originalError,
      context,
      timestamp: Date.now(),
      recoverable: this.isRecoverable(type),
      userMessage: this.getUserMessage(type, message),
      suggestedAction: this.getSuggestedAction(type),
    }

    this.logError(error)
    return error
  }

  private static isRecoverable(type: ErrorType): boolean {
    switch (type) {
      case ErrorType.NETWORK:
      case ErrorType.TIMEOUT:
      case ErrorType.RATE_LIMIT:
        return true
      case ErrorType.AUTHENTICATION:
      case ErrorType.PERMISSION:
        return false
      case ErrorType.PARSING:
      case ErrorType.CACHE:
      case ErrorType.UNKNOWN:
        return true
      default:
        return false
    }
  }

  private static getUserMessage(type: ErrorType, message: string): string {
    switch (type) {
      case ErrorType.AUTHENTICATION:
        return "Please log in to LinkedIn and try again."
      case ErrorType.NETWORK:
        return "Network connection issue. Please check your internet connection."
      case ErrorType.RATE_LIMIT:
        return "LinkedIn is limiting requests. Please wait a moment and try again."
      case ErrorType.PARSING:
        return "Unable to process LinkedIn data. This may be due to changes in LinkedIn's interface."
      case ErrorType.CACHE:
        return "Cache error occurred. Your data may need to be refreshed."
      case ErrorType.PERMISSION:
        return "Extension permissions are required. Please check your browser settings."
      case ErrorType.TIMEOUT:
        return "Request timed out. Please try again."
      case ErrorType.UNKNOWN:
      default:
        return "An unexpected error occurred. Please try refreshing the page."
    }
  }

  private static getSuggestedAction(type: ErrorType): string | undefined {
    switch (type) {
      case ErrorType.AUTHENTICATION:
        return "Navigate to LinkedIn and log in to your account"
      case ErrorType.NETWORK:
        return "Check your internet connection and try again"
      case ErrorType.RATE_LIMIT:
        return "Wait 5-10 minutes before making more requests"
      case ErrorType.PARSING:
        return "Clear cache and refresh the extension"
      case ErrorType.CACHE:
        return "Clear cache from the dashboard settings"
      case ErrorType.PERMISSION:
        return "Check Chrome extension permissions in browser settings"
      case ErrorType.TIMEOUT:
        return "Try again with a stable internet connection"
      default:
        return "Refresh the page or restart the extension"
    }
  }

  private static logError(error: ExtensionError): void {
    // Add to error log
    this.errorLog.unshift(error)

    // Maintain log size
    if (this.errorLog.length > this.MAX_LOG_SIZE) {
      this.errorLog = this.errorLog.slice(0, this.MAX_LOG_SIZE)
    }

    // Console logging with context
    console.error(`[LinkedIn Extension] ${error.type}: ${error.message}`, {
      error: error.originalError,
      context: error.context,
      timestamp: new Date(error.timestamp).toISOString(),
    })

    // Store critical errors in chrome storage for debugging
    if (!error.recoverable) {
      this.storeCriticalError(error)
    }
  }

  private static async storeCriticalError(error: ExtensionError): Promise<void> {
    try {
      const stored = await chrome.storage.local.get("critical_errors")
      const criticalErrors = stored.critical_errors || []

      criticalErrors.unshift({
        ...error,
        originalError: error.originalError?.message || null, // Serialize error
      })

      // Keep only last 10 critical errors
      const limitedErrors = criticalErrors.slice(0, 10)

      await chrome.storage.local.set({ critical_errors: limitedErrors })
    } catch (storageError) {
      console.error("Failed to store critical error:", storageError)
    }
  }

  static getErrorLog(): ExtensionError[] {
    return [...this.errorLog]
  }

  static clearErrorLog(): void {
    this.errorLog = []
  }

  static async getCriticalErrors(): Promise<ExtensionError[]> {
    try {
      const stored = await chrome.storage.local.get("critical_errors")
      return stored.critical_errors || []
    } catch (error) {
      console.error("Failed to get critical errors:", error)
      return []
    }
  }

  static async clearCriticalErrors(): Promise<void> {
    try {
      await chrome.storage.local.remove("critical_errors")
    } catch (error) {
      console.error("Failed to clear critical errors:", error)
    }
  }

  // Analyze error patterns
  static getErrorAnalysis(): {
    totalErrors: number
    errorsByType: Record<ErrorType, number>
    recentErrors: number
    criticalErrors: number
    recoveryRate: number
  } {
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000

    const recentErrors = this.errorLog.filter((e) => e.timestamp > oneHourAgo)
    const criticalErrors = this.errorLog.filter((e) => !e.recoverable)

    const errorsByType = this.errorLog.reduce(
      (acc, error) => {
        acc[error.type] = (acc[error.type] || 0) + 1
        return acc
      },
      {} as Record<ErrorType, number>,
    )

    const totalErrors = this.errorLog.length
    const recoveryRate = totalErrors > 0 ? ((totalErrors - criticalErrors.length) / totalErrors) * 100 : 100

    return {
      totalErrors,
      errorsByType,
      recentErrors: recentErrors.length,
      criticalErrors: criticalErrors.length,
      recoveryRate: Math.round(recoveryRate),
    }
  }

  // Handle specific error types
  static handleNetworkError(error: Error, context?: Record<string, any>): ExtensionError {
    let errorType = ErrorType.NETWORK

    if (error.message.includes("timeout") || error.name === "AbortError") {
      errorType = ErrorType.TIMEOUT
    } else if (error.message.includes("429") || error.message.includes("rate limit")) {
      errorType = ErrorType.RATE_LIMIT
    }

    return this.createError(errorType, error.message, error, context)
  }

  static handleAuthError(message: string, context?: Record<string, any>): ExtensionError {
    return this.createError(ErrorType.AUTHENTICATION, message, undefined, context)
  }

  static handleParsingError(error: Error, context?: Record<string, any>): ExtensionError {
    return this.createError(ErrorType.PARSING, error.message, error, context)
  }

  static handleCacheError(error: Error, context?: Record<string, any>): ExtensionError {
    return this.createError(ErrorType.CACHE, error.message, error, context)
  }

  static handlePermissionError(message: string, context?: Record<string, any>): ExtensionError {
    return this.createError(ErrorType.PERMISSION, message, undefined, context)
  }

  // Recovery strategies
  static async attemptRecovery(error: ExtensionError): Promise<boolean> {
    if (!error.recoverable) {
      return false
    }

    try {
      switch (error.type) {
        case ErrorType.CACHE:
          // Clear corrupted cache
          await chrome.storage.local.clear()
          return true

        case ErrorType.NETWORK:
        case ErrorType.TIMEOUT:
          // Wait and retry logic handled by request queue
          return true

        case ErrorType.RATE_LIMIT:
          // Handled by request queue backoff
          return true

        case ErrorType.PARSING:
          // Clear cache and retry
          await chrome.storage.local.clear()
          return true

        default:
          return false
      }
    } catch (recoveryError) {
      console.error("Recovery attempt failed:", recoveryError)
      return false
    }
  }
}

// Global error handler for unhandled errors
window.addEventListener("error", (event) => {
  ErrorHandler.createError(ErrorType.UNKNOWN, event.error?.message || "Unhandled error", event.error, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  })
})

// Global handler for unhandled promise rejections
window.addEventListener("unhandledrejection", (event) => {
  ErrorHandler.createError(
    ErrorType.UNKNOWN,
    event.reason?.message || "Unhandled promise rejection",
    event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
    { type: "unhandledrejection" },
  )
})

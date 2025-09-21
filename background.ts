import { chrome } from "chrome"
import { ConnectionsService } from "./src/connections-service"
import { ErrorHandler, ErrorType } from "./src/error-handler"

// Initialize the connections service
const connectionsService = new ConnectionsService()

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received message:", request)

  // Wrap all message handling in error handling
  const handleMessage = async () => {
    try {
      switch (request.action) {
        case "getConnections":
          return await handleGetConnections(request.forceRefresh || false)

        case "refreshConnections":
          return await handleRefreshConnections()

        case "getCacheStats":
          return await handleGetCacheStats()

        case "clearCache":
          return await handleClearCache()

        case "getQueueStats":
          return await handleGetQueueStats()

        case "getErrorLog":
          return await handleGetErrorLog()

        case "clearErrorLog":
          return await handleClearErrorLog()

        case "getHealthStatus":
          return await handleGetHealthStatus()

        default:
          throw ErrorHandler.createError(ErrorType.UNKNOWN, `Unknown action: ${request.action}`, undefined, {
            action: request.action,
          })
      }
    } catch (error) {
      console.error("Message handling error:", error)

      if (error.type && error.userMessage) {
        // Already a handled error
        return { error: error.userMessage, details: error }
      } else {
        // Unhandled error
        const handledError = ErrorHandler.createError(
          ErrorType.UNKNOWN,
          error instanceof Error ? error.message : String(error),
          error instanceof Error ? error : undefined,
          { action: request.action },
        )
        return { error: handledError.userMessage, details: handledError }
      }
    }
  }

  handleMessage()
    .then(sendResponse)
    .catch((error) => {
      console.error("Async message handling error:", error)
      sendResponse({ error: "Internal error occurred" })
    })

  return true // Keep message channel open for async response
})

async function handleGetConnections(forceRefresh: boolean) {
  try {
    const connections = await connectionsService.getConnectionsWithLogos()
    return { success: true, data: connections }
  } catch (error) {
    throw error // Re-throw handled errors
  }
}

async function handleRefreshConnections() {
  try {
    const connections = await connectionsService.refreshConnections()
    return { success: true, data: connections }
  } catch (error) {
    throw error
  }
}

async function handleGetCacheStats() {
  try {
    const stats = await connectionsService.getCacheStats()
    return { success: true, data: stats }
  } catch (error) {
    throw error
  }
}

async function handleClearCache() {
  try {
    await connectionsService.clearCache()
    return { success: true, message: "Cache cleared successfully" }
  } catch (error) {
    throw error
  }
}

async function handleGetQueueStats() {
  try {
    const stats = connectionsService.requestQueue?.getStats() || {}
    return { success: true, data: stats }
  } catch (error) {
    const handledError = ErrorHandler.createError(
      ErrorType.UNKNOWN,
      "Failed to get queue stats",
      error instanceof Error ? error : undefined,
    )
    throw handledError
  }
}

async function handleGetErrorLog() {
  try {
    const errorLog = ErrorHandler.getErrorLog()
    const criticalErrors = await ErrorHandler.getCriticalErrors()
    const analysis = ErrorHandler.getErrorAnalysis()

    return {
      success: true,
      data: {
        errorLog: errorLog.slice(0, 20), // Return last 20 errors
        criticalErrors,
        analysis,
      },
    }
  } catch (error) {
    const handledError = ErrorHandler.createError(
      ErrorType.UNKNOWN,
      "Failed to get error log",
      error instanceof Error ? error : undefined,
    )
    throw handledError
  }
}

async function handleClearErrorLog() {
  try {
    ErrorHandler.clearErrorLog()
    await ErrorHandler.clearCriticalErrors()
    return { success: true, message: "Error log cleared successfully" }
  } catch (error) {
    const handledError = ErrorHandler.createError(
      ErrorType.UNKNOWN,
      "Failed to clear error log",
      error instanceof Error ? error : undefined,
    )
    throw handledError
  }
}

async function handleGetHealthStatus() {
  try {
    const healthStatus = await connectionsService.performHealthCheck()
    return { success: true, data: healthStatus }
  } catch (error) {
    const handledError = ErrorHandler.createError(
      ErrorType.UNKNOWN,
      "Failed to get health status",
      error instanceof Error ? error : undefined,
    )
    throw handledError
  }
}

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log("LinkedIn Connections Dashboard installed:", details)

  try {
    if (details.reason === "install") {
      // Open welcome page or show notification
      chrome.tabs.create({
        url: chrome.runtime.getURL("dashboard.html"),
      })
    }
  } catch (error) {
    ErrorHandler.createError(
      ErrorType.UNKNOWN,
      "Failed to handle installation",
      error instanceof Error ? error : undefined,
      { reason: details.reason },
    )
  }
})

// Handle tab updates to detect LinkedIn navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  try {
    if (changeInfo.status === "complete" && tab.url?.includes("linkedin.com")) {
      console.log("LinkedIn page loaded, extension ready")
    }
  } catch (error) {
    ErrorHandler.createError(
      ErrorType.UNKNOWN,
      "Failed to handle tab update",
      error instanceof Error ? error : undefined,
      { tabId, changeInfo, url: tab.url },
    )
  }
})

// Handle startup errors
chrome.runtime.onStartup.addListener(() => {
  try {
    console.log("LinkedIn Connections Dashboard starting up")
    // Perform any startup health checks
    connectionsService.performHealthCheck().catch((error) => {
      ErrorHandler.createError(
        ErrorType.UNKNOWN,
        "Startup health check failed",
        error instanceof Error ? error : undefined,
      )
    })
  } catch (error) {
    ErrorHandler.createError(ErrorType.UNKNOWN, "Failed to handle startup", error instanceof Error ? error : undefined)
  }
})

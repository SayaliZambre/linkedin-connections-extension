import { LinkedInAPI } from "./linkedin-api"
import { CacheManager } from "./cache-manager"
import { RequestQueue } from "./request-queue"
import { ErrorHandler, ErrorType } from "./error-handler"
import type { LinkedInConnection } from "./types"

export class ConnectionsService {
  private linkedInAPI: LinkedInAPI
  private requestQueue: RequestQueue
  private readonly CONNECTIONS_CACHE_KEY = "connections"
  private readonly COMPANY_CACHE_PREFIX = "company_logo_"

  constructor() {
    this.linkedInAPI = new LinkedInAPI()
    this.requestQueue = new RequestQueue()
  }

  async getAllConnections(forceRefresh = false): Promise<LinkedInConnection[]> {
    try {
      // Check cache first unless force refresh is requested
      if (!forceRefresh) {
        try {
          const cachedConnections = await CacheManager.get<LinkedInConnection[]>(this.CONNECTIONS_CACHE_KEY)
          if (cachedConnections) {
            console.log("Returning cached connections")
            return cachedConnections
          }
        } catch (cacheError) {
          const error = ErrorHandler.handleCacheError(cacheError as Error, { operation: "get_connections" })
          console.warn("Cache error, proceeding with fresh fetch:", error.userMessage)
        }
      }

      console.log("Fetching fresh connections from LinkedIn")
      const allConnections: LinkedInConnection[] = []
      let start = 0
      const batchSize = 100
      let hasMore = true
      let consecutiveFailures = 0
      const maxConsecutiveFailures = 3

      // Fetch connections in batches
      while (hasMore && consecutiveFailures < maxConsecutiveFailures) {
        try {
          const connections = await this.linkedInAPI.fetchConnections(start, batchSize)

          if (connections.length === 0) {
            hasMore = false
            break
          }

          allConnections.push(...connections)
          start += batchSize
          consecutiveFailures = 0 // Reset failure counter on success

          // Add a delay between batches to avoid rate limiting
          if (hasMore) {
            await this.sleep(500 + Math.random() * 500)
          }

          // Limit to prevent excessive API calls (adjust as needed)
          if (allConnections.length >= 1000) {
            console.warn("Reached connection limit of 1000 to prevent rate limiting")
            break
          }
        } catch (batchError) {
          consecutiveFailures++
          const error = ErrorHandler.handleNetworkError(batchError as Error, {
            batch: start,
            attempt: consecutiveFailures,
          })

          console.error(`Failed to fetch batch starting at ${start}:`, error.userMessage)

          if (consecutiveFailures >= maxConsecutiveFailures) {
            throw new Error(`Failed to fetch connections after ${maxConsecutiveFailures} consecutive failures`)
          }

          // Wait longer before retrying
          await this.sleep(2000 * consecutiveFailures)
        }
      }

      if (allConnections.length === 0) {
        throw new Error("No connections could be fetched. Please check your LinkedIn authentication.")
      }

      // Cache the connections
      try {
        await CacheManager.set(this.CONNECTIONS_CACHE_KEY, allConnections)
      } catch (cacheError) {
        const error = ErrorHandler.handleCacheError(cacheError as Error, { operation: "set_connections" })
        console.warn("Failed to cache connections:", error.userMessage)
        // Continue without caching
      }

      // Fetch company logos in the background
      this.fetchCompanyLogosInBackground(allConnections).catch((logoError) => {
        ErrorHandler.handleNetworkError(logoError as Error, { operation: "fetch_company_logos" })
      })

      return allConnections
    } catch (error) {
      const handledError = ErrorHandler.handleNetworkError(error as Error, { operation: "get_all_connections" })
      console.error("Failed to get connections:", handledError.userMessage)
      throw handledError
    }
  }

  private async fetchCompanyLogosInBackground(connections: LinkedInConnection[]): Promise<void> {
    try {
      const uniqueCompanies = new Set<string>()

      connections.forEach((connection) => {
        if (connection.currentCompany) {
          uniqueCompanies.add(connection.currentCompany)
        }
      })

      console.log(`Fetching logos for ${uniqueCompanies.size} unique companies`)

      // Process companies in batches to avoid overwhelming the API
      const companiesArray = Array.from(uniqueCompanies)
      const batchSize = 5

      for (let i = 0; i < companiesArray.length; i += batchSize) {
        const batch = companiesArray.slice(i, i + batchSize)

        await Promise.allSettled(
          batch.map(async (companyName) => {
            try {
              // Check if logo is already cached
              const cachedLogo = await CacheManager.get<string>(`${this.COMPANY_CACHE_PREFIX}${companyName}`)
              if (cachedLogo) return

              // Fetch logo through request queue
              const logoUrl = await this.linkedInAPI.fetchCompanyLogo(companyName)
              if (logoUrl) {
                await CacheManager.set(`${this.COMPANY_CACHE_PREFIX}${companyName}`, logoUrl, 24 * 60 * 60 * 1000) // Cache for 24 hours
              }
            } catch (logoError) {
              ErrorHandler.handleNetworkError(logoError as Error, {
                operation: "fetch_company_logo",
                company: companyName,
              })
            }
          }),
        )

        // Add delay between batches
        if (i + batchSize < companiesArray.length) {
          await this.sleep(1000 + Math.random() * 1000)
        }
      }
    } catch (error) {
      ErrorHandler.handleNetworkError(error as Error, { operation: "fetch_company_logos_background" })
    }
  }

  async getConnectionsWithLogos(): Promise<LinkedInConnection[]> {
    try {
      const connections = await this.getAllConnections()

      // Enhance connections with cached company logos
      const enhancedConnections = await Promise.all(
        connections.map(async (connection) => {
          if (connection.currentCompany) {
            try {
              const cachedLogo = await CacheManager.get<string>(
                `${this.COMPANY_CACHE_PREFIX}${connection.currentCompany}`,
              )
              if (cachedLogo) {
                return { ...connection, companyLogo: cachedLogo }
              }
            } catch (cacheError) {
              ErrorHandler.handleCacheError(cacheError as Error, {
                operation: "get_company_logo",
                company: connection.currentCompany,
              })
            }
          }
          return connection
        }),
      )

      return enhancedConnections
    } catch (error) {
      throw error // Re-throw as it's already handled in getAllConnections
    }
  }

  async refreshConnections(): Promise<LinkedInConnection[]> {
    try {
      await CacheManager.remove(this.CONNECTIONS_CACHE_KEY)
      return this.getAllConnections(true)
    } catch (error) {
      const handledError = ErrorHandler.handleCacheError(error as Error, { operation: "refresh_connections" })
      throw handledError
    }
  }

  async getCacheStats() {
    try {
      return CacheManager.getCacheStats()
    } catch (error) {
      ErrorHandler.handleCacheError(error as Error, { operation: "get_cache_stats" })
      return { totalItems: 0, totalSize: 0, oldestEntry: null, newestEntry: null, expiredItems: 0 }
    }
  }

  async clearCache(): Promise<void> {
    try {
      await CacheManager.clear()
    } catch (error) {
      const handledError = ErrorHandler.handleCacheError(error as Error, { operation: "clear_cache" })
      throw handledError
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // Health check method
  async performHealthCheck(): Promise<{
    status: "healthy" | "warning" | "critical"
    issues: string[]
    recommendations: string[]
  }> {
    const issues: string[] = []
    const recommendations: string[] = []
    let status: "healthy" | "warning" | "critical" = "healthy"

    try {
      // Check cache health
      const cacheStats = await this.getCacheStats()
      if (cacheStats.expiredItems > cacheStats.totalItems * 0.5) {
        issues.push("High number of expired cache items")
        recommendations.push("Clear cache to improve performance")
        status = "warning"
      }

      // Check error patterns
      const errorAnalysis = ErrorHandler.getErrorAnalysis()
      if (errorAnalysis.recentErrors > 10) {
        issues.push(`High error rate: ${errorAnalysis.recentErrors} errors in the last hour`)
        recommendations.push("Check network connection and LinkedIn authentication")
        status = "warning"
      }

      if (errorAnalysis.criticalErrors > 0) {
        issues.push(`${errorAnalysis.criticalErrors} critical errors detected`)
        recommendations.push("Review error log and restart extension if needed")
        status = "critical"
      }

      // Check queue health
      const queueStats = this.requestQueue.getStats()
      if (queueStats.queueLength > 50) {
        issues.push("Request queue is backed up")
        recommendations.push("Wait for queue to process or restart extension")
        status = "warning"
      }
    } catch (healthCheckError) {
      ErrorHandler.createError(ErrorType.UNKNOWN, "Health check failed", healthCheckError as Error)
      issues.push("Health check failed")
      recommendations.push("Restart the extension")
      status = "critical"
    }

    return { status, issues, recommendations }
  }
}

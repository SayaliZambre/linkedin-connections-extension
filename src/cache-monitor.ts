import { CacheManager } from "./cache-manager"

export class CacheMonitor {
  private static instance: CacheMonitor
  private monitoringInterval: number | null = null
  private readonly MONITOR_INTERVAL = 60000 // 1 minute

  static getInstance(): CacheMonitor {
    if (!CacheMonitor.instance) {
      CacheMonitor.instance = new CacheMonitor()
    }
    return CacheMonitor.instance
  }

  startMonitoring(): void {
    if (this.monitoringInterval) {
      console.log("Cache monitoring already started")
      return
    }

    console.log("Starting cache monitoring...")
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performMaintenanceTasks()
      } catch (error) {
        console.error("Cache monitoring error:", error)
      }
    }, this.MONITOR_INTERVAL)
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
      console.log("Cache monitoring stopped")
    }
  }

  private async performMaintenanceTasks(): Promise<void> {
    // Clean up expired entries
    const expiredCount = await CacheManager.cleanupExpired()
    if (expiredCount > 0) {
      console.log(`Cache maintenance: cleaned up ${expiredCount} expired entries`)
    }

    // Validate cache integrity
    const validation = await CacheManager.validateCache()
    if (validation.invalid > 0) {
      console.log(`Cache maintenance: repaired ${validation.repaired} invalid entries`)
    }

    // Log cache stats periodically
    const stats = await CacheManager.getCacheStats()
    console.log(
      `Cache stats: ${stats.totalItems} items, ${Math.round(stats.totalSize / 1024)}KB, ${stats.expiredItems} expired`,
    )
  }

  async getHealthReport(): Promise<{
    status: "healthy" | "warning" | "critical"
    issues: string[]
    recommendations: string[]
    stats: any
  }> {
    const stats = await CacheManager.getCacheStats()
    const validation = await CacheManager.validateCache()
    const issues: string[] = []
    const recommendations: string[] = []

    let status: "healthy" | "warning" | "critical" = "healthy"

    // Check for issues
    if (stats.expiredItems > stats.totalItems * 0.3) {
      issues.push(`High number of expired items (${stats.expiredItems}/${stats.totalItems})`)
      recommendations.push("Run cache cleanup to remove expired entries")
      status = "warning"
    }

    if (stats.totalSize > 4 * 1024 * 1024) {
      // 4MB
      issues.push(`Cache size is large (${Math.round(stats.totalSize / 1024)}KB)`)
      recommendations.push("Consider clearing old cache entries")
      status = "warning"
    }

    if (validation.invalid > 0) {
      issues.push(`Found ${validation.invalid} corrupted cache entries`)
      recommendations.push("Cache validation repaired corrupted entries")
      status = "warning"
    }

    if (stats.totalItems === 0) {
      issues.push("No cached data available")
      recommendations.push("Fetch connections to populate cache")
    }

    if (issues.length > 2) {
      status = "critical"
    }

    return {
      status,
      issues,
      recommendations,
      stats: {
        ...stats,
        validation,
        healthScore: Math.max(0, 100 - issues.length * 20),
      },
    }
  }
}

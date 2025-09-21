import type { RequestQueueItem } from "./types"

export interface QueueStats {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  queueLength: number
  isProcessing: boolean
  rateLimitHits: number
}

export interface RequestOptions {
  priority?: number // Higher number = higher priority
  timeout?: number
  retryDelay?: number
  headers?: Record<string, string>
}

interface EnhancedRequestQueueItem extends RequestQueueItem {
  priority: number
  startTime?: number
  timeout: number
  retryDelay: number
  headers: Record<string, string>
}

export class RequestQueue {
  private queue: EnhancedRequestQueueItem[] = []
  private isProcessing = false
  private readonly minDelay = 300
  private readonly maxDelay = 1000
  private readonly maxRetries = 3
  private readonly defaultTimeout = 30000 // 30 seconds

  // Statistics tracking
  private stats: QueueStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    queueLength: 0,
    isProcessing: false,
    rateLimitHits: 0,
  }

  private responseTimes: number[] = []
  private lastRequestTime = 0
  private rateLimitBackoff = 0

  async enqueue<T>(url: string, options: RequestOptions = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      const item: EnhancedRequestQueueItem = {
        url,
        resolve,
        reject,
        retries: 0,
        priority: options.priority || 0,
        timeout: options.timeout || this.defaultTimeout,
        retryDelay: options.retryDelay || 1000,
        headers: options.headers || {},
      }

      // Insert item based on priority (higher priority first)
      const insertIndex = this.queue.findIndex((queueItem) => queueItem.priority < item.priority)
      if (insertIndex === -1) {
        this.queue.push(item)
      } else {
        this.queue.splice(insertIndex, 0, item)
      }

      this.stats.totalRequests++
      this.stats.queueLength = this.queue.length

      if (!this.isProcessing) {
        this.processQueue()
      }
    })
  }

  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      this.isProcessing = false
      this.stats.isProcessing = false
      return
    }

    this.isProcessing = true
    this.stats.isProcessing = true
    const item = this.queue.shift()!
    this.stats.queueLength = this.queue.length

    try {
      // Apply rate limiting backoff if needed
      if (this.rateLimitBackoff > 0) {
        console.log(`Rate limit backoff: waiting ${this.rateLimitBackoff}ms`)
        await this.sleep(this.rateLimitBackoff)
        this.rateLimitBackoff = Math.max(0, this.rateLimitBackoff - 1000)
      }

      // Ensure minimum delay between requests
      const timeSinceLastRequest = Date.now() - this.lastRequestTime
      const requiredDelay = Math.random() * (this.maxDelay - this.minDelay) + this.minDelay

      if (timeSinceLastRequest < requiredDelay) {
        await this.sleep(requiredDelay - timeSinceLastRequest)
      }

      item.startTime = Date.now()
      this.lastRequestTime = Date.now()

      const response = await this.makeRequest(item)
      const responseTime = Date.now() - item.startTime

      // Track response time
      this.responseTimes.push(responseTime)
      if (this.responseTimes.length > 100) {
        this.responseTimes.shift() // Keep only last 100 response times
      }

      this.stats.successfulRequests++
      this.updateAverageResponseTime()

      item.resolve(response)
    } catch (error) {
      await this.handleRequestError(item, error)
    }

    // Continue processing the queue
    setTimeout(() => this.processQueue(), 100)
  }

  private async makeRequest(item: EnhancedRequestQueueItem): Promise<any> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), item.timeout)

    try {
      const headers = {
        accept: "application/vnd.linkedin.normalized+json+2.1",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        ...item.headers,
      }

      const response = await fetch(item.url, {
        method: "GET",
        credentials: "include",
        headers,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Handle rate limiting
      if (response.status === 429) {
        this.stats.rateLimitHits++
        const retryAfter = response.headers.get("retry-after")
        const backoffTime = retryAfter ? Number.parseInt(retryAfter) * 1000 : 5000

        this.rateLimitBackoff = Math.max(this.rateLimitBackoff, backoffTime)
        throw new Error(`Rate limited. Retry after ${backoffTime}ms`)
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  private async handleRequestError(item: EnhancedRequestQueueItem, error: any): Promise<void> {
    const isRateLimit = error.message?.includes("Rate limited")
    const isTimeout = error.name === "AbortError"
    const isNetworkError = error.message?.includes("fetch")

    if (item.retries < this.maxRetries && (isRateLimit || isTimeout || isNetworkError)) {
      item.retries++

      // Calculate exponential backoff delay
      const backoffDelay = item.retryDelay * Math.pow(2, item.retries - 1)
      const jitteredDelay = backoffDelay + Math.random() * 1000

      console.warn(
        `Request failed, retrying (${item.retries}/${this.maxRetries}) after ${jitteredDelay}ms:`,
        error.message,
      )

      // Add delay before retry
      await this.sleep(jitteredDelay)

      // Re-queue with higher priority to retry sooner
      item.priority += 10
      const insertIndex = this.queue.findIndex((queueItem) => queueItem.priority < item.priority)
      if (insertIndex === -1) {
        this.queue.push(item)
      } else {
        this.queue.splice(insertIndex, 0, item)
      }

      this.stats.queueLength = this.queue.length
    } else {
      console.error(`Request failed after ${this.maxRetries} retries:`, error)
      this.stats.failedRequests++
      item.reject(error)
    }
  }

  private updateAverageResponseTime(): void {
    if (this.responseTimes.length > 0) {
      const sum = this.responseTimes.reduce((acc, time) => acc + time, 0)
      this.stats.averageResponseTime = Math.round(sum / this.responseTimes.length)
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  getStats(): QueueStats {
    return {
      ...this.stats,
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
    }
  }

  getQueueLength(): number {
    return this.queue.length
  }

  clear(): void {
    this.queue.forEach((item) => item.reject(new Error("Queue cleared")))
    this.queue = []
    this.isProcessing = false
    this.stats.queueLength = 0
    this.stats.isProcessing = false
  }

  pause(): void {
    this.isProcessing = false
    this.stats.isProcessing = false
    console.log("Request queue paused")
  }

  resume(): void {
    if (this.queue.length > 0 && !this.isProcessing) {
      console.log("Request queue resumed")
      this.processQueue()
    }
  }

  // Get detailed queue information
  getQueueInfo(): Array<{
    url: string
    priority: number
    retries: number
    waitTime: number
  }> {
    const now = Date.now()
    return this.queue.map((item, index) => ({
      url: item.url,
      priority: item.priority,
      retries: item.retries,
      waitTime: now - (item.startTime || now),
    }))
  }

  // Adjust queue priorities based on patterns
  optimizeQueue(): void {
    // Boost priority of requests that have been waiting too long
    const now = Date.now()
    const maxWaitTime = 30000 // 30 seconds

    this.queue.forEach((item) => {
      const waitTime = now - (item.startTime || now)
      if (waitTime > maxWaitTime) {
        item.priority += Math.floor(waitTime / 10000) // Boost priority based on wait time
      }
    })

    // Re-sort queue by priority
    this.queue.sort((a, b) => b.priority - a.priority)
  }

  // Health check for the queue system
  getHealthStatus(): {
    status: "healthy" | "warning" | "critical"
    issues: string[]
    recommendations: string[]
  } {
    const stats = this.getStats()
    const issues: string[] = []
    const recommendations: string[] = []

    let status: "healthy" | "warning" | "critical" = "healthy"

    // Check queue length
    if (stats.queueLength > 50) {
      issues.push(`Queue is backed up with ${stats.queueLength} pending requests`)
      recommendations.push("Consider pausing new requests or increasing processing speed")
      status = "warning"
    }

    // Check failure rate
    const totalProcessed = stats.successfulRequests + stats.failedRequests
    if (totalProcessed > 0) {
      const failureRate = (stats.failedRequests / totalProcessed) * 100
      if (failureRate > 20) {
        issues.push(`High failure rate: ${failureRate.toFixed(1)}%`)
        recommendations.push("Check network connectivity and LinkedIn authentication")
        status = failureRate > 50 ? "critical" : "warning"
      }
    }

    // Check rate limiting
    if (stats.rateLimitHits > 5) {
      issues.push(`Frequent rate limiting: ${stats.rateLimitHits} hits`)
      recommendations.push("Increase delays between requests or reduce request frequency")
      status = "warning"
    }

    // Check response times
    if (stats.averageResponseTime > 10000) {
      issues.push(`Slow response times: ${stats.averageResponseTime}ms average`)
      recommendations.push("Check network conditions or LinkedIn server performance")
      status = "warning"
    }

    return { status, issues, recommendations }
  }

  // Reset statistics
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      rateLimitHits: 0,
    }
    this.responseTimes = []
    console.log("Queue statistics reset")
  }
}

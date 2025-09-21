export class RateLimiter {
  private requests: number[] = []
  private readonly windowMs: number
  private readonly maxRequests: number

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  async checkLimit(): Promise<{ allowed: boolean; retryAfter?: number }> {
    const now = Date.now()

    // Remove old requests outside the window
    this.requests = this.requests.filter((timestamp) => now - timestamp < this.windowMs)

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests)
      const retryAfter = this.windowMs - (now - oldestRequest)

      return {
        allowed: false,
        retryAfter: Math.max(0, retryAfter),
      }
    }

    this.requests.push(now)
    return { allowed: true }
  }

  getRemainingRequests(): number {
    const now = Date.now()
    this.requests = this.requests.filter((timestamp) => now - timestamp < this.windowMs)
    return Math.max(0, this.maxRequests - this.requests.length)
  }

  getResetTime(): number {
    if (this.requests.length === 0) return 0

    const oldestRequest = Math.min(...this.requests)
    return oldestRequest + this.windowMs
  }

  reset(): void {
    this.requests = []
  }
}

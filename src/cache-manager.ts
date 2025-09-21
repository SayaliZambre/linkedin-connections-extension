import type { CacheEntry } from "./types"
import { chrome } from "chrome"

export class CacheManager {
  private static readonly CACHE_PREFIX = "linkedin_connections_"
  private static readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes
  private static readonly MAX_CACHE_SIZE = 5 * 1024 * 1024 // 5MB limit
  private static readonly COMPRESSION_THRESHOLD = 1024 // Compress data larger than 1KB

  static async set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): Promise<void> {
    const cacheEntry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    }

    try {
      // Check cache size before adding new entry
      await this.enforceStorageLimit()

      let serializedData = JSON.stringify(cacheEntry)

      // Compress large data
      if (serializedData.length > this.COMPRESSION_THRESHOLD) {
        serializedData = await this.compressData(serializedData)
      }

      await chrome.storage.local.set({
        [`${this.CACHE_PREFIX}${key}`]: {
          ...cacheEntry,
          compressed: serializedData.length > this.COMPRESSION_THRESHOLD,
          size: serializedData.length,
        },
      })

      console.log(`Cached ${key} (${serializedData.length} bytes, TTL: ${ttl}ms)`)
    } catch (error) {
      console.error("Failed to set cache:", error)
      throw error
    }
  }

  static async get<T>(key: string): Promise<T | null> {
    try {
      const result = await chrome.storage.local.get(`${this.CACHE_PREFIX}${key}`)
      const cacheEntry: CacheEntry<T> & { compressed?: boolean; size?: number } = result[`${this.CACHE_PREFIX}${key}`]

      if (!cacheEntry) return null

      const isExpired = Date.now() - cacheEntry.timestamp > cacheEntry.ttl
      if (isExpired) {
        await this.remove(key)
        console.log(`Cache expired for ${key}`)
        return null
      }

      // Decompress if needed
      if (cacheEntry.compressed) {
        const decompressedData = await this.decompressData(JSON.stringify(cacheEntry))
        return JSON.parse(decompressedData).data
      }

      console.log(`Cache hit for ${key}`)
      return cacheEntry.data
    } catch (error) {
      console.error("Failed to get cache:", error)
      return null
    }
  }

  static async remove(key: string): Promise<void> {
    try {
      await chrome.storage.local.remove(`${this.CACHE_PREFIX}${key}`)
      console.log(`Removed cache for ${key}`)
    } catch (error) {
      console.error("Failed to remove cache:", error)
    }
  }

  static async clear(): Promise<void> {
    try {
      const allItems = await chrome.storage.local.get(null)
      const keysToRemove = Object.keys(allItems).filter((key) => key.startsWith(this.CACHE_PREFIX))

      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove)
        console.log(`Cleared ${keysToRemove.length} cache entries`)
      }
    } catch (error) {
      console.error("Failed to clear cache:", error)
    }
  }

  static async getCacheStats(): Promise<{
    totalItems: number
    totalSize: number
    oldestEntry: number | null
    newestEntry: number | null
    expiredItems: number
  }> {
    try {
      const allItems = await chrome.storage.local.get(null)
      const cacheItems = Object.entries(allItems).filter(([key]) => key.startsWith(this.CACHE_PREFIX))

      let totalSize = 0
      let oldestEntry: number | null = null
      let newestEntry: number | null = null
      let expiredItems = 0
      const now = Date.now()

      cacheItems.forEach(([key, entry]: [string, any]) => {
        if (entry.size) {
          totalSize += entry.size
        } else {
          totalSize += JSON.stringify(entry).length
        }

        if (entry.timestamp) {
          if (!oldestEntry || entry.timestamp < oldestEntry) {
            oldestEntry = entry.timestamp
          }
          if (!newestEntry || entry.timestamp > newestEntry) {
            newestEntry = entry.timestamp
          }

          // Check if expired
          if (now - entry.timestamp > entry.ttl) {
            expiredItems++
          }
        }
      })

      return {
        totalItems: cacheItems.length,
        totalSize,
        oldestEntry,
        newestEntry,
        expiredItems,
      }
    } catch (error) {
      console.error("Failed to get cache stats:", error)
      return { totalItems: 0, totalSize: 0, oldestEntry: null, newestEntry: null, expiredItems: 0 }
    }
  }

  static async cleanupExpired(): Promise<number> {
    try {
      const allItems = await chrome.storage.local.get(null)
      const cacheItems = Object.entries(allItems).filter(([key]) => key.startsWith(this.CACHE_PREFIX))
      const now = Date.now()
      const expiredKeys: string[] = []

      cacheItems.forEach(([key, entry]: [string, any]) => {
        if (entry.timestamp && entry.ttl && now - entry.timestamp > entry.ttl) {
          expiredKeys.push(key)
        }
      })

      if (expiredKeys.length > 0) {
        await chrome.storage.local.remove(expiredKeys)
        console.log(`Cleaned up ${expiredKeys.length} expired cache entries`)
      }

      return expiredKeys.length
    } catch (error) {
      console.error("Failed to cleanup expired cache:", error)
      return 0
    }
  }

  private static async enforceStorageLimit(): Promise<void> {
    try {
      const stats = await this.getCacheStats()

      if (stats.totalSize > this.MAX_CACHE_SIZE) {
        console.warn(`Cache size (${stats.totalSize}) exceeds limit (${this.MAX_CACHE_SIZE}), cleaning up...`)

        // First, remove expired items
        await this.cleanupExpired()

        // If still over limit, remove oldest items
        const updatedStats = await this.getCacheStats()
        if (updatedStats.totalSize > this.MAX_CACHE_SIZE) {
          await this.removeOldestItems(Math.ceil(updatedStats.totalItems * 0.3)) // Remove 30% of items
        }
      }
    } catch (error) {
      console.error("Failed to enforce storage limit:", error)
    }
  }

  private static async removeOldestItems(count: number): Promise<void> {
    try {
      const allItems = await chrome.storage.local.get(null)
      const cacheItems = Object.entries(allItems)
        .filter(([key]) => key.startsWith(this.CACHE_PREFIX))
        .sort(([, a], [, b]) => (a.timestamp || 0) - (b.timestamp || 0))
        .slice(0, count)

      const keysToRemove = cacheItems.map(([key]) => key)

      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove)
        console.log(`Removed ${keysToRemove.length} oldest cache entries`)
      }
    } catch (error) {
      console.error("Failed to remove oldest items:", error)
    }
  }

  private static async compressData(data: string): Promise<string> {
    // Simple compression using built-in compression
    try {
      const encoder = new TextEncoder()
      const decoder = new TextDecoder()
      const compressed = encoder.encode(data)
      return btoa(String.fromCharCode(...compressed))
    } catch (error) {
      console.warn("Compression failed, storing uncompressed:", error)
      return data
    }
  }

  private static async decompressData(data: string): Promise<string> {
    try {
      const compressed = Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
      const decoder = new TextDecoder()
      return decoder.decode(compressed)
    } catch (error) {
      console.warn("Decompression failed, returning as-is:", error)
      return data
    }
  }

  static async validateCache(): Promise<{ valid: number; invalid: number; repaired: number }> {
    try {
      const allItems = await chrome.storage.local.get(null)
      const cacheItems = Object.entries(allItems).filter(([key]) => key.startsWith(this.CACHE_PREFIX))

      let valid = 0
      let invalid = 0
      let repaired = 0
      const keysToRemove: string[] = []

      for (const [key, entry] of cacheItems) {
        try {
          // Validate entry structure
          if (!entry || typeof entry !== "object" || !entry.timestamp || !entry.ttl) {
            keysToRemove.push(key)
            invalid++
            continue
          }

          // Try to parse data
          if (entry.compressed) {
            await this.decompressData(JSON.stringify(entry))
          }

          valid++
        } catch (error) {
          console.warn(`Invalid cache entry ${key}:`, error)
          keysToRemove.push(key)
          invalid++
        }
      }

      // Remove invalid entries
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove)
        repaired = keysToRemove.length
      }

      return { valid, invalid, repaired }
    } catch (error) {
      console.error("Failed to validate cache:", error)
      return { valid: 0, invalid: 0, repaired: 0 }
    }
  }

  static async getDetailedStats(): Promise<{
    overview: any
    entries: Array<{
      key: string
      size: number
      age: number
      ttl: number
      expired: boolean
      compressed: boolean
    }>
  }> {
    try {
      const overview = await this.getCacheStats()
      const allItems = await chrome.storage.local.get(null)
      const cacheItems = Object.entries(allItems).filter(([key]) => key.startsWith(this.CACHE_PREFIX))
      const now = Date.now()

      const entries = cacheItems.map(([key, entry]: [string, any]) => ({
        key: key.replace(this.CACHE_PREFIX, ""),
        size: entry.size || JSON.stringify(entry).length,
        age: now - (entry.timestamp || 0),
        ttl: entry.ttl || 0,
        expired: entry.timestamp && entry.ttl ? now - entry.timestamp > entry.ttl : false,
        compressed: entry.compressed || false,
      }))

      return { overview, entries }
    } catch (error) {
      console.error("Failed to get detailed stats:", error)
      return { overview: {}, entries: [] }
    }
  }
}

export interface LinkedInConnection {
  id: string
  fullName: string
  profilePicture?: string
  currentCompany?: string
  companyLogo?: string
  position?: string
  profileUrl?: string
}

export interface CompanyInfo {
  name: string
  logo?: string
  id: string
}

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export interface RequestQueueItem {
  url: string
  resolve: (data: any) => void
  reject: (error: any) => void
  retries: number
}

export interface LinkedInApiResponse {
  elements?: any[]
  paging?: {
    count: number
    start: number
    total: number
  }
}

export interface DashboardState {
  connections: LinkedInConnection[]
  filteredConnections: LinkedInConnection[]
  loading: boolean
  error: string | null
  searchTerm: string
  selectedCompany: string
  companies: string[]
  stats: {
    total: number
    withCompany: number
    withPhoto: number
    uniqueCompanies: number
  }
  cacheStats: any
  queueStats: any
}

import type { LinkedInConnection, LinkedInApiResponse } from "./types"
import { chrome } from "chrome"

export class LinkedInAPI {
  private baseUrl = "https://www.linkedin.com/voyager/api"
  private csrfToken: string | null = null

  constructor() {
    this.initializeCSRFToken()
  }

  private async initializeCSRFToken(): Promise<void> {
    try {
      // Extract CSRF token from LinkedIn cookies
      const cookies = await chrome.cookies.getAll({ domain: ".linkedin.com" })
      const jsessionCookie = cookies.find((cookie) => cookie.name === "JSESSIONID")
      if (jsessionCookie) {
        this.csrfToken = jsessionCookie.value.split(":")[1] || null
      }
    } catch (error) {
      console.error("Failed to initialize CSRF token:", error)
    }
  }

  private getHeaders(): HeadersInit {
    return {
      accept: "application/vnd.linkedin.normalized+json+2.1",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      "csrf-token": this.csrfToken || "",
      "x-li-lang": "en_US",
      "x-li-track": JSON.stringify({
        clientVersion: "1.13.1043",
        mpVersion: "1.13.1043",
        osName: "web",
        timezoneOffset: new Date().getTimezoneOffset(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    }
  }

  async fetchConnections(start = 0, count = 100): Promise<LinkedInConnection[]> {
    const url = `${this.baseUrl}/relationships/dash/connections?decorationId=com.linkedin.voyager.dash.deco.web.mynetwork.ConnectionListWithProfile-5&count=${count}&start=${start}&sortType=RECENTLY_ADDED`

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: LinkedInApiResponse = await response.json()
      return this.parseConnectionsResponse(data)
    } catch (error) {
      console.error("Failed to fetch connections:", error)
      throw error
    }
  }

  private parseConnectionsResponse(data: LinkedInApiResponse): LinkedInConnection[] {
    if (!data.elements) return []

    return data.elements.map((element: any) => {
      const profile = element.connectedMember || {}
      const miniProfile = profile.miniProfile || {}
      const occupation = miniProfile.occupation || ""

      return {
        id: miniProfile.entityUrn?.split(":").pop() || "",
        fullName: `${miniProfile.firstName || ""} ${miniProfile.lastName || ""}`.trim(),
        profilePicture: miniProfile.picture?.rootUrl
          ? `${miniProfile.picture.rootUrl}${miniProfile.picture.artifacts?.[0]?.fileIdentifyingUrlPathSegment || ""}`
          : undefined,
        currentCompany: this.extractCompanyName(occupation),
        position: this.extractPosition(occupation),
        profileUrl: miniProfile.publicIdentifier
          ? `https://www.linkedin.com/in/${miniProfile.publicIdentifier}`
          : undefined,
      }
    })
  }

  private extractCompanyName(occupation: string): string | undefined {
    const match = occupation.match(/at (.+?)(?:\s|$)/)
    return match ? match[1].trim() : undefined
  }

  private extractPosition(occupation: string): string | undefined {
    const match = occupation.match(/^(.+?)\s+at/)
    return match ? match[1].trim() : occupation || undefined
  }

  async fetchCompanyLogo(companyName: string): Promise<string | undefined> {
    try {
      const searchUrl = `${this.baseUrl}/typeahead/hitsV2?keywords=${encodeURIComponent(companyName)}&origin=GLOBAL_SEARCH_HEADER&q=blended&start=0&count=5`

      const response = await fetch(searchUrl, {
        method: "GET",
        headers: this.getHeaders(),
        credentials: "include",
      })

      if (!response.ok) return undefined

      const data = await response.json()
      const companyHit = data.elements?.find(
        (element: any) => element.hitInfo?.["com.linkedin.voyager.search.SearchCompany"],
      )

      if (companyHit) {
        const company = companyHit.hitInfo["com.linkedin.voyager.search.SearchCompany"]
        const logo = company.logo?.rootUrl
        const artifact = company.logo?.artifacts?.[0]

        if (logo && artifact) {
          return `${logo}${artifact.fileIdentifyingUrlPathSegment}`
        }
      }

      return undefined
    } catch (error) {
      console.error(`Failed to fetch company logo for ${companyName}:`, error)
      return undefined
    }
  }
}

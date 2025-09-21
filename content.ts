// Content script to inject into LinkedIn pages
// This helps with authentication and provides additional context

console.log("LinkedIn Connections Dashboard content script loaded")

// Declare chrome variable
declare const chrome: any

// Check if user is logged in to LinkedIn
function checkLinkedInAuth(): boolean {
  const authElements = [
    'a[href*="/logout"]',
    ".global-nav__me",
    "[data-test-global-nav-me]",
    ".nav-item__profile-member-photo",
  ]

  return authElements.some((selector) => document.querySelector(selector) !== null)
}

// Extract CSRF token from page
function extractCSRFToken(): string | null {
  const scripts = document.querySelectorAll("script")
  for (const script of scripts) {
    const content = script.textContent || ""
    const match = content.match(/"csrfToken":"([^"]+)"/)
    if (match) {
      return match[1]
    }
  }
  return null
}

// Send authentication status to background script
function sendAuthStatus() {
  const isAuthenticated = checkLinkedInAuth()
  const csrfToken = extractCSRFToken()

  chrome.runtime.sendMessage({
    action: "authStatus",
    isAuthenticated,
    csrfToken,
    url: window.location.href,
  })
}

// Check auth status when page loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", sendAuthStatus)
} else {
  sendAuthStatus()
}

// Monitor for navigation changes (LinkedIn is a SPA)
let currentUrl = window.location.href
const observer = new MutationObserver(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href
    setTimeout(sendAuthStatus, 1000) // Delay to allow page to load
  }
})

observer.observe(document.body, {
  childList: true,
  subtree: true,
})

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "checkAuth":
      sendResponse({
        isAuthenticated: checkLinkedInAuth(),
        csrfToken: extractCSRFToken(),
        url: window.location.href,
      })
      break

    case "navigateToConnections":
      // Navigate to connections page if not already there
      if (!window.location.href.includes("/mynetwork/invite-connect/connections/")) {
        window.location.href = "https://www.linkedin.com/mynetwork/invite-connect/connections/"
      }
      sendResponse({ success: true })
      break

    default:
      sendResponse({ error: "Unknown action" })
  }
})

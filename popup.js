// Popup script to handle user interactions
document.addEventListener("DOMContentLoaded", async () => {
  const openDashboardBtn = document.getElementById("openDashboard")
  const statusDiv = document.getElementById("status")

  // Declare the chrome variable
  const chrome = window.chrome

  // Check if we're on LinkedIn
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const isLinkedIn = tab.url?.includes("linkedin.com")

  if (!isLinkedIn) {
    statusDiv.textContent = "Please navigate to LinkedIn first"
    statusDiv.className = "mt-4 text-sm text-red-600"
    openDashboardBtn.disabled = true
    openDashboardBtn.className = "bg-gray-400 text-white font-medium py-2 px-4 rounded-lg cursor-not-allowed"
    return
  }

  // Check authentication status
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: "checkAuth" })

    if (!response.isAuthenticated) {
      statusDiv.textContent = "Please log in to LinkedIn first"
      statusDiv.className = "mt-4 text-sm text-red-600"
      openDashboardBtn.disabled = true
      openDashboardBtn.className = "bg-gray-400 text-white font-medium py-2 px-4 rounded-lg cursor-not-allowed"
      return
    }

    statusDiv.textContent = "Ready to fetch connections"
    statusDiv.className = "mt-4 text-sm text-green-600"
  } catch (error) {
    console.error("Failed to check auth:", error)
    statusDiv.textContent = "Error checking authentication"
    statusDiv.className = "mt-4 text-sm text-red-600"
  }

  // Handle dashboard button click
  openDashboardBtn.addEventListener("click", () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL("dashboard.html"),
    })
    window.close()
  })

  // Add cache stats
  try {
    const cacheResponse = await chrome.runtime.sendMessage({ action: "getCacheStats" })
    if (cacheResponse.success) {
      const stats = cacheResponse.data
      const cacheInfo = document.createElement("div")
      cacheInfo.className = "mt-2 text-xs text-gray-500"
      cacheInfo.textContent = `Cache: ${stats.totalItems} items (${Math.round(stats.totalSize / 1024)}KB)`
      statusDiv.appendChild(cacheInfo)
    }
  } catch (error) {
    console.error("Failed to get cache stats:", error)
  }
})

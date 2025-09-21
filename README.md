🚀 LinkedIn Connections Dashboard – Chrome Extension

A Chrome extension that fetches and displays your LinkedIn connections in a clean, responsive dashboard with advanced filtering, caching, and analytics capabilities.

✨ Features

🔒 Secure Authentication – Uses your existing LinkedIn session (no extra login).

⚡ Smart Caching – 5–10 min cache with TTL + auto cleanup.

⏳ Request Throttling – Random delays (300–1000ms) to mimic human activity.

📊 Responsive Dashboard – Built with Svelte + TailwindCSS, includes real-time statistics.

🔍 Advanced Filtering – Search by name, company, or position.

🏢 Company Logos – Auto-fetch & cache logos (24h).

🛠 Error Handling – Automatic retries, rate-limit backoff, and recovery strategies.

📈 Performance Monitoring – Track cache, queue, and response metrics.

📋 Requirements

Chrome Browser (Manifest V3 compatible)

Active LinkedIn account & session

At least one LinkedIn connection

🛠 Installation
Option 1 – Development (Load Unpacked)

Clone repo:

git clone <repo-url>
cd linkedin-connections-extension


Open Chrome and navigate to:

chrome://extensions/


Enable Developer Mode.

Click Load Unpacked → Select project folder.

Open LinkedIn, log in, then click the extension icon → Open Dashboard.

Option 2 – Build & Package

Compile TypeScript (if modified):

npm install -g typescript
tsc src/*.ts --outDir dist --target es2020 --module es2020


Package:

Go to chrome://extensions/

Click Pack extension

Select folder → .crx file generated

🔧 Usage

Log in to LinkedIn.

Click the extension icon → Open Dashboard.

Fetch connections with Refresh (first load: 30–60s).

Use cached data for faster reloads.

Dashboard Features

📌 Statistics Overview

Total connections

With company info

With profile photos

Unique companies

🔎 Filtering & Search

Search by name, company, or position

Company-based filters

Real-time search updates

🛡 System Monitoring

Cache health (size, items, expired)

Request queue status

Performance metrics

⚙️ How It Works
LinkedIn API (Reverse-Engineered)

Uses internal Voyager API endpoints (authenticated with CSRF + cookies).

Example endpoints:

GET /voyager/api/relationships/dash/connections
GET /voyager/api/typeahead/hitsV2?keywords={companyName}


Required headers:

{
  'accept': 'application/vnd.linkedin.normalized+json+2.1',
  'csrf-token': '',
  'x-li-lang': 'en_US'
}

Caching

Connections → 5–10 min TTL

Company Logos → 24h TTL

Stored via Chrome Storage API:

chrome.storage.local.set({
  'linkedin_connections': {
    data: connections,
    timestamp: Date.now(),
    ttl: 300000 // 5 minutes
  }
})

Request Queue

Random delay (300–1000ms)

Exponential backoff on retries

Auto-detects 429 (rate limit)

Priority-based queue

📊 Architecture

File Structure

linkedin-connections-extension/
├── manifest.json
├── popup.html / popup.js
├── dashboard.html
├── background.ts
├── content.ts
├── src/
│   ├── types.ts
│   ├── linkedin-api.ts
│   ├── connections-service.ts
│   ├── cache-manager.ts
│   ├── cache-monitor.ts
│   ├── request-queue.ts
│   ├── rate-limiter.ts
│   └── error-handler.ts
└── README.md


Component Responsibilities

background.ts → Message routing, lifecycle mgmt, error handling

content.ts → LinkedIn auth detection, CSRF token extraction

linkedin-api.ts → API communication + logo fetching

connections-service.ts → Batch processing + cache integration

cache-manager.ts → TTL mgmt, compression, cleanup

request-queue.ts → Throttling, retries, monitoring

⚠️ Limitations

❌ Unofficial API (may break anytime if LinkedIn changes).

⏳ Fetch limited to 1000 connections (rate-limiting safety).

🌐 Requires stable internet + active LinkedIn session.

🖥 Chrome-only (Manifest V3).

🐛 Troubleshooting

"Please log in" → Log into LinkedIn, reload extension.

Rate-limited → Wait 5–10 minutes.

No connections loading → Clear cache → Refresh → Restart Chrome.

Debugging:

Open DevTools > Console → look for [LinkedIn Extension] logs.

🔒 Privacy & Security

Data stored locally only (no external servers).

Uses LinkedIn cookies + CSRF tokens securely.

No passwords stored/transmitted.

Minimal Chrome permissions:

{
  "permissions": ["activeTab", "storage", "cookies"],
  "host_permissions": ["https://*.linkedin.com/*"]
}

🤝 Contributing

Fork & clone repo.

Modify TypeScript files.

Test via Load Unpacked in Chrome.

Submit PR with changes.

Coding Standards

TypeScript (strict)

ESLint enforced

Centralized error handling

Comprehensive logging

📄 License

Educational & personal use only.
Respect LinkedIn’s Terms of Service.

📞 Support

Check troubleshooting steps.

Review browser console logs.

Open GitHub issue with:

Browser version

Error messages/screenshots

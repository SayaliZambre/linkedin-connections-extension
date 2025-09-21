<script>
  import { run } from 'svelte/legacy';

  import { onMount } from 'svelte';
  
  let connections = [];
  let filteredConnections = $state([]);
  let searchTerm = $state('');
  let selectedCompany = $state('');
  let loading = $state(true);
  let stats = $state({
    total: 0,
    companies: 0,
    recentConnections: 0
  });

  // Mock data - replace with actual LinkedIn API data
  const mockConnections = [
    {
      id: 1,
      name: 'Sarah Chen',
      company: 'Vercel',
      position: 'Senior Product Designer',
      profilePicture: '/placeholder.svg?height=40&width=40',
      companyLogo: '/placeholder.svg?height=24&width=24',
      connectedDate: '2024-01-15'
    },
    {
      id: 2,
      name: 'Michael Rodriguez',
      company: 'Microsoft',
      position: 'Software Engineer',
      profilePicture: '/placeholder.svg?height=40&width=40',
      companyLogo: '/placeholder.svg?height=24&width=24',
      connectedDate: '2024-01-10'
    },
    {
      id: 3,
      name: 'Emily Johnson',
      company: 'Google',
      position: 'UX Researcher',
      profilePicture: '/placeholder.svg?height=40&width=40',
      companyLogo: '/placeholder.svg?height=24&width=24',
      connectedDate: '2024-01-08'
    },
    {
      id: 4,
      name: 'David Kim',
      company: 'Stripe',
      position: 'Frontend Developer',
      profilePicture: '/placeholder.svg?height=40&width=40',
      companyLogo: '/placeholder.svg?height=24&width=24',
      connectedDate: '2024-01-05'
    },
    {
      id: 5,
      name: 'Lisa Wang',
      company: 'Vercel',
      position: 'Engineering Manager',
      profilePicture: '/placeholder.svg?height=40&width=40',
      companyLogo: '/placeholder.svg?height=24&width=24',
      connectedDate: '2024-01-03'
    },
    {
      id: 6,
      name: 'James Wilson',
      company: 'Figma',
      position: 'Product Manager',
      profilePicture: '/placeholder.svg?height=40&width=40',
      companyLogo: '/placeholder.svg?height=24&width=24',
      connectedDate: '2023-12-28'
    }
  ];

  onMount(() => {
    // Simulate loading
    setTimeout(() => {
      connections = mockConnections;
      filteredConnections = connections;
      updateStats();
      loading = false;
    }, 1000);
  });

  function updateStats() {
    const companies = new Set(connections.map(c => c.company));
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 30);
    
    stats = {
      total: connections.length,
      companies: companies.size,
      recentConnections: connections.filter(c => new Date(c.connectedDate) > recentDate).length
    };
  }

  function filterConnections() {
    filteredConnections = connections.filter(connection => {
      const matchesSearch = connection.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           connection.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           connection.position.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCompany = selectedCompany === '' || connection.company === selectedCompany;
      
      return matchesSearch && matchesCompany;
    });
  }

  run(() => {
    filterConnections();
  });

  const companies = Array.from(new Set(connections.map(c => c.company))).sort();
</script>

<div class="min-h-screen bg-background text-foreground">
  <!-- Header -->
  <header class="border-b border-border bg-card">
    <div class="flex h-16 items-center justify-between px-6">
      <div class="flex items-center space-x-4">
        <h1 class="text-2xl font-bold">LinkedIn Connections</h1>
        <div class="flex items-center space-x-2 text-sm text-muted-foreground">
          <span class="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            Dashboard
          </span>
        </div>
      </div>
      
      <div class="flex items-center space-x-4">
        <button class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
          Export Data
        </button>
        <button class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
          Sync LinkedIn
        </button>
      </div>
    </div>
  </header>

  <div class="flex">
    <!-- Sidebar -->
    <aside class="w-64 border-r border-border bg-card p-6">
      <nav class="space-y-6">
        <div>
          <h3 class="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">Overview</h3>
          <ul class="space-y-2">
            <li>
              <a href="/" class="flex items-center rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground">
                <svg class="mr-3 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                All Connections
              </a>
            </li>
            <li>
              <a href="/" class="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                <svg class="mr-3 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Companies
              </a>
            </li>
            <li>
              <a href="/" class="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                <svg class="mr-3 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Analytics
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 class="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">Filters</h3>
          <div class="space-y-4">
            <div>
              <label class="text-sm font-medium text-foreground" for="search">Search</label>
              <input
                id="search"
                type="text"
                bind:value={searchTerm}
                placeholder="Search connections..."
                class="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            
            <div>
              <label class="text-sm font-medium text-foreground" for="company">Company</label>
              <select
                id="company"
                bind:value={selectedCompany}
                class="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">All Companies</option>
                {#each companies as company}
                  <option value={company}>{company}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>
      </nav>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 p-6">
      <!-- Stats Cards -->
      <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="rounded-lg border border-border bg-card p-6">
          <div class="flex items-center">
            <div class="flex-1">
              <p class="text-sm font-medium text-muted-foreground">Total Connections</p>
              <p class="text-2xl font-bold text-foreground">{stats.total}</p>
            </div>
            <div class="rounded-full bg-primary/10 p-3">
              <svg class="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div class="rounded-lg border border-border bg-card p-6">
          <div class="flex items-center">
            <div class="flex-1">
              <p class="text-sm font-medium text-muted-foreground">Companies</p>
              <p class="text-2xl font-bold text-foreground">{stats.companies}</p>
            </div>
            <div class="rounded-full bg-primary/10 p-3">
              <svg class="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
        </div>

        <div class="rounded-lg border border-border bg-card p-6">
          <div class="flex items-center">
            <div class="flex-1">
              <p class="text-sm font-medium text-muted-foreground">Recent (30 days)</p>
              <p class="text-2xl font-bold text-foreground">{stats.recentConnections}</p>
            </div>
            <div class="rounded-full bg-primary/10 p-3">
              <svg class="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Connections Table -->
      <div class="rounded-lg border border-border bg-card">
        <div class="border-b border-border p-6">
          <h2 class="text-lg font-semibold text-foreground">Your Connections</h2>
          <p class="text-sm text-muted-foreground">Manage and view your LinkedIn professional network</p>
        </div>

        <div class="p-6">
          {#if loading}
            <div class="flex items-center justify-center py-12">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span class="ml-3 text-muted-foreground">Loading connections...</span>
            </div>
          {:else if filteredConnections.length === 0}
            <div class="text-center py-12">
              <svg class="mx-auto h-12 w-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 class="mt-4 text-lg font-medium text-foreground">No connections found</h3>
              <p class="mt-2 text-sm text-muted-foreground">Try adjusting your search or filter criteria.</p>
            </div>
          {:else}
            <div class="space-y-4">
              {#each filteredConnections as connection (connection.id)}
                <div class="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-accent/50 transition-colors">
                  <div class="flex items-center space-x-4">
                    <img
                      src={connection.profilePicture || "/placeholder.svg"}
                      alt={connection.name}
                      class="h-12 w-12 rounded-full object-cover"
                    />
                    <div>
                      <h3 class="font-medium text-foreground">{connection.name}</h3>
                      <p class="text-sm text-muted-foreground">{connection.position}</p>
                    </div>
                  </div>

                  <div class="flex items-center space-x-4">
                    <div class="flex items-center space-x-2">
                      <img
                        src={connection.companyLogo || "/placeholder.svg"}
                        alt={connection.company}
                        class="h-6 w-6 rounded object-cover"
                      />
                      <span class="text-sm font-medium text-foreground">{connection.company}</span>
                    </div>
                    
                    <div class="text-right">
                      <p class="text-xs text-muted-foreground">Connected</p>
                      <p class="text-sm text-foreground">{new Date(connection.connectedDate).toLocaleDateString()}</p>
                    </div>

                    <button class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8" aria-label="Action Button">
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </main>
  </div>
</div>

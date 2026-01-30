/**
 * XOAuth Thunderbird Options Page
 */

let cachedProviders = [];

const elements = {
  cachedCount: document.getElementById("cachedCount"),
  accountCount: document.getElementById("accountCount"),
  refreshAllBtn: document.getElementById("refreshAllBtn"),
  clearCacheBtn: document.getElementById("clearCacheBtn"),
  scanAccountsBtn: document.getElementById("scanAccountsBtn"),
  reloadListBtn: document.getElementById("reloadListBtn"),
  clearLogsBtn: document.getElementById("clearLogsBtn"),
  loadingIndicator: document.getElementById("loadingIndicator"),
  emptyState: document.getElementById("emptyState"),
  providerList: document.getElementById("providerList"),
  logContainer: document.getElementById("logContainer"),
};

function log(message, type = "info") {
  const timestamp = new Date().toLocaleTimeString();
  const entry = document.createElement("p");
  entry.className = `log-entry log-${type}`;
  entry.innerHTML = `<span class="log-timestamp">[${timestamp}]</span>${message}`;

  elements.logContainer.appendChild(entry);
  elements.logContainer.scrollTop = elements.logContainer.scrollHeight;

  const entries = elements.logContainer.querySelectorAll(".log-entry");
  if (entries.length > 100) {
    entries[0].remove();
  }
}

function clearLogs() {
  elements.logContainer.innerHTML = "";
  log("Logs cleared", "info");
}

async function getCachedDomains() {
  try {
    const result = await messenger.oauthprovider.getCachedDomains();
    return result.domains || [];
  } catch (error) {
    log(`Error getting cached domains: ${error.message}`, "error");
    return [];
  }
}

async function getProviderDetails(domain) {
  try {
    const details = await messenger.oauthprovider.getProviderDetails(domain);
    return details;
  } catch (error) {
    log(`Error getting details for ${domain}: ${error.message}`, "error");
    return null;
  }
}

async function getAccounts() {
  try {
    const accounts = await messenger.accounts.list();
    return accounts;
  } catch (error) {
    log(`Error getting accounts: ${error.message}`, "error");
    return [];
  }
}

async function refreshProvider(domain) {
  try {
    const result = await messenger.oauthprovider.refreshProvider(domain);
    return result.exists;
  } catch (error) {
    log(`Error refreshing ${domain}: ${error.message}`, "error");
    return false;
  }
}

async function clearCache(domain = null) {
  try {
    await messenger.oauthprovider.clearCache(domain);
    return true;
  } catch (error) {
    log(`Error clearing cache: ${error.message}`, "error");
    return false;
  }
}

function showLoading() {
  elements.loadingIndicator.style.display = "flex";
  elements.emptyState.style.display = "none";
  elements.providerList.style.display = "none";
}

function hideLoading() {
  elements.loadingIndicator.style.display = "none";
}

function showEmptyState() {
  elements.emptyState.style.display = "block";
  elements.providerList.style.display = "none";
}

function showProviderList() {
  elements.emptyState.style.display = "none";
  elements.providerList.style.display = "flex";
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return "Unknown";

  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function isStale(timestamp, maxAge = 24 * 60 * 60 * 1000) {
  if (!timestamp) return true;
  return Date.now() - timestamp > maxAge;
}

function renderProviderItem(details) {
  const item = document.createElement("div");
  item.className = "provider-item";
  item.dataset.domain = details.domain;

  const statusClass = details.isStale ? "status-stale" : "status-fresh";
  const statusText = details.isStale ? "Stale" : "Fresh";

  item.innerHTML = `
    <div class="provider-info">
      <div class="provider-domain">${details.domain}</div>
      <div class="provider-details">
        <span class="provider-detail">
          Cached: ${formatTimeAgo(details.cachedAt)}
        </span>
        <span class="provider-detail">
          <span class="status-badge ${statusClass}">
            ${statusText}
          </span>
        </span>
      </div>
    </div>
    <div class="provider-actions">
      <button class="btn btn-small btn-primary refresh-btn" data-domain="${details.domain}">
        <span class="icon">↻</span>
        Refresh
      </button>
      <button class="btn btn-small btn-danger remove-btn" data-domain="${details.domain}">
        <span class="icon">✕</span>
        Remove
      </button>
    </div>
  `;

  return item;
}

async function loadProviders() {
  showLoading();
  log("Loading cached providers...", "info");

  try {
    cachedProviders = await getCachedDomains();
    elements.cachedCount.textContent = cachedProviders.length;

    hideLoading();

    if (cachedProviders.length === 0) {
      showEmptyState();
      log("No cached providers found", "warning");
    } else {
      showProviderList();
      elements.providerList.innerHTML = "";

      for (const domain of cachedProviders) {
        const details = await getProviderDetails(domain);
        if (details) {
          const item = renderProviderItem(details);
          elements.providerList.appendChild(item);
        }
      }

      log(`Loaded ${cachedProviders.length} cached provider(s)`, "success");
    }
  } catch (error) {
    hideLoading();
    log(`Failed to load providers: ${error.message}`, "error");
  }
}

async function loadStats() {
  try {
    const accounts = await getAccounts();
    let identityCount = 0;

    accounts.forEach((account) => {
      identityCount += account.identities?.length || 0;
    });

    elements.accountCount.textContent = identityCount;
  } catch (error) {
    log(`Failed to load stats: ${error.message}`, "error");
  }
}

async function handleRefreshAll() {
  if (cachedProviders.length === 0) {
    log("No providers to refresh", "warning");
    return;
  }

  elements.refreshAllBtn.disabled = true;
  log(`Refreshing ${cachedProviders.length} provider(s)...`, "info");

  let successCount = 0;
  for (const domain of cachedProviders) {
    const success = await refreshProvider(domain);
    if (success) {
      successCount++;
      log(`✓ Refreshed: ${domain}`, "success");
    } else {
      log(`✗ Failed: ${domain}`, "error");
    }
  }

  log(
    `Refresh complete: ${successCount}/${cachedProviders.length} successful`,
    successCount === cachedProviders.length ? "success" : "warning",
  );

  elements.refreshAllBtn.disabled = false;
  await loadProviders();
}

async function handleClearCache() {
  if (!confirm("Are you sure you want to clear all cached providers?")) {
    return;
  }

  elements.clearCacheBtn.disabled = true;
  log("Clearing all cache...", "info");

  const success = await clearCache();
  if (success) {
    log("Cache cleared successfully", "success");
    await loadProviders();
    await loadStats();
  } else {
    log("Failed to clear cache", "error");
  }

  elements.clearCacheBtn.disabled = false;
}

async function handleScanAccounts() {
  elements.scanAccountsBtn.disabled = true;
  log("Scanning accounts...", "info");

  try {
    const accounts = await getAccounts();
    let processedDomains = new Set();

    for (const account of accounts) {
      for (const identity of account.identities || []) {
        if (identity.email) {
          const domain = identity.email.split("@")[1]?.toLowerCase();
          if (domain && !processedDomains.has(domain)) {
            processedDomains.add(domain);
            log(`Checking: ${domain}`, "info");
            await refreshProvider(domain);
          }
        }
      }
    }

    log(
      `Scan complete: ${processedDomains.size} domain(s) processed`,
      "success",
    );
    await loadProviders();
    await loadStats();
  } catch (error) {
    log(`Scan failed: ${error.message}`, "error");
  }

  elements.scanAccountsBtn.disabled = false;
}

async function handleRefreshProvider(domain) {
  log(`Refreshing ${domain}...`, "info");

  const success = await refreshProvider(domain);
  if (success) {
    log(`✓ Refreshed: ${domain}`, "success");
    await loadProviders();
  } else {
    log(`✗ Failed to refresh: ${domain}`, "error");
  }
}

async function handleRemoveProvider(domain) {
  if (!confirm(`Remove cached config for ${domain}?`)) {
    return;
  }

  log(`Removing ${domain}...`, "info");

  const success = await clearCache(domain);
  if (success) {
    log(`✓ Removed: ${domain}`, "success");
    await loadProviders();
    await loadStats();
  } else {
    log(`✗ Failed to remove: ${domain}`, "error");
  }
}

elements.refreshAllBtn.addEventListener("click", handleRefreshAll);
elements.clearCacheBtn.addEventListener("click", handleClearCache);
elements.scanAccountsBtn.addEventListener("click", handleScanAccounts);
elements.reloadListBtn.addEventListener("click", () => {
  log("Reloading provider list...", "info");
  loadProviders();
});
elements.clearLogsBtn.addEventListener("click", clearLogs);

elements.providerList.addEventListener("click", (e) => {
  const refreshBtn = e.target.closest(".refresh-btn");
  const removeBtn = e.target.closest(".remove-btn");

  if (refreshBtn) {
    const domain = refreshBtn.dataset.domain;
    handleRefreshProvider(domain);
  } else if (removeBtn) {
    const domain = removeBtn.dataset.domain;
    handleRemoveProvider(domain);
  }
});

async function init() {
  log("XOAuth Thunderbird Options loaded", "success");
  await loadStats();
  await loadProviders();
}

init();

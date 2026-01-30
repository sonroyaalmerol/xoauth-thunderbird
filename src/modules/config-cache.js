/**
 * Config Cache Module
 * Handles caching OAuth configurations in preferences
 */

let PREF_BRANCH = "extensions.xoauthtb.cache.";

let prefService = Components.classes[
  "@mozilla.org/preferences-service;1"
].getService(Components.interfaces.nsIPrefService);
let prefBranch = prefService.getBranch(PREF_BRANCH);

var ConfigCache = {
  /**
   * Save OAuth config to preferences
   * @param {string} domain - The domain
   * @param {object} config - OAuth configuration
   */
  save(domain, config) {
    try {
      const key = this.getDomainKey(domain);
      const json = JSON.stringify({
        ...config,
        cachedAt: Date.now(),
      });

      prefBranch.setStringPref(key, json);
      console.log(`[XOAuthTB] Cached config for: ${domain}`);
    } catch (error) {
      console.error(`[XOAuthTB] Failed to cache ${domain}:`, error);
    }
  },

  /**
   * Load OAuth config from preferences
   * @param {string} domain - The domain
   * @returns {object|null} - Cached config or null
   */
  load(domain) {
    try {
      const key = this.getDomainKey(domain);
      if (!prefBranch.prefHasUserValue(key)) {
        return null;
      }

      const json = prefBranch.getStringPref(key);
      const config = JSON.parse(json);

      console.log(`[XOAuthTB] Loaded cached config for: ${domain}`);
      return config;
    } catch (error) {
      console.warn(`[XOAuthTB] Failed to load cache for ${domain}:`, error);
      return null;
    }
  },

  /**
   * Get provider details with metadata
   * @param {string} domain - The domain
   * @returns {object|null} - Provider details or null
   */
  getDetails(domain) {
    try {
      const config = this.load(domain);
      if (!config) return null;

      const stale = this.isStale(config);

      return {
        domain,
        issuer: config.issuer,
        hostnames: config.hostnames || [],
        cachedAt: config.cachedAt,
        isStale: stale,
        ageMs: config.cachedAt ? Date.now() - config.cachedAt : null,
      };
    } catch (error) {
      console.error(`[XOAuthTB] Failed to get details for ${domain}:`, error);
      return null;
    }
  },

  /**
   * Check if cached config exists
   * @param {string} domain - The domain
   * @returns {boolean}
   */
  has(domain) {
    const key = this.getDomainKey(domain);
    return prefBranch.prefHasUserValue(key);
  },

  /**
   * Remove cached config
   * @param {string} domain - The domain
   */
  remove(domain) {
    try {
      const key = this.getDomainKey(domain);
      if (prefBranch.prefHasUserValue(key)) {
        prefBranch.clearUserPref(key);
        console.log(`[XOAuthTB] Removed cache for: ${domain}`);
      }
    } catch (error) {
      console.error(`[XOAuthTB] Failed to remove cache for ${domain}:`, error);
    }
  },

  /**
   * Clear all cached configs
   */
  clearAll() {
    try {
      const prefs = prefBranch.getChildList("");
      for (const pref of prefs) {
        prefBranch.clearUserPref(pref);
      }
      console.log("[XOAuthTB] Cleared all cached configs");
    } catch (error) {
      console.error("[XOAuthTB] Failed to clear cache:", error);
    }
  },

  /**
   * Get all cached domains
   * @returns {string[]}
   */
  getAllDomains() {
    try {
      const prefs = prefBranch.getChildList("");
      return prefs.map((pref) => this.keyToDomain(pref));
    } catch (error) {
      console.error("[XOAuthTB] Failed to get cached domains:", error);
      return [];
    }
  },

  /**
   * Check if cache is stale
   * @param {object} config - Cached config
   * @param {number} maxAge - Max age in milliseconds (default 24h)
   * @returns {boolean}
   */
  isStale(config, maxAge = 24 * 60 * 60 * 1000) {
    if (!config || !config.cachedAt) return true;
    return Date.now() - config.cachedAt > maxAge;
  },

  /**
   * Convert domain to preference key
   * @param {string} domain
   * @returns {string}
   */
  getDomainKey(domain) {
    // Replace dots with underscores for pref key
    return domain.toLowerCase().replace(/\./g, "_");
  },

  /**
   * Convert preference key back to domain
   * @param {string} key
   * @returns {string}
   */
  keyToDomain(key) {
    return key.replace(/_/g, ".");
  },
};

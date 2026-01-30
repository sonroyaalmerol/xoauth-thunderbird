/**
 * Account Scanner Module
 * Scans existing accounts for OAuth configuration
 */

var AccountScanner = {
  /**
   * Scan all accounts and register OAuth providers
   */
  scanAndRegisterAll() {
    try {
      const accountManager = Components.classes[
        "@mozilla.org/messenger/account-manager;1"
      ].getService(Components.interfaces.nsIMsgAccountManager);

      console.log("[XOAuthTB] Starting account scan...");
      let count = 0;

      for (const account of accountManager.accounts) {
        for (const identity of account.identities) {
          if (!identity.email) continue;

          const domain = this.extractDomain(identity.email);
          if (domain) {
            console.log(`[XOAuthTB] Checking: ${identity.email}`);
            if (ConfigFetcher.fetchAndRegister(domain)) {
              count++;
            }
          }
        }
      }

      console.log(`[XOAuthTB] Scan complete: ${count} registered`);
    } catch (error) {
      console.error("[XOAuthTB] Scan failed:", error);
    }
  },

  /**
   * Extract domain from email
   * @param {string} email
   * @returns {string|null}
   */
  extractDomain(email) {
    if (!email || typeof email !== "string") return null;

    const parts = email.split("@");
    if (parts.length !== 2) return null;

    return parts[1].toLowerCase().trim();
  },
};

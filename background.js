console.log("[XOAuthTB] Extension loaded");

async function registerExistingAccounts() {
  console.log("[XOAuthTB] Initializing startup registration...");
  try {
    const accounts = await messenger.accounts.list();

    for (const account of accounts) {
      for (const identity of account.identities || []) {
        if (identity.email) {
          const domain = identity.email.split("@")[1]?.toLowerCase();
          if (domain) {
            try {
              const { exists } =
                await browser.oauthprovider.checkIfProviderExists(domain);
              if (exists) {
                console.log(
                  `[XOAuthTB] Provider verified/registered for: ${domain}`,
                );
              } else {
                console.log(
                  `[XOAuthTB] No OAuth config available for: ${domain}`,
                );
              }
            } catch (apiError) {
              console.error(
                `[XOAuthTB] API call failed for ${domain}:`,
                apiError,
              );
            }
          }
        }
      }
    }
    console.log("[XOAuthTB] Startup registration complete.");
  } catch (error) {
    console.error("[XOAuthTB] Failed to list accounts:", error);
  }
}

function keep_alive() {
  let getting = browser.runtime.getPlatformInfo();
  setTimeout(keep_alive, "20000");
}

keep_alive();
registerExistingAccounts();

messenger.accounts.onCreated.addListener((accountId, account) => {
  console.log(
    `[XOAuthTB] New account detected: ${accountId}. Refreshing providers...`,
  );
  registerExistingAccounts();
});
messenger.accounts.onUpdated.addListener((accountId, account) => {
  console.log(
    `[XOAuthTB] Updated account detected: ${accountId}. Refreshing providers...`,
  );
  registerExistingAccounts();
});

console.log("[XOAuthTB] Background monitoring active.");

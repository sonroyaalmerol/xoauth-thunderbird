const { ExtensionCommon } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionCommon.sys.mjs",
);
const { NetUtil } = ChromeUtils.importESModule(
  "resource://gre/modules/NetUtil.sys.mjs",
);
const { FetchConfig } = ChromeUtils.importESModule(
  "resource:///modules/accountcreation/FetchConfig.sys.mjs",
);
const { OAuth2Providers } = ChromeUtils.importESModule(
  "resource:///modules/OAuth2Providers.sys.mjs",
);

const Cc = Components.classes,
  Ci = Components.interfaces;

const fetchSync = (url) => {
  console.log(`[XOAuthTB] fetchSync starting: ${url}`);
  try {
    let uri = Services.io.newURI(url);
    let channel = NetUtil.newChannel({
      uri: uri,
      loadUsingSystemPrincipal: true,
    });

    if (channel instanceof Ci.nsIHttpChannel) {
      channel.QueryInterface(Ci.nsIHttpChannelInternal);
      channel.loadFlags |= Ci.nsIRequest.LOAD_BYPASS_CACHE;
    }

    let inputStream = channel.open();

    if (inputStream) {
      let data = NetUtil.readInputStreamToString(
        inputStream,
        inputStream.available(),
        {
          charset: "UTF-8",
        },
      );
      console.log(`[XOAuthTB] fetchSync success. Length: ${data.length}`);
      return data;
    }
  } catch (e) {
    console.warn(`[XOAuthTB] fetchSync failed for ${url}: ${e.message}`);
  }
  return null;
};

const fetchAndRegister = (domain) => {
  if (!domain) return true;
  const urls = [
    `https://autoconfig.${domain}/mail/config-v1.1.xml?emailaddress=user@${domain}`,
    `https://${domain}/.well-known/autoconfig/mail/config-v1.1.xml`,
    `https://autoconfig.thunderbird.net/v1.1/${domain}`,
  ];

  for (const url of urls) {
    try {
      console.log(`[XOAuthTB] Fetch: ${url}`);
      let xmlText = fetchSync(url);
      if (parseAndRegister(xmlText, url)) {
        console.log(`[XOAuthTB] Registered ${domain} successfully.`);
        return true;
      }
    } catch (e) {
      console.error(`[XOAuthTB] Fetch Error for ${url}:`, e);
    }
  }

  return false;
};

const parseAndRegister = (xmlText, url) => {
  if (!xmlText || !xmlText.includes("<oAuth2>")) {
    console.error(`[XOAuthTB] No <oAuth2> block found in ${url}`);
    return false;
  }
  try {
    const oauthBlockMatch = xmlText.match(/<oAuth2[^>]*>([\s\S]*?)<\/oAuth2>/i);
    if (!oauthBlockMatch) return false;
    const oauthBlock = oauthBlockMatch[1];

    const getTag = (tag, source = oauthBlock) => {
      const regex = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, "i");
      const match = source.match(regex);
      return match ? match[1].trim() : "";
    };

    const hostnameMatches = xmlText.matchAll(
      /<hostname[^>]*>([^<]+)<\/hostname>/gi,
    );
    const hostnames = [
      ...new Set(Array.from(hostnameMatches, (m) => m[1].trim())),
    ];

    const issuer = getTag("issuer");
    const authURL = getTag("authURL") || getTag("authUrl");
    const tokenURL = getTag("tokenURL") || getTag("tokenUrl");

    if (!issuer || !authURL || !tokenURL) {
      console.warn("[XOAuthTB] Missing critical OAuth fields in XML.");
      return false;
    }

    console.log(
      `[XOAuthTB] Registering: ${issuer} for ${hostnames.join(", ")}`,
    );

    let isRegistered = !!OAuth2Providers.getIssuerDetails(issuer);
    if (isRegistered) {
      console.log(
        `[XOAuthTB] Existing registration found: ${issuer}. Unregistering existing one.`,
      );
      OAuth2Providers.unregisterProvider(issuer);
    }

    const providerConfig = {
      issuer,
      clientId: getTag("clientId"),
      clientSecret: getTag("clientSecret") || null,
      authURL,
      tokenURL,
      redirectUri: getTag("redirectUri") || "https://localhost",
      usePKCE: (getTag("usePKCE") || "true").toLowerCase() === "true",
      hostnames,
      scope: getTag("scope"),
    };

    console.log(
      "[XOAuthTB] Registering OAuth2 Provider with config:",
      providerConfig,
    );

    OAuth2Providers.registerProvider(
      providerConfig.issuer,
      providerConfig.clientId,
      providerConfig.clientSecret,
      providerConfig.authURL,
      providerConfig.tokenURL,
      providerConfig.redirectUri,
      providerConfig.usePKCE,
      providerConfig.hostnames,
      providerConfig.scope,
    );

    return true;
  } catch (e) {
    console.error(`[XOAuthTB] Parse Error for ${url}:`, e);
    return false;
  }
};

this.oauthprovider = class extends ExtensionCommon.ExtensionAPI {
  onStartup() {
    console.log("[XOAuthTB] Checking FetchConfig.fromISP...");
    if (!FetchConfig._originalFromISP) {
      console.log("[XOAuthTB] Hooking FetchConfig.fromISP...");
      FetchConfig._originalFromISP = FetchConfig.fromISP;
    }

    FetchConfig.fromISP = function (...args) {
      fetchAndRegister(args[0]);

      return FetchConfig._originalFromISP(...args);
    };
  }

  onShutdown(isAppShutdown) {
    if (isAppShutdown) return;

    if (FetchConfig._originalFromISP) {
      console.log("[XOAuthTB] Restoring original FetchConfig.fromISP");
      FetchConfig.fromISP = FetchConfig._originalFromISP;
      delete FetchConfig._originalFromISP;
    }

    console.log("[XOAuthTB] Shutdown complete.");
  }

  getAPI(context) {
    return {
      oauthprovider: {
        async checkIfProviderExists(hostname) {
          return {
            exists: !!fetchAndRegister(hostname),
          };
        },
      },
    };
  }
};

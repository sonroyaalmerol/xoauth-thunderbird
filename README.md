# XOAuth Thunderbird

Thunderbird’s built-in OAuth2 support is usually hardcoded to major providers (Google, Microsoft, etc.). This extension lets you use OAuth2 with any mail server that provides its own configuration via the standard Autoconfig XML format.

### What it does
*   **Automatic Discovery**: Hooks into Thunderbird's account setup process. When you enter your email, the extension checks for an `<oAuth2>` block in the Autoconfig XML (from `autoconfig.yourdomain.com` or the domain's well-known paths).
*   **Dynamic Registration**: If an OAuth2 config is found, the extension registers it on the fly so Thunderbird can actually handle the login prompt.
*   **Background Maintenance**: Monitors your existing accounts. If you have an account that needs an OAuth2 provider that hasn't been registered yet, it will try to fetch and register it in the background.

### Why?
Many private or enterprise mail servers support OAuth2/OIDC, but since they aren't "famous," Thunderbird doesn't know which URLs to use for the login popup. This extension bridges that gap by reading the `<oAuth2>` tags directly from the server's own autoconfig file.

### Installation / Usage
1.  Download the `.xpi` from the Releases page.
2.  In Thunderbird, go to **Add-ons and Themes** -> Gear Icon -> **Install Add-on From File**.
3.  Add your email account as usual. If your server provides the correct XML config, the "OAuth2" authentication method will now work instead of failing.

### Server-Side Configuration

For this extension to pick up your settings, your mail server's `config-v1.1.xml` (hosted at `https://autoconfig.yourdomain.com/mail/config-v1.1.xml`) needs to include an `<oAuth2>` block.

Here is a minimal example of a compatible configuration:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<clientConfig version="1.1">
  <emailProvider id="example.com">
    <domain>example.com</domain>

    <incomingServer type="imap">
      <hostname>imap.example.com</hostname>
      <port>993</port>
      <socketType>SSL</socketType>
      <authentication>OAuth2</authentication>
      <username>%EMAILADDRESS%</username>
    </incomingServer>

    <!-- This block is what the extension looks for -->
    <oAuth2>
      <issuer>https://auth.domain.com/application/o/mail/</issuer>
      <scope>openid email offline_access</scope>
      <authURL>https://auth.domain.com/application/o/authorize/</authURL>
      <tokenURL>https://auth.domain.com/application/o/token/</tokenURL>
      <clientId>your-client-id-here</clientId>
      <!-- Optional: <clientSecret>...</clientSecret> -->
    </oAuth2>
  </emailProvider>
</clientConfig>
```

### Important requirements:
1.  **Authentication Mode**: Ensure your `<incomingServer>` and `<outgoingServer>` blocks specifically set `<authentication>OAuth2</authentication>`.
2.  **HTTPS**: The XML must be served over a valid HTTPS connection for the extension to fetch it.
3.  **Client ID**: If your OAuth2 provider (like Authentik, Keycloak, or Okta) requires a specific Client ID for the "Thunderbird" application, make sure it is defined in the XML. For public/native clients using PKCE, you can often leave the secret blank.

### How it works
This is a [MailExtension Experiment](https://developer.thunderbird.net/add-ons/mailextensions/experiments). It uses `ExtensionCommon.sys.mjs` to hook into internal Thunderbird modules (`FetchConfig` and `OAuth2Providers`). It bypasses the standard API limitations to register custom OAuth2 issuers, client IDs, and scopes dynamically.

---
*Note: This extension requires Thunderbird 140 or newer.*

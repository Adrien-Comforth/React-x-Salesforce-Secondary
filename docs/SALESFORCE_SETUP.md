# Salesforce setup

This guide connects the Product Manager app to a Salesforce org and embeds it in Lightning. It covers every setting on both sides: the org, the app's hosting (Vercel), and the browser.

- **Part A:** deploy the metadata from the CLI.
- **Part B:** clicks in Setup: CORS, the OAuth app (External Client App or Connected App), picklists, access, and pages.
- **Part C:** point the app at the org.
- **Part D:** browser settings.

Then [verify](#verify) the setup. If something fails, see [Troubleshooting](#troubleshooting).

## What embedding needs

The app runs on its own origin (for example `https://product-manager.vercel.app`) and is shown inside Lightning in an iframe. Every request it makes goes from the browser straight to Salesforce. Each item below is needed:

| Requirement | Why | Where | Done by |
|---|---|---|---|
| App origin as a **Trusted URL** (CSP Trusted Site, `frame-src`) | Lightning blocks iframes to origins it doesn't trust | Org | Metadata (Part A) |
| App origin in the **CORS allowed origins** | The browser calls the REST API from the app's origin | Org | Metadata (Part A) |
| **Enable CORS for OAuth endpoints** | The browser calls the token and revoke endpoints | Org | Manual (B1) |
| **External Client App** (or Connected App) with PKCE, no secret | OAuth login for a public browser client | Org | Manual (B2) |
| Permission set: tab + Product2 create/read/edit/delete | User access | Org | Metadata + CLI (Part A) |
| **API Enabled** user permission | REST API access | Org | Already on for admins; manual for others (B4) |
| `Content-Security-Policy: frame-ancestors` header | Lets Lightning frame the app | Vercel | Already in [web/vercel.json](../web/vercel.json) |
| `VITE_SF_*` environment variables | Tells the app which org and OAuth client to use | Vercel | Manual (Part C) |
| Popups allowed | Login runs in a popup | Browser | Manual (Part D) |

## Before you start

- **An org.** A Developer Edition org or a sandbox, and a user with the System Administrator profile.
- **Tools.** Salesforce CLI (`sf`) and Node.js.
- **The app's production URL.** You need the origin only: `https`, no path, no trailing slash. Vercel preview URLs change with every deployment, so use the production URL.

Placeholders used below:

| Placeholder | Example |
|---|---|
| `<app-url>` | `https://product-manager.vercel.app` |
| `<my-domain>` | `https://acme-dev-ed.develop.my.salesforce.com` |

## Part A: Deploy the metadata (CLI)

Run these from the repository root.

1. **Log in to the org.** This opens a browser window, saves the org under the alias `product-dev`, and makes it the default org.

   ```bash
   npm run sf:login
   sf org display --target-org product-dev
   ```

   In the output, **Instance Url** is your `<my-domain>`. Note the API version too.

2. **Point the metadata at the app.** This writes `<app-url>` into the custom label, the Trusted URL, and the CORS origin. Commit the result so later deploys keep the right URL.

   ```bash
   npm run sf:set-url -- <app-url>
   ```

3. **Validate, then deploy.** The deploy step also assigns the `Product_Manager_App` permission set to you.

   ```bash
   cd salesforce && sf project deploy start --dry-run && cd ..
   npm run sf:deploy
   ```

This deploys:

| Component | Name | Purpose |
|---|---|---|
| Lightning Web Component | `productApp` (*Product Manager (React)*) | The iframe host |
| Custom tab | `Product_Manager` | Shows the component full-page |
| Custom label | `Product_App_URL` | The app URL the component loads |
| Trusted URLs (CSP Trusted Sites) | `Product_App_Vercel`, `Product_App_Localhost` | Allow `frame-src` to the app and to the local dev server |
| CORS allowed origins | `Product_App_Vercel`, `Product_App_Localhost` | Allow REST calls from those origins |
| Permission set | `Product_Manager_App` | Tab visibility and Product2 create/read/edit/delete |

The metadata has never been deployed to a real org. If the deploy fails, these are the likely causes:

- **API version 68.0 not supported:** lower `sourceApiVersion` in `salesforce/sfdx-project.json` and `<apiVersion>` in `productApp.js-meta.xml` to the org's version.
- **Tab `motif` rejected:** choose another motif, or remove the tab and create it in Setup.
- **Trusted URL `context` rejected:** change `All` to `LEX`.

## Part B: Setup in the org

### B1. Enable CORS for OAuth endpoints

1. Go to **Setup**, type **CORS** in Quick Find, and open **CORS**.
2. Under **CORS Policy Settings**, click **Edit**, tick **Enable CORS for OAuth endpoints**, and click **Save**.
3. Check that the **Allowed Origins List** has `<app-url>` and `https://localhost:5173`. Part A deployed both.

Without this setting, the app reaches the login popup, but the token exchange fails with a network error.

### B2. Create the OAuth app: External Client App (recommended)

> **External Client App or Connected App?** Since Spring '26, Salesforce blocks creating new Connected Apps by default. **External Client Apps** (ECAs) replace them. The OAuth flow and the Consumer Key work the same way, and the app doesn't care which one you use. If your org still allows Connected Apps, see [B2 (alternative)](#b2-alternative-connected-app).

1. Go to **Setup**, type **External Client App Manager** in Quick Find, and click **New External Client App**.
2. **Basic Information**
   - **External Client App Name:** `Product Manager`. The API name fills in automatically.
   - **Contact Email:** your email address.
   - **Distribution State:** `Local`.
3. **API (Enable OAuth Settings):** tick **Enable OAuth**, then fill in the sections below.
4. **App Settings**
   - **Callback URL:** enter one URL per line. Each must match exactly, including the `/oauth/callback` path.

     ```
     <app-url>/oauth/callback
     https://localhost:5173/oauth/callback
     ```

   - **OAuth Scopes:** add these two.
     - *Manage user data via APIs (api)*
     - *Perform requests at any time (refresh_token, offline_access)*
5. **Flow Enablement:** leave every option unticked. The app uses the standard authorization code flow, which needs no checkbox.
6. **Security**

   | Setting | Value | Why |
   |---|---|---|
   | Require secret for Web Server Flow | **Off** | A browser app can't keep a secret |
   | Require secret for Refresh Token Flow | **Off** | Same reason |
   | Require Proof Key for Code Exchange (PKCE) extension for Supported Authorization Flows | **On** | PKCE protects the flow without a secret |
   | Enable Refresh Token Rotation | **Off** | The app can refresh twice at once; with rotation on, the second refresh fails and logs the user out. See [Known limitations](../README.md#known-limitations). |

7. Click **Create**.
8. Open the **Policies** tab and click **Edit**. Under **OAuth Policies**:
   - **Permitted Users:** *All users can self-authorize*. For tighter control, choose *Admin approved users are pre-authorized*, then add the `Product Manager App` permission set under **App Policies**.
   - **Refresh Token Policy:** *Refresh token is valid until revoked* is fine for testing. In production, use an expiry.
   - Leave the other policies at their defaults, and click **Save**.
9. Open the **Settings** tab, expand **OAuth Settings**, and click **Consumer Key and Secret**. Confirm the verification code that Salesforce emails you, then copy the **Consumer Key**. The app never uses the Consumer Secret, so don't copy it anywhere.
10. Wait. A new or changed app can take up to about 10 minutes to start working. Errors like `invalid_client_id` or `redirect_uri_mismatch` right after creating the app are often only this delay.

### B2 (alternative): Connected App

Use this only if your org still lets you create Connected Apps. If the **New Connected App** button is missing or blocked, use the External Client App above.

1. Go to **Setup**, type **App Manager** in Quick Find, and click **New Connected App**.
2. **Basic Information:** enter **Connected App Name** `Product Manager`, keep the API name, and enter a **Contact Email**.
3. **API (Enable OAuth Settings)**
   - Tick **Enable OAuth Settings**.
   - **Callback URL:** the same two lines as in B2.
   - **Selected OAuth Scopes:** the same two scopes as in B2.
   - Tick **Require Proof Key for Code Exchange (PKCE) Extension for Supported Authorization Flows**.
   - Untick **Require Secret for Web Server Flow** and **Require Secret for Refresh Token Flow**.
   - Leave every other flow unticked (*Client Credentials*, *Authorization Code and Credentials*, *Token Exchange*, *Device*), and leave **Refresh Token Rotation** off if your org shows it.
4. Click **Save**, then **Continue**.
5. Back in **App Manager**, open the menu on the app's row and choose **Manage**. Click **Edit Policies** and set:
   - **Permitted Users:** *All users may self-authorize*
   - **Refresh Token Policy:** *Refresh token is valid until revoked*

   Click **Save**.
6. In **App Manager**, open the menu on the app's row and choose **View**. Click **Manage Consumer Details**, confirm the emailed code, and copy the **Consumer Key**.
7. Allow up to about 10 minutes for the app to start working.

### B3. Product Family picklist values

New Developer Edition orgs often have no Product Family values. Without them, the family filter and the form's family field stay empty.

1. Go to **Setup**, then **Object Manager**, then **Product**, then **Fields & Relationships**, then **Product Family**.
2. Under **Values**, click **New**, add values such as `Hardware`, `Software`, `Services`, and `Accessories` (the demo data uses these), and click **Save**.
3. Optionally, do the same for **Quantity Unit of Measure** (for example `Each`, `Box`, `Hour`, `License`).

### B4. User access

- **Permission set.** `npm run sf:deploy` assigns `Product Manager App` to you. To give it to another user, go to **Setup**, then **Permission Sets**, then **Product Manager App**, then **Manage Assignments**, and click **Add Assignment**. You can also run:

  ```bash
  sf org assign permset --name Product_Manager_App --on-behalf-of <username>
  ```

- **API Enabled.** The System Administrator profile already has this permission. Other users need it, or the app's API calls fail. Go to **Setup**, then **Permission Sets**, then **Product Manager App**, then **System Permissions**. Click **Edit**, tick **API Enabled**, and click **Save**. This permission isn't in the repo's permission set file yet, so check it again after each deploy.
- **Admin-approved apps.** If you chose *Admin approved users are pre-authorized* in B2, also add the permission set to the External Client App's **App Policies**.

### B5. Show the app in Lightning

**As a tab.** The permission set makes the **Product Manager** tab visible. Users can find it in the App Launcher, or open it from the CLI with `npm run sf:open`. To add it to an app's navigation bar:

1. Go to **Setup**, then **App Manager**.
2. Click **Edit** on the app (for example *Sales*), then open **Navigation Items**.
3. Add **Product Manager** and click **Save**.

**On a Product record page.** The component then opens that product's detail view.

1. Open any Product record, click the gear icon, and choose **Edit Page**.
2. In Lightning App Builder, drag **Product Manager (React)** from the **Custom** section onto the page.
3. Set the properties if needed:
   - **App URL:** leave empty to use the `Product_App_URL` label. Set it to `https://localhost:5173` to test your local dev server.
   - **Height (px):** defaults to 720.
4. Click **Save**, then **Activate**. Choose **Org Default** (or an app default) and click **Save**.

**On a Home page or App page.** Use the same component in Lightning App Builder. These pages show the product list.

## Part C: Point the app at the org

1. In Vercel, go to **Project**, then **Settings**, then **Environment Variables**. Add these for Production, and for Preview if you want:

   ```
   VITE_SF_CLIENT_ID=<Consumer Key from B2>
   VITE_SF_LOGIN_URL=<my-domain>
   VITE_SF_API_VERSION=v68.0
   ```

   - **`VITE_SF_LOGIN_URL`:** use the My Domain URL, which ends in `.my.salesforce.com` (the **Instance Url** from `sf org display`). Two look-alike URLs don't work:
     - `login.salesforce.com` doesn't apply your org's CORS settings.
     - The Lightning URL in your browser's address bar (`….lightning.force.com`) redirects the token request to My Domain without CORS headers, so the browser blocks it.
   - **`VITE_SF_API_VERSION`:** match the org's API version.
   - **`VITE_DATA_MODE`:** leave it unset. Setting it to `demo` forces demo mode even when a client ID is set.

2. **Redeploy.** `VITE_*` values are built into the app at build time, so saving the variables alone changes nothing.
3. **Check the frame header.** [web/vercel.json](../web/vercel.json) already sends this header:

   ```
   frame-ancestors 'self' https://*.force.com https://*.salesforce.com https://*.salesforce-setup.com
   ```

   It covers Lightning (`*.lightning.force.com`, sandboxes included), My Domain, and Setup. It does **not** cover Experience Cloud sites (`*.my.site.com`). Embedding there would need that origin added to the header.

**Local development against the org:**

1. Copy [web/.env.example](../web/.env.example) to `web/.env.local` and fill in the same values.
2. Run `npm run dev`.
3. Open `https://localhost:5173` in a normal tab once and accept the self-signed certificate. Until you do, the dev server won't load inside Lightning either.

## Part D: Browser

- **Allow popups** for the Lightning domain (`https://<mydomain>.lightning.force.com`). The login popup is opened from inside the iframe.
- **Expect to log in twice.** Browsers keep an iframe's storage separate from the same site in its own tab. Logging in on the standalone app doesn't log you in inside Lightning, and the reverse is also true.

## Verify

1. **Standalone.** Open `<app-url>` and click **Log in with Salesforce**. Approve access in the popup. The header should show *Connected to &lt;host&gt; as &lt;your name&gt;*.
2. **Create, read, update, delete.** Create a product, edit it, and delete it. Check each change in Salesforce:

   ```bash
   sf data query -q "SELECT Id, Name FROM Product2 ORDER BY CreatedDate DESC LIMIT 5" -o product-dev
   ```

3. **Embedded tab.** Run `npm run sf:open`, log in inside the iframe, and repeat the checks.
4. **Record page.** Open a Product record that has the component. It should open straight to that product's detail view.

The full test plan is in [HANDOFF.md](HANDOFF.md#6-test-plan).

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Iframe is blank or says "refused to connect" | The Trusted URL is missing or inactive (check **Setup**, then **Trusted URLs**), or `frame-ancestors` in `web/vercel.json` doesn't cover the Lightning host. The browser console shows which policy blocked it. |
| The component shows a yellow "set a valid URL" box | The `Product_App_URL` label is invalid. Run `npm run sf:set-url -- <app-url>` and deploy again, or set the component's **App URL** property. |
| Login fails with "Could not reach …" | First look at the URL in the message. If it ends in `lightning.force.com`, `VITE_SF_LOGIN_URL` is the Lightning domain: set it to the My Domain URL (`….my.salesforce.com`) and redeploy (Part C). Otherwise, **Enable CORS for OAuth endpoints** is off (B1), or the origin isn't in the CORS list. The origin must match exactly: scheme and host, no trailing slash. |
| "Network error calling Salesforce" after login | The app's origin isn't in the CORS allowed origins list. |
| The popup shows `redirect_uri_mismatch` | The callback URL doesn't match exactly, or the app is still within its ~10-minute start-up delay. |
| The popup shows `invalid_client_id` | Wrong Consumer Key, the start-up delay, or Vercel wasn't redeployed after the variables were set. |
| Token exchange fails with `invalid_client` | **Require secret for Web Server Flow** is still on. Turn it off. |
| `invalid_grant` | The code was reused or expired, the PKCE values don't match, or the callback URL doesn't match exactly. |
| `OAUTH_APPROVAL_ERROR_GENERIC` or "user not approved" | **Permitted Users** policy. Set self-authorize, or pre-authorize the user through the permission set. |
| `API_DISABLED_FOR_ORG` or "API is not enabled" | The user lacks **API Enabled** (B4). |
| "The login popup was blocked" | Allow popups for the Lightning domain (Part D). |
| The popup finishes, but the embedded app never logs in | The popup lost its link back to the iframe (`window.opener`), which happens when the login page sets `Cross-Origin-Opener-Policy`. Embedded mode has no fallback. See [Known limitations](../README.md#known-limitations). |
| The user is logged out shortly after logging in | The refresh token is missing (check the `refresh_token` scope), or **Refresh Token Rotation** is on (B2). |
| The Product Family dropdown is empty | The org has no picklist values (B3). |
| Embedding works in production but not in a Vercel preview | Preview URLs aren't in the Trusted URLs or CORS lists. Test with the production URL, or add the preview origin to both lists. |

## References

- [External Client Apps and Connected Apps](https://developer.salesforce.com/docs/platform/mobile-sdk/guide/connected-apps.html) (Salesforce Developers)
- [Build Integrations with External Client Apps](https://trailhead.salesforce.com/content/learn/projects/build-integrations-with-external-client-apps/implement-the-oauth-20-web-server-flow) (Trailhead)

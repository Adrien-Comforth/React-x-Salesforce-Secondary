# Handoff: connect the Product Manager app to a Salesforce org

You are picking up a project that is fully built and runs in **demo mode** (no org connected). Your job is to connect it to the user's Salesforce **Developer Edition** org, deploy the Salesforce metadata, switch the Vercel deployment to live Salesforce data, and test everything end to end, including the embedded (iframe in Lightning) mode.

Read [README.md](../README.md) for the architecture overview. This file is the operational plan.

## Context you need

- **Goal of the project:** a React app (Vite + React 19 + TypeScript) for full CRUD on the standard **Product2** object. It runs standalone on **Vercel** and is embedded in Lightning by an LWC that renders it in an iframe.
- **Environment:** Windows 11. Bash (Git Bash) and PowerShell are both available. Node 24, Salesforce CLI `sf` 2.157.x, Java 25 are installed.
- **Repo layout:**
  - `web/`: the React app. Vercel's Root Directory must be `web`.
  - `salesforce/`: SFDX project (`sourceApiVersion` 68.0).
  - Root `package.json`: helper scripts (`sf:login`, `sf:set-url`, `sf:deploy`, `sf:open`, `dev`, `build`, `test:lwc`).
- **State at handoff (2026-11-09):** nothing was committed or deployed by the previous agent. The user said they'd deploy to Vercel themselves. **Check first**: `git log`, `git status`, and ask the user for the Vercel production URL. Don't assume it.
- **No org was authorized yet.** The CLI alias to use is `product-dev`.

## Rules for you

- Ask the user before anything outward-facing: `git push`, Vercel deploys, `sf project deploy start` to their org. Changing Setup in the org is also the user's call. Several steps are manual Setup clicks the user must do; give them exact instructions.
- The ECA **Consumer Key is public** (PKCE, no secret), so it's fine in Vercel env vars. **No client secret is used anywhere.** Don't add one.
- Never commit `.env.local`. It's already gitignored.
- `VITE_*` variables are baked in at **build** time. Changing them in Vercel needs a **redeploy**.

## Code map (where to look when debugging)

| Concern | File |
|---|---|
| Env/config, demo vs salesforce mode, embedded detection | [web/src/config.ts](../web/src/config.ts) |
| OAuth PKCE popup flow, token exchange, refresh, logout | [web/src/auth/oauth.ts](../web/src/auth/oauth.ts) |
| Session storage (sessionStorage + in-memory) | [web/src/auth/session.ts](../web/src/auth/session.ts) |
| REST wrapper (401 → refresh → retry), SOQL escaping | [web/src/data/salesforceApi.ts](../web/src/data/salesforceApi.ts) |
| Product2 CRUD + describe picklists | [web/src/data/salesforceProductService.ts](../web/src/data/salesforceProductService.ts) |
| Demo (localStorage) implementation | [web/src/data/demoProductService.ts](../web/src/data/demoProductService.ts) |
| Pages | [web/src/pages/](../web/src/pages/) |
| Vercel rewrites + `frame-ancestors` header | [web/vercel.json](../web/vercel.json) |
| LWC iframe host | [salesforce/force-app/main/default/lwc/productApp/](../salesforce/force-app/main/default/lwc/productApp/) |
| URL rewrite script | [salesforce/scripts/set-app-url.mjs](../salesforce/scripts/set-app-url.mjs) |

Salesforce metadata in `salesforce/force-app/main/default/`:

- `lwc/productApp`: targets AppPage, HomePage, RecordPage (Product2) and Tab. It reads its URL from the custom label or the `appUrl` property, appends `?embedded=1`, and adds `#/products/<recordId>` on record pages.
- `labels/CustomLabels.labels-meta.xml`: `Product_App_URL` (placeholder `https://your-app.vercel.app`).
- `tabs/Product_Manager.tab-meta.xml`: LWC tab.
- `permissionsets/Product_Manager_App.permissionset-meta.xml`: tab visibility plus Product2 CRUD.
- `cspTrustedSites/Product_App_{Vercel,Localhost}`: frame-src only.
- `corsWhitelistOrigins/Product_App_{Vercel,Localhost}`: REST API CORS.

## Plan

### 1. Confirm the starting point

```bash
git status && git log --oneline -5
npm run build            # must pass
npm run test:lwc         # 3 tests must pass
```

Ask the user for:
- the Vercel production URL
- whether demo mode works there
- the org's My Domain URL

### 2. Authorize the org (user completes the browser login)

```bash
npm run sf:login         # sf org login web --alias product-dev --set-default
sf org display --target-org product-dev
```

From `sf org display`, note the **Instance Url**: that's the My Domain URL, used as `VITE_SF_LOGIN_URL`.

### 3. Point metadata at Vercel, then deploy

```bash
npm run sf:set-url -- https://<vercel-app>.vercel.app
cd salesforce && sf project deploy start --dry-run   # validate first
cd .. && npm run sf:deploy                            # deploy + assign permset
```

**This metadata has never been deployed.** It was only checked with `sf project convert source`. Likely fixes if the deploy fails:
- **`apiVersion 68.0` not supported:** lower `sourceApiVersion` in `salesforce/sfdx-project.json` and `<apiVersion>` in `productApp.js-meta.xml` to the org's version (`sf org display` shows it).
- **Tab `motif` rejected:** use another valid motif, or drop the tab and create it in Setup.
- **CspTrustedSite `context` rejected:** use `LEX`.

### 4. Manual Setup steps (give these to the user)

1. **Setup → CORS:** tick **Enable CORS for OAuth endpoints**. Without it, the token exchange fails with a network/CORS error.
2. **Setup → CORS list:** confirm the Vercel and `https://localhost:5173` origins appear. They were deployed as metadata.
3. **Setup → External Client App Manager → New External Client App**, with these settings:
   - **OAuth:** Enable OAuth.
   - **Callback URLs:**
     - `https://<vercel-app>.vercel.app/oauth/callback`
     - `https://localhost:5173/oauth/callback`
   - **Scopes:** `api`, `refresh_token, offline_access`.
   - **Flow enablement:**
     - **Require PKCE:** on.
     - **Require secret for Web Server Flow:** off.
     - **Require secret for Refresh Token Flow:** off.
   - **Policies:**
     - **Permitted users:** All users may self-authorize.
     - **Refresh token:** valid until revoked (fine for testing).
   - **After saving:** copy the **Consumer Key**.

   **Changes can take up to ~10 minutes to propagate.** Errors like `invalid_client_id` or `redirect_uri_mismatch` right after creation may just be that.
4. **Product Family picklist:** in Setup → Object Manager → Product → Fields → Product Family, add a few values (e.g. Hardware, Software, Services). New Developer Edition orgs often have none, so the family filter and select would be empty.

### 5. Switch Vercel to live data

In Vercel → Project → Settings → Environment Variables (Production, and Preview if desired), set:

```
VITE_SF_CLIENT_ID=<consumer key>
VITE_SF_LOGIN_URL=https://<mydomain>.my.salesforce.com
VITE_SF_API_VERSION=v68.0     # match the org
```

Leave `VITE_DATA_MODE` unset. Redeploy, either from the Vercel dashboard or with `npx vercel --prod` from `web/` after asking the user.

For local testing against the org, create `web/.env.local` with the same keys, then run `npm run dev`. The dev server is `https://localhost:5173` with a self-signed cert, which must be accepted once in the browser, including before it can load inside the Lightning iframe.

### 6. Test plan

**A. Standalone (Vercel URL in a normal tab)**
1. The login screen appears, and "Log in with Salesforce" opens a popup.
2. After approval, the popup closes. The header shows "Connected to <host> as <name>".
3. **Read:** existing Products are listed. Search, family/status filters, sorting and paging all work.
4. **Create:** the new product appears in the app, and also in Salesforce (`sf data query -q "SELECT Id, Name FROM Product2 ORDER BY CreatedDate DESC LIMIT 5" -o product-dev`).
5. **Update:** change several fields, including clearing one (blank must become null), and verify in Salesforce.
6. **Delete:** the product goes to the Recycle Bin. Deleting a product used in a Pricebook entry or opportunity line should show Salesforce's error message inline.
7. **Reload:** after a reload, the session persists (sessionStorage).
8. **Log out:** the login screen returns.

**B. Embedded**
1. `npm run sf:open` opens the **Product Manager** tab. Repeat the login and CRUD checks inside the iframe.
2. In App Builder, add *Product Manager (React)* to a Product2 record page. It should open straight to that product's detail view.

**C. Local dev in Lightning**
In App Builder, set the component's **App URL** property to `https://localhost:5173` and confirm it loads.

## Known risks and how to handle them

| Symptom | Likely cause / fix |
|---|---|
| "Could not reach …" / "Network error … CORS" | Origin missing from the CORS list, or **Enable CORS for OAuth endpoints** is off. The origin must match exactly: scheme + host, no trailing slash. |
| Iframe blank / "refused to connect" | Vercel CSP Trusted Site missing or inactive, or the `frame-ancestors` in `web/vercel.json` doesn't cover the Lightning host. Check the browser console for which CSP blocked it. |
| Popup completes but the app never logs in | The popup lost `window.opener` (a `Cross-Origin-Opener-Policy` from the login page). Standalone mode falls back to BroadcastChannel. **Embedded mode has no fallback**, because the iframe's storage and channels are partitioned. If this happens, discuss options with the user, e.g. a server-side relay on Vercel (a serverless function keyed by `state`), or the LWC opening the app in a new tab. |
| Popup blocked | The user must allow popups for the Lightning domain. `window.open` is called synchronously in the click handler. |
| `invalid_grant` on token exchange | Code reused or expired, a PKCE mismatch, or the callback URL isn't an exact match. |
| `OAUTH_APPROVAL_ERROR_GENERIC` / user not approved | ECA policy: set Permitted users to self-authorize, or assign the user via a permission set on the ECA. |
| Family dropdown empty | No picklist values in the org (see step 4.4). |
| 401 loop | Refresh token missing: check the `refresh_token` scope on the ECA. |

## Done when

- [ ] The metadata is deployed and the permission set is assigned.
- [ ] The ECA exists, and the Vercel env vars are set and redeployed.
- [ ] Tests A and B pass on the Vercel production URL.
- [ ] Any fixes are committed, after the user approves the commit.
- [ ] README updated if any step differed from what is written here.

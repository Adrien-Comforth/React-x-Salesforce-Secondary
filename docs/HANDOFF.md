# Handoff: connect the Product Manager app to a Salesforce org

You are picking up a project that is fully built and runs in **demo mode** (no org connected). Your job:

1. Connect it to the user's Salesforce **Developer Edition** org.
2. Deploy the Salesforce metadata.
3. Switch the Vercel deployment to live Salesforce data.
4. Test everything end to end, including embedded mode (the iframe inside Lightning).

Read [README.md](../README.md) for the architecture. Use [SALESFORCE_SETUP.md](SALESFORCE_SETUP.md) for every Setup click and for troubleshooting. This file is the operational plan.

## Context you need

- **Project:** a React app (Vite + React 19 + TypeScript) for creating, reading, updating and deleting the standard **Product2** object. It runs on its own on **Vercel** and is embedded in Lightning by an LWC that shows it in an iframe.
- **Environment:** Windows 11, with both Bash (Git Bash) and PowerShell. Versions checked on 2026-11-10:
  - Node 22.19 on `PATH` (`sf` bundles its own Node)
  - Salesforce CLI `sf` 2.157.8
  - Java 21
- **Repo layout:**
  - `web/`: the React app. Vercel's Root Directory must be `web`.
  - `salesforce/`: the SFDX project (`sourceApiVersion` 68.0).
  - Root `package.json`: helper scripts (`sf:login`, `sf:set-url`, `sf:deploy`, `sf:open`, `dev`, `build`, `test:lwc`).
- **State as of 2026-11-10:**
  - All code is in the initial commit (`8ff8498`) on `main`.
  - Nothing has been deployed to an org yet. The metadata still points at the placeholder `https://your-app.vercel.app`.
  - The user said they would deploy to Vercel themselves. Whether they have, and the production URL, are unknown. **Ask; don't assume.**
  - Dependencies aren't installed (`node_modules` is missing), so the build and tests haven't been run since the commit.
  - No org has been authorized. Use the CLI alias `product-dev`.
- **Known code issues:** see [Known limitations](../README.md#known-limitations). Don't fix them unless the user asks. One affects setup: keep **Refresh Token Rotation off** on the OAuth app.

## Rules for you

- **Ask first.** Ask the user before anything that affects systems outside this machine: `git push`, Vercel deploys, `sf project deploy start` to their org. Changing the org's Setup is also the user's call. Several steps are manual Setup clicks the user must do; give them the exact steps from [SALESFORCE_SETUP.md](SALESFORCE_SETUP.md).
- **No client secret.** The OAuth app's Consumer Key is public (PKCE, no secret), so it's fine in Vercel environment variables. **No client secret is used anywhere. Don't add one.**
- **Connected Apps.** Since Spring '26, Salesforce blocks creating new Connected Apps by default. Use an **External Client App**. Only use a Connected App if the user's org still allows it.
- **Never commit `.env.local`.** It's already in `.gitignore`.
- **Redeploy after env changes.** `VITE_*` variables are built in at **build** time, so changing them in Vercel needs a **redeploy**.

## Code map (where to look when debugging)

| Concern | File |
|---|---|
| Environment and config, demo vs Salesforce mode, embedded detection | [web/src/config.ts](../web/src/config.ts) |
| Popup login (OAuth + PKCE), token exchange, refresh, logout | [web/src/auth/oauth.ts](../web/src/auth/oauth.ts) |
| Session storage (sessionStorage + in memory) | [web/src/auth/session.ts](../web/src/auth/session.ts) |
| REST wrapper (refresh and retry on 401), SOQL escaping | [web/src/data/salesforceApi.ts](../web/src/data/salesforceApi.ts) |
| Product2 queries and changes, picklists from describe | [web/src/data/salesforceProductService.ts](../web/src/data/salesforceProductService.ts) |
| Demo (localStorage) version | [web/src/data/demoProductService.ts](../web/src/data/demoProductService.ts) |
| Pages | [web/src/pages/](../web/src/pages/) |
| Vercel rewrites and the `frame-ancestors` header | [web/vercel.json](../web/vercel.json) |
| LWC iframe host | [salesforce/force-app/main/default/lwc/productApp/](../salesforce/force-app/main/default/lwc/productApp/) |
| URL rewrite script | [salesforce/scripts/set-app-url.mjs](../salesforce/scripts/set-app-url.mjs) |

The Salesforce metadata is described in [salesforce/README.md](../salesforce/README.md).

## Plan

### 1. Confirm the starting point

```bash
git status && git log --oneline -5
npm run install:all      # node_modules is missing
npm run build            # must pass
npm run test:lwc         # 3 tests must pass
```

Ask the user for:
- the Vercel production URL
- whether demo mode works there
- the org's My Domain URL

### 2. Authorize the org (the user completes the browser login)

```bash
npm run sf:login         # sf org login web --alias product-dev --set-default
sf org display --target-org product-dev
```

In the `sf org display` output, **Instance Url** is the My Domain URL, which goes in `VITE_SF_LOGIN_URL`. Also note the org's API version.

### 3. Point the metadata at Vercel, then deploy

Follow [SALESFORCE_SETUP.md, Part A](SALESFORCE_SETUP.md#part-a-deploy-the-metadata-cli):

```bash
npm run sf:set-url -- https://<vercel-app>.vercel.app
cd salesforce && sf project deploy start --dry-run   # validate first
cd .. && npm run sf:deploy                            # deploy + assign the permission set
```

**This metadata has never been deployed.** The guide lists the likely fixes if it fails (API version, tab motif, Trusted URL context). Any fix is a code change, so tell the user and get approval before committing it.

### 4. Manual Setup steps (give these to the user)

[SALESFORCE_SETUP.md, Part B](SALESFORCE_SETUP.md#part-b-setup-in-the-org) has the exact clicks:

1. **B1:** turn on **Enable CORS for OAuth endpoints**, and confirm both origins are in the CORS list.
2. **B2:** create the **External Client App**:
   - PKCE on, both "Require secret" options off, rotation off
   - the two callback URLs and the two scopes
   - Permitted Users set to self-authorize
   - copy the **Consumer Key**

   Allow up to ~10 minutes for the app to start working.
3. **B3:** add Product Family picklist values.
4. **B4:** check user access. Non-admin users also need **API Enabled**.
5. **B5:** add the tab to the navigation bar, and the component to the Product record page.

### 5. Switch Vercel to live data

Follow [SALESFORCE_SETUP.md, Part C](SALESFORCE_SETUP.md#part-c-point-the-app-at-the-org). Set `VITE_SF_CLIENT_ID`, `VITE_SF_LOGIN_URL` and `VITE_SF_API_VERSION`, and leave `VITE_DATA_MODE` unset. Then redeploy, either from the Vercel dashboard or with `npx vercel --prod` from `web/` once the user agrees.

For local testing against the org:
1. Create `web/.env.local` with the same keys.
2. Run `npm run dev`.
3. Accept the self-signed certificate at `https://localhost:5173` once, before trying to load it inside Lightning.

### 6. Test plan

**A. Standalone (the Vercel URL in a normal tab)**
1. The login screen appears, and **Log in with Salesforce** opens a popup.
2. After approval, the popup closes. The header shows "Connected to <host> as <name>".
3. **Read:** existing products are listed. Search, the family and status filters, sorting, and paging all work.
4. **Create:** the new product appears in the app and in Salesforce:

   ```bash
   sf data query -q "SELECT Id, Name FROM Product2 ORDER BY CreatedDate DESC LIMIT 5" -o product-dev
   ```

5. **Update:** change several fields, including clearing one (a blank field must become null), and check the result in Salesforce.
6. **Delete:** the product goes to the Recycle Bin. Deleting a product that a Pricebook entry or opportunity line uses should show Salesforce's error message in the dialog.
7. **Reload:** the session survives a page reload (sessionStorage).
8. **Log out:** the login screen returns.

**B. Embedded**
1. `npm run sf:open` opens the **Product Manager** tab. Repeat the login and the create, read, update and delete checks inside the iframe.
2. In App Builder, add *Product Manager (React)* to a Product2 record page. It should open straight to that product's detail view.

**C. Local dev in Lightning**

In App Builder, set the component's **App URL** property to `https://localhost:5173` and confirm it loads.

## When something fails

See [SALESFORCE_SETUP.md, Troubleshooting](SALESFORCE_SETUP.md#troubleshooting). The highest risk is login in embedded mode: if the popup loses `window.opener`, the iframe never receives the code, and embedded mode has no fallback. If that happens, discuss options with the user, for example:
- a server-side relay on Vercel (a serverless function keyed by `state`)
- having the LWC open the app in a new tab

## Done when

- [ ] The metadata is deployed and the permission set is assigned.
- [ ] The External Client App exists, and the Vercel environment variables are set and redeployed.
- [ ] Tests A and B pass on the Vercel production URL.
- [ ] Any fixes are committed, after the user approves the commit.
- [ ] The docs are updated if any step differed from what they say.

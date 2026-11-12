# React x Salesforce: Product Manager

A React app for creating, reading, updating and deleting the standard **Product2** object. It runs on its own on Vercel and is embedded in Lightning through an LWC that shows it in an iframe.

```
web/          Vite + React 19 + TypeScript app, deployed to Vercel
salesforce/   SFDX project: LWC iframe host, tab, permission set, Trusted URLs, CORS origins
docs/         Setup guide and handoff notes
```

## Documentation

| Document | Read it for |
|---|---|
| [docs/SALESFORCE_SETUP.md](docs/SALESFORCE_SETUP.md) | Step-by-step org setup: metadata deploy, CORS, External Client App or Connected App, embedding, troubleshooting |
| [docs/HANDOFF.md](docs/HANDOFF.md) | Handover: current state, work done, open items, demo preparation, test plan |
| [web/README.md](web/README.md) | The React app: scripts, environment variables, code structure |
| [salesforce/README.md](salesforce/README.md) | The Salesforce metadata and the `productApp` LWC |

## How it works

```
Lightning page ──► LWC c-productApp ──► <iframe src="https://<app>.vercel.app/?embedded=1#/products/<id>">
                                                   │
                         OAuth 2.0 + PKCE (popup)  │  REST API (Bearer token, CORS)
                                                   ▼
                                      https://<mydomain>.my.salesforce.com
```

- **Data modes.** With no `VITE_SF_CLIENT_ID` set, the app runs in **demo mode**: Product records live in the browser's localStorage. With the client ID set, it reads and writes Salesforce data.
- **No backend.** The browser calls the Salesforce REST API directly.
- **Auth.** OAuth 2.0 Authorization Code with PKCE, as a public client with no secret.
  - Login runs in a popup, because Salesforce's login page can't load inside an iframe. The popup sends the code back with `postMessage`, and the code verifier never leaves the app window.
  - Tokens are kept in `sessionStorage`. The access token is refreshed automatically on a 401.
- **Embedding.** Both sides must allow the iframe:
  - Vercel sends `Content-Security-Policy: frame-ancestors` allowing `*.force.com`, `*.salesforce.com` and `*.salesforce-setup.com` ([web/vercel.json](web/vercel.json)).
  - Salesforce needs the app URL as a **Trusted URL** (CSP Trusted Site, `frame-src`) and in the **CORS allowed origins**.
- **Deep links.** On a Product record page, the LWC adds `#/products/<recordId>` so the app opens that product.

## Local development

```bash
npm run install:all
npm run dev            # https://localhost:5173 (self-signed cert: accept it once in the browser)
```

To use a real org locally, copy [web/.env.example](web/.env.example) to `web/.env.local` and fill it in.

| Script (repo root) | What it does |
|---|---|
| `npm run install:all` | Installs dependencies in `web/` and `salesforce/` |
| `npm run dev` | Starts the HTTPS dev server for the React app |
| `npm run build` | Type-checks and builds the React app |
| `npm run test:lwc` | Runs the LWC Jest tests |
| `npm run sf:login` | Logs in to the org with the alias `product-dev` and sets it as the default |
| `npm run sf:set-url -- <url>` | Writes the app URL into the Salesforce metadata |
| `npm run sf:deploy` | Deploys the metadata and assigns the permission set |
| `npm run sf:open` | Opens the Product Manager tab in the org |

## Deploy to Vercel

Demo mode works with no Salesforce setup.

1. Push the repo to GitHub and import it in Vercel.
2. Set **Root Directory** to `web`. Vercel detects Vite automatically, and [web/vercel.json](web/vercel.json) handles SPA rewrites and headers.
3. Deploy. Demo mode needs no environment variables.

## Connect the org

The full steps, with every setting, are in **[docs/SALESFORCE_SETUP.md](docs/SALESFORCE_SETUP.md)**. In short:

1. **Deploy the metadata.** Run `npm run sf:login`, then `npm run sf:set-url -- https://<your-app>.vercel.app`, then `npm run sf:deploy`.
2. **Enable CORS for OAuth.** In Setup, open **CORS** and tick **Enable CORS for OAuth endpoints**.
3. **Create the OAuth app.** Create an **External Client App** with:
   - Callback URLs `https://<your-app>.vercel.app/oauth/callback` and `https://localhost:5173/oauth/callback`
   - Scopes `api` and `refresh_token, offline_access`
   - PKCE on, both "Require secret" options off, and refresh token rotation off

   Copy its **Consumer Key**. Since Spring '26, new Connected Apps are blocked by default; the guide also has Connected App steps for orgs that still allow them.
4. **Add Product Family picklist values,** and give non-admin users **API Enabled**.
5. **Configure Vercel.** Set `VITE_SF_CLIENT_ID` (the Consumer Key) and `VITE_SF_LOGIN_URL` (the org's My Domain URL), then **redeploy**. `VITE_*` values are built in at build time.
6. **Test.** `npm run sf:open` opens the **Product Manager** tab. You can also add *Product Manager (React)* to a Product record page in Lightning App Builder.

> Vercel *preview* deployments use different URLs, so they aren't in the Trusted URLs or CORS lists. Test embedding with the production URL, or add the preview origin too.

## Known limitations

A code review found these. None of them block a demo or a Developer Edition test, but they should be fixed before wider use.

| # | Limitation | Effect | Where |
|---|---|---|---|
| 1 | The list page sends two requests at once. When the token has expired, both refresh it. | Harmless by default. If **Refresh Token Rotation** is on, the second refresh fails and the user is logged out, so keep rotation off. | [salesforceProductService.ts](web/src/data/salesforceProductService.ts), [salesforceApi.ts](web/src/data/salesforceApi.ts) |
| 2 | If the token refresh succeeds but the retried request hits a network error, the app treats it as an expired session. | The user is logged out even though they have a valid new token. | [salesforceApi.ts](web/src/data/salesforceApi.ts) |
| 3 | Error responses are assumed to be JSON. | An HTML error page (for example during Salesforce maintenance) shows as "Unexpected token <" instead of a useful message. | [salesforceApi.ts](web/src/data/salesforceApi.ts) |
| 4 | Paging uses SOQL `OFFSET`, which Salesforce caps at 2000. | With more than 2,000 products, pages after 100 fail to load. | [salesforceProductService.ts](web/src/data/salesforceProductService.ts) |
| 5 | The permission set doesn't include **API Enabled**. | Non-admin users can't use the app until it's added in Setup. | [Product_Manager_App.permissionset-meta.xml](salesforce/force-app/main/default/permissionsets/Product_Manager_App.permissionset-meta.xml) |
| 6 | Embedded login has no fallback if the popup loses `window.opener` (a `Cross-Origin-Opener-Policy` on the login page). | Login inside Lightning would hang. The standalone app falls back to `BroadcastChannel`. | [oauth.ts](web/src/auth/oauth.ts) |
| 7 | Closing the login popup by hand isn't detected. | The login screen keeps waiting until the user clicks **Cancel**. | [oauth.ts](web/src/auth/oauth.ts) |
| 8 | `frame-ancestors` doesn't include Experience Cloud (`*.my.site.com`). | The app can't be embedded in an Experience Cloud site. | [web/vercel.json](web/vercel.json) |
| 9 | The web app has no automated tests. Only the LWC has tests (3). | Changes to the React app are checked by hand only. | — |

# React x Salesforce: Product Manager

A React app for full CRUD on the standard **Product2** object. It runs standalone on Vercel and is embedded in Lightning through an LWC iframe host.

```
web/          Vite + React + TypeScript app (deployed to Vercel)
salesforce/   SFDX project: LWC iframe host, tab, permission set, CSP + CORS metadata
```

## How it works

```
Lightning page ──► LWC c-productApp ──► <iframe src="https://<app>.vercel.app/?embedded=1#/products/<id>">
                                                   │
                         OAuth 2.0 + PKCE (popup)  │  REST API (Bearer token, CORS)
                                                   ▼
                                      https://<mydomain>.my.salesforce.com
```

- **Data modes.** With no `VITE_SF_CLIENT_ID` set, the app runs in **demo mode**: Product records live in the browser's localStorage. Set the client ID and it talks to Salesforce.
- **Auth.** Authorization Code + PKCE, a public client with no secret. Login runs in a popup because Salesforce's login page can't load inside an iframe. The popup sends the code back with `postMessage`, and the code verifier never leaves the app window. Tokens are kept in `sessionStorage`, and the access token is refreshed automatically on a 401.
- **Embedding.** Vercel sends `Content-Security-Policy: frame-ancestors` allowing `*.force.com` and `*.salesforce.com` ([web/vercel.json](web/vercel.json)). Salesforce, in turn, needs the app URL as a **CSP Trusted Site** (frame-src) and in the **CORS allowlist**.
- **Deep links.** The LWC sets `#/products/<recordId>` when it is placed on a Product record page.

## Local development

```bash
npm run install:all
npm run dev            # https://localhost:5173 (self-signed cert: accept it once in the browser)
```

To use a real org locally, copy [web/.env.example](web/.env.example) to `web/.env.local` and fill it in.

## Deploy to Vercel (demo mode works with no Salesforce setup)

1. Push the repo to GitHub and import it in Vercel.
2. Set **Root Directory** to `web`. The framework (Vite) is detected automatically, and [web/vercel.json](web/vercel.json) handles SPA rewrites and headers.
3. Deploy. No environment variables are needed for demo mode.

## Connecting the org (checklist)

1. **Log in with the CLI:** `npm run sf:login` (Developer Edition org, alias `product-dev`).
2. **Point the metadata at Vercel:** `npm run sf:set-url -- https://<your-app>.vercel.app`
3. **Deploy and assign access:** `npm run sf:deploy`. This deploys the LWC, tab, label, CSP Trusted Sites and CORS origins, then assigns the `Product_Manager_App` permission set.
4. **Turn on CORS for OAuth:** in Setup → **CORS**, tick **Enable CORS for OAuth endpoints**.
5. **Create the External Client App:** Setup → **External Client App Manager** → New.
   - Enable OAuth. Callback URLs: `https://<your-app>.vercel.app/oauth/callback` and `https://localhost:5173/oauth/callback`
   - Scopes: *Manage user data via APIs (api)*, *Perform requests at any time (refresh_token, offline_access)*
   - Flow enablement: **Require PKCE**. Untick *Require secret for Web Server Flow* and *Require secret for Refresh Token Flow*.
   - Policies: Permitted users = *All users may self-authorize*. Copy the **Consumer Key**.
6. **Configure Vercel:** under Project → Settings → Environment Variables, set:
   - `VITE_SF_CLIENT_ID` = the Consumer Key
   - `VITE_SF_LOGIN_URL` = `https://<mydomain>.my.salesforce.com`

   Then **redeploy**. `VITE_*` values are baked in at build time.
7. **Test:** `npm run sf:open` opens the **Product Manager** tab. You can also drop *Product Manager (React)* onto a Product2 record page in App Builder.

> Vercel *preview* deployments use different URLs, so they aren't in the CSP or CORS allowlists. Test embedding with the production URL, or add the preview origin too.

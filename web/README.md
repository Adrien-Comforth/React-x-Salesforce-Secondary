# web: Product Manager React app

The React app for creating, reading, updating and deleting Salesforce **Product2** records. It is built with Vite, React 19 and TypeScript, and styled with the Salesforce Lightning Design System (SLDS). It has no backend: the browser calls the Salesforce REST API directly.

For the overall architecture and the org setup, see the [root README](../README.md) and [docs/SALESFORCE_SETUP.md](../docs/SALESFORCE_SETUP.md).

## Scripts

Run these from `web/`, or use the root scripts.

| Command | What it does |
|---|---|
| `npm run dev` | Starts the dev server at `https://localhost:5173`. It uses HTTPS with a self-signed certificate on a fixed port, because Lightning only frames HTTPS origins and the origin is registered in Salesforce. |
| `npm run build` | Type-checks (`tsc -b`) and builds to `dist/` |
| `npm run lint` | Runs oxlint |
| `npm run preview` | Serves the built app |

## Configuration

Copy [.env.example](.env.example) to `.env.local` for local development. On Vercel, set the same keys under **Project**, **Settings**, **Environment Variables**.

| Variable | Default | Meaning |
|---|---|---|
| `VITE_SF_CLIENT_ID` | *(empty)* | Consumer Key of the External Client App or Connected App. **Empty means demo mode.** This value is public (PKCE, no secret). |
| `VITE_SF_LOGIN_URL` | `https://login.salesforce.com` | The org's My Domain URL. Set it: CORS for the OAuth endpoints only applies on My Domain. |
| `VITE_SF_API_VERSION` | `v68.0` | REST API version |
| `VITE_DATA_MODE` | *(empty)* | Set to `demo` to force demo mode even when a client ID is set |

`VITE_*` values are built into the app at **build time**. After changing them, restart the dev server or redeploy on Vercel.

### Data modes

- **Demo:** used when `VITE_SF_CLIENT_ID` is empty or `VITE_DATA_MODE=demo`. The app seeds 12 sample products in `localStorage` and adds a 200 ms delay to mimic network calls. The header shows a *Demo data* badge and a **Reset demo data** button.
- **Salesforce:** used when a client ID is set. The app shows a login screen, then works on live Product2 records.

## Code structure

```
src/
  main.tsx                 Entry point. On /oauth/callback it runs the popup side of login instead of the app.
  App.tsx                  Shows the login page or the product pages; adds app_embedded when framed
  config.ts                Environment variables, data mode, embedded detection
  router.ts                Hash routes: #/ (list) and #/products/<id> (detail)
  hooks.ts                 Debounce, picklist loading, formatting helpers
  auth/
    oauth.ts               Popup login (Authorization Code + PKCE), token refresh, logout and revoke
    pkce.ts                Random strings and the S256 code challenge
    session.ts             Session store: in memory and in sessionStorage
  data/
    types.ts               Product types, the ProductService interface, field limits, ID pattern
    productService.ts      Picks the demo or Salesforce implementation
    salesforceApi.ts       REST wrapper: refresh once on 401, error mapping, SOQL escaping
    salesforceProductService.ts   Product2 queries and changes, picklists from describe
    demoProductService.ts  localStorage version of the same interface
  pages/                   LoginPage, ProductListPage, ProductDetailPage
  components/              Header, form and delete modals, modal shell, toasts, SLDS icons, spinner
```

## How it works

- **Login.** Clicking **Log in with Salesforce** works like this:
  1. The app opens a popup straight away, so popup blockers allow it.
  2. It creates a PKCE verifier and a `state` value, and sends the popup to `/services/oauth2/authorize`.
  3. Salesforce redirects the popup to `/oauth/callback` on this app's origin.
  4. The popup posts the code back to the app with `postMessage`. It also uses `BroadcastChannel` as a fallback, which only works when the app isn't framed.
  5. The app checks the origin and `state`, exchanges the code for tokens, and saves the session.
- **Requests.** `sfRequest` adds the bearer token. On a 401 it refreshes the token once and retries. If that fails, it clears the session and the login screen returns.
- **Embedding.** The app counts as embedded when it runs inside an iframe or the URL has `?embedded=1`. Embedded mode removes the page's maximum width and makes the background transparent.
- **Input safety.**
  - Search terms are escaped for SOQL, including the `LIKE` wildcards.
  - Record IDs are checked against the Salesforce ID pattern before they're used in a URL.
  - Sort fields come from a fixed list.

## Deploying

Vercel deploys this folder. Set **Root Directory** to `web`. [vercel.json](vercel.json) rewrites all paths to `index.html` and sends these headers:
- `frame-ancestors`, which allows Salesforce domains to frame the app
- `Referrer-Policy`
- `X-Content-Type-Options`

Known issues are listed in the root README under [Known limitations](../README.md#known-limitations).

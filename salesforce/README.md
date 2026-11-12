# salesforce: Lightning host for the Product Manager app

An SFDX project (source API version 68.0) that embeds the React app ([../web](../web)) in Lightning Experience. It contains no Apex and no custom objects: the app works on the standard **Product2** object through the REST API.

For the full org setup, including the manual Setup steps that metadata can't cover, see [docs/SALESFORCE_SETUP.md](../docs/SALESFORCE_SETUP.md).

## What's in `force-app/main/default`

| Path | Type | Purpose |
|---|---|---|
| `lwc/productApp/` | Lightning Web Component | Shows the app in an iframe. Its label in App Builder is *Product Manager (React)*. |
| `tabs/Product_Manager.tab-meta.xml` | Custom tab | Shows the component full-page |
| `labels/CustomLabels.labels-meta.xml` | Custom label `Product_App_URL` | The app URL the component loads by default |
| `cspTrustedSites/Product_App_{Vercel,Localhost}` | Trusted URLs (CSP Trusted Sites) | Allow `frame-src` to the app and to `https://localhost:5173` |
| `corsWhitelistOrigins/Product_App_{Vercel,Localhost}` | CORS allowed origins | Allow REST API calls from those origins |
| `permissionsets/Product_Manager_App.permissionset-meta.xml` | Permission set | Tab visibility, plus Product2 create, read, edit and delete. It doesn't include **API Enabled** yet. |

The label, the Vercel Trusted URL, and the Vercel CORS origin start with the placeholder `https://your-app.vercel.app`. Replace it before deploying (see below).

## The `productApp` component

The component can be placed on App pages, Home pages, Product2 record pages, and tabs.

| Property | Where it's set | Meaning |
|---|---|---|
| `appUrl` | Lightning App Builder (App, Home and Record pages) | Overrides the `Product_App_URL` label. Use `https://localhost:5173` to test the local dev server. |
| `height` | Lightning App Builder | Iframe height in pixels (default 720) |
| `recordId` | Set automatically on record pages | Opens that product's detail view |

The component builds the iframe URL as `<appUrl or label>?embedded=1`, and adds `#/products/<recordId>` on record pages. If the URL is invalid, it shows a warning box instead of the iframe.

The iframe's `sandbox` attribute allows scripts, same-origin access, forms, popups, and `allow-popups-to-escape-sandbox`. The login popup needs the last two.

## Commands

Run these from the **repository root**:

```bash
npm run sf:login                     # log in to the org as product-dev (sets it as the default)
npm run sf:set-url -- <app-url>      # write the app URL into the label, Trusted URL and CORS origin
npm run sf:deploy                    # deploy, then assign the Product_Manager_App permission set
npm run sf:open                      # open the Product Manager tab
npm run test:lwc                     # run the LWC Jest tests
```

Run these from **this folder** after `npm install`:

```bash
npm run lint                         # ESLint for the LWC code
npm run test:unit                    # same as test:lwc
npm run test:unit:coverage
npm run prettier                     # format the metadata and code
```

### `scripts/set-app-url.mjs`

The script takes an `https` URL and keeps only its origin. It writes that origin into three files:

- `CustomLabels.labels-meta.xml`
- `Product_App_Vercel.cspTrustedSite-meta.xml`
- `Product_App_Vercel.corsWhitelistOrigin-meta.xml`

It also reminds you to add `<origin>/oauth/callback` to the OAuth app. The localhost entries stay as they are.

## Tests

`lwc/productApp/__tests__/productApp.test.js` has 3 Jest tests:
- the default URL from the label
- the record-page deep link with an `appUrl` override and a custom height
- the warning shown for an invalid URL

## Leftovers from the SFDX template

- `scripts/apex/hello.apex` and `scripts/soql/account.soql` are template samples. This project doesn't use them.
- `.husky/pre-commit` runs `lint-staged`. The git repository root is the folder above this one, so `husky` can't install the hook from here, and **the hook doesn't run**.
- `config/project-scratch-def.json` is the default scratch org definition. The project targets a Developer Edition org instead.

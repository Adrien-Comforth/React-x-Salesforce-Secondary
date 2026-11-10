// Points the Salesforce metadata at the deployed React app.
// Usage (from repo root): npm run sf:set-url -- https://my-app.vercel.app
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raw = process.argv[2];
let origin;
try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') throw new Error('must be https');
    origin = url.origin;
} catch {
    console.error('Usage: node scripts/set-app-url.mjs https://<your-app>.vercel.app');
    process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'force-app', 'main', 'default');
const edits = [
    ['labels/CustomLabels.labels-meta.xml', /(<fullName>Product_App_URL<\/fullName>[\s\S]*?<value>)[^<]*(<\/value>)/],
    ['cspTrustedSites/Product_App_Vercel.cspTrustedSite-meta.xml', /(<endpointUrl>)[^<]*(<\/endpointUrl>)/],
    ['corsWhitelistOrigins/Product_App_Vercel.corsWhitelistOrigin-meta.xml', /(<urlPattern>)[^<]*(<\/urlPattern>)/]
];

for (const [file, pattern] of edits) {
    const path = join(root, file);
    const content = readFileSync(path, 'utf8');
    if (!pattern.test(content)) throw new Error(`Pattern not found in ${file}`);
    writeFileSync(path, content.replace(pattern, `$1${origin}$2`));
    console.log(`Updated ${file} -> ${origin}`);
}
console.log(`\nAlso add ${origin}/oauth/callback as a callback URL on the External Client App.`);

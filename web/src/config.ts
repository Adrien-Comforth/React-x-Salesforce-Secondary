const env = import.meta.env

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

export const config = {
  /** My Domain login URL of the org, e.g. https://acme-dev-ed.develop.my.salesforce.com */
  loginUrl: trimSlash(env.VITE_SF_LOGIN_URL || 'https://login.salesforce.com'),
  /** Consumer key of the External Client App. Empty => demo mode. */
  clientId: (env.VITE_SF_CLIENT_ID ?? '').trim(),
  apiVersion: env.VITE_SF_API_VERSION || 'v68.0',
  redirectUri: `${window.location.origin}/oauth/callback`,
} as const

export type DataMode = 'salesforce' | 'demo'

/**
 * "demo" stores Product records in this browser's localStorage so the app is fully
 * usable before an org is connected. It is used when no client id is configured or
 * when VITE_DATA_MODE=demo is set explicitly.
 */
export const dataMode: DataMode =
  env.VITE_DATA_MODE === 'demo' || !config.clientId ? 'demo' : 'salesforce'

/** True when running inside an iframe (e.g. the Lightning page) or when ?embedded=1 is set. */
export const isEmbedded: boolean = (() => {
  try {
    if (window.self !== window.top) return true
  } catch {
    return true // cross-origin access to window.top throws => we are framed
  }
  return new URLSearchParams(window.location.search).has('embedded')
})()

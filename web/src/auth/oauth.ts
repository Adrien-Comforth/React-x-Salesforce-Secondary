import { config } from '../config'
import { codeChallengeS256, randomString } from './pkce'
import { setSession, type Session } from './session'

/**
 * OAuth 2.0 Authorization Code + PKCE, run in a popup.
 *
 * Why a popup: Salesforce's login page refuses to render inside an iframe, and when this
 * app is embedded in Lightning it *is* in an iframe. The popup lands on /oauth/callback
 * (same origin as the app) and hands the authorization code back to the opener via
 * postMessage. The code verifier never leaves the opener's memory.
 *
 * BroadcastChannel is a fallback for when the opener reference is lost (e.g. the
 * identity provider sets Cross-Origin-Opener-Policy). It only works when the app is
 * not framed, because framed storage/channels are partitioned per top-level site.
 */

const CHANNEL_NAME = 'sf-oauth'
const MESSAGE_TYPE = 'sf-oauth-callback'

interface CallbackMessage {
  type: typeof MESSAGE_TYPE
  state: string | null
  code: string | null
  error: string | null
  errorDescription: string | null
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  instance_url: string
  id: string
  error?: string
  error_description?: string
}

function isCallbackMessage(data: unknown): data is CallbackMessage {
  return typeof data === 'object' && data !== null && (data as CallbackMessage).type === MESSAGE_TYPE
}

async function postToken(params: Record<string, string>): Promise<TokenResponse> {
  let res: Response
  try {
    res = await fetch(`${config.loginUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    })
  } catch {
    throw new Error(
      `Could not reach ${config.loginUrl}. Check that this origin (${window.location.origin}) is in the org's CORS allowlist and that "Enable CORS for OAuth endpoints" is on.`,
    )
  }
  const json = (await res.json().catch(() => ({}))) as TokenResponse
  if (!res.ok) throw new Error(json.error_description || json.error || `Token request failed (${res.status})`)
  return json
}

function toSession(token: TokenResponse, previous?: Session): Session {
  // id looks like https://login.salesforce.com/id/<orgId>/<userId>
  const [orgId = '', userId = ''] = new URL(token.id).pathname.split('/').slice(-2)
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? previous?.refreshToken,
    instanceUrl: token.instance_url,
    orgId,
    userId,
    userName: previous?.userName,
  }
}

export async function login(signal?: AbortSignal): Promise<Session> {
  // Open synchronously within the click handler so popup blockers allow it.
  const popup = window.open('about:blank', 'sf-login', 'width=520,height=720')
  if (!popup) throw new Error('The login popup was blocked. Allow popups for this site and try again.')

  const verifier = randomString(64)
  const state = randomString(24)
  const challenge = await codeChallengeS256(verifier)

  const authorizeUrl = new URL(`${config.loginUrl}/services/oauth2/authorize`)
  authorizeUrl.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: 'api refresh_token',
    state,
  }).toString()
  popup.location.href = authorizeUrl.toString()

  const message = await new Promise<CallbackMessage>((resolve, reject) => {
    let channel: BroadcastChannel | null = null
    const cleanup = () => {
      window.removeEventListener('message', onWindowMessage)
      channel?.close()
      signal?.removeEventListener('abort', onAbort)
    }
    const accept = (data: unknown) => {
      if (!isCallbackMessage(data) || data.state !== state) return
      cleanup()
      resolve(data)
    }
    const onWindowMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin) accept(event.data)
    }
    const onAbort = () => {
      cleanup()
      try {
        popup.close()
      } catch {
        /* ignore */
      }
      reject(new DOMException('Login cancelled', 'AbortError'))
    }

    window.addEventListener('message', onWindowMessage)
    try {
      channel = new BroadcastChannel(CHANNEL_NAME)
      channel.onmessage = (event) => accept(event.data)
    } catch {
      channel = null
    }
    signal?.addEventListener('abort', onAbort)
  })

  if (message.error) throw new Error(message.errorDescription || message.error)
  if (!message.code) throw new Error('No authorization code was returned.')

  const token = await postToken({
    grant_type: 'authorization_code',
    code: message.code,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    code_verifier: verifier,
  })
  const session = toSession(token)
  setSession(session)
  return session
}

export async function refreshSession(session: Session): Promise<Session> {
  if (!session.refreshToken) throw new Error('No refresh token')
  const token = await postToken({
    grant_type: 'refresh_token',
    refresh_token: session.refreshToken,
    client_id: config.clientId,
  })
  const next = toSession(token, session)
  setSession(next)
  return next
}

export async function logout(session: Session | null): Promise<void> {
  setSession(null)
  if (!session) return
  // Best effort: revoke the refresh token (also invalidates its access tokens).
  try {
    await fetch(`${config.loginUrl}/services/oauth2/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: session.refreshToken ?? session.accessToken }),
    })
  } catch {
    /* ignore */
  }
}

/** Runs on /oauth/callback inside the popup. */
export function completeLoginInPopup(): void {
  const params = new URLSearchParams(window.location.search)
  const message: CallbackMessage = {
    type: MESSAGE_TYPE,
    state: params.get('state'),
    code: params.get('code'),
    error: params.get('error'),
    errorDescription: params.get('error_description'),
  }
  try {
    window.opener?.postMessage(message, window.location.origin)
  } catch {
    /* opener gone */
  }
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channel.postMessage(message)
    channel.close()
  } catch {
    /* unsupported */
  }
  setTimeout(() => window.close(), 300)
}

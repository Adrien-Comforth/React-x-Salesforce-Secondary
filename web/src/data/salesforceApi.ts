import { refreshSession } from '../auth/oauth'
import { getSession, setSession, type Session } from '../auth/session'
import { config } from '../config'

export class SalesforceError extends Error {
  readonly status: number
  readonly errorCode?: string
  readonly fields: string[]

  constructor(message: string, status: number, errorCode?: string, fields: string[] = []) {
    super(message)
    this.name = 'SalesforceError'
    this.status = status
    this.errorCode = errorCode
    this.fields = fields
  }
}

export class AuthRequiredError extends Error {
  constructor(message = 'Please log in to Salesforce.') {
    super(message)
    this.name = 'AuthRequiredError'
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
}

interface ApiErrorBody {
  message?: string
  errorCode?: string
  fields?: string[]
}

async function send(session: Session, path: string, options: RequestOptions): Promise<Response> {
  try {
    return await fetch(`${session.instanceUrl}/services/data/${config.apiVersion}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new SalesforceError(
      `Network error calling Salesforce. Check that ${window.location.origin} is in the org's CORS allowlist.`,
      0,
    )
  }
}

/** Calls the Salesforce REST API, refreshing the access token once on 401. */
export async function sfRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let session = getSession()
  if (!session) throw new AuthRequiredError()

  let res = await send(session, path, options)
  if (res.status === 401 && session.refreshToken) {
    try {
      session = await refreshSession(session)
      res = await send(session, path, options)
    } catch {
      /* fall through to re-login */
    }
  }
  if (res.status === 401) {
    setSession(null)
    throw new AuthRequiredError('Your Salesforce session expired. Please log in again.')
  }
  if (res.status === 204) return undefined as T

  const text = await res.text()
  const data: unknown = text ? JSON.parse(text) : undefined
  if (!res.ok) {
    const first = (Array.isArray(data) ? data[0] : data) as ApiErrorBody | undefined
    throw new SalesforceError(
      first?.message ?? `Salesforce request failed (${res.status})`,
      res.status,
      first?.errorCode,
      first?.fields,
    )
  }
  return data as T
}

/** Escapes a value for use inside a single-quoted SOQL string literal. */
export function soqlString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/** Same as soqlString, but also escapes LIKE wildcards so user input matches literally. */
export function soqlLikeContains(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
  return `'%${escaped}%'`
}

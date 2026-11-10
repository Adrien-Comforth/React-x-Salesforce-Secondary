import { useSyncExternalStore } from 'react'

export interface Session {
  accessToken: string
  refreshToken?: string
  instanceUrl: string
  userId: string
  orgId: string
  /** Display name, resolved after login. */
  userName?: string
}

const STORAGE_KEY = 'sf-session'
const listeners = new Set<() => void>()

function read(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

let current: Session | null = read()

export function getSession(): Session | null {
  return current
}

/**
 * Tokens live in memory and in sessionStorage (scoped to this tab, and to the
 * Lightning iframe partition when embedded) so a page reload doesn't force a new login.
 */
export function setSession(session: Session | null): void {
  current = session
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage may be unavailable (privacy mode); in-memory session still works.
  }
  listeners.forEach((fn) => fn())
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSession)
}

import { useEffect } from 'react'
import { logout } from '../auth/oauth'
import { getSession, setSession, useSession } from '../auth/session'
import { dataMode } from '../config'
import { resetDemoData } from '../data/demoProductService'
import { sfRequest } from '../data/salesforceApi'

/** Thin bar showing the data source and the signed-in user, with logout / demo reset. */
export function AppHeader() {
  const session = useSession()

  // Resolve the user's display name once per session.
  useEffect(() => {
    if (!session || session.userName || !/^[a-zA-Z0-9]{15,18}$/.test(session.userId)) return
    sfRequest<{ Name: string }>(`/sobjects/User/${session.userId}?fields=Name`)
      .then((user) => {
        const latest = getSession()
        if (latest) setSession({ ...latest, userName: user.Name })
      })
      .catch(() => {})
  }, [session])

  return (
    <div className="app-bar slds-grid slds-grid_align-spread slds-grid_vertical-align-center">
      {dataMode === 'demo' ? (
        <>
          <span className="slds-badge slds-theme_warning">Demo data · stored in this browser</span>
          <button
            type="button"
            className="slds-button"
            onClick={() => {
              resetDemoData()
              window.location.hash = '/'
              window.location.reload()
            }}
          >
            Reset demo data
          </button>
        </>
      ) : (
        <>
          <span className="slds-text-body_small slds-text-color_weak slds-truncate">
            Connected to {session ? new URL(session.instanceUrl).host : 'Salesforce'}
            {session?.userName ? ` as ${session.userName}` : ''}
          </span>
          <button type="button" className="slds-button" onClick={() => logout(getSession())}>
            Log out
          </button>
        </>
      )}
    </div>
  )
}

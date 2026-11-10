import { useRef, useState } from 'react'
import { login } from '../auth/oauth'
import { Icon } from '../components/Icon'
import { config } from '../config'
import { errorMessage } from '../hooks'

export function LoginPage() {
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const onLogin = async () => {
    const controller = new AbortController()
    abortRef.current = controller
    setWaiting(true)
    setError(null)
    try {
      await login(controller.signal) // session update re-renders App into the product pages
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(errorMessage(e))
      setWaiting(false)
    }
  }

  return (
    <div className="login-wrapper">
      <article className="slds-card login-card">
        <div className="slds-card__body slds-card__body_inner slds-p-vertical_large slds-text-align_center">
          <span className="slds-icon_container slds-icon-standard-product slds-m-bottom_small">
            <Icon category="standard" name="product" className="slds-icon slds-icon_large" />
          </span>
          <h1 className="slds-text-heading_medium slds-m-bottom_x-small">Product Manager</h1>
          <p className="slds-text-color_weak slds-m-bottom_large">
            Connect to Salesforce to view and manage Product records.
          </p>

          {error && (
            <div className="slds-notify slds-notify_alert slds-alert_error slds-m-bottom_medium" role="alert">
              <h2>{error}</h2>
            </div>
          )}

          {waiting ? (
            <>
              <p className="slds-m-bottom_small">Complete the login in the popup window…</p>
              <button type="button" className="slds-button slds-button_neutral" onClick={() => abortRef.current?.abort()}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="slds-button slds-button_brand" onClick={onLogin}>
              Log in with Salesforce
            </button>
          )}

          <p className="slds-text-body_small slds-text-color_weak slds-m-top_large">{config.loginUrl}</p>
        </div>
      </article>
    </div>
  )
}

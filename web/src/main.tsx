import '@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { completeLoginInPopup } from './auth/oauth'
import './index.css'

const root = createRoot(document.getElementById('root')!)

if (window.location.pathname === '/oauth/callback') {
  // We are the OAuth popup: hand the result to the opener and close.
  completeLoginInPopup()
  root.render(
    <p className="slds-p-around_large slds-text-align_center">Login complete. You can close this window.</p>,
  )
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

type Variant = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: number
  variant: Variant
  title: string
  message?: string
}

type ShowToast = (variant: Variant, title: string, message?: string) => void

const ToastContext = createContext<ShowToast>(() => {})

export function useToast(): ShowToast {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), [])

  const show = useCallback<ShowToast>(
    (variant, title, message) => {
      const id = nextId.current++
      setToasts((all) => [...all.slice(-2), { id, variant, title, message }])
      setTimeout(() => dismiss(id), variant === 'error' ? 8000 : 4000)
    },
    [dismiss],
  )

  const value = useMemo(() => show, [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="slds-notify_container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`slds-notify slds-notify_toast slds-theme_${t.variant}`} role="status">
            <span className="slds-assistive-text">{t.variant}</span>
            <span className={`slds-icon_container slds-icon-utility-${t.variant} slds-m-right_small slds-no-flex slds-align-top`}>
              <Icon category="utility" name={t.variant} className="slds-icon slds-icon_small" />
            </span>
            <div className="slds-notify__content">
              <h2 className="slds-text-heading_small">{t.title}</h2>
              {t.message && <p>{t.message}</p>}
            </div>
            <div className="slds-notify__close">
              <button
                type="button"
                className="slds-button slds-button_icon slds-button_icon-inverse"
                title="Close"
                onClick={() => dismiss(t.id)}
              >
                <Icon category="utility" name="close" className="slds-button__icon slds-button__icon_large" />
                <span className="slds-assistive-text">Close</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

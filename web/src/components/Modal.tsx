import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'

interface ModalProps {
  title: string
  onClose: () => void
  footer: ReactNode
  children: ReactNode
  size?: 'small' | 'medium'
  /** Disables close (Esc / X) while a request is in flight. */
  busy?: boolean
}

export function Modal({ title, onClose, footer, children, size = 'small', busy = false }: ModalProps) {
  const headingId = useId()
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const firstField = sectionRef.current?.querySelector<HTMLElement>(
      '.slds-modal__content input, .slds-modal__content select, .slds-modal__content textarea',
    )
    ;(firstField ?? sectionRef.current)?.focus()
    return () => previouslyFocused?.focus?.()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  return (
    <>
      <section
        ref={sectionRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={headingId}
        className={`slds-modal slds-fade-in-open ${size === 'medium' ? 'slds-modal_medium' : 'slds-modal_small'}`}
      >
        <div className="slds-modal__container">
          <button
            type="button"
            className="slds-button slds-button_icon slds-modal__close"
            onClick={onClose}
            disabled={busy}
          >
            <Icon category="utility" name="close" className="slds-button__icon slds-button__icon_large" />
            <span className="slds-assistive-text">Cancel and close</span>
          </button>
          <div className="slds-modal__header">
            <h1 id={headingId} className="slds-modal__title slds-hyphenate">
              {title}
            </h1>
          </div>
          <div className="slds-modal__content slds-p-around_medium">{children}</div>
          <div className="slds-modal__footer">{footer}</div>
        </div>
      </section>
      <div className="slds-backdrop slds-backdrop_open" role="presentation" />
    </>
  )
}

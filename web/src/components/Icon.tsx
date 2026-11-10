import standardSprite from '@salesforce-ux/design-system/assets/icons/standard-sprite/svg/symbols.svg?url'
import utilitySprite from '@salesforce-ux/design-system/assets/icons/utility-sprite/svg/symbols.svg?url'

interface IconProps {
  category: 'utility' | 'standard'
  name: string
  className?: string
}

/** Renders an SLDS sprite icon. Always decorative; pair with assistive text where needed. */
export function Icon({ category, name, className }: IconProps) {
  const sprite = category === 'utility' ? utilitySprite : standardSprite
  return (
    <svg className={className} aria-hidden="true" focusable="false">
      <use href={`${sprite}#${name}`} />
    </svg>
  )
}

interface ButtonIconProps {
  icon: string
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: 'border-filled' | 'bare'
}

export function ButtonIcon({ icon, label, onClick, disabled, variant = 'border-filled' }: ButtonIconProps) {
  const variantClass = variant === 'border-filled' ? 'slds-button_icon-border-filled' : ''
  return (
    <button
      type="button"
      className={`slds-button slds-button_icon ${variantClass}`}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon category="utility" name={icon} className="slds-button__icon" />
      <span className="slds-assistive-text">{label}</span>
    </button>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="slds-spinner_container">
      <div role="status" className="slds-spinner slds-spinner_medium slds-spinner_brand">
        <span className="slds-assistive-text">{label}</span>
        <div className="slds-spinner__dot-a" />
        <div className="slds-spinner__dot-b" />
      </div>
    </div>
  )
}

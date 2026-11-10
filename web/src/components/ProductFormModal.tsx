import { useState, type FormEvent } from 'react'
import { productService } from '../data/productService'
import { SalesforceError } from '../data/salesforceApi'
import { FIELD_LIMITS, type PicklistOption, type Product, type ProductInput } from '../data/types'
import { errorMessage, usePicklists } from '../hooks'
import { Modal } from './Modal'
import { useToast } from './Toasts'

interface Props {
  /** Omit to create a new product. */
  product?: Product
  onClose: () => void
  onSaved: (id: string) => void
}

type TextField = 'Name' | 'ProductCode' | 'StockKeepingUnit' | 'Description'
type Errors = Partial<Record<keyof ProductInput, string>>

const FORM_ID = 'product-form'

function initialValues(product?: Product): ProductInput {
  return {
    Name: product?.Name ?? '',
    ProductCode: product?.ProductCode ?? '',
    Description: product?.Description ?? '',
    Family: product?.Family ?? '',
    IsActive: product?.IsActive ?? true,
    QuantityUnitOfMeasure: product?.QuantityUnitOfMeasure ?? '',
    StockKeepingUnit: product?.StockKeepingUnit ?? '',
  }
}

function validate(values: ProductInput): Errors {
  const errors: Errors = {}
  if (!values.Name.trim()) errors.Name = 'Complete this field.'
  for (const field of Object.keys(FIELD_LIMITS) as TextField[]) {
    const limit = FIELD_LIMITS[field]
    if ((values[field] ?? '').length > limit) errors[field] = `Use ${limit} characters or fewer.`
  }
  return errors
}

/** Keeps the record's current value selectable even if it is no longer an active picklist value. */
function withCurrent(options: PicklistOption[], current: string | null): PicklistOption[] {
  if (!current || options.some((o) => o.value === current)) return options
  return [...options, { label: current, value: current }]
}

export function ProductFormModal({ product, onClose, onSaved }: Props) {
  const [values, setValues] = useState(() => initialValues(product))
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const picklists = usePicklists()
  const toast = useToast()
  const isEdit = Boolean(product)

  const set = <K extends keyof ProductInput>(field: K, value: ProductInput[K]) => {
    setValues((v) => ({ ...v, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const found = validate(values)
    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length) return

    setSaving(true)
    try {
      let id: string
      if (product) {
        await productService.update(product.Id, values)
        id = product.Id
      } else {
        id = await productService.create(values)
      }
      toast('success', isEdit ? `Product "${values.Name.trim()}" was saved.` : `Product "${values.Name.trim()}" was created.`)
      onSaved(id)
    } catch (error) {
      setSaving(false)
      if (error instanceof SalesforceError && error.fields.length) {
        const fieldErrors: Errors = {}
        for (const f of error.fields) fieldErrors[f as keyof ProductInput] = error.message
        setErrors(fieldErrors)
      }
      setFormError(errorMessage(error))
    }
  }

  const textInput = (field: Exclude<TextField, 'Description'>, label: string, required = false) => (
    <div className={`slds-form-element ${errors[field] ? 'slds-has-error' : ''}`}>
      <label className="slds-form-element__label" htmlFor={`f-${field}`}>
        {required && (
          <abbr className="slds-required" title="required">
            *{' '}
          </abbr>
        )}
        {label}
      </label>
      <div className="slds-form-element__control">
        <input
          id={`f-${field}`}
          className="slds-input"
          value={values[field] ?? ''}
          onChange={(e) => set(field, e.target.value)}
          aria-invalid={Boolean(errors[field])}
          aria-describedby={errors[field] ? `e-${field}` : undefined}
          required={required}
        />
      </div>
      {errors[field] && (
        <div className="slds-form-element__help" id={`e-${field}`}>
          {errors[field]}
        </div>
      )}
    </div>
  )

  const picklist = (field: 'Family' | 'QuantityUnitOfMeasure', label: string, options: PicklistOption[]) => (
    <div className={`slds-form-element ${errors[field] ? 'slds-has-error' : ''}`}>
      <label className="slds-form-element__label" htmlFor={`f-${field}`}>
        {label}
      </label>
      <div className="slds-form-element__control">
        <div className="slds-select_container">
          <select
            id={`f-${field}`}
            className="slds-select"
            value={values[field] ?? ''}
            onChange={(e) => set(field, e.target.value)}
          >
            <option value="">--None--</option>
            {withCurrent(options, values[field]).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {errors[field] && <div className="slds-form-element__help">{errors[field]}</div>}
    </div>
  )

  return (
    <Modal
      title={isEdit ? `Edit ${product?.Name}` : 'New Product'}
      onClose={onClose}
      busy={saving}
      size="medium"
      footer={
        <>
          <button type="button" className="slds-button slds-button_neutral" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form={FORM_ID} className="slds-button slds-button_brand" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      {formError && (
        <div className="slds-notify slds-notify_alert slds-alert_error slds-m-bottom_medium" role="alert">
          <h2>{formError}</h2>
        </div>
      )}
      <form id={FORM_ID} onSubmit={onSubmit} noValidate>
        <div className="slds-grid slds-wrap slds-gutters_small">
          <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
            {textInput('Name', 'Product Name', true)}
          </div>
          <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
            {textInput('ProductCode', 'Product Code')}
          </div>
          <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
            {picklist('Family', 'Product Family', picklists.family)}
          </div>
          <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
            {textInput('StockKeepingUnit', 'Product SKU')}
          </div>
          <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
            {picklist('QuantityUnitOfMeasure', 'Quantity Unit of Measure', picklists.quantityUnitOfMeasure)}
          </div>
          <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small slds-align-bottom">
            <div className="slds-form-element">
              <div className="slds-form-element__control">
                <div className="slds-checkbox">
                  <input
                    type="checkbox"
                    id="f-IsActive"
                    checked={values.IsActive}
                    onChange={(e) => set('IsActive', e.target.checked)}
                  />
                  <label className="slds-checkbox__label" htmlFor="f-IsActive">
                    <span className="slds-checkbox_faux" />
                    <span className="slds-form-element__label">Active</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div className="slds-col slds-size_1-of-1">
            <div className={`slds-form-element ${errors.Description ? 'slds-has-error' : ''}`}>
              <label className="slds-form-element__label" htmlFor="f-Description">
                Product Description
              </label>
              <div className="slds-form-element__control">
                <textarea
                  id="f-Description"
                  className="slds-textarea"
                  rows={4}
                  value={values.Description ?? ''}
                  onChange={(e) => set('Description', e.target.value)}
                />
              </div>
              {errors.Description && <div className="slds-form-element__help">{errors.Description}</div>}
            </div>
          </div>
        </div>
      </form>
    </Modal>
  )
}

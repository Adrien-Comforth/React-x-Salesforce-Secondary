import { useEffect, useState, type ReactNode } from 'react'
import { DeleteProductModal } from '../components/DeleteProductModal'
import { Icon } from '../components/Icon'
import { ProductFormModal } from '../components/ProductFormModal'
import { Spinner } from '../components/Spinner'
import { productService } from '../data/productService'
import type { Product } from '../data/types'
import { errorMessage, formatDateTime } from '../hooks'
import { navigate } from '../router'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2">
      <div className="slds-form-element slds-form-element_readonly slds-form-element_stacked">
        <span className="slds-form-element__label">{label}</span>
        <div className="slds-form-element__control">
          <div className="slds-form-element__static detail-value">{children || ' '}</div>
        </div>
      </div>
    </div>
  )
}

export function ProductDetailPage({ id }: { id: string }) {
  const [product, setProduct] = useState<Product | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [modal, setModal] = useState<'none' | 'edit' | 'delete'>('none')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    productService
      .get(id)
      .then((p) => active && setProduct(p))
      .catch((e) => active && setError(errorMessage(e)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [id, reloadKey])

  const backLink = (
    <a href="#/" className="slds-text-link back-link">
      <Icon category="utility" name="chevronleft" className="slds-icon slds-icon_xx-small slds-icon-text-default slds-m-right_xx-small" />
      All Products
    </a>
  )

  if (error) {
    return (
      <div className="slds-card slds-p-around_medium">
        {backLink}
        <div className="slds-notify slds-notify_alert slds-alert_error slds-m-top_small" role="alert">
          <h2>{error}</h2>
        </div>
      </div>
    )
  }

  if (!product) return <div className="detail-loading slds-is-relative">{loading && <Spinner />}</div>

  return (
    <>
      <div className="slds-page-header slds-page-header_record-home">
        <div className="slds-m-bottom_x-small">{backLink}</div>
        <div className="slds-page-header__row">
          <div className="slds-page-header__col-title">
            <div className="slds-media">
              <div className="slds-media__figure">
                <span className="slds-icon_container slds-icon-standard-product">
                  <Icon category="standard" name="product" className="slds-icon slds-page-header__icon" />
                </span>
              </div>
              <div className="slds-media__body">
                <div className="slds-page-header__name">
                  <div className="slds-page-header__name-title">
                    <h1>
                      <span>Product</span>
                      <span className="slds-page-header__title slds-truncate" title={product.Name}>
                        {product.Name}
                      </span>
                    </h1>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="slds-page-header__col-actions">
            <div className="slds-page-header__controls">
              <div className="slds-page-header__control">
                <div className="slds-button-group" role="group">
                  <button type="button" className="slds-button slds-button_neutral" onClick={() => setModal('edit')}>
                    Edit
                  </button>
                  <button type="button" className="slds-button slds-button_text-destructive" onClick={() => setModal('delete')}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <article className="slds-card slds-m-top_small slds-is-relative">
        {loading && <Spinner />}
        <div className="slds-card__header">
          <h2 className="slds-card__header-title">Details</h2>
        </div>
        <div className="slds-card__body slds-card__body_inner">
          <div className="slds-grid slds-wrap slds-gutters">
            <Field label="Product Name">{product.Name}</Field>
            <Field label="Product Code">{product.ProductCode}</Field>
            <Field label="Product Family">{product.Family}</Field>
            <Field label="Product SKU">{product.StockKeepingUnit}</Field>
            <Field label="Quantity Unit of Measure">{product.QuantityUnitOfMeasure}</Field>
            <Field label="Active">
              <span className={`slds-badge ${product.IsActive ? 'slds-theme_success' : 'slds-badge_lightest'}`}>
                {product.IsActive ? 'Active' : 'Inactive'}
              </span>
            </Field>
            <div className="slds-col slds-size_1-of-1">
              <div className="slds-form-element slds-form-element_readonly slds-form-element_stacked">
                <span className="slds-form-element__label">Product Description</span>
                <div className="slds-form-element__control">
                  <div className="slds-form-element__static detail-value detail-multiline">{product.Description || ' '}</div>
                </div>
              </div>
            </div>
            <Field label="Created">{formatDateTime(product.CreatedDate)}</Field>
            <Field label="Last Modified">{formatDateTime(product.LastModifiedDate)}</Field>
            <Field label="Record Id">
              <code>{product.Id}</code>
            </Field>
          </div>
        </div>
      </article>

      {modal === 'edit' && (
        <ProductFormModal
          product={product}
          onClose={() => setModal('none')}
          onSaved={() => {
            setModal('none')
            setReloadKey((k) => k + 1)
          }}
        />
      )}
      {modal === 'delete' && (
        <DeleteProductModal
          product={product}
          onClose={() => setModal('none')}
          onDeleted={() => {
            setModal('none')
            navigate({ name: 'list' })
          }}
        />
      )}
    </>
  )
}

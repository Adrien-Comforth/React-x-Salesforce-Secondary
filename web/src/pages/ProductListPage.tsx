import { useEffect, useState } from 'react'
import { ButtonIcon, Icon } from '../components/Icon'
import { DeleteProductModal } from '../components/DeleteProductModal'
import { ProductFormModal } from '../components/ProductFormModal'
import { Spinner } from '../components/Spinner'
import { productService } from '../data/productService'
import type { Product, ProductPage, ProductQuery, SortField, StatusFilter } from '../data/types'
import { errorMessage, formatDateTime, useDebouncedValue, usePicklists } from '../hooks'
import { navigate } from '../router'

const PAGE_SIZE = 20

const COLUMNS: { field: SortField; label: string }[] = [
  { field: 'Name', label: 'Product Name' },
  { field: 'ProductCode', label: 'Product Code' },
  { field: 'Family', label: 'Product Family' },
  { field: 'IsActive', label: 'Status' },
  { field: 'LastModifiedDate', label: 'Last Modified' },
]

type ModalState = { kind: 'none' } | { kind: 'create' } | { kind: 'edit'; product: Product } | { kind: 'delete'; product: Product }

export function ProductListPage() {
  const [search, setSearch] = useState('')
  const [family, setFamily] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sortField, setSortField] = useState<SortField>('Name')
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('ASC')
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [result, setResult] = useState<ProductPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>({ kind: 'none' })
  const picklists = usePicklists()
  const debouncedSearch = useDebouncedValue(search)

  useEffect(() => {
    let active = true
    const query: ProductQuery = { search: debouncedSearch, family, status, sortField, sortDirection, page, pageSize: PAGE_SIZE }
    setLoading(true)
    setError(null)
    productService
      .list(query)
      .then((r) => {
        if (!active) return
        // If the current page became empty (e.g. after a delete), step back one page.
        if (r.records.length === 0 && page > 1) setPage((p) => p - 1)
        else setResult(r)
      })
      .catch((e) => active && setError(errorMessage(e)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [debouncedSearch, family, status, sortField, sortDirection, page, reloadKey])

  const reload = () => setReloadKey((k) => k + 1)
  const resetPage = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value)
    setPage(1)
  }

  const onSort = (field: SortField) => {
    if (field === sortField) setSortDirection((d) => (d === 'ASC' ? 'DESC' : 'ASC'))
    else {
      setSortField(field)
      setSortDirection(field === 'LastModifiedDate' ? 'DESC' : 'ASC')
    }
    setPage(1)
  }

  const total = result?.totalSize ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)
  const sortLabel = COLUMNS.find((c) => c.field === sortField)?.label

  return (
    <>
      <div className="slds-page-header slds-page-header_object-home">
        <div className="slds-page-header__row">
          <div className="slds-page-header__col-title">
            <div className="slds-media">
              <div className="slds-media__figure">
                <span className="slds-icon_container slds-icon-standard-product" title="Product">
                  <Icon category="standard" name="product" className="slds-icon slds-page-header__icon" />
                </span>
              </div>
              <div className="slds-media__body">
                <div className="slds-page-header__name">
                  <div className="slds-page-header__name-title">
                    <h1>
                      <span>Products</span>
                      <span className="slds-page-header__title slds-truncate" title="All Products">
                        All Products
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
                <button type="button" className="slds-button slds-button_brand" onClick={() => setModal({ kind: 'create' })}>
                  <Icon category="utility" name="add" className="slds-button__icon slds-button__icon_left" />
                  New
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="slds-page-header__row">
          <div className="slds-page-header__col-meta">
            <p className="slds-page-header__meta-text">
              {total} {total === 1 ? 'item' : 'items'} • Sorted by {sortLabel}
            </p>
          </div>
          <div className="slds-page-header__col-controls">
            <div className="slds-page-header__controls">
              <div className="slds-page-header__control">
                <ButtonIcon icon="refresh" label="Refresh" onClick={reload} disabled={loading} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="slds-card slds-m-top_small">
        <div className="slds-card__body slds-card__body_inner slds-p-top_small">
          <div className="slds-grid slds-wrap slds-gutters_x-small slds-grid_vertical-align-end">
            <div className="slds-col slds-size_1-of-1 slds-medium-size_6-of-12 slds-m-bottom_x-small">
              <div className="slds-form-element">
                <label className="slds-form-element__label" htmlFor="filter-search">
                  Search
                </label>
                <div className="slds-form-element__control slds-input-has-icon slds-input-has-icon_left">
                  <Icon category="utility" name="search" className="slds-icon slds-input__icon slds-input__icon_left slds-icon-text-default" />
                  <input
                    id="filter-search"
                    type="search"
                    className="slds-input"
                    placeholder="Name, product code or SKU"
                    value={search}
                    onChange={(e) => resetPage(setSearch)(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="slds-col slds-size_1-of-2 slds-medium-size_3-of-12 slds-m-bottom_x-small">
              <div className="slds-form-element">
                <label className="slds-form-element__label" htmlFor="filter-family">
                  Product Family
                </label>
                <div className="slds-form-element__control">
                  <div className="slds-select_container">
                    <select
                      id="filter-family"
                      className="slds-select"
                      value={family}
                      onChange={(e) => resetPage(setFamily)(e.target.value)}
                    >
                      <option value="">All</option>
                      {picklists.family.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="slds-col slds-size_1-of-2 slds-medium-size_3-of-12 slds-m-bottom_x-small">
              <div className="slds-form-element">
                <label className="slds-form-element__label" htmlFor="filter-status">
                  Status
                </label>
                <div className="slds-form-element__control">
                  <div className="slds-select_container">
                    <select
                      id="filter-status"
                      className="slds-select"
                      value={status}
                      onChange={(e) => resetPage(setStatus)(e.target.value as StatusFilter)}
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="table-wrapper slds-is-relative">
          {loading && <Spinner />}
          {error ? (
            <div className="slds-p-around_medium">
              <div className="slds-notify slds-notify_alert slds-alert_error" role="alert">
                <h2>{error}</h2>
              </div>
              <button type="button" className="slds-button slds-button_neutral slds-m-top_small" onClick={reload}>
                Try again
              </button>
            </div>
          ) : (
            <table className="slds-table slds-table_cell-buffer slds-table_bordered" aria-label="Products">
              <thead>
                <tr className="slds-line-height_reset">
                  {COLUMNS.map((c) => {
                    const sorted = c.field === sortField
                    return (
                      <th
                        key={c.field}
                        scope="col"
                        className={`slds-is-sortable ${sorted ? 'slds-is-sorted' : ''}`}
                        aria-sort={sorted ? (sortDirection === 'ASC' ? 'ascending' : 'descending') : 'none'}
                      >
                        <button type="button" className="slds-th__action slds-text-link_reset sort-button" onClick={() => onSort(c.field)}>
                          <span className="slds-truncate" title={c.label}>
                            {c.label}
                          </span>
                          {sorted && (
                            <Icon
                              category="utility"
                              name={sortDirection === 'ASC' ? 'arrowup' : 'arrowdown'}
                              className="slds-icon slds-icon-text-default slds-icon_x-small slds-m-left_xx-small"
                            />
                          )}
                        </button>
                      </th>
                    )
                  })}
                  <th scope="col" className="actions-col">
                    <span className="slds-assistive-text">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result?.records.map((p) => (
                  <tr key={p.Id} className="slds-hint-parent">
                    <th scope="row">
                      <div className="slds-truncate" title={p.Name}>
                        <a href={`#/products/${p.Id}`}>{p.Name}</a>
                      </div>
                    </th>
                    <td>
                      <div className="slds-truncate">{p.ProductCode}</div>
                    </td>
                    <td>
                      <div className="slds-truncate">{p.Family}</div>
                    </td>
                    <td>
                      <span className={`slds-badge ${p.IsActive ? 'slds-theme_success' : 'slds-badge_lightest'}`}>
                        {p.IsActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="slds-truncate">{formatDateTime(p.LastModifiedDate)}</div>
                    </td>
                    <td className="actions-col">
                      <div className="slds-button-group" role="group">
                        <ButtonIcon icon="edit" label={`Edit ${p.Name}`} onClick={() => setModal({ kind: 'edit', product: p })} />
                        <ButtonIcon icon="delete" label={`Delete ${p.Name}`} onClick={() => setModal({ kind: 'delete', product: p })} />
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && result?.records.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length + 1} className="slds-text-align_center slds-p-vertical_large">
                      No products match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <footer className="slds-card__footer slds-grid slds-grid_align-spread slds-grid_vertical-align-center">
          <span className="slds-text-color_weak">
            {from}–{to} of {total}
          </span>
          <div className="slds-button-group" role="group">
            <button type="button" className="slds-button slds-button_neutral" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <button
              type="button"
              className="slds-button slds-button_neutral"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </footer>
      </div>

      {modal.kind === 'create' && (
        <ProductFormModal
          onClose={() => setModal({ kind: 'none' })}
          onSaved={(id) => {
            setModal({ kind: 'none' })
            navigate({ name: 'detail', id })
          }}
        />
      )}
      {modal.kind === 'edit' && (
        <ProductFormModal
          product={modal.product}
          onClose={() => setModal({ kind: 'none' })}
          onSaved={() => {
            setModal({ kind: 'none' })
            reload()
          }}
        />
      )}
      {modal.kind === 'delete' && (
        <DeleteProductModal
          product={modal.product}
          onClose={() => setModal({ kind: 'none' })}
          onDeleted={() => {
            setModal({ kind: 'none' })
            reload()
          }}
        />
      )}
    </>
  )
}

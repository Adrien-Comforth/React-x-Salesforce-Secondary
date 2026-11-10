import { useState } from 'react'
import { dataMode } from '../config'
import { productService } from '../data/productService'
import type { Product } from '../data/types'
import { errorMessage } from '../hooks'
import { Modal } from './Modal'
import { useToast } from './Toasts'

interface Props {
  product: Pick<Product, 'Id' | 'Name'>
  onClose: () => void
  onDeleted: () => void
}

export function DeleteProductModal({ product, onClose, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  const onConfirm = async () => {
    setDeleting(true)
    setError(null)
    try {
      await productService.remove(product.Id)
      toast('success', `Product "${product.Name}" was deleted.`)
      onDeleted()
    } catch (e) {
      setDeleting(false)
      setError(errorMessage(e))
    }
  }

  return (
    <Modal
      title="Delete Product"
      onClose={onClose}
      busy={deleting}
      footer={
        <>
          <button type="button" className="slds-button slds-button_neutral" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button type="button" className="slds-button slds-button_destructive" onClick={onConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </>
      }
    >
      {error && (
        <div className="slds-notify slds-notify_alert slds-alert_error slds-m-bottom_medium" role="alert">
          <h2>{error}</h2>
        </div>
      )}
      <p className="slds-text-align_center">
        Are you sure you want to delete <strong>{product.Name}</strong>?{' '}
        {dataMode === 'salesforce' ? 'It will be moved to the Salesforce Recycle Bin.' : "This can't be undone."}
      </p>
    </Modal>
  )
}

import { useEffect, useState } from 'react'
import { productService } from './data/productService'
import type { ProductPicklists } from './data/types'

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

const EMPTY_PICKLISTS: ProductPicklists = { family: [], quantityUnitOfMeasure: [] }

export function usePicklists(): ProductPicklists {
  const [picklists, setPicklists] = useState(EMPTY_PICKLISTS)
  useEffect(() => {
    let active = true
    productService
      .picklists()
      .then((p) => active && setPicklists(p))
      .catch(() => {
        /* picklists are optional; selects just stay empty */
      })
    return () => {
      active = false
    }
  }, [])
  return picklists
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

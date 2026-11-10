import { useEffect, useState } from 'react'
import { PRODUCT_ID_PATTERN } from './data/types'

/**
 * Hash-based routes so deep links work on static hosting and inside the Lightning
 * iframe (the LWC host sets #/products/<recordId> on record pages).
 */
export type Route = { name: 'list' } | { name: 'detail'; id: string }

function parse(hash: string): Route {
  const match = /^#\/products\/([^/?]+)$/.exec(hash)
  if (match && PRODUCT_ID_PATTERN.test(match[1])) return { name: 'detail', id: match[1] }
  return { name: 'list' }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function navigate(route: Route): void {
  window.location.hash = route.name === 'detail' ? `/products/${route.id}` : '/'
}

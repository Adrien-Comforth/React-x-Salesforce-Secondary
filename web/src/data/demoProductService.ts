import { SalesforceError } from './salesforceApi'
import type { Product, ProductInput, ProductPage, ProductPicklists, ProductQuery, ProductService } from './types'

/**
 * In-browser stand-in for Product2 so the app can be deployed and exercised before an
 * org is connected. Data is kept in localStorage and seeded on first use.
 */

const STORAGE_KEY = 'demo-products-v1'
const LATENCY_MS = 200

const PICKLISTS: ProductPicklists = {
  family: ['Hardware', 'Software', 'Services', 'Accessories'].map((v) => ({ label: v, value: v })),
  quantityUnitOfMeasure: ['Each', 'Box', 'Hour', 'License'].map((v) => ({ label: v, value: v })),
}

const SEED: [string, string, string, string, boolean, string][] = [
  ['Edge Gateway G1', 'GW-100', 'Hardware', 'Each', true, 'Industrial IoT gateway with dual Ethernet and LTE failover.'],
  ['Edge Gateway G2 Pro', 'GW-200', 'Hardware', 'Each', true, 'High-throughput gateway with on-device analytics.'],
  ['Sensor Pack (10)', 'SN-010', 'Accessories', 'Box', true, 'Temperature and humidity sensors, pack of ten.'],
  ['Mounting Kit', 'AC-310', 'Accessories', 'Each', true, 'Wall and DIN-rail mounting hardware.'],
  ['Fleet Console', 'SW-500', 'Software', 'License', true, 'Cloud console for device fleet management.'],
  ['Fleet Console Enterprise', 'SW-510', 'Software', 'License', true, 'Adds SSO, audit trail and premium support.'],
  ['Analytics Add-on', 'SW-520', 'Software', 'License', false, 'Legacy analytics module, superseded by G2 Pro.'],
  ['Installation Service', 'SV-700', 'Services', 'Hour', true, 'On-site installation by a certified engineer.'],
  ['Remote Onboarding', 'SV-710', 'Services', 'Hour', true, 'Guided remote setup and configuration session.'],
  ['Premium Support (1 yr)', 'SV-720', 'Services', 'Each', true, '24/7 support with a 4-hour response SLA.'],
  ['Edge Gateway G0', 'GW-050', 'Hardware', 'Each', false, 'Discontinued entry-level gateway.'],
  ['Power Supply 24V', 'AC-320', 'Accessories', 'Each', true, 'Replacement 24V DIN-rail power supply.'],
]

function newId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(15))
  return '01t' + Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

function seed(): Product[] {
  const now = Date.now()
  return SEED.map(([Name, ProductCode, Family, QuantityUnitOfMeasure, IsActive, Description], i) => {
    const date = new Date(now - (i + 1) * 86_400_000).toISOString()
    return {
      Id: newId(),
      Name,
      ProductCode,
      Family,
      QuantityUnitOfMeasure,
      IsActive,
      Description,
      StockKeepingUnit: `SKU-${ProductCode}`,
      CreatedDate: date,
      LastModifiedDate: date,
    }
  })
}

let memory: Product[] | null = null

function load(): Product[] {
  if (memory) return memory
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return (memory = JSON.parse(raw) as Product[])
  } catch {
    /* fall through to seed */
  }
  memory = seed()
  save(memory)
  return memory
}

function save(products: Product[]): void {
  memory = products
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products))
  } catch {
    /* in-memory only */
  }
}

const delay = <T>(value: () => T): Promise<T> =>
  new Promise((resolve, reject) =>
    setTimeout(() => {
      try {
        resolve(value())
      } catch (error) {
        reject(error)
      }
    }, LATENCY_MS),
  )

function clean(input: ProductInput): ProductInput {
  const blankToNull = (v: string | null) => (v && v.trim() ? v.trim() : null)
  if (!input.Name.trim()) throw new SalesforceError('Required fields are missing: [Name]', 400, 'REQUIRED_FIELD_MISSING', ['Name'])
  return {
    Name: input.Name.trim(),
    ProductCode: blankToNull(input.ProductCode),
    Description: blankToNull(input.Description),
    Family: blankToNull(input.Family),
    IsActive: input.IsActive,
    QuantityUnitOfMeasure: blankToNull(input.QuantityUnitOfMeasure),
    StockKeepingUnit: blankToNull(input.StockKeepingUnit),
  }
}

function notFound(id: string): never {
  throw new SalesforceError(`Product ${id} not found or was deleted.`, 404, 'NOT_FOUND')
}

function compare(a: Product, b: Product, field: ProductQuery['sortField']): number {
  const av = a[field]
  const bv = b[field]
  if (av === bv) return 0
  if (av === null) return 1
  if (bv === null) return -1
  return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
}

export function createDemoProductService(): ProductService {
  return {
    list: (query: ProductQuery): Promise<ProductPage> =>
      delay(() => {
        const term = query.search.trim().toLowerCase()
        const filtered = load().filter((p) => {
          if (term && ![p.Name, p.ProductCode, p.StockKeepingUnit].some((v) => v?.toLowerCase().includes(term)))
            return false
          if (query.family && p.Family !== query.family) return false
          if (query.status === 'active' && !p.IsActive) return false
          if (query.status === 'inactive' && p.IsActive) return false
          return true
        })
        const direction = query.sortDirection === 'ASC' ? 1 : -1
        filtered.sort((a, b) => {
          const result = compare(a, b, query.sortField)
          // Nulls last regardless of direction, like the SOQL query.
          if (a[query.sortField] === null || b[query.sortField] === null) return result
          return result * direction
        })
        const start = (query.page - 1) * query.pageSize
        return { records: filtered.slice(start, start + query.pageSize), totalSize: filtered.length }
      }),

    get: (id: string) => delay(() => load().find((p) => p.Id === id) ?? notFound(id)),

    create: (input: ProductInput) =>
      delay(() => {
        const now = new Date().toISOString()
        const product: Product = { ...clean(input), Id: newId(), CreatedDate: now, LastModifiedDate: now }
        save([product, ...load()])
        return product.Id
      }),

    update: (id: string, input: ProductInput) =>
      delay(() => {
        const products = load()
        const existing = products.find((p) => p.Id === id) ?? notFound(id)
        const updated: Product = { ...existing, ...clean(input), LastModifiedDate: new Date().toISOString() }
        save(products.map((p) => (p.Id === id ? updated : p)))
      }),

    remove: (id: string) =>
      delay(() => {
        const products = load()
        if (!products.some((p) => p.Id === id)) notFound(id)
        save(products.filter((p) => p.Id !== id))
      }),

    picklists: () => delay(() => PICKLISTS),
  }
}

export function resetDemoData(): void {
  memory = null
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

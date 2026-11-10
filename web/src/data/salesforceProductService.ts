import { SalesforceError, sfRequest, soqlLikeContains, soqlString } from './salesforceApi'
import {
  PRODUCT_ID_PATTERN,
  type PicklistOption,
  type Product,
  type ProductInput,
  type ProductPage,
  type ProductPicklists,
  type ProductQuery,
  type ProductService,
} from './types'

const FIELDS = [
  'Id',
  'Name',
  'ProductCode',
  'Description',
  'Family',
  'IsActive',
  'QuantityUnitOfMeasure',
  'StockKeepingUnit',
  'CreatedDate',
  'LastModifiedDate',
].join(', ')

interface QueryResult<T> {
  totalSize: number
  done: boolean
  records: (T & { attributes?: unknown })[]
}

interface DescribeField {
  name: string
  picklistValues: { active: boolean; label: string; value: string }[]
}

function assertId(id: string): void {
  if (!PRODUCT_ID_PATTERN.test(id)) throw new SalesforceError(`Invalid record id "${id}"`, 400)
}

function whereClause(query: ProductQuery): string {
  const conditions: string[] = []
  const search = query.search.trim()
  if (search) {
    const term = soqlLikeContains(search)
    conditions.push(`(Name LIKE ${term} OR ProductCode LIKE ${term} OR StockKeepingUnit LIKE ${term})`)
  }
  if (query.family) conditions.push(`Family = ${soqlString(query.family)}`)
  if (query.status === 'active') conditions.push('IsActive = true')
  if (query.status === 'inactive') conditions.push('IsActive = false')
  return conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
}

function soql(q: string): string {
  return `/query?q=${encodeURIComponent(q)}`
}

function stripAttributes<T>(record: T & { attributes?: unknown }): T {
  const copy = { ...record }
  delete copy.attributes
  return copy as T
}

/** Empty strings become null so PATCH clears the field instead of storing "". */
function toPayload(input: ProductInput): Record<string, unknown> {
  const blankToNull = (v: string | null) => (v && v.trim() ? v.trim() : null)
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

export function createSalesforceProductService(): ProductService {
  let picklistsPromise: Promise<ProductPicklists> | null = null

  return {
    async list(query: ProductQuery): Promise<ProductPage> {
      const where = whereClause(query)
      const offset = (query.page - 1) * query.pageSize
      const [page, count] = await Promise.all([
        sfRequest<QueryResult<Product>>(
          soql(
            `SELECT ${FIELDS} FROM Product2 ${where} ` +
              `ORDER BY ${query.sortField} ${query.sortDirection} NULLS LAST, Id ` +
              `LIMIT ${query.pageSize} OFFSET ${offset}`,
          ),
        ),
        sfRequest<QueryResult<never>>(soql(`SELECT COUNT() FROM Product2 ${where}`)),
      ])
      return { records: page.records.map(stripAttributes), totalSize: count.totalSize }
    },

    async get(id: string): Promise<Product> {
      assertId(id)
      const record = await sfRequest<Product & { attributes?: unknown }>(
        `/sobjects/Product2/${id}?fields=${encodeURIComponent(FIELDS)}`,
      )
      return stripAttributes(record)
    },

    async create(input: ProductInput): Promise<string> {
      const result = await sfRequest<{ id: string }>('/sobjects/Product2', { method: 'POST', body: toPayload(input) })
      return result.id
    },

    async update(id: string, input: ProductInput): Promise<void> {
      assertId(id)
      await sfRequest<void>(`/sobjects/Product2/${id}`, { method: 'PATCH', body: toPayload(input) })
    },

    async remove(id: string): Promise<void> {
      assertId(id)
      await sfRequest<void>(`/sobjects/Product2/${id}`, { method: 'DELETE' })
    },

    picklists(): Promise<ProductPicklists> {
      picklistsPromise ??= sfRequest<{ fields: DescribeField[] }>('/sobjects/Product2/describe')
        .then((describe) => {
          const optionsFor = (name: string): PicklistOption[] =>
            (describe.fields.find((f) => f.name === name)?.picklistValues ?? [])
              .filter((v) => v.active)
              .map(({ label, value }) => ({ label, value }))
          return { family: optionsFor('Family'), quantityUnitOfMeasure: optionsFor('QuantityUnitOfMeasure') }
        })
        .catch((error: unknown) => {
          picklistsPromise = null
          throw error
        })
      return picklistsPromise
    },
  }
}

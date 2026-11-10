/** Fields of the standard Product2 object used by this app. */
export interface Product {
  Id: string
  Name: string
  ProductCode: string | null
  Description: string | null
  Family: string | null
  IsActive: boolean
  QuantityUnitOfMeasure: string | null
  StockKeepingUnit: string | null
  CreatedDate: string
  LastModifiedDate: string
}

export type ProductInput = Pick<
  Product,
  'Name' | 'ProductCode' | 'Description' | 'Family' | 'IsActive' | 'QuantityUnitOfMeasure' | 'StockKeepingUnit'
>

export const SORTABLE_FIELDS = ['Name', 'ProductCode', 'Family', 'IsActive', 'LastModifiedDate'] as const
export type SortField = (typeof SORTABLE_FIELDS)[number]
export type SortDirection = 'ASC' | 'DESC'
export type StatusFilter = 'all' | 'active' | 'inactive'

export interface ProductQuery {
  search: string
  family: string
  status: StatusFilter
  sortField: SortField
  sortDirection: SortDirection
  page: number
  pageSize: number
}

export interface ProductPage {
  records: Product[]
  totalSize: number
}

export interface PicklistOption {
  label: string
  value: string
}

export interface ProductPicklists {
  family: PicklistOption[]
  quantityUnitOfMeasure: PicklistOption[]
}

export interface ProductService {
  list(query: ProductQuery): Promise<ProductPage>
  get(id: string): Promise<Product>
  create(input: ProductInput): Promise<string>
  update(id: string, input: ProductInput): Promise<void>
  remove(id: string): Promise<void>
  picklists(): Promise<ProductPicklists>
}

/** Max lengths from the Product2 schema, used for client-side validation. */
export const FIELD_LIMITS = {
  Name: 255,
  ProductCode: 255,
  StockKeepingUnit: 180,
  Description: 4000,
} as const

export const PRODUCT_ID_PATTERN = /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/

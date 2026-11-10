import { dataMode } from '../config'
import { createDemoProductService } from './demoProductService'
import { createSalesforceProductService } from './salesforceProductService'
import type { ProductService } from './types'

export const productService: ProductService =
  dataMode === 'salesforce' ? createSalesforceProductService() : createDemoProductService()

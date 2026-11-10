/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SF_LOGIN_URL?: string
  readonly VITE_SF_CLIENT_ID?: string
  readonly VITE_SF_API_VERSION?: string
  readonly VITE_DATA_MODE?: 'demo' | 'salesforce'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

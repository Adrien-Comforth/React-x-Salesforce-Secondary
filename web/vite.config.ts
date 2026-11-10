import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The app is embedded in a Lightning page (served over HTTPS) via an iframe,
// so the dev server must also be HTTPS on a fixed origin. That origin is
// registered in Salesforce as a CSP Trusted Site / CORS allowed origin.
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
  },
})

import { useSession } from './auth/session'
import { AppHeader } from './components/AppHeader'
import { ToastProvider } from './components/Toasts'
import { dataMode, isEmbedded } from './config'
import { LoginPage } from './pages/LoginPage'
import { ProductDetailPage } from './pages/ProductDetailPage'
import { ProductListPage } from './pages/ProductListPage'
import { useRoute } from './router'

export default function App() {
  const session = useSession()
  const route = useRoute()
  const needsLogin = dataMode === 'salesforce' && !session

  return (
    <ToastProvider>
      <div className={`app ${isEmbedded ? 'app_embedded' : ''}`}>
        {needsLogin ? (
          <LoginPage />
        ) : (
          <>
            <AppHeader />
            {route.name === 'detail' ? <ProductDetailPage key={route.id} id={route.id} /> : <ProductListPage />}
          </>
        )}
      </div>
    </ToastProvider>
  )
}

import { StrictMode } from 'react'
import { Auth0Provider } from '@auth0/auth0-react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN as string | undefined
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined

const isAuth0Configured = Boolean(auth0Domain && auth0ClientId && auth0Audience)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAuth0Configured ? (
      <Auth0Provider
        domain={auth0Domain!}
        clientId={auth0ClientId!}
        authorizationParams={{
          audience: auth0Audience,
          redirect_uri: window.location.origin,
          scope: 'openid profile email',
        }}
        cacheLocation="localstorage"
      >
        <App />
      </Auth0Provider>
    ) : (
      <main className="grid min-h-screen place-items-center bg-[#08090a] px-5 text-zinc-100">
        <section className="w-full max-w-lg rounded border border-zinc-900 bg-[#0c0d0e] p-5">
          <h1 className="text-base font-semibold">Auth0 is not configured</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Add VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID, and VITE_AUTH0_AUDIENCE
            to Todo.View/.env.local, then restart Vite.
          </p>
        </section>
      </main>
    )}
  </StrictMode>,
)

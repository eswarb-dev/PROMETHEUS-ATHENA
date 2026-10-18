import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/query/queryClient.js'
import { SessionProvider } from './lib/auth/SessionProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}><SessionProvider><App /></SessionProvider></QueryClientProvider>
  </StrictMode>,
)

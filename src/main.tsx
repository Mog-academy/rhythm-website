import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { RhythmStateProvider } from './state/RhythmStateProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <RhythmStateProvider>
        <App />
      </RhythmStateProvider>
    </HashRouter>
  </StrictMode>,
)

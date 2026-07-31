import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Inter — the app UI's typeface (weights actually used by the Tailwind classes).
// The printed documents (letters, cards) bring their own fonts and are untouched.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import '@fontsource/inter/900.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

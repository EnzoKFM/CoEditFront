import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AudioCallDemo } from './AudioCallDemo'
import './demo.css'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AudioCallDemo />
    </StrictMode>,
)

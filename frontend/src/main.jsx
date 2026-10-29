// Inicializa React en el documento principal.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './estilos/global.css'
import './componentes/ui/ui.css'
import { aplicarTema } from './config/tema.js'
import App from './App.jsx'
import ProveedorAutenticacion from './contexto/ProveedorAutenticacion.jsx'

aplicarTema()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorAutenticacion>
        <App />
      </ProveedorAutenticacion>
    </BrowserRouter>
  </StrictMode>,
)

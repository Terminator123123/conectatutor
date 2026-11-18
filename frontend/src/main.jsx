// Inicializa React en el documento principal.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './estilos/global.css'
import './componentes/ui/ui.css'
import './estilos/marca.css'
import './estilos/marca-paginas.css'
import { aplicarTema } from './config/tema.js'
import { iniciarTraduccion } from './servicios/traduccion.js'
import App from './App.jsx'
import GuardiaPestana from './componentes/layout/GuardiaPestana.jsx'
import ProveedorAutenticacion from './contexto/ProveedorAutenticacion.jsx'

aplicarTema()
iniciarTraduccion()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorAutenticacion>
        <GuardiaPestana>
          <App />
        </GuardiaPestana>
      </ProveedorAutenticacion>
    </BrowserRouter>
  </StrictMode>,
)

// Organiza la navegación, el contenido de cada ruta y el pie de página.
import { Outlet, useLocation } from 'react-router-dom'
import LimiteError from './LimiteError.jsx'
import BarraNavegacion from './BarraNavegacion.jsx'
import PiePagina from './PiePagina.jsx'
import './Layout.css'

/** @returns {import('react').ReactElement} Estructura compartida con navegación y recuperación por ruta. */
function Layout() {
  const location = useLocation()
  return (
    <div className="ct-layout">
      <a href="#contenido" className="ct-saltar">Saltar al contenido</a>
      <BarraNavegacion />
      <main id="contenido" tabIndex={-1} className="container py-4">
        <LimiteError key={location.pathname}><Outlet /></LimiteError>
      </main>
      <PiePagina />
    </div>
  )
}

export default Layout

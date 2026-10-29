// Organiza la navegación, el contenido de cada ruta y el pie de página.
import { Outlet } from 'react-router-dom'
import BarraNavegacion from './BarraNavegacion.jsx'
import PiePagina from './PiePagina.jsx'
import './Layout.css'

function Layout() {
  return (
    <div className="ct-layout">
      <BarraNavegacion />
      <main className="container py-4">
        <Outlet />
      </main>
      <PiePagina />
    </div>
  )
}

export default Layout

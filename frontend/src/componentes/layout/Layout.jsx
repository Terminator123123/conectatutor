// Organiza la navegación, el contenido de cada ruta y el pie de página.
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAutenticacion } from '../../contexto/useAutenticacion.js'
import { cuentaSinActivar } from '../../servicios/mapeoApi.js'
import { useEffect } from 'react'
import LimiteError from './LimiteError.jsx'
import BarraNavegacion from './BarraNavegacion.jsx'
import PiePagina from './PiePagina.jsx'
import PanelMarcaAcceso from './PanelMarcaAcceso.jsx'
import './Layout.css'

/** @returns {import('react').ReactElement} Estructura compartida con navegación y recuperación por ruta. */
function Layout() {
  const location = useLocation()
  const { usuario } = useAutenticacion()
  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])
  const acceso = ['/ingresar', '/recuperar-acceso', '/primer-acceso'].some((ruta) => location.pathname.startsWith(ruta))
  // Una cuenta creada por Coordinación no usa la aplicación hasta crear su contraseña y aceptar el aviso.
  if (cuentaSinActivar(usuario) && location.pathname !== '/primer-acceso') {
    return <Navigate to="/primer-acceso" replace state={{ desde: location.pathname + location.search }} />
  }
  return (
    <div className={`ct-layout${acceso ? ' ct-layout-acceso' : ''}`}>
      <a href="#contenido" className="ct-saltar">Saltar al contenido</a>
      <BarraNavegacion />
      {acceso && <PanelMarcaAcceso />}
      <main id="contenido" tabIndex={-1} className="container py-4">
        <LimiteError key={location.pathname}><Outlet /></LimiteError>
      </main>
      {['/', '/como-funciona', '/componentes'].includes(location.pathname) && <PiePagina />}
    </div>
  )
}

export default Layout

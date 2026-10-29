// Muestra los mismos enlaces en la barra superior o inferior según el ancho.
import { NavLink } from 'react-router-dom'
import { INSTITUCION } from '../../config/institucion.js'

const enlaces = [
  { ruta: '/', etiqueta: 'Inicio', icono: 'bi-house' },
  { ruta: '/tutores', etiqueta: 'Buscar', icono: 'bi-search' },
  { ruta: '/sesiones', etiqueta: 'Mis sesiones', icono: 'bi-calendar-event' },
  { ruta: '/perfil', etiqueta: 'Perfil', icono: 'bi-person' },
  { ruta: '/admin/verificacion', etiqueta: 'Admin', icono: 'bi-shield-check' },
  { ruta: '/ingresar', etiqueta: 'Ingresar', icono: 'bi-box-arrow-in-right' },
]

function BarraNavegacion() {
  function renderizarEnlaces() {
    return enlaces.map(({ ruta, etiqueta, icono }) => (
      <NavLink
        key={ruta}
        to={ruta}
        end={ruta === '/'}
        className={({ isActive }) => `ct-enlace${isActive ? ' ct-enlace-activo' : ''}`}
      >
        <i className={`bi ${icono}`} aria-hidden="true" />
        <span>{etiqueta}</span>
      </NavLink>
    ))
  }

  return (
    <>
      <header className="ct-cabecera">
        <div className="container d-flex align-items-center justify-content-between gap-3 py-3">
          <span className="ct-nombre-app">{INSTITUCION.nombreApp}</span>
          <nav className="ct-navegacion-superior d-none d-md-flex" aria-label="Navegación principal">
            {renderizarEnlaces()}
          </nav>
        </div>
      </header>
      <nav className="ct-navegacion-inferior d-flex d-md-none" aria-label="Navegación móvil">
        {renderizarEnlaces()}
      </nav>
    </>
  )
}

export default BarraNavegacion

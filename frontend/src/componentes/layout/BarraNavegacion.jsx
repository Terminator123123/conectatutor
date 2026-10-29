// Muestra los mismos enlaces en la barra superior o inferior según el ancho.
import { NavLink, useNavigate } from 'react-router-dom'
import { INSTITUCION } from '../../config/institucion.js'
import { useAutenticacion } from '../../contexto/useAutenticacion.js'
import { RolUsuario } from '../../modelo/enums.js'

const INVITADO = 'INVITADO'

const enlaces = [
  { ruta: '/', etiqueta: 'Inicio', icono: 'bi-house', roles: INVITADO },
  { ruta: '/tutores', etiqueta: 'Buscar', icono: 'bi-search', roles: [RolUsuario.ESTUDIANTE] },
  { ruta: '/sesiones', etiqueta: 'Mis sesiones', icono: 'bi-calendar-event', roles: [RolUsuario.ESTUDIANTE] },
  { ruta: '/perfil', etiqueta: 'Perfil', icono: 'bi-person', roles: [RolUsuario.ESTUDIANTE] },
  { ruta: '/admin/verificacion', etiqueta: 'Coordinación', icono: 'bi-shield-check', roles: [RolUsuario.ADMINISTRADOR] },
  { ruta: '/ingresar', etiqueta: 'Ingresar', icono: 'bi-box-arrow-in-right', roles: INVITADO },
  { ruta: '/registro', etiqueta: 'Registrarse', icono: 'bi-person-plus', roles: INVITADO },
  { ruta: null, etiqueta: 'Salir', icono: 'bi-box-arrow-right', roles: [RolUsuario.ESTUDIANTE, RolUsuario.ADMINISTRADOR] },
]

function BarraNavegacion() {
  const { usuario, cargando, cerrarSesion } = useAutenticacion()
  const navigate = useNavigate()
  const enlacesVisibles = enlaces.filter(({ roles }) => usuario
    ? Array.isArray(roles) && roles.includes(usuario.getRol())
    : roles === INVITADO)

  function salir() {
    cerrarSesion()
    navigate('/')
  }

  function renderizarEnlaces() {
    return enlacesVisibles.map(({ ruta, etiqueta, icono }) => ruta === null ? (
      <button type="button" className="ct-enlace" key={etiqueta} onClick={salir}>
        <i className={`bi ${icono}`} aria-hidden="true" />
        <span>{etiqueta}</span>
      </button>
    ) : (
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
        <div className="container d-flex flex-wrap align-items-center justify-content-between gap-3 py-3">
          <div className="ct-identidad d-flex align-items-center gap-2">
            <img
              className="ct-logo-institucional"
              src={INSTITUCION.logos.horizontal}
              alt={INSTITUCION.nombre}
              height="36"
            />
            <span className="ct-nombre-app">{INSTITUCION.nombreApp}</span>
          </div>
          {!cargando && (
            <nav className="ct-navegacion-superior d-none d-md-flex" aria-label="Navegación principal">
              {usuario && <span className="ct-usuario-navegacion">{usuario.getNombre()}</span>}
              {renderizarEnlaces()}
            </nav>
          )}
        </div>
      </header>
      {!cargando && (
        <nav className="ct-navegacion-inferior d-flex d-md-none" aria-label="Navegación móvil">
          {renderizarEnlaces()}
        </nav>
      )}
    </>
  )
}

export default BarraNavegacion

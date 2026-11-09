// Adapta la navegación del prototipo al rol y al tamaño de pantalla.
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { INSTITUCION } from '../../config/institucion.js'
import { useAutenticacion } from '../../contexto/useAutenticacion.js'
import { RolUsuario } from '../../modelo/enums.js'
import Avatar from '../ui/Avatar.jsx'
import EncabezadoPagina from './EncabezadoPagina.jsx'

// Resuelve cada título sin cadenas de condiciones dentro del marcado.
function tituloNavegacion(ruta, busqueda, usuario) {
  const parametros = new URLSearchParams(busqueda)
  if (ruta === '/notificaciones') return 'Notificaciones'
  if (ruta === '/sesion-expirada') return 'Sesión expirada'
  if (ruta.endsWith('/reprogramar')) return 'Reprogramar sesión'
  if (ruta.includes('/promedio')) return 'Valoración'
  if (ruta === '/tutores' && parametros.get('vista') === 'gratuitas') return 'Tutorías gratuitas'
  if (ruta === '/tutores' && parametros.get('elegir') === '1') return 'Elegir materia'
  if (ruta.includes('/solicitar')) return parametros.has('estado') ? 'Solicitud' : 'Solicitar tutoría'
  if (ruta.includes('/calificar')) return 'Calificar sesión'
  if (ruta.startsWith('/tutores/')) {
    if (parametros.get('vista') !== 'resumen') return 'Perfil del tutor'
    return parametros.get('tipo') === 'nuevo' ? 'Tutor nuevo' : 'Perfil de ' + (parametros.get('nombre') ?? 'tutor')
  }
  if (ruta === '/sesiones') return 'Mis sesiones'
  if (ruta.startsWith('/sesiones/')) {
    if (parametros.get('resultado') === 'enviada') return 'Solicitud a ' + (parametros.get('nombre') ?? 'tutor')
    if (parametros.has('resultado')) return parametros.get('resultado') === 'sesion' ? 'Sesión confirmada' : 'Mis sesiones'
    if (parametros.has('cancelar')) return parametros.get('cancelar') === 'confirmada' ? 'Cancelar sesión confirmada' : 'Cancelar solicitud'
    return parametros.get('estado') === 'confirmada' ? 'Sesión confirmada' : 'Detalle de solicitud'
  }
  if (ruta === '/perfil') {
    const tutor = usuario?.esTutor?.()
    if (parametros.has('horario')) return 'Disponibilidad'
    if (parametros.get('guardado') === '1') return tutor ? 'Perfil de tutor' : 'Perfil de estudiante'
    if (parametros.get('completar') === '1') return 'Completa tu perfil'
    if (parametros.get('editar') === '1') return 'Editar perfil'
    return tutor ? 'Mi perfil de tutor' : 'Mi perfil'
  }
  if (ruta === '/solicitudes') return 'Solicitudes'
  if (ruta === '/admin/verificacion') return parametros.has('soporte') || parametros.has('resultado') ? 'Administración' : 'Verificación de tutores'
  if (ruta === '/admin/materias' || ruta === '/admin/reportes') return 'Administración'
  if (ruta === '/admin/perfil') return 'Mi perfil'
  if (ruta === '/favoritos') return parametros.has('vacio') ? 'Favoritos' : 'Tutores favoritos'
  return ''
}

/** @returns {import('react').ReactElement} Cabecera y barra inferior por rol. */
export default function BarraNavegacion() {
  const { usuario, cargando } = useAutenticacion()
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const acceso = ['/registro', '/ingresar', '/recuperar-acceso'].some((ruta) => pathname.startsWith(ruta))
  const expirada = pathname === '/sesion-expirada'
  const estudiante = usuario?.getRol() === RolUsuario.ESTUDIANTE
  const estadoSolicitud = pathname.includes('/solicitar') && new URLSearchParams(search).has('estado')
  const accionFija = pathname.includes('/solicitar') && !estadoSolicitud
  const enlaces = estudiante ? [
    ['/tutores', 'Buscar', 'bi-search'],
    ['/sesiones', 'Sesiones', 'bi-calendar-event'],
    ...(usuario.esTutor() ? [['/solicitudes', 'Solicitudes', 'bi-calendar-check']] : []),
    ['/perfil', 'Perfil', 'bi-person'],
  ] : usuario ? [
    ['/admin/verificacion', 'Coordinación', 'bi-shield-check'],
    ['/admin/perfil', 'Perfil', 'bi-person'],
  ] : [['/', 'Inicio', 'bi-house'], ['/ingresar', 'Ingresar', 'bi-box-arrow-in-right'], ['/registro', 'Registrarse', 'bi-person-plus']]
  const titulo = tituloNavegacion(pathname, search, usuario)
  function enlacesDe(barra) {
    return enlaces.map(([ruta, etiqueta, icono]) => <NavLink key={ruta} to={ruta} end={ruta === '/'}
      className={({ isActive }) => `ct-enlace${isActive && !(ruta === '/tutores' && estadoSolicitud) || ruta === '/sesiones' && (estadoSolicitud || pathname === '/notificaciones') || ruta === '/tutores' && ['/favoritos', '/reportar'].includes(pathname) ? ' ct-enlace-activo' : ''}`}>
      <i className={`bi ${icono}`} aria-hidden="true" />
      <span>{barra === 'superior' && etiqueta === 'Buscar' ? 'Buscar tutores' : barra === 'superior' && etiqueta === 'Sesiones' ? 'Mis sesiones' : etiqueta}</span>
    </NavLink>)
  }
  return <>
    <header className={`ct-cabecera${acceso ? ' ct-cabecera-acceso' : ''}${pathname === '/tutores' ? ' ct-cabecera-buscar' : ''}`}>
      <Link className="ct-identidad" to="/">
        <span className="ct-simbolo"><img src={INSTITUCION.logos.favicon} alt="" width="20" height="20" /></span>
        <span className="ct-nombre-app">{INSTITUCION.nombreApp}</span>
      </Link>
      {!cargando && !expirada && <nav className="ct-navegacion-superior" aria-label="Navegación principal">{enlacesDe('superior')}</nav>}
      {usuario && <Link className="ct-cuenta" to={estudiante ? '/perfil' : '/admin/perfil'}>
        <span>{usuario.getNombre().split(' ')[0]}</span><Avatar nombre={usuario.getNombre()} />
      </Link>}
      <button className="ct-volver-tablet btn-ct-secundario" onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate('/')} type="button">Volver</button>
    </header>
    {!acceso && titulo && <EncabezadoPagina titulo={titulo} />}
    {!cargando && !acceso && !expirada && !accionFija && <nav className="ct-navegacion-inferior" aria-label="Navegación móvil">{enlacesDe('inferior')}</nav>}
  </>
}


// Deja explorar tutores sin cuenta; quien entra como administrador vuelve a su panel.
import { Navigate, useLocation } from 'react-router-dom'
import { useAutenticacion } from '../../contexto/useAutenticacion.js'
import { RolUsuario } from '../../modelo/enums.js'
import { SESION_REEMPLAZADA } from '../../servicios/api.js'
import { rutaInicialDe } from '../../servicios/rutasPorRol.js'
import Cargando from '../ui/Cargando.jsx'
import MensajeError from '../ui/MensajeError.jsx'

/**
 * @param {object} props Propiedades de la ruta abierta.
 * @param {import('react').ReactNode} props.children Contenido visible para invitados y estudiantes.
 * @returns {import('react').ReactNode} Contenido, espera o redirección.
 */
export default function RutaAbierta({ children }) {
  const { usuario, cargando, errorInicial, reintentarSesion, sesionExpirada, motivoCierre } = useAutenticacion()
  const location = useLocation()
  if (cargando) return <Cargando texto="Cargando…" />
  if (errorInicial) return <MensajeError mensaje={errorInicial} alReintentar={reintentarSesion} forma="marca" />
  // Aunque la página sea pública, si la cuenta se abrió en otro lugar se explica en vez de cerrarla en silencio
  if (!usuario && sesionExpirada && motivoCierre === SESION_REEMPLAZADA) {
    return <Navigate to="/sesion-expirada" replace state={{ desde: location.pathname + location.search }} />
  }
  if (usuario?.getRol() === RolUsuario.ADMINISTRADOR) return <Navigate to={rutaInicialDe(usuario)} replace />
  return children
}

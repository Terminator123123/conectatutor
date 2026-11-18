// Deja explorar tutores sin cuenta; quien entra como administrador vuelve a su panel.
import { Navigate } from 'react-router-dom'
import { useAutenticacion } from '../../contexto/useAutenticacion.js'
import { RolUsuario } from '../../modelo/enums.js'
import { rutaInicialDe } from '../../servicios/rutasPorRol.js'
import Cargando from '../ui/Cargando.jsx'
import MensajeError from '../ui/MensajeError.jsx'

/**
 * @param {object} props Propiedades de la ruta abierta.
 * @param {import('react').ReactNode} props.children Contenido visible para invitados y estudiantes.
 * @returns {import('react').ReactNode} Contenido, espera o redirección.
 */
export default function RutaAbierta({ children }) {
  const { usuario, cargando, errorInicial, reintentarSesion } = useAutenticacion()
  if (cargando) return <Cargando texto="Cargando…" />
  if (errorInicial) return <MensajeError mensaje={errorInicial} alReintentar={reintentarSesion} forma="marca" />
  if (usuario?.getRol() === RolUsuario.ADMINISTRADOR) return <Navigate to={rutaInicialDe(usuario)} replace />
  return children
}

// Restringe una ruta a los roles autorizados y conserva el destino del invitado.
import { Navigate, useLocation } from 'react-router-dom'
import { useAutenticacion } from '../../contexto/useAutenticacion.js'
import { rutaInicialDe } from '../../servicios/rutasPorRol.js'
import Cargando from '../ui/Cargando.jsx'
import MensajeError from '../ui/MensajeError.jsx'

/**
 * @param {object} props Propiedades del acceso protegido.
 * @param {string[]} props.roles Roles admitidos de RolUsuario.
 * @param {import('react').ReactNode} props.children Contenido protegido.
 * @returns {import('react').ReactNode} Contenido, espera o redirección.
 */
export default function RutaProtegida({ roles, children }) {
  const { usuario, cargando, sesionExpirada, errorInicial, reintentarSesion } = useAutenticacion()
  const location = useLocation()
  if (cargando) return <Cargando texto="Verificando tu sesión…" />
  if (errorInicial) return <MensajeError mensaje={errorInicial} alReintentar={reintentarSesion} />
  if (!usuario && sesionExpirada) return <Navigate to="/sesion-expirada" replace state={{ desde: location.pathname + location.search }} />
  if (!usuario) return <Navigate to="/ingresar" replace state={{ desde: location.pathname + location.search }} />
  if (!roles.includes(usuario.getRol())) return <Navigate to={rutaInicialDe(usuario)} replace />
  return children
}

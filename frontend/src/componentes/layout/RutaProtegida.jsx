// Restringe una ruta a los roles autorizados y conserva el destino del invitado.
import { Navigate, useLocation } from 'react-router-dom'
import { useAutenticacion } from '../../contexto/useAutenticacion.js'
import { rutaInicialDe } from '../../servicios/rutasPorRol.js'
import Cargando from '../ui/Cargando.jsx'

/**
 * @param {object} props Propiedades del acceso protegido.
 * @param {string[]} props.roles Roles admitidos de RolUsuario.
 * @param {import('react').ReactNode} props.children Contenido protegido.
 * @returns {import('react').ReactNode} Contenido, espera o redirección.
 */
export default function RutaProtegida({ roles, children }) {
  const { usuario, cargando } = useAutenticacion()
  const location = useLocation()
  if (cargando) return <Cargando texto="Verificando tu sesión…" />
  if (!usuario) return <Navigate to="/ingresar" replace state={{ desde: location.pathname }} />
  if (!roles.includes(usuario.getRol())) return <Navigate to={rutaInicialDe(usuario)} replace />
  return children
}

// Reserva las pantallas de acceso y registro para usuarios sin sesión.
import { Navigate } from 'react-router-dom'
import { useAutenticacion } from '../../contexto/useAutenticacion.js'
import { rutaInicialDe } from '../../servicios/rutasPorRol.js'
import Cargando from '../ui/Cargando.jsx'

/**
 * @param {object} props Propiedades de la ruta pública de acceso.
 * @param {import('react').ReactNode} props.children Contenido para invitados.
 * @returns {import('react').ReactNode} Contenido, espera o redirección.
 */
export default function RutaSoloInvitados({ children }) {
  const { usuario, cargando } = useAutenticacion()
  if (cargando) return <Cargando texto="Verificando tu sesión…" />
  if (usuario) return <Navigate to={rutaInicialDe(usuario)} replace />
  return children
}

// Presenta el cierre de sesión demostrativo antes de volver al acceso.
import { useLocation, useNavigate } from 'react-router-dom'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import Boton from '../componentes/ui/Boton.jsx'
import DatoSesion from '../componentes/ui/DatoSesion.jsx'
import '../estilos/solicitante.css'

/** @returns {import('react').ReactElement} Estado de sesión expirada del prototipo. */
export default function SesionExpirada() {
  //solucion temp por falrta de bak correguir despues//
  useTituloPagina('Sesión expirada')
  const { cerrarSesion } = useAutenticacion()
  const navigate = useNavigate()
  const location = useLocation()

  function volverAlAcceso() {
    cerrarSesion()
    navigate('/ingresar', { replace: true, state: { desde: location.state?.desde ?? '/sesiones' } })
  }

  return (
    <section className="ct-estado-formulario ct-sesion-expirada">
      <span className="ct-paso">Acceso requerido</span>
      <h1>Vuelve a iniciar sesión</h1>
      <p className="ct-texto-secundario">Tu sesión terminó por inactividad. Vuelve a iniciar sesión para continuar.</p>
      <DatoSesion etiqueta="Estado">Sesión expirada</DatoSesion>
      <p className="ct-texto-secundario">Por seguridad cerramos la sesión después de 30 minutos sin actividad.</p>
      <p className="ct-demostracion">Esta pantalla simula un cierre por inactividad.</p>
      <div className="ct-estado-formulario-acciones">
        <Boton anchoCompleto alHacerClic={volverAlAcceso}>Iniciar sesión</Boton>
      </div>
    </section>
  )
}

// Conserva el destino al volver al acceso después de la expiración.
import { useLocation, useNavigate } from 'react-router-dom'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import Boton from '../componentes/ui/Boton.jsx'
import DatoSesion from '../componentes/ui/DatoSesion.jsx'
import { SESION_REEMPLAZADA } from '../servicios/api.js'
import '../estilos/solicitante.css'

/** @returns {import('react').ReactElement} Estado de sesión expirada. */
export default function SesionExpirada() {
  useTituloPagina('Sesión expirada')
  const { cerrarSesion, motivoCierre } = useAutenticacion()
  const reemplazada = motivoCierre === SESION_REEMPLAZADA
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
      <p className="ct-texto-secundario">{reemplazada
        ? 'Tu cuenta se abrió en otra pestaña, navegador o dispositivo, y aquí se cerró: una cuenta solo puede estar abierta en un lugar a la vez.'
        : 'Tu sesión dejó de ser válida. Vuelve a iniciar sesión para continuar.'}</p>
      <DatoSesion etiqueta="Estado">{reemplazada ? 'Abierta en otro lugar' : 'Sesión expirada'}</DatoSesion>
      <p className="ct-texto-secundario">{reemplazada
        ? 'Si quieres seguir aquí, inicia sesión de nuevo; entonces se cerrará en el otro lugar.'
        : 'Por seguridad debes volver a identificarte para acceder a tus datos.'}</p>
      <p className="ct-demostracion">Tus sesiones de tutoría se conservan.</p>
      <div className="ct-estado-formulario-acciones">
        <Boton anchoCompleto alHacerClic={volverAlAcceso}>Iniciar sesión</Boton>
      </div>
    </section>
  )
}

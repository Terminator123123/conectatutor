// Publica una calificación mediante las reglas R6 y R7 del modelo.
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { useEscritorio } from '../hooks/useEscritorio.js'
import { useSesion } from '../hooks/useSesion.js'
import { repositorio } from '../servicios/instancias.js'
import { formatearFechaBreve } from '../componentes/ui/fechaBreve.js'
import Avatar from '../componentes/ui/Avatar.jsx'
import BloqueCalificacion from '../componentes/ui/BloqueCalificacion.jsx'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import Boton from '../componentes/ui/Boton.jsx'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'
import Modal from '../componentes/ui/Modal.jsx'
import MisSolicitudes from './sesiones/MisSolicitudes.jsx'
import '../estilos/solicitante.css'

/** @returns {import('react').ReactElement} Pantalla propia de valoración. */
export default function CalificarSesion() {
  useTituloPagina('Calificar sesión')
  const { id } = useParams()
  const { usuario } = useAutenticacion()
  const { sesion, cargando, error, reintentar } = useSesion(id, usuario.getId())
  const [puntaje, setPuntaje] = useState(0)
  const [resena, setResena] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorAccion, setErrorAccion] = useState('')
  const navigate = useNavigate()
  const escritorio = useEscritorio()
  async function publicar(evento) {
    evento.preventDefault()
    if (enviando) return
    setErrorAccion('')
    if (resena.trim().length > 300) { setErrorAccion('La reseña debe tener como máximo 300 caracteres.'); return }
    setEnviando(true)
    try {
      const actuar = async () => {
        const actuales = await repositorio.listarSesionesDe(usuario.getId())
        const actual = actuales.find((item) => item.getId() === id && item.getSolicitante().getId() === usuario.getId())
        if (!actual) throw new Error('Solo puedes calificar tus propias solicitudes.')
        actual.calificar(puntaje, resena.trim())
        await repositorio.guardarSesion(actual)
      }
      if (navigator.locks?.request) await navigator.locks.request(`ct-sesion-${id}`, actuar)
      else await actuar()
      navigate('/sesiones?estado=finalizadas', { replace:true, state:{ aviso:'Calificación publicada. Gracias por compartir tu experiencia.', nombreTutor:sesion.getTutor().getEstudiante().getNombre().split(' ')[0] } })
    } catch (fallo) { setErrorAccion(fallo.message) }
    finally { setEnviando(false) }
  }
  if (cargando) return <Cargando texto="Cargando sesión…" />
  if (error) return <MensajeError mensaje={error} alReintentar={reintentar} />
  if (!sesion || sesion.getSolicitante().getId() !== usuario.getId()) return <EstadoVacio titulo="No encontramos esta solicitud" accion={{ etiqueta:'Mis sesiones', ruta:'/sesiones' }} />
  const tutor = sesion.getTutor().getEstudiante()
  const contenido = <section className="ct-calificar-pagina">
    <Avatar nombre={tutor.getNombre()} tamano={72} />
    <h1>¿Cómo te fue con {tutor.getNombre().split(' ')[0]}?</h1>
    <p>{sesion.getMateria().getNombre()}, {formatearFechaBreve(sesion.getFecha())}<br />{sesion.getFranja().getHoraInicio()}–{sesion.getFranja().getHoraFin()}</p>
    <form noValidate onSubmit={publicar}>
      <fieldset className="ct-selector-contenedor" disabled={enviando}>
          <legend className="visually-hidden">Calificación
        </legend>
          <BloqueCalificacion editable tamano="grande" valor={puntaje} alCambiar={setPuntaje} />
        </fieldset>
      <strong className="ct-puntaje" aria-live="polite">
        {puntaje} de 5{escritorio && puntaje > 0 ? ', ' + ['', 'Muy mala', 'Mala', 'Regular', 'Muy buena', 'Excelente'][puntaje] : ''}
      </strong>
      <CampoFormulario etiqueta={escritorio ? 'Reseña' : 'Comparte tu experiencia'} nombre="resena" tipo="textarea" valor={resena} alCambiar={setResena} deshabilitado={enviando} />
      <p>Tu nombre y reseña serán visibles en el perfil del tutor.</p>
      {errorAccion && <MensajeError mensaje={errorAccion} />}
      <Boton tipo="submit" anchoCompleto cargando={enviando}>Publicar calificación</Boton>
      <Boton variante="secundario" anchoCompleto deshabilitado={enviando} alHacerClic={() => navigate('/sesiones?estado=finalizadas')}>Ahora no</Boton>
    </form>
  </section>
  return escritorio ? 
  <>
      <div inert>
          <header className="ct-sesiones-titular">
              <h1>Tu espacio para seguir aprendiendo.
        </h1>
              <p>Gestiona tus solicitudes y comparte cómo fue tu experiencia.
        </p>
            </header>
          <MisSolicitudes />
        </div>
      <Modal abierto
      titulo={`¿Cómo te fue con ${tutor.getNombre().split(' ')[0]}?`}
      alCerrar={() => { if (!enviando) navigate('/sesiones?estado=finalizadas') }}>
      {contenido}
    </Modal>
    </> : contenido
}


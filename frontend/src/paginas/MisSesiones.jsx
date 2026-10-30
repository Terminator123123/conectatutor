import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { INSTITUCION } from '../config/institucion.js'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { EstadoSesion } from '../modelo/enums.js'
import { repositorio } from '../servicios/instancias.js'
import { formatearFecha } from '../servicios/agenda.js'
import ItemSesion from '../componentes/ui/ItemSesion.jsx'
import Modal from '../componentes/ui/Modal.jsx'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import BloqueCalificacion from '../componentes/ui/BloqueCalificacion.jsx'
import Boton from '../componentes/ui/Boton.jsx'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'
import '../estilos/solicitante.css'

/** @returns {import('react').ReactElement} Solicitudes y acciones del solicitante. */
export default function MisSesiones() {
  const { usuario } = useAutenticacion()
  const location = useLocation()
  const navigate = useNavigate()
  const usuarioId = usuario.getId()
  const [sesiones, setSesiones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [intento, setIntento] = useState(0)
  const [aviso, setAviso] = useState(location.state?.aviso ?? '')
  const [modal, setModal] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [motivoTocado, setMotivoTocado] = useState(false)
  const [puntaje, setPuntaje] = useState(0)
  const [resena, setResena] = useState('')
  const [resenaTocada, setResenaTocada] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [errorAccion, setErrorAccion] = useState('')
  const motivoRef = useRef(null)
  const resenaRef = useRef(null)

  useEffect(() => {
    if (location.state?.aviso) {
      navigate('.', { replace: true, state: null })
    }
  }, [location.state, navigate])

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setErrorCarga('')
      try {
        const resultado = await repositorio.listarSesionesDe(usuarioId)
        if (activo) setSesiones(resultado.filter((sesion) => sesion.getSolicitante().getId() === usuarioId))
      } catch (error) {
        if (activo) setErrorCarga(error.message)
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [usuarioId, intento])

  function abrir(tipo, sesion) {
    setModal({ tipo, id: sesion.getId(), nombre: sesion.getTutor().getEstudiante().getNombre(), materia: sesion.getMateria().getNombre() })
    setMotivo('')
    setMotivoTocado(false)
    setPuntaje(0)
    setResena('')
    setResenaTocada(false)
    setErrorAccion('')
  }
  function cerrar() {
    if (!enviando) setModal(null)
  }
  const errorMotivo = motivo.trim().length >= 5 ? '' : 'Cuéntale al tutor por qué cancelas.'
  const errorResena = resena.trim().length <= 300 ? '' : 'La reseña debe tener como máximo 300 caracteres.'

  async function confirmarAccion() {
    if (enviando || !modal) return
    setErrorAccion('')
    if (modal.tipo === 'cancelar') {
      setMotivoTocado(true)
      if (errorMotivo) { motivoRef.current?.querySelector('textarea')?.focus(); return }
    } else {
      setResenaTocada(true)
      if (errorResena) { resenaRef.current?.querySelector('textarea')?.focus(); return }
    }
    setEnviando(true)
    try {
      // Se relee para que el modelo decida sobre el estado persistido más reciente.
      const actuales = await repositorio.listarSesionesDe(usuarioId)
      const sesion = actuales.find((item) => item.getId() === modal.id)
      if (!sesion) throw new Error('No encontramos esta sesión. Vuelve a cargar tus solicitudes.')
      if (modal.tipo === 'cancelar') sesion.cancelar(motivo.trim())
      else sesion.calificar(puntaje, resena.trim())
      await repositorio.guardarSesion(sesion)
      setModal(null)
      setAviso(modal.tipo === 'cancelar' ? 'Tutoría cancelada.' : 'Gracias, tu calificación quedó guardada.')
      setIntento((anterior) => anterior + 1)
    } catch (error) {
      setErrorAccion(error.message)
    } finally {
      setEnviando(false)
    }
  }

  const proximas = sesiones.filter((sesion) => [EstadoSesion.PENDIENTE, EstadoSesion.CONFIRMADA].includes(sesion.getEstado())).sort((a, b) => a.getFecha() - b.getFecha())
  const historial = sesiones.filter((sesion) => [EstadoSesion.FINALIZADA, EstadoSesion.RECHAZADA, EstadoSesion.CANCELADA].includes(sesion.getEstado())).sort((a, b) => b.getFecha() - a.getFecha())
  const correo = INSTITUCION.canalesPermanencia[usuario.getSede()]
  return (
    <section className="ct-solicitante ct-mis-sesiones">
      <h1>Mis sesiones</h1><h2>Mis solicitudes</h2>
      <div role="status" className={aviso ? 'ct-aviso' : undefined}>{aviso}</div>
      {cargando ? <Cargando texto="Cargando solicitudes…" /> : errorCarga ? (
        <MensajeError mensaje={errorCarga} alReintentar={() => setIntento((anterior) => anterior + 1)} />
      ) : sesiones.length === 0 ? (
        <EstadoVacio icono="bi-calendar-event" titulo="Aún no has solicitado tutorías" texto="Busca un tutor y elige un horario que te sirva." accion={{ etiqueta: 'Buscar tutores', ruta: '/tutores' }} />
      ) : [{ titulo: 'Próximas', lista: proximas }, { titulo: 'Historial', lista: historial }].filter((grupo) => grupo.lista.length).map((grupo) => (
        <section key={grupo.titulo} className="ct-grupo-sesiones"><h3>{grupo.titulo}</h3><div className="ct-lista-sesiones">{grupo.lista.map((sesion) => {
          const estado = sesion.getEstado()
          const calificacion = sesion.getCalificacion()
          return <ItemSesion key={sesion.getId()} nombre={sesion.getTutor().getEstudiante().getNombre()} materia={sesion.getMateria().getNombre()} fecha={formatearFecha(sesion.getFecha())} franja={`${sesion.getFranja().getHoraInicio()}–${sesion.getFranja().getHoraFin()}`} estado={estado}>
            {[EstadoSesion.PENDIENTE, EstadoSesion.CONFIRMADA].includes(estado) && <Boton variante="secundario" alHacerClic={() => abrir('cancelar', sesion)}>Cancelar</Boton>}
            {estado === EstadoSesion.FINALIZADA && (calificacion ? <p>Calificaste con {calificacion.getPuntaje()} de 5</p> : <Boton alHacerClic={() => abrir('calificar', sesion)}>Calificar</Boton>)}
            {[EstadoSesion.RECHAZADA, EstadoSesion.CANCELADA].includes(estado) && sesion.getMotivo() && <p className="ct-texto-secundario">Motivo: {sesion.getMotivo()}</p>}
          </ItemSesion>
        })}</div></section>
      ))}
      <p className="ct-apoyo">¿Necesitas apoyo de la universidad? Escribe al Área de Permanencia de tu sede: <a href={`mailto:${correo}`}>{correo}</a></p>
      <Modal abierto={modal?.tipo === 'cancelar'} titulo="Cancelar tutoría" alCerrar={cerrar} pie={<>
        <Boton variante="secundario" alHacerClic={cerrar} deshabilitado={enviando}>Volver</Boton>
        <Boton alHacerClic={confirmarAccion} cargando={enviando}>Cancelar tutoría</Boton>
      </>}>
        <div ref={motivoRef} onBlur={() => setMotivoTocado(true)}>
          <CampoFormulario etiqueta="Motivo" tipo="textarea" valor={motivo} alCambiar={setMotivo} obligatorio deshabilitado={enviando} error={motivoTocado ? errorMotivo : ''} ayuda="Cuéntale al tutor por qué cancelas." />
        </div>
        {errorAccion && <MensajeError mensaje={errorAccion} />}
      </Modal>
      <Modal abierto={modal?.tipo === 'calificar'} titulo="Calificar tutoría" alCerrar={cerrar} pie={<>
        <Boton variante="secundario" alHacerClic={cerrar} deshabilitado={enviando}>Volver</Boton>
        <Boton alHacerClic={confirmarAccion} cargando={enviando}>Enviar calificación</Boton>
      </>}>
        <p>{modal?.nombre} · {modal?.materia}</p>
        <fieldset className="ct-selector-contenedor" disabled={enviando}>
          <legend className="visually-hidden">Puntaje de la tutoría</legend>
          <BloqueCalificacion editable tamano="grande" valor={puntaje} alCambiar={setPuntaje} />
        </fieldset>
        <div ref={resenaRef} onBlur={() => setResenaTocada(true)}>
          <CampoFormulario etiqueta="Reseña (opcional)" tipo="textarea" valor={resena} alCambiar={setResena} deshabilitado={enviando} error={resenaTocada ? errorResena : ''} ayuda="Máximo 300 caracteres." />
        </div>
        {errorAccion && <MensajeError mensaje={errorAccion} />}
      </Modal>
    </section>
  )
}

import { formatearMoneda } from '../componentes/ui/moneda.js'
// Muestra la solicitud y cancela sobre el estado persistido más reciente.
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { useEscritorio } from '../hooks/useEscritorio.js'
import { useSesion } from '../hooks/useSesion.js'
import { EstadoSesion } from '../modelo/enums.js'
import { repositorio } from '../servicios/instancias.js'
import { formatearFechaBreve } from '../componentes/ui/fechaBreve.js'
import { enlaceGoogleCalendar } from '../servicios/calendario.js'
import ChipEstado from '../componentes/ui/ChipEstado.jsx'
import Boton from '../componentes/ui/Boton.jsx'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'
import '../estilos/solicitante.css'
import EncuestaCancelacion from '../componentes/sesiones/EncuestaCancelacion.jsx'
import { revisarEncuesta, textoEncuesta } from '../servicios/motivosCancelacion.js'

/** @returns {import('react').ReactElement} Detalle protegido de una sesión. */
export default function DetalleSesion() {
  useTituloPagina('Detalle de solicitud')
  const { id } = useParams()
  const { usuario } = useAutenticacion()
  const escritorio = useEscritorio()
  const tableta = useEscritorio(768) && !escritorio
  const { sesion, cargando, error, reintentar } = useSesion(id, usuario.getId())
  const [parametros, setParametros] = useSearchParams()
  const abierto = parametros.has('cancelar')
  function setAbierto(valor) { setParametros(valor ? { cancelar:sesion.getEstado() === EstadoSesion.CONFIRMADA ? 'confirmada' : 'pendiente' } : {}, { replace:true }); window.scrollTo(0, 0) }
  const [encuesta, setEncuesta] = useState({ motivos: [], otro: '' })
  const [enviando, setEnviando] = useState(false)
  const [errorAccion, setErrorAccion] = useState('')
  const [aviso, setAviso] = useState('')
  async function cancelar() {
    if (enviando) return
    setErrorAccion('')
    const problema = revisarEncuesta(encuesta)
    if (problema) { setErrorAccion(problema); return }
    setEnviando(true)
    try {
      const actuar = async () => {
        const actuales = await repositorio.listarSesionesDe(usuario.getId())
        const actual = actuales.find((item) => item.getId() === id)
        if (!actual) throw new Error('No encontramos esta sesión.')
        const eraConfirmada = actual.getEstado() === EstadoSesion.CONFIRMADA
        actual.cancelar(textoEncuesta(encuesta))
        await repositorio.guardarSesion(actual, { encuesta })
        return eraConfirmada
      }
      const eraConfirmada = navigator.locks?.request ? await navigator.locks.request(`ct-sesion-${id}`, actuar) : await actuar()
      setParametros({ resultado:eraConfirmada ? 'sesion' : 'solicitud' }, { replace:true })
      setAviso(eraConfirmada ? 'Sesión cancelada.' : 'Solicitud cancelada.'); reintentar(); window.scrollTo(0, 0)
    } catch (fallo) { setErrorAccion(fallo.message) }
    finally { setEnviando(false) }
  }
  if (cargando) return <Cargando texto="Cargando solicitud…" />
  if (error) return <MensajeError mensaje={error} alReintentar={reintentar} forma="perfil" />
  if (!sesion) return <EstadoVacio icono="bi-calendar-event" titulo="No encontramos esta solicitud" accion={{ etiqueta:'Mis sesiones', ruta:'/sesiones' }} />
  const solicitante = sesion.getSolicitante().getId() === usuario.getId()
  const persona = solicitante ? sesion.getTutor().getEstudiante() : sesion.getSolicitante()
  const mutable = [EstadoSesion.PENDIENTE, EstadoSesion.CONFIRMADA].includes(sesion.getEstado())
  const confirmada = sesion.getEstado() === EstadoSesion.CONFIRMADA
  const aMinutos = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3))
  const horas = (aMinutos(sesion.getFranja().getHoraFin()) - aMinutos(sesion.getFranja().getHoraInicio())) / 60
  const tarifa = sesion.getTutor().getTarifaHora()
  if (solicitante && parametros.get('resultado') === 'enviada' && sesion.getEstado() === EstadoSesion.PENDIENTE) {
    if (tableta) return <section className="ct-confirmacion-solicitud-tablet">
        <ChipEstado estado={EstadoSesion.PENDIENTE} />
        <h1>
        {persona.getNombre().split(' ')[0]} recibió tu solicitud
      </h1>
        <p className="ct-texto-secundario">Revisa los datos antes de enviar la solicitud.
      </p>
        <div className="ct-dato">
            <small>Tu solicitud
        </small>
        {sesion.getMateria().getNombre()}, {formatearFechaBreve(sesion.getFecha())}, {sesion.getFranja().getHoraInicio()}–{sesion.getFranja().getHoraFin()}
      </div>
        <Link className="ct-boton btn-ct-primario" to="/tutores">Volver a buscar
      </Link>
      </section>
    return <section className="ct-estado-formulario">
        <span className="ct-paso">Pendiente de respuesta
      </span>
        <h1>Tu solicitud quedó pendiente
      </h1>
        <p className="ct-texto-secundario">
        {persona.getNombre().split(' ')[0]} podrá aceptar o rechazar tu solicitud. Puedes consultar su respuesta en Mis sesiones.
      </p>
        <div className="ct-dato">
            <small>Tutor y materia
        </small>
        {persona.getNombre()}, {sesion.getMateria().getNombre()}
      </div>
        <div className="ct-dato">
            <small>Fecha y horario
        </small>
        {formatearFechaBreve(sesion.getFecha())}, {sesion.getFranja().getHoraInicio()}–{sesion.getFranja().getHoraFin()}
      </div>
        <div className="ct-dato">
            <small>Tema
        </small>
        {sesion.getTema()}
      </div>
        <div className="ct-dato">
            <small>Tarifa
        </small>
        {tarifa === null ? `Tutoría gratuita, ${horas} horas` : `${horas} horas × ${formatearMoneda(tarifa)}/h`}
      </div>
        <div className="ct-estado-formulario-acciones">
            <Link className="ct-boton btn-ct-primario" to={`/tutores/${sesion.getTutor().getId()}`}>Volver al perfil
        </Link>
            <Link className="ct-boton btn-ct-secundario" to="/tutores">Buscar otros tutores
        </Link>
          </div>
      </section>
  }
  if (sesion.getEstado() === EstadoSesion.CANCELADA && (aviso || parametros.has('resultado'))) {
    if (parametros.get('resultado') === 'solicitud') return <section className="ct-solicitud-cancelada">
        <ChipEstado estado={EstadoSesion.CANCELADA} />
        <h1>Solicitud cancelada
      </h1>
        <p>
        {persona.getNombre()}, {sesion.getMateria().getNombre()}
      </p>
        <p className="ct-texto-secundario">
        {formatearFechaBreve(sesion.getFecha())}, {sesion.getFranja().getHoraInicio()}–{sesion.getFranja().getHoraFin()}
      </p>
        <p>Motivo: {sesion.getMotivo()}
      </p>
        <Link className="ct-boton btn-ct-primario" to={`/tutores/${sesion.getTutor().getId()}/solicitar`}>Buscar otro horario
      </Link>
      </section>
    return <section className="ct-estado-formulario">
        <span className="ct-confirmacion-etiqueta ct-etiqueta-error">Cancelación confirmada
      </span>
        <h1>La sesión quedó cancelada
      </h1>
        <p className="ct-texto-secundario" role="status">La sesión quedó cancelada. Ambas partes pueden consultar el motivo.
      </p>
        <div className="ct-dato">
            <small>Estado de la sesión
        </small>Cancelada
      </div>
        <div className="ct-dato">
            <small>Motivo
        </small>
        {sesion.getMotivo()}
      </div>
        <div className="ct-estado-formulario-acciones">
            <Link className="ct-boton btn-ct-primario" to={solicitante ? '/sesiones?estado=finalizadas' : '/solicitudes'}>Volver a mis sesiones
        </Link>
          </div>
      </section>
  }
  if (abierto && mutable) return <section className={`ct-estado-formulario${confirmada ? '' : ' ct-cancelar-pendiente'}`}>
    {confirmada && <span className="ct-confirmacion-etiqueta">Sesión confirmada</span>}
    <h1>{confirmada ? solicitante ? `¿Cancelar tu tutoría con ${persona.getNombre().split(' ')[0]}?` : 'Cancela una sesión confirmada' : '¿Cambió tu disponibilidad?'}</h1>
    <p className="ct-texto-secundario">
      {confirmada ? solicitante ? `La sesión está confirmada. ${persona.getNombre().split(' ')[0]} podrá consultar el motivo cuando canceles.` : `Vista de ${usuario.getNombre()}. ${persona.getNombre().split(' ')[0]} podrá consultar el motivo de la cancelación.` : 'Tu tutor podrá ver el motivo de la cancelación.'}
    </p>
    {confirmada && 
    <>
        <div className="ct-dato">
            <small>
          {solicitante ? 'Tutor y materia' : 'Solicitante y materia'}
        </small>
        {persona.getNombre()}, {sesion.getMateria().getNombre()}
      </div>
        <div className="ct-dato">
            <small>Horario confirmado
        </small>
        {formatearFechaBreve(sesion.getFecha())}, {sesion.getFranja().getHoraInicio()}–{sesion.getFranja().getHoraFin()}
      </div>
      </>}
    <EncuestaCancelacion valor={encuesta} alCambiar={(valor) => { setEncuesta(valor); setErrorAccion('') }} deshabilitado={enviando} error={errorAccion} />
    <div className="ct-estado-formulario-acciones">
        <Boton anchoCompleto cargando={enviando} alHacerClic={cancelar}>Confirmar cancelación
      </Boton>
        <Boton anchoCompleto variante="secundario" deshabilitado={enviando} alHacerClic={() => setAbierto(false)}>
        {confirmada ? solicitante ? 'Conservar sesión' : 'Conservar sesión y volver' : 'Conservar solicitud'}
      </Boton>
      </div>
  </section>
  return <section className="ct-detalle-sesion">
    <ChipEstado estado={sesion.getEstado()} />
    <h1>{sesion.getMateria().getNombre()}</h1><h2>{persona.getNombre()}</h2>
    <p>{formatearFechaBreve(sesion.getFecha())}, {sesion.getFranja().getHoraInicio()}–{sesion.getFranja().getHoraFin()}</p>
    {confirmada && <strong className="ct-tarifa ct-tarifa-confirmada">{tarifa === null ? 'Tutoría gratuita' : 'Tarifa informativa: ' + formatearMoneda(tarifa * horas)}</strong>}
    <p>{sesion.getTema()}</p>
    {!confirmada && <strong className="ct-tarifa">{horas} horas, {tarifa === null ? 'Tutoría gratuita' : 'Tarifa informativa: ' + formatearMoneda(tarifa * horas)}</strong>}
    {confirmada && persona.getCorreo() && <div className="ct-dato"><small>Correo para acordar el lugar o el enlace</small>
      <a href={`mailto:${persona.getCorreo()}`}>{persona.getCorreo()}</a></div>}
    {sesion.getMotivo() && <div className="ct-dato"><small>Motivo</small>{sesion.getMotivo()}</div>}
    {sesion.getCalificacion() && <p>Calificaste con {sesion.getCalificacion().getPuntaje()} de 5</p>}
    {confirmada && <a className="ct-boton btn-ct-primario" target="_blank" rel="noreferrer" href={enlaceGoogleCalendar({
      fecha: sesion.getFecha(), horaInicio: sesion.getFranja().getHoraInicio(), horaFin: sesion.getFranja().getHoraFin(),
      materia: sesion.getMateria().getNombre(), persona: persona.getNombre(), tema: sesion.getTema(),
    })}><i className="bi bi-calendar-plus" aria-hidden="true" />Añadir a Google Calendar<span className="visually-hidden"> (se abre en otra pestaña)</span></a>}
    {confirmada && <Link className="ct-boton btn-ct-secundario" to={`/sesiones/${id}/reprogramar`}>Proponer otro horario</Link>}
    {mutable && 
    <Boton variante="secundario" anchoCompleto alHacerClic={() => { setErrorAccion(''); setAbierto(true) }}>
      {sesion.getEstado() === EstadoSesion.CONFIRMADA ? 'Cancelar sesión' : 'Cancelar solicitud'}
    </Boton>}
    {solicitante && sesion.getEstado() === EstadoSesion.FINALIZADA && !sesion.getCalificacion() && 
    <Link className="ct-boton btn-ct-primario" to={`/sesiones/${id}/calificar`}>Calificar
    </Link>}
    <Link className="ct-boton btn-ct-secundario" to={solicitante ? '/sesiones' : '/solicitudes'}>Volver a mis sesiones</Link>
  </section>
}


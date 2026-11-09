// Presenta las solicitudes propias por estado y enlaza sus acciones.
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAutenticacion } from '../../contexto/useAutenticacion.js'
import { EstadoSesion } from '../../modelo/enums.js'
import { repositorio } from '../../servicios/instancias.js'
import { formatearFechaBreve } from '../../componentes/ui/fechaBreve.js'
import ItemSesion from '../../componentes/ui/ItemSesion.jsx'
import ChipEstado from '../../componentes/ui/ChipEstado.jsx'
import Cargando from '../../componentes/ui/Cargando.jsx'
import MensajeError from '../../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../../componentes/ui/EstadoVacio.jsx'

/** @returns {import('react').ReactElement} Pestañas, tarjetas y tabla de sesiones. */
export default function MisSolicitudes({ aviso = '' }) {
  const { usuario } = useAutenticacion()
  const usuarioId = usuario.getId()
  const [sesiones, setSesiones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  const [parametros, setParametros] = useSearchParams()
  const estados = ['pendientes', 'confirmadas', 'finalizadas']
  const seleccion = estados.includes(parametros.get('estado')) ? parametros.get('estado') : 'pendientes'
  const grupos = { pendientes:[EstadoSesion.PENDIENTE], confirmadas:[EstadoSesion.CONFIRMADA], finalizadas:[EstadoSesion.FINALIZADA, EstadoSesion.RECHAZADA, EstadoSesion.CANCELADA] }
  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true); setError('')
      try {
        const resultado = await repositorio.listarSesionesDe(usuarioId)
        if (activo) setSesiones(resultado.filter((sesion) => sesion.getSolicitante().getId() === usuarioId))
      } catch (fallo) { if (activo) setError(fallo.message) }
      finally { if (activo) setCargando(false) }
    }
    cargar()
    return () => { activo = false }
  }, [usuarioId, intento])
  function cambiar(estado) {
    setParametros((anteriores) => { const nuevos = new URLSearchParams(anteriores); nuevos.set('estado', estado); return nuevos })
  }
  function flechas(evento) {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(evento.key)) return
    evento.preventDefault()
    const indice = estados.indexOf(seleccion)
    const siguiente = evento.key === 'Home' ? 0 : evento.key === 'End' ? 2 : (indice + (evento.key === 'ArrowLeft' ? 2 : 1)) % 3
    cambiar(estados[siguiente])
    evento.currentTarget.querySelectorAll('[role="tab"]')[siguiente]?.focus()
  }
  if (cargando) return <Cargando texto="Cargando solicitudes…" />
  if (error) return <MensajeError mensaje={error} alReintentar={() => setIntento((valor) => valor + 1)} />
  if (!sesiones.length) return <section className="ct-primera-sesion">
      <i className="bi bi-calendar-event" aria-hidden="true" />
      <h1>Tu primera tutoría te espera.
    </h1>
      <p>Encuentra un tutor, elige un horario y cuéntale qué necesitas aprender.
    </p>
      <Link className="ct-boton btn-ct-primario ct-boton-completo" to="/tutores">Buscar tutores
    </Link>
    </section>
  const lista = sesiones.filter((sesion) => grupos[seleccion].includes(sesion.getEstado())).sort((a,b) => seleccion === 'finalizadas' ? b.getFecha() - a.getFecha() : a.getFecha() - b.getFecha())
  function accion(sesion) {
    return sesion.getEstado() === EstadoSesion.FINALIZADA && !sesion.getCalificacion() ? 
    <Link className="ct-boton btn-ct-primario" to={`/sesiones/${sesion.getId()}/calificar`}>Calificar
    </Link>
      : sesion.getCalificacion() ? <Link className="ct-boton btn-ct-primario" to={`/sesiones/${sesion.getId()}/promedio`}>Calificación publicada</Link>
        : 
        <Link className="ct-enlace-texto" to={`/sesiones/${sesion.getId()}${sesion.getEstado() === EstadoSesion.CONFIRMADA ? '?estado=confirmada' : ''}`}>
          {sesion.getEstado() === EstadoSesion.PENDIENTE ? 'Por confirmar' : sesion.getEstado() === EstadoSesion.CONFIRMADA ? 'Sesión confirmada' : 'Ver solicitud'}
        </Link>
  }
  return <section className="ct-sesiones-propias">
    <div className="ct-sesiones-movil">
      <div role="tablist" aria-label="Estado de sesiones" className="ct-tabs-estado" onKeyDown={flechas}>
        {estados.map((estado) => <button
          key={estado}
          id={`tab-${estado}`}
          role="tab"
          type="button"
          aria-selected={seleccion === estado}
          aria-controls="panel-sesiones"
          tabIndex={seleccion === estado ? 0 : -1}
          onClick={() => cambiar(estado)}>
          {estado[0].toUpperCase() + estado.slice(1)}
        </button>)}
      </div>
      {aviso.startsWith('Calificación publicada') && <div role="status" className="ct-aviso"><strong>Tu calificación se publicó.</strong><p>Gracias por compartir tu experiencia.</p></div>}
      <div role="tabpanel" id="panel-sesiones" aria-labelledby={`tab-${seleccion}`}>
        <h2>
          {seleccion === 'pendientes' ? 'Pendiente de respuesta' : seleccion === 'confirmadas' ? lista.length === 1 ? 'Tu próxima tutoría' : 'Tus próximas tutorías' : 'Tu historial de aprendizaje'}
        </h2>
        {lista.length ? 
        <div className="ct-lista-sesiones">
          {lista.map((sesion) => <ItemSesion
            key={sesion.getId()}
            nombre={sesion.getTutor().getEstudiante().getNombre()}
            materia={sesion.getMateria().getNombre()}
            fecha={formatearFechaBreve(sesion.getFecha())}
            franja={`${sesion.getFranja().getHoraInicio()}–${sesion.getFranja().getHoraFin()}`}
            estado={sesion.getEstado()}>
          {sesion.getEstado() !== EstadoSesion.FINALIZADA && 
          <Link
            className="ct-boton btn-ct-secundario ct-boton-completo"
            to={`/sesiones/${sesion.getId()}${sesion.getEstado() === EstadoSesion.CONFIRMADA ? '?estado=confirmada' : ''}`}>Ver solicitud
          </Link>}
          {sesion.getEstado() === EstadoSesion.FINALIZADA && (sesion.getCalificacion() ? <span className="ct-confirmacion-etiqueta">Calificación enviada</span> : accion(sesion))}
        </ItemSesion>)}
        </div> : 
        <EstadoVacio
          icono="bi-calendar-event"
          titulo="No tienes sesiones todavía"
          texto="Busca un tutor y elige un horario que te sirva."
          accion={{ etiqueta:'Buscar un tutor', ruta:'/tutores' }} />}
      </div>
      {aviso && !aviso.startsWith('Calificación publicada') && <p role="status" className="ct-texto-secundario ct-aviso-solicitud">{aviso}</p>}
      {seleccion === 'confirmadas' && lista.length > 0 && <p className="ct-texto-secundario ct-aviso-solicitud">Tu tutor aceptó la solicitud. Revisa los detalles antes de la sesión.</p>}
      {seleccion === 'finalizadas' && 
      <>
          <p className="ct-texto-secundario ct-aviso-solicitud">Solo puedes calificar las sesiones que ya terminaron.
        </p>
        {lista.some((sesion) => sesion.getCalificacion()) && 
        <Link
          className="ct-boton btn-ct-secundario ct-boton-completo ct-enlace-promedio"
          to={`/sesiones/${lista.find((sesion) => sesion.getCalificacion()).getId()}/promedio`}>Ver cómo se calcula el promedio
        </Link>}
      </>}
    </div>
    <div className="ct-sesiones-escritorio">
      {aviso && !aviso.startsWith('Calificación publicada') && <div role="status" className="ct-aviso">{aviso}</div>}
      {sesiones.length ? 
      <div className="ct-tabla-contenedor">
          <table className="ct-tabla-sesiones">
              <caption className="visually-hidden">Mis sesiones en todos los estados
          </caption>
              <thead>
                  <tr>
              {['Tutor','Materia','Fecha','Horario','Estado','Acción'].map((texto) => <th scope="col" key={texto}>
                {texto}
              </th>)}
            </tr>
                </thead>
              <tbody>
            {sesiones.map((sesion) => <tr key={sesion.getId()}>
                      <th scope="row">
                          <Link to={`/sesiones/${sesion.getId()}${sesion.getEstado() === EstadoSesion.CONFIRMADA ? '?estado=confirmada' : ''}`}>
                  {sesion.getTutor().getEstudiante().getNombre()}
                </Link>
                        </th>
                      <td>
                {sesion.getMateria().getNombre()}
              </td>
                      <td>
                {formatearFechaBreve(sesion.getFecha())}
              </td>
                      <td>
                {sesion.getFranja().getHoraInicio()}–{sesion.getFranja().getHoraFin()}
              </td>
                      <td>
                          <ChipEstado estado={sesion.getEstado()} />
                        </td>
                      <td>
                {accion(sesion)}
              </td>
                    </tr>)}
          </tbody>
            </table>
        </div> : 
      <EstadoVacio icono="bi-calendar-event" titulo="No tienes sesiones todavía" accion={{ etiqueta:'Buscar un tutor', ruta:'/tutores' }} />}
      <p>Las calificaciones están disponibles únicamente para sesiones finalizadas.</p>
      <Link className="ct-boton btn-ct-secundario" to="/tutores">Buscar otra tutoría</Link>
    </div>
  </section>
}


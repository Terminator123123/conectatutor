// Resume las sesiones que atiende el tutor y enlaza su gestión real.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EstadoSesion } from '../../modelo/enums.js'
import { repositorio } from '../../servicios/instancias.js'
import { formatearFechaBreve } from '../../componentes/ui/fechaBreve.js'
import Cargando from '../../componentes/ui/Cargando.jsx'
import MensajeError from '../../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../../componentes/ui/EstadoVacio.jsx'

/** @param {{perfil: import('../../modelo/PerfilTutor.js').default}} props Perfil propio del tutor.
 * @returns {import('react').ReactElement} Historial y accesos a la sesión confirmada. */
export default function ResumenSesionesTutor({ perfil }) {
  const [sesiones, setSesiones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  const perfilId = perfil.getId()
  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true); setError('')
      try { const lista = await repositorio.listarSesionesDelTutor(perfilId); if (activo) setSesiones(lista) }
      catch (fallo) { if (activo) setError(fallo.message) }
      finally { if (activo) setCargando(false) }
    }
    cargar()
    return () => { activo = false }
  }, [perfilId, intento])
  if (cargando) return <Cargando texto="Cargando tus tutorías…" />
  if (error) return <MensajeError mensaje={error} alReintentar={() => setIntento((valor) => valor + 1)} />
  const lista = sesiones.filter((sesion) => sesion.getEstado() !== EstadoSesion.PENDIENTE).sort((a, b) => {
    const diferencia = Number(b.getEstado() === EstadoSesion.CONFIRMADA) - Number(a.getEstado() === EstadoSesion.CONFIRMADA)
    return diferencia || b.getFecha() - a.getFecha()
  })
  const confirmada = lista.find((sesion) => sesion.getEstado() === EstadoSesion.CONFIRMADA)
  return <section className="ct-estado-formulario">
    <h1>Tus sesiones como tutor</h1><p className="ct-texto-secundario">{perfil.getEstudiante().getNombre()}, historial de tutorías.</p>
    {lista.length ? lista.map((sesion) => {
      const estado = sesion.getEstado()
      const partes = sesion.getSolicitante().getNombre().split(' ')
      const nombre = estado === EstadoSesion.FINALIZADA ? `${partes[0]} ${partes[1]?.[0] ?? ''}.` : sesion.getSolicitante().getNombre()
      return <Link key={sesion.getId()} className="ct-dato" to={`/sesiones/${sesion.getId()}`}>
          <small>
          {estado[0] + estado.slice(1).toLowerCase()}
        </small>
        {nombre}, {sesion.getMateria().getNombre()}, {formatearFechaBreve(sesion.getFecha(), false)}, {sesion.getFranja().getHoraInicio()}–{sesion.getFranja().getHoraFin()}
      </Link>
    }) : <EstadoVacio titulo="Aún no tienes sesiones" texto="Cuando aceptes una solicitud, podrás consultarla aquí." />}
    <div className="ct-estado-formulario-acciones">
      {confirmada && 
      <Link className="ct-boton btn-ct-primario" to={`/sesiones/${confirmada.getId()}?estado=confirmada`}>Ver sesión confirmada
      </Link>}
      <Link className="ct-boton btn-ct-secundario" to="/solicitudes">Ver solicitudes pendientes
      </Link>
      {confirmada && 
      <Link className="ct-boton btn-ct-secundario" to={`/sesiones/${confirmada.getId()}?cancelar=confirmada`}>Cancelar sesión confirmada
      </Link>}
    </div>
  </section>
}

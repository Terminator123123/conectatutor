// Deriva novedades de las sesiones de la cuenta sin avisos en tiempo real.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { EstadoSesion } from '../modelo/enums.js'
import { repositorio } from '../servicios/instancias.js'
import { formatearFechaBreve } from '../componentes/ui/fechaBreve.js'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'
import '../estilos/solicitante.css'

function derivarNovedades(sesiones, usuarioId) {
  return [...sesiones].sort((a, b) => b.getFecha() - a.getFecha()).map((sesion) => {
    const propia = sesion.getSolicitante().getId() === usuarioId
    const persona = propia ? sesion.getTutor().getEstudiante() : sesion.getSolicitante()
    const nombre = persona.getNombre().split(' ')[0]
    const estado = sesion.getEstado()
    const porCalificar = propia && estado === EstadoSesion.FINALIZADA && !sesion.getCalificacion()
    const textos = {
      [EstadoSesion.PENDIENTE]: propia
        ? [`Solicitud enviada a ${nombre}`, 'Sigue pendiente de respuesta.']
        : [`${nombre} te envió una solicitud`, 'Revisa el tema y responde desde Solicitudes.'],
      [EstadoSesion.CONFIRMADA]: propia
        ? [`${nombre} aceptó tu solicitud`, 'Horario confirmado.']
        : [`Tutoría confirmada con ${nombre}`, 'Revisa los detalles antes de la sesión.'],
      [EstadoSesion.RECHAZADA]: [`Solicitud rechazada con ${nombre}`, 'Puedes consultar el motivo en el detalle.'],
      [EstadoSesion.CANCELADA]: [`Sesión cancelada con ${nombre}`, 'Puedes consultar el motivo en el detalle.'],
      [EstadoSesion.FINALIZADA]: porCalificar
        ? [`Califica tu tutoría con ${nombre}`, 'Tu experiencia ayuda a otros estudiantes.']
        : [`Sesión finalizada con ${nombre}`, sesion.getCalificacion() ? 'La calificación ya está publicada.' : 'Aún sin calificar.'],
    }
    const [titulo, ayuda] = textos[estado]
    return {
      id: sesion.getId(), titulo, ayuda,
      detalle: `${sesion.getMateria().getNombre()}, ${formatearFechaBreve(sesion.getFecha())}, ${sesion.getFranja().getHoraInicio()}–${sesion.getFranja().getHoraFin()}`,
      ruta: porCalificar ? `/sesiones/${sesion.getId()}/calificar` : `/sesiones/${sesion.getId()}`,
      accion: porCalificar ? `Calificar a ${nombre}` : `Ver sesión de ${nombre}`,
    }
  })
}

/** @returns {import('react').ReactElement} Novedades calculadas desde sesiones reales. */
export default function Notificaciones() {
  useTituloPagina('Notificaciones')
  const { usuario } = useAutenticacion()
  const usuarioId = usuario.getId()
  const [novedades, setNovedades] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setError('')
      try {
        const sesiones = await repositorio.listarSesionesDe(usuarioId)
        if (activo) setNovedades(derivarNovedades(sesiones, usuarioId))
      } catch (fallo) {
        if (activo) setError(fallo.message)
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [usuarioId, intento])

  if (cargando) return <Cargando texto="Cargando novedades…" />
  if (error) return <MensajeError mensaje={error} alReintentar={() => setIntento((valor) => valor + 1)} />
  return (
    <section className="ct-estado-formulario ct-notificaciones">
      <span className="ct-chip-materia">{novedades.length} {novedades.length === 1 ? 'novedad' : 'novedades'}</span>
      <h1>Novedades de tus tutorías</h1>
      <p className="ct-demostracion">Simulación: estas novedades se derivan de tus sesiones; no se guardan ni se envían notificaciones.</p>
      <p className="ct-texto-secundario">Aquí verás los cambios en tus solicitudes y sesiones.</p>
      <div className="ct-notificaciones-lista">
      {novedades.length ? novedades.map((novedad) => (
        <article className="ct-notificacion" key={novedad.id}>
          <Link className="ct-dato" to={novedad.ruta}>
            <small>{novedad.titulo}</small>{novedad.detalle}
          </Link>
          <p className="ct-texto-secundario">{novedad.ayuda}</p>
        </article>
      )) : <EstadoVacio icono="bi-bell" titulo="No tienes novedades" texto="Cuando tengas una tutoría, verás sus cambios aquí." />}
      </div>
      <div className="ct-estado-formulario-acciones">
        {novedades.slice(0, 2).map((novedad, indice) => (
          <Link key={novedad.id} className={`ct-boton ${indice ? 'btn-ct-secundario' : 'btn-ct-primario'}`} to={novedad.ruta}>
            {novedad.accion}
          </Link>
        ))}
        {!novedades.length && <Link className="ct-boton btn-ct-primario" to="/sesiones">Ver mis sesiones</Link>}
      </div>
    </section>
  )
}

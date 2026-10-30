// Presenta la oferta, disponibilidad y reseñas anónimas de un tutor.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { repositorio } from '../servicios/instancias.js'
import { ETIQUETAS_DIA, formatearFecha, formatearFranja } from '../servicios/agenda.js'
import Avatar from '../componentes/ui/Avatar.jsx'
import BloqueCalificacion from '../componentes/ui/BloqueCalificacion.jsx'
import ChipEstado from '../componentes/ui/ChipEstado.jsx'
import ChipMateria from '../componentes/ui/ChipMateria.jsx'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'
import '../estilos/solicitante.css'

/** @returns {import('react').ReactElement} Perfil público de un tutor para estudiantes. */
export default function DetalleTutor() {
  const { id } = useParams()
  const { usuario } = useAutenticacion()
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setError('')
      try {
        const [perfil, sesiones] = await Promise.all([
          repositorio.obtenerPerfilTutor(id), repositorio.listarSesionesDelTutor(id),
        ])
        if (activo) setDatos({ perfil, sesiones })
      } catch (fallo) {
        if (activo) setError(fallo.message)
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [id, intento])
  if (cargando) return <Cargando texto="Cargando perfil…" />
  if (error) return <MensajeError mensaje={error} alReintentar={() => setIntento((anterior) => anterior + 1)} />
  if (!datos?.perfil) return <EstadoVacio icono="bi-person" titulo="No encontramos este tutor" texto="Vuelve a buscar un tutor que te acompañe." accion={{ etiqueta: 'Volver a la búsqueda', ruta: '/tutores' }} />

  const { perfil, sesiones } = datos
  const estudiante = perfil.getEstudiante()
  const propio = estudiante.getId() === usuario.getId()
  const puedeSolicitar = perfil.estaVerificado() && !propio
  const dias = Object.keys(ETIQUETAS_DIA)
  const franjas = [...perfil.getDisponibilidad()].sort((a, b) => dias.indexOf(a.getDia()) - dias.indexOf(b.getDia()) || a.getHoraInicio().localeCompare(b.getHoraInicio()))
  const calificaciones = sesiones.map((sesion) => sesion.getCalificacion()).filter(Boolean).sort((a, b) => b.getFecha() - a.getFecha())
  return (
    <article className={`ct-solicitante ct-detalle${puedeSolicitar ? ' ct-detalle-con-accion' : ''}`}>
      <Link className="ct-volver" to="/tutores">← Volver a la búsqueda</Link>
      <header className="ct-perfil-encabezado">
        <Avatar nombre={estudiante.getNombre()} tamano={72} />
        <div className="ct-perfil-identidad">
          <h1>{estudiante.getNombre()}</h1>
          <p>{estudiante.getPrograma().getNombre()} · {estudiante.getSemestre()}.º semestre · {estudiante.getSede()}</p>
          <BloqueCalificacion promedio={perfil.calcularPromedio(sesiones)} total={calificaciones.length} />
          <p className="ct-tarifa ct-tarifa-gratuita">Gratuita</p>
        </div>
        {puedeSolicitar && <div className="ct-perfil-accion"><Link className="ct-boton btn-ct-primario" to={`/tutores/${id}/solicitar`}>Solicitar tutoría</Link></div>}
        {propio && <p>Este es tu perfil de tutor.</p>}
      </header>
      {!perfil.estaVerificado() && <div><ChipEstado estado={perfil.getEstadoVerificacion()} /><p>Este tutor todavía no está verificado por Coordinación.</p></div>}
      <section><h2>Sobre mí</h2><p>{perfil.getBiografia()}</p></section>
      <section><h2>Materias</h2><div className="ct-lista-chips">{perfil.getMaterias().map((materia) => <ChipMateria key={materia.getId()} nombre={materia.getNombre()} />)}</div></section>
      <section><h2>Disponibilidad</h2>{franjas.length ? <ul>{franjas.map((franja, indice) => <li key={indice}>{formatearFranja(franja)}</li>)}</ul> : <p>Este tutor no tiene horarios disponibles.</p>}</section>
      <section><h2>Reseñas</h2>{calificaciones.length ? <ul className="ct-resenas">{calificaciones.map((calificacion) => (
        <li key={calificacion.getId()}><p><span aria-hidden="true">★ </span>{calificacion.getPuntaje()} de 5</p><p>{calificacion.getResena()}</p><p className="ct-texto-secundario">{formatearFecha(calificacion.getFecha())}</p></li>
      ))}</ul> : <p>Todavía no tiene reseñas.</p>}</section>
    </article>
  )
}

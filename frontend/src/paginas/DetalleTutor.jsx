import { formatearMoneda } from '../componentes/ui/moneda.js'
import { formatearFechaBreve } from '../componentes/ui/fechaBreve.js'
// Presenta al tutor, su oferta real y las opiniones con autor abreviado.
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { useEscritorio } from '../hooks/useEscritorio.js'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { repositorio } from '../servicios/instancias.js'
import { estaOcupadaEnAgenda, proximasOcurrencias } from '../servicios/agenda.js'
import Avatar from '../componentes/ui/Avatar.jsx'
import BloqueCalificacion from '../componentes/ui/BloqueCalificacion.jsx'
import Boton from '../componentes/ui/Boton.jsx'
import ChipEstado from '../componentes/ui/ChipEstado.jsx'
import ChipMateria from '../componentes/ui/ChipMateria.jsx'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'
import '../estilos/solicitante.css'


/** @returns {import('react').ReactElement} Perfil público de un tutor para estudiantes. */
export default function DetalleTutor({ tituloPagina }) {
  const { id } = useParams()
  const [parametros] = useSearchParams()
  const { usuario } = useAutenticacion()
  const escritorio = useEscritorio()
  const tableta = useEscritorio(768) && !escritorio
  const [datos, setDatos] = useState(null)
  const [favorito, setFavorito] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorFavorito, setErrorFavorito] = useState('')
  const [todasLasResenas, setTodasLasResenas] = useState(false)
  useTituloPagina(tituloPagina ?? datos?.perfil?.getEstudiante().getNombre() ?? 'Perfil del tutor')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  const usuarioId = usuario.getId()
  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true); setError(''); setTodasLasResenas(false)
      try {
        const [resumen, favoritos] = await Promise.all([
          repositorio.obtenerResumenTutor(id), repositorio.listarFavoritos(usuarioId),
        ])
        const ocupaciones = resumen.perfil.estaVerificado() ? await repositorio.obtenerOcupacionTutor(id) : []
        if (activo) { setDatos({ ...resumen, ocupaciones }); setFavorito(favoritos.includes(id)) }
      } catch (fallo) {
        if (activo) {
          if (fallo.status === 404) setDatos(null)
          else setError(fallo.message)
        }
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [id, intento, usuarioId])
  async function alternar() {
    if (guardando) return
    setGuardando(true); setErrorFavorito('')
    try {
      const lista = await repositorio.alternarFavorito(usuarioId, id)
      setFavorito(lista.includes(id))
    } catch (fallo) { setErrorFavorito(fallo.message) }
    finally { setGuardando(false) }
  }
  if (cargando) return <Cargando texto="Cargando perfil…" />
  if (error) return <MensajeError mensaje={error} alReintentar={() => setIntento((anterior) => anterior + 1)} />
  if (!datos?.perfil) return <EstadoVacio
    icono="bi-person"
    titulo="No encontramos este tutor"
    texto="Vuelve a buscar un tutor que te acompañe."
    accion={{ etiqueta:'Volver a la búsqueda', ruta:'/tutores' }} />
  const { perfil, promedio, totalCalificaciones, tutoriasCompletadas, resenas, ocupaciones } = datos
  const estudiante = perfil.getEstudiante()
  const propio = estudiante.getId() === usuarioId
  const puedeSolicitar = perfil.estaVerificado() && !propio && perfil.getDisponibilidad().length > 0 && perfil.getMaterias().length > 0
  const calificaciones = [...resenas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  const disponibilidad = perfil.getDisponibilidad().flatMap((franja) => proximasOcurrencias(franja)
    .filter(({ clave }) => !estaOcupadaEnAgenda(ocupaciones, franja, clave))
    .map((fecha) => ({ ...fecha, franja }))).sort((a,b) => a.fecha - b.fecha)
  const proximas = disponibilidad.slice(0,4)
  const tarifa = perfil.getTarifaHora()
  const titular = perfil.getBiografia().split(/(?<=[.!?])\s/)[0]
  const datosAcademicos = `${estudiante.getPrograma().getNombre()} · ${estudiante.getSemestre()}.º semestre · ${estudiante.getSede()}`
  const solicitar = <Link className="ct-boton btn-ct-primario ct-boton-completo" to={`/tutores/${id}/solicitar`}>Solicitar tutoría</Link>
  if (parametros.get('vista') === 'resumen') return <article className="ct-estado-formulario ct-resumen-perfil">
    <h1>{estudiante.getNombre()}</h1><p className="ct-texto-secundario">{estudiante.getPrograma().getNombre()}, {estudiante.getSemestre()}.º semestre. {titular}</p>
    <div className="ct-dato">
        <small>
        {calificaciones.length ? 'Valoración' : 'Experiencia en la plataforma'}
      </small>
      {totalCalificaciones ? `${promedio.toFixed(1)} de 5, ${totalCalificaciones} ${totalCalificaciones === 1 ? 'tutoría calificada' : 'tutorías calificadas'}` : `${tutoriasCompletadas} tutorías completadas, Aún sin reseñas`}
    </div>
    <div className="ct-dato">
        <small>Tarifa
      </small>
      {tarifa === null ? 'Tutoría gratuita' : formatearMoneda(tarifa) + ' por hora'}
    </div>
    <div className="ct-dato">
        <small>Disponibilidad
      </small>
      {proximas[0] ? `${formatearFechaBreve(proximas[0].fecha, false)}, ${proximas[0].franja.getHoraInicio()}–${proximas[0].franja.getHoraFin()}` : 'Sin franjas publicadas para los próximos días'}
    </div>
    <div className="ct-resumen-perfil-extra">
        <Link className="ct-boton btn-ct-secundario" to={`/tutores/${id}?completo=1`}>Ver perfil completo
      </Link>
      {!propio && 
      <Boton variante="secundario" anchoCompleto cargando={guardando} alHacerClic={alternar}>
        {favorito ? 'Guardado en favoritos' : 'Guardar en favoritos'}
      </Boton>}
    </div>
    {errorFavorito && 
    <MensajeError mensaje={errorFavorito} />}
    <div className="ct-estado-formulario-acciones">
      {puedeSolicitar && solicitar}
      <Link className={`ct-boton ${puedeSolicitar ? 'btn-ct-secundario' : 'btn-ct-primario'}`} to="/tutores">
        {puedeSolicitar ? 'Volver a buscar' : 'Ver otros tutores'}
      </Link>
      </div>
  </article>
  if (tableta) return <article className="ct-ficha-tutor-tablet">
    <header className="ct-ficha-nombre-tablet">
        <h1>
        {estudiante.getNombre()}
      </h1>
        <ChipEstado estado={perfil.getEstadoVerificacion()} />
      </header>
    <p className="ct-texto-secundario">
      {datosAcademicos}
    </p>
    <div className="ct-ficha-datos-tablet">
        <div className="ct-dato">
            <small>Valoración
        </small>
        {totalCalificaciones ? `${promedio.toFixed(1)} de 5, ${tutoriasCompletadas} ${tutoriasCompletadas === 1 ? 'tutoría completada' : 'tutorías completadas'}` : 'Tutor nuevo'}
      </div>
        <div className="ct-dato">
            <small>Tarifa
        </small>
        {tarifa === null ? 'Gratuita' : formatearMoneda(tarifa) + ' por hora'}
      </div>
      </div>
    <h2 className="ct-ficha-materias-tablet" title={perfil.getMaterias().map((materia) => materia.getNombre()).join(', ')}>
      {perfil.getMaterias().map((materia) => materia.getNombre()).join(', ') || 'Sin materias seleccionadas'}
    </h2>
    <p>
      {perfil.getBiografia()}
    </p>
    <div className="ct-dato">
        <small>Próxima disponibilidad
      </small>
      {proximas[0] ? `${formatearFechaBreve(proximas[0].fecha)}, ${proximas[0].franja.getHoraInicio()}–${proximas[0].franja.getHoraFin()}` : 'Este tutor no tiene horarios disponibles.'}
    </div>
    <div className="ct-acciones-perfil-tablet">
      {puedeSolicitar ? solicitar : propio ? 
      <Link className="ct-boton btn-ct-primario" to="/perfil">Editar mi perfil
      </Link> : 
      <Boton anchoCompleto deshabilitado>
        {perfil.estaVerificado() ? 'Sin horarios disponibles' : 'Perfil en revisión'}
      </Boton>}{!propio && 
      <Boton variante="secundario" anchoCompleto cargando={guardando} alHacerClic={alternar}>
        {favorito ? 'Guardado en favoritos' : 'Guardar en favoritos'}
      </Boton>}
    </div>
    {errorFavorito && 
    <MensajeError mensaje={errorFavorito} />}
    <details className="ct-informacion-perfil-tablet">
        <summary>Más información del perfil
      </summary>
        <h2>Materias
      </h2>
        <ul>
        {perfil.getMaterias().map((materia) => <li key={materia.getId()}>
          {materia.getNombre()}
        </li>)}
      </ul>
        <h2>Lo que dicen sus estudiantes
      </h2>
      {calificaciones.length ? 
      <ul className="ct-resenas">
        {calificaciones.map((calificacion, indice) => {
      return <li key={`${calificacion.fecha}-${calificacion.autor}-${indice}`}>
          <strong>
          {calificacion.autor}, {calificacion.puntaje}/5
        </strong>
          <p>
          {calificacion.resena}
        </p>
          <Link className="ct-enlace-texto" to={`/reportar?tipo=reseña&id=${id}&fecha=${encodeURIComponent(calificacion.fecha)}&autor=${encodeURIComponent(calificacion.autor)}`}>Reportar reseña
        </Link>
        </li>
    })}</ul> : <p>Todavía no tiene reseñas.</p>}<Link className="ct-enlace-texto" to={`/reportar?tipo=perfil&id=${id}`}>Reportar perfil</Link></details>
  </article>
  return <article className={`ct-solicitante ct-ficha-tutor${puedeSolicitar ? ' ct-detalle-con-accion' : ''}`}>
    <nav className="ct-migas" aria-label="Ruta de navegación"><Link to="/tutores">Tutores</Link> / {perfil.getMaterias()[0]?.getNombre()} / {estudiante.getNombre()}</nav>
    <div className="ct-ficha-composicion">
      <aside className="ct-ficha-identidad">
        <header className="ct-ficha-nombre">
            <Avatar nombre={estudiante.getNombre()} tamano={72} />
            <div>
                <h1>
              {estudiante.getNombre()}
            </h1>
                <p>
              {datosAcademicos}
            </p>
                <ChipEstado estado={perfil.getEstadoVerificacion()} />
              </div>
          </header>
        <div className="ct-ficha-valoracion">
            <BloqueCalificacion promedio={promedio} total={totalCalificaciones} />
            <strong className={`ct-tarifa${tarifa === null ? ' ct-tarifa-gratuita' : ''}`}>
            {tarifa === null ? 'Gratuita' : `${formatearMoneda(tarifa)}/h`}
          </strong>
          </div>
        {!propio && <Boton variante="secundario" anchoCompleto cargando={guardando} alHacerClic={alternar}>{favorito ? 'Guardado en favoritos' : 'Guardar en favoritos'}</Boton>}
        <div role="status" className="visually-hidden">{favorito ? 'Tutor guardado en tu lista.' : ''}</div>
        {errorFavorito && <MensajeError mensaje={errorFavorito} />}
        {puedeSolicitar && <div className="ct-ficha-accion-escritorio">{solicitar}<p>Tu solicitud se confirma cuando el tutor la acepta.</p></div>}
        {propio && <p>Este es tu perfil de tutor.</p>}
        {!perfil.estaVerificado() && <p>Este tutor todavía no está verificado por Coordinación.</p>}
      </aside>
      <div className="ct-ficha-contenido">
        <div className="ct-ficha-titular"><h1>{titular}</h1>{perfil.getBiografia().trim() !== titular.trim() && <p>{perfil.getBiografia()}</p>}</div>
        <section className="ct-ficha-materias">
            <h2>
            {escritorio ? 'Materias y horarios' : 'Materias'}
          </h2>
            <div className="ct-materias-lista">
            {perfil.getMaterias().map((materia) => <span key={materia.getId()}>
              {materia.getNombre()}
            </span>)}
          </div>
            <div className="ct-materias-escritorio">
            {perfil.getMaterias().map((materia) => <ChipMateria key={materia.getId()} nombre={materia.getNombre()} />)}
          </div>
          </section>
        <section className="ct-ficha-biografia"><h2>Sobre mí</h2><p>{perfil.getBiografia()}</p></section>
        <section>
          {!escritorio && 
          <h2>Próxima disponibilidad
          </h2>}{escritorio && proximas.length ? 
          <p className="ct-texto-secundario">
            {proximas.map(({ fecha, franja }) => `${formatearFechaBreve(fecha, false)}, ${franja.getHoraInicio()}–${franja.getHoraFin()}`).join(' / ')}
          </p> : proximas.length ? 
          <div className="ct-proximas">
            {proximas.map(({ clave, fecha, franja },indice) => <div key={`${clave}-${indice}`}>
                    <span>
                {formatearFechaBreve(fecha, false)}
              </span>
                    <p>
                {franja.getHoraInicio()}–{franja.getHoraFin()}
              </p>
                  </div>)}
          </div> : 
          <p>Este tutor no tiene horarios disponibles.
          </p>}
        </section>
        <section>
            <h2>
            {escritorio ? 'La experiencia de otros estudiantes' : 'Lo que dicen sus estudiantes'}
          </h2>
          {calificaciones.length ? 
          <ul className="ct-resenas">
            {(todasLasResenas ? calificaciones : calificaciones.slice(0,5)).map((calificacion, indice) => {
          return <li key={`${calificacion.fecha}-${calificacion.autor}-${indice}`}>
              <strong>
              {calificacion.autor}, {calificacion.puntaje}/5
            </strong>
              <p>
              {calificacion.resena}
            </p>
              <Link className="ct-enlace-texto" to={`/reportar?tipo=reseña&id=${id}&fecha=${encodeURIComponent(calificacion.fecha)}&autor=${encodeURIComponent(calificacion.autor)}`}>Reportar reseña
            </Link>
            </li>
        })}</ul> : <p>Todavía no tiene reseñas.</p>}
          {!todasLasResenas && calificaciones.length > 5 && <Boton variante="secundario" alHacerClic={() => setTodasLasResenas(true)}>Ver todas las reseñas ({calificaciones.length})</Boton>}
        </section>
        <Link className="ct-enlace-texto" to={`/reportar?tipo=perfil&id=${id}`}>Reportar perfil</Link>
      </div>
    </div>
    {puedeSolicitar && <div className="ct-perfil-accion">{solicitar}</div>}
  </article>
}


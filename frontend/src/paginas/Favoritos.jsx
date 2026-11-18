// Presenta los tutores guardados por el estudiante y permite quitarlos.
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { repositorio } from '../servicios/instancias.js'
import TarjetaTutor from '../componentes/ui/TarjetaTutor.jsx'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import '../estilos/solicitante.css'

/** @returns {import('react').ReactElement} Lista persistida y estado vacío de favoritos. */
export default function Favoritos() {
  useTituloPagina('Tutores favoritos')
  const { usuario } = useAutenticacion()
  const usuarioId = usuario.getId()
  const [, setParametros] = useSearchParams()
  const [tutores, setTutores] = useState([])
  const [recomendado, setRecomendado] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true); setError('')
      try {
        const [favoritos, perfiles] = await Promise.all([repositorio.listarFavoritos(usuarioId), repositorio.listarTutoresVerificados({})])
        const elegibles = perfiles.filter((perfil) => perfil.getEstudiante().getId() !== usuarioId)
        const resultado = await Promise.all(elegibles.filter((perfil) => favoritos.includes(perfil.getId())).map(async (perfil) => {
          const { promedio, totalCalificaciones } = await repositorio.obtenerResumenTutor(perfil.getId())
          const estudiante = perfil.getEstudiante()
          // Siempre al perfil completo, con su diseño; la vista resumida quedaba sin estilos.
          const ruta = `/tutores/${perfil.getId()}`
          return { id:perfil.getId(), usuarioId:estudiante.getId(), sede:estudiante.getSede(), nombre:estudiante.getNombre(), programa:estudiante.getPrograma().getNombre(), semestre:estudiante.getSemestre(), materias:perfil.getMaterias().map((materia) => materia.getNombre()), promedio, totalCalificaciones, tarifaHora:perfil.getTarifaHora(), ruta }
        }))
        if (activo) { setTutores(resultado); setParametros(resultado.length ? {} : { vacio:'1' }, { replace:true }); setRecomendado(elegibles[0] ? { nombre:elegibles[0].getEstudiante().getNombre(), ruta:`/tutores/${elegibles[0].getId()}` } : null) }
      } catch (fallo) { if (activo) setError(fallo.message) }
      finally { if (activo) setCargando(false) }
    }
    cargar()
    return () => { activo = false }
  }, [usuarioId, intento, setParametros])
  const [materia, setMateria] = useState('')
  async function quitar(id) {
    if (guardando) return
    setGuardando(true); setError('')
    try {
      await repositorio.quitarFavorito(usuarioId, id)
      const restantes = tutores.filter((tutor) => tutor.id !== id)
      setTutores(restantes)
      if (!restantes.some((tutor) => tutor.materias.includes(materia))) setMateria('')
      if (!restantes.length) { setParametros({ vacio:'1' }, { replace:true }); window.scrollTo(0, 0) }
    } catch (fallo) { setError(fallo.message) }
    finally { setGuardando(false) }
  }
  if (cargando) return <Cargando texto="Cargando favoritos…" />
  if (error && !tutores.length) return <MensajeError mensaje={error} alReintentar={() => setIntento((valor) => valor + 1)} forma="tarjetas" />
  // Filtro por materia: solo las que ofrecen los tutores guardados
  const materias = [...new Set(tutores.flatMap((tutor) => tutor.materias))].sort((a, b) => a.localeCompare(b, 'es'))
  const visibles = materia ? tutores.filter((tutor) => tutor.materias.includes(materia)) : tutores
  return <section className="ct-estado-formulario ct-favoritos">
    {tutores.length > 0 && <span className="ct-confirmacion-etiqueta">{tutores.length} {tutores.length === 1 ? 'tutor guardado' : 'tutores guardados'}</span>}
    <h1>{tutores.length ? 'Vuelve a quienes te ayudan' : 'Aún no tienes favoritos'}</h1>
    <p className="ct-texto-secundario">
      {tutores.length ? 'Filtra por materia o toca el corazón para quitar a un tutor.' : 'Toca el corazón de un tutor para guardarlo y encontrarlo aquí la próxima vez.'}
    </p>
    {error && <MensajeError mensaje={error} alReintentar={() => setIntento((valor) => valor + 1)} />}
    {materias.length > 1 && <div className="ct-filtro-materias-favoritos" role="group" aria-label="Filtrar favoritos por materia">
      <button type="button" className={`ct-filtro-chip${!materia ? ' ct-filtro-chip-activo' : ''}`} aria-pressed={!materia} onClick={() => setMateria('')}>Todas</button>
      {materias.map((nombre) => <button key={nombre} type="button" className={`ct-filtro-chip${materia === nombre ? ' ct-filtro-chip-activo' : ''}`} aria-pressed={materia === nombre} onClick={() => setMateria(nombre)}>{nombre}</button>)}
    </div>}
    {tutores.length > 0 && <p className="ct-conteo" aria-live="polite">{visibles.length} {visibles.length === 1 ? 'tutor' : 'tutores'}{materia ? ' de ' + materia : ''}</p>}
    <div className="ct-rejilla-favoritos">
      {visibles.map(({ id, ...tutor }) => <TarjetaTutor key={id} {...tutor} favorito guardando={guardando} alAlternarFavorito={() => quitar(id)} />)}
    </div>
    {!tutores.length && <div className="ct-estado-formulario-acciones">
      <Link className="ct-boton btn-ct-primario" to="/">Explorar tutores</Link>
      {recomendado && <Link className="ct-boton btn-ct-secundario" to={recomendado.ruta}>Ver perfil de {recomendado.nombre.split(' ')[0]}</Link>}
    </div>}
  </section>
}

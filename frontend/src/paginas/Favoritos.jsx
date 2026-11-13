// Presenta los tutores guardados por el estudiante y permite quitarlos.
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { repositorio } from '../servicios/instancias.js'
import TarjetaTutor from '../componentes/ui/TarjetaTutor.jsx'
import Boton from '../componentes/ui/Boton.jsx'
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
          const tipoResumen = !perfil.getDisponibilidad().length ? 'sin-horarios' : totalCalificaciones === 0 ? 'nuevo' : ''
          const ruta = `/tutores/${perfil.getId()}${tipoResumen ? '?vista=resumen&tipo=' + tipoResumen + '&nombre=' + encodeURIComponent(estudiante.getNombre().split(' ')[0]) : ''}`
          return { id:perfil.getId(), nombre:estudiante.getNombre(), programa:estudiante.getPrograma().getNombre(), semestre:estudiante.getSemestre(), materias:perfil.getMaterias().map((materia) => materia.getNombre()), promedio, totalCalificaciones, tarifaHora:perfil.getTarifaHora(), ruta }
        }))
        if (activo) { setTutores(resultado); setParametros(resultado.length ? {} : { vacio:'1' }, { replace:true }); setRecomendado(elegibles[0] ? { nombre:elegibles[0].getEstudiante().getNombre(), ruta:`/tutores/${elegibles[0].getId()}` } : null) }
      } catch (fallo) { if (activo) setError(fallo.message) }
      finally { if (activo) setCargando(false) }
    }
    cargar()
    return () => { activo = false }
  }, [usuarioId, intento, setParametros])
  async function quitar(id) {
    if (guardando) return
    setGuardando(true); setError('')
    try {
      await repositorio.quitarFavorito(usuarioId, id)
      setTutores((anteriores) => anteriores.filter((tutor) => tutor.id !== id))
      if (tutores.length === 1) { setParametros({ vacio:'1' }, { replace:true }); window.scrollTo(0, 0) }
    } catch (fallo) { setError(fallo.message) }
    finally { setGuardando(false) }
  }
  if (cargando) return <Cargando texto="Cargando favoritos…" />
  if (error && !tutores.length) return <MensajeError mensaje={error} alReintentar={() => setIntento((valor) => valor + 1)} />
  const primero = tutores[0]
  return <section className="ct-estado-formulario ct-favoritos">
    {primero && <span className="ct-confirmacion-etiqueta">{tutores.length} {tutores.length === 1 ? 'tutor guardado' : 'tutores guardados'}</span>}
    <h1>{primero ? 'Vuelve a quienes te ayudan' : 'Aún no tienes favoritos'}</h1>
    <p className="ct-texto-secundario">
      {primero ? `Tienes ${tutores.length === 1 ? 'un tutor guardado' : tutores.length + ' tutores guardados'}.` : 'Guarda un tutor desde su perfil para encontrarlo aquí la próxima vez.'}
    </p>
    {error && <MensajeError mensaje={error} alReintentar={() => setIntento((valor) => valor + 1)} />}
    <div className="ct-rejilla-favoritos">
      {tutores.map(({ id, ...tutor }) => <div key={id}>
            <TarjetaTutor {...tutor} />
        {tutores.length > 1 && 
        <Boton variante="secundario" anchoCompleto deshabilitado={guardando} alHacerClic={() => quitar(id)}>Quitar a {tutor.nombre.split(' ')[0]} de favoritos
        </Boton>}
      </div>)}
    </div>
    <div className="ct-estado-formulario-acciones">
      {primero ? 
      <>
            <Link className="ct-boton btn-ct-primario" to={primero.ruta}>Ver perfil de {primero.nombre.split(' ')[0]}
        </Link>
            <Boton variante="secundario" anchoCompleto cargando={guardando} alHacerClic={() => quitar(primero.id)}>Quitar de favoritos
        </Boton>
          </> : 
      <>
            <Link className="ct-boton btn-ct-primario" to="/tutores">Explorar tutores
        </Link>
        {recomendado && 
        <Link className="ct-boton btn-ct-secundario" to={recomendado.ruta}>Ver perfil de {recomendado.nombre.split(' ')[0]}
        </Link>}
      </>}
    </div>
  </section>
}

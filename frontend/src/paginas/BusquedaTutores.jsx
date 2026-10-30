import { useEffect, useState } from 'react'
import { INSTITUCION } from '../config/institucion.js'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { repositorio } from '../servicios/instancias.js'
import { ETIQUETAS_DIA } from '../servicios/agenda.js'
import BarraBusqueda from '../componentes/ui/BarraBusqueda.jsx'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import TarjetaTutor from '../componentes/ui/TarjetaTutor.jsx'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'
import '../estilos/solicitante.css'

const normalizar = (texto) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** @returns {import('react').ReactElement} Búsqueda de tutores verificados. */
export default function BusquedaTutores() {
  const { usuario } = useAutenticacion()
  const [filtros, setFiltros] = useState({ sede: usuario.getSede(), programaId: '', materiaId: '', dia: '' })
  const [busqueda, setBusqueda] = useState('')
  const [datos, setDatos] = useState({ programas: [], materias: [], tutores: [] })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  const usuarioId = usuario.getId()

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setError('')
      try {
        const [programas, materias, perfiles] = await Promise.all([
          repositorio.listarProgramas(), repositorio.listarMaterias(filtros.programaId || undefined),
          repositorio.listarTutoresVerificados(filtros),
        ])
        const tutores = await Promise.all(perfiles.filter((perfil) => perfil.getEstudiante().getId() !== usuarioId).map(async (perfil) => {
          const sesiones = await repositorio.listarSesionesDelTutor(perfil.getId())
          const estudiante = perfil.getEstudiante()
          return {
            id: perfil.getId(), nombre: estudiante.getNombre(), programa: estudiante.getPrograma().getNombre(),
            semestre: estudiante.getSemestre(), materias: perfil.getMaterias().map((materia) => materia.getNombre()),
            promedio: perfil.calcularPromedio(sesiones), totalCalificaciones: sesiones.filter((sesion) => sesion.getCalificacion() !== null).length,
            tarifaHora: perfil.getTarifaHora(), ruta: `/tutores/${perfil.getId()}`,
          }
        }))
        if (activo) setDatos({ programas, materias, tutores })
      } catch (fallo) {
        if (activo) setError(fallo.message)
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [filtros, usuarioId, intento])

  function cambiar(nombre, valor) {
    setFiltros((anteriores) => ({ ...anteriores, [nombre]: valor, ...(nombre === 'programaId' ? { materiaId: '' } : {}) }))
  }
  function quitarFiltros() {
    setFiltros({ sede: '', programaId: '', materiaId: '', dia: '' })
    setBusqueda('')
  }
  const texto = normalizar(busqueda.trim())
  const resultados = datos.tutores.filter((tutor) => normalizar([tutor.nombre, ...tutor.materias].join(' ')).includes(texto))
  const sede = filtros.sede || usuario.getSede()
  const correo = INSTITUCION.canalesPermanencia[sede]

  return (
    <section className="ct-solicitante">
      <h1>Buscar tutores</h1>
      <p>Solo aparecen tutores verificados por Coordinación.</p>
      <BarraBusqueda valor={busqueda} alCambiar={setBusqueda} alBuscar={() => {}} etiqueta="Buscar por tutor o materia" placeholder="Nombre del tutor o materia" />
      <form className="ct-filtros" onSubmit={(evento) => evento.preventDefault()} aria-label="Filtros de tutores">
        <CampoFormulario etiqueta="Sede" tipo="select" valor={filtros.sede} alCambiar={(valor) => cambiar('sede', valor)} opciones={[{ valor: '', etiqueta: 'Todas las sedes' }, ...INSTITUCION.sedes.map((valor) => ({ valor, etiqueta: valor }))]} />
        <CampoFormulario etiqueta="Programa" tipo="select" valor={filtros.programaId} alCambiar={(valor) => cambiar('programaId', valor)} opciones={[{ valor: '', etiqueta: 'Todos los programas' }, ...datos.programas.map((programa) => ({ valor: programa.getId(), etiqueta: programa.getNombre() }))]} />
        <CampoFormulario etiqueta="Materia" tipo="select" valor={filtros.materiaId} alCambiar={(valor) => cambiar('materiaId', valor)} opciones={[{ valor: '', etiqueta: 'Todas las materias' }, ...datos.materias.map((materia) => ({ valor: materia.getId(), etiqueta: materia.getNombre() }))]} />
        <CampoFormulario etiqueta="Día" tipo="select" valor={filtros.dia} alCambiar={(valor) => cambiar('dia', valor)} opciones={[{ valor: '', etiqueta: 'Cualquier día' }, ...Object.entries(ETIQUETAS_DIA).map(([valor, etiqueta]) => ({ valor, etiqueta }))]} />
      </form>
      {cargando ? <Cargando texto="Cargando tutores…" /> : error ? (
        <MensajeError mensaje={error} alReintentar={() => setIntento((anterior) => anterior + 1)} />
      ) : <>
        <p aria-live="polite">{resultados.length} {resultados.length === 1 ? 'tutor encontrado' : 'tutores encontrados'}</p>
        {resultados.length ? <div className="ct-rejilla-tutores">{resultados.map(({ id, ...tutor }) => <TarjetaTutor key={id} {...tutor} />)}</div> : (
          <EstadoVacio icono="bi-search" titulo="No hay tutores con esos filtros" texto={`Prueba con otra sede o escribe a Permanencia ${sede}: ${correo}`} accion={{ etiqueta: 'Quitar filtros', alHacerClic: quitarFiltros }} />
        )}
      </>}
    </section>
  )
}

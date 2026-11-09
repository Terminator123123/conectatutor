// Busca tutores verificados con filtros académicos, tarifa y valoración.
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { useEscritorio } from '../hooks/useEscritorio.js'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { INSTITUCION } from '../config/institucion.js'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { repositorio } from '../servicios/instancias.js'
import { ETIQUETAS_DIA, fechaEnColombia, proximasOcurrencias } from '../servicios/agenda.js'
import BarraBusqueda from '../componentes/ui/BarraBusqueda.jsx'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import TarjetaTutor from '../componentes/ui/TarjetaTutor.jsx'
import Avatar from '../componentes/ui/Avatar.jsx'
import Boton from '../componentes/ui/Boton.jsx'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import ResultadoBusquedaVacia from '../componentes/ui/ResultadoBusquedaVacia.jsx'
import Modal from '../componentes/ui/Modal.jsx'
import '../estilos/solicitante.css'

const normalizar = (texto) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** @param {{soloFavoritos?: boolean}} props Limita la lista a los favoritos del estudiante.
 * @returns {import('react').ReactElement} Búsqueda de tutores verificados. */
export default function BusquedaTutores({ soloFavoritos = false }) {
  useTituloPagina(soloFavoritos ? 'Tutores favoritos' : 'Buscar tutores')
  const { usuario } = useAutenticacion()
  const [parametros, setParametros] = useSearchParams()
  const escritorio = useEscritorio()
  const inicial = { sede: soloFavoritos ? '' : usuario.getSede(), programaId: '', materiaId: parametros.get('materia') ?? '', dia: '', tarifa: parametros.get('vista') === 'gratuitas' ? 'gratis' : '', valoracion: parametros.get('vista') === 'gratuitas' ? '4' : '', semana:'' }
  const [filtros, setFiltros] = useState(inicial)
  const [borrador, setBorrador] = useState(inicial)
  const [panelAbierto, setPanelAbierto] = useState(false)
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
        const [programas, materias, perfiles, favoritos] = await Promise.all([
          repositorio.listarProgramas(), repositorio.listarMaterias(),
          repositorio.listarTutoresVerificados(filtros), repositorio.listarFavoritos(usuarioId),
        ])
        const tutores = await Promise.all(perfiles.filter((perfil) => perfil.getEstudiante().getId() !== usuarioId && (!soloFavoritos || favoritos.includes(perfil.getId()))).map(async (perfil) => {
          const sesiones = await repositorio.listarSesionesDelTutor(perfil.getId())
          const estudiante = perfil.getEstudiante()
          const hoy = new Date(`${fechaEnColombia(new Date())}T12:00:00-05:00`)
          const finSemana = new Date(hoy.getTime() + ((7 - hoy.getUTCDay()) % 7) * 86400000)
          const tipoResumen = !perfil.getDisponibilidad().length ? 'sin-horarios' : !sesiones.some((sesion) => sesion.getCalificacion()) ? 'nuevo' : ''
          const ruta = `/tutores/${perfil.getId()}${tipoResumen ? '?vista=resumen&tipo=' + tipoResumen + '&nombre=' + encodeURIComponent(estudiante.getNombre().split(' ')[0]) : ''}`
          return {
            id: perfil.getId(), nombre: estudiante.getNombre(), programa: estudiante.getPrograma().getNombre(),
            semestre: estudiante.getSemestre(), materias: perfil.getMaterias().map((materia) => materia.getNombre()),
            promedio: perfil.calcularPromedio(sesiones), totalCalificaciones: sesiones.filter((sesion) => sesion.getCalificacion() !== null).length,
            tarifaHora: perfil.getTarifaHora(), ruta,
            disponibleEstaSemana:perfil.getDisponibilidad().some((franja) => proximasOcurrencias(franja).some(({ clave }) => clave <= fechaEnColombia(finSemana))),
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
  }, [filtros, usuarioId, intento, soloFavoritos])

  function cambiar(nombre, valor) {
    setBorrador((anteriores) => ({ ...anteriores, [nombre]: valor, ...(nombre === 'programaId' ? { materiaId: '' } : {}) }))
  }
  function quitarFiltros() {
    const vacios = { sede: '', programaId: '', materiaId: '', dia: '', tarifa: '', valoracion: '', semana:'' }
    setFiltros(vacios); setBorrador(vacios); setBusqueda(''); setPanelAbierto(false); setParametros({})
  }
  function elegirMateria(materiaId) {
    setBusqueda(datos.materias.find((materia) => materia.getId() === materiaId)?.getNombre() ?? '')
    setFiltros((anteriores) => ({ ...anteriores, materiaId }))
    setBorrador((anteriores) => ({ ...anteriores, materiaId }))
  }
  function abrirFiltros() {
    if (!panelAbierto && !filtros.tarifa && !filtros.valoracion && !filtros.semana) setBorrador((anterior) => ({ ...anterior, tarifa:'gratis' }))
    setPanelAbierto(!panelAbierto)
  }
  function filtroRapido(cambios) { const nuevos = { ...borrador, tarifa:'', valoracion:'', semana:'', ...cambios }; setFiltros(nuevos); setBorrador(nuevos); setPanelAbierto(false) }
  const texto = normalizar(busqueda.trim())
  const resultados = datos.tutores.filter((tutor) => normalizar([tutor.nombre, ...tutor.materias].join(' ')).includes(texto)
    && (!filtros.tarifa || (filtros.tarifa === 'gratis' ? tutor.tarifaHora === null : tutor.tarifaHora !== null))
    && (!filtros.valoracion || tutor.promedio >= Number(filtros.valoracion))
    && (!filtros.semana || tutor.disponibleEstaSemana))
  const sede = filtros.sede || usuario.getSede()
  const correo = INSTITUCION.canalesPermanencia[sede]
  const materiaActual = datos.materias.find((materia) => materia.getId() === filtros.materiaId)
  const materias = datos.materias.filter((materia) => !borrador.programaId || materia.getPrograma().getId() === borrador.programaId)
  const comunes = datos.materias.filter((materia) => ['Cálculo Diferencial', 'Algoritmo y Programación I', 'Biología General'].includes(materia.getNombre())).filter((materia, indice, lista) => lista.findIndex((otra) => otra.getNombre() === materia.getNombre()) === indice)
  const etiquetasFiltro = [filtros.tarifa === 'gratis' ? 'Tutorías gratuitas' : '', filtros.valoracion ? filtros.valoracion + ' estrellas o más' : '', filtros.semana ? 'Disponibles esta semana' : ''].filter(Boolean)
  const detalleConteo = materiaActual ? ' de ' + materiaActual.getNombre() + (etiquetasFiltro.length ? ', ' + etiquetasFiltro.join(', ') : '') : ', ' + (etiquetasFiltro.join(', ') || 'Todas las materias')

  if (parametros.get('elegir') === '1') return <section className="ct-elegir-materia">
    <h1>¿En qué materia necesitas ayuda?</h1>
    <p className="ct-texto-secundario">Catálogo cerrado de la comunidad.<br />Selecciona la materia para ver sus tutores.</p>
    {cargando ? 
    <Cargando texto="Cargando materias…" /> : error ? 
    <MensajeError mensaje={error} alReintentar={() => setIntento((valor) => valor + 1)} /> : datos.materias.filter((materia, indice, lista) => lista.findIndex((otra) => otra.getNombre() === materia.getNombre()) === indice).map((materia) => <Boton
      key={materia.getId()}
      variante={filtros.materiaId === materia.getId() ? 'primario' : 'secundario'} anchoCompleto
      alHacerClic={() => { elegirMateria(materia.getId()); setParametros({ materia:materia.getId() }) }}>
      {materia.getNombre()}
    </Boton>)}
  </section>

  if (parametros.get('vista') === 'gratuitas') return (
    <section className="ct-busqueda-gratuita">
      <h1>Aprender también es compartir.</h1>
      <span className="ct-chip-materia">Gratuita, 4+ estrellas</span>
      {!cargando && !error && resultados.length > 0 && (
        <p className="ct-conteo">
          {resultados.length} {resultados.length === 1 ? 'tutor disponible' : 'tutores disponibles'}
        </p>
      )}
      {cargando ? <Cargando texto="Cargando tutores…" /> : error ? (
        <MensajeError mensaje={error} alReintentar={() => setIntento((valor) => valor + 1)} />
      ) : resultados.length ? (
        <div className="ct-rejilla-tutores">
          {resultados.map(({ id, ...tutor }) => <TarjetaTutor key={id} {...tutor} />)}
        </div>
      ) : <ResultadoBusquedaVacia sede={sede} correo={correo} alQuitarFiltros={quitarFiltros} />}
      {resultados.length > 0 && (
        <Boton variante="secundario" anchoCompleto alHacerClic={quitarFiltros}>Ver todos los tutores</Boton>
      )}
    </section>
  )

  const formularioFiltros = 
  <form
    className="ct-filtro-formulario"
    aria-label="Filtros de tutores"
    onSubmit={(evento) => { evento.preventDefault(); setFiltros({ ...borrador,
       ...(borrador.tarifa === 'gratis' && !escritorio ? { valoracion:'4' } : {}) }); setPanelAbierto(false); if (borrador.tarifa === 'gratis' && !escritorio) setParametros({ vista:'gratuitas' }) }}>
    <h1 className="ct-filtro-titular-movil">Encuentra tu mejor opción</h1>
    <div className="ct-opciones-filtro-movil">
      <h2>Tarifa
      </h2>
      <Boton anchoCompleto
        variante={borrador.tarifa === 'gratis' ? 'primario' : 'secundario'}
        alHacerClic={() => setBorrador((anterior) => ({ ...anterior, tarifa:anterior.tarifa === 'gratis' ? '' : 'gratis', valoracion:'', semana:'' }))}>Solo tutorías gratuitas
      </Boton>
      <h2>Valoración mínima</h2><Boton anchoCompleto variante="secundario" alHacerClic={() => filtroRapido({ valoracion:'4' })}>4 estrellas o más</Boton>
      <h2>Disponibilidad</h2><Boton anchoCompleto variante="secundario" alHacerClic={() => filtroRapido({ semana:'1' })}>Esta semana</Boton>
    </div>
    <div className="ct-campos-filtro-escritorio">
        <CampoFormulario
        etiqueta="Materia"
        tipo="select"
        valor={borrador.materiaId}
        alCambiar={(valor) => cambiar('materiaId', valor)}
        opciones={[{ valor:'', etiqueta:'Todas las materias' }, ...materias.map((materia) => ({ valor:materia.getId(), etiqueta:materia.getNombre() }))]} />
        <CampoFormulario
        etiqueta="Tarifa"
        tipo="select"
        valor={borrador.tarifa}
        alCambiar={(valor) => cambiar('tarifa', valor)}
        opciones={[{ valor:'', etiqueta:'Cualquier tarifa' }, { valor:'gratis', etiqueta:'Gratuitas' }, { valor:'pago', etiqueta:'Con tarifa informativa' }]} />
        <CampoFormulario
        etiqueta="Valoración"
        tipo="select"
        valor={borrador.valoracion}
        alCambiar={(valor) => cambiar('valoracion', valor)}
        opciones={[{ valor:'', etiqueta:'Todas las valoraciones' }, { valor:'4', etiqueta:'4 estrellas o más' }, { valor:'5', etiqueta:'5 estrellas' }]} />
      </div>
    <details className="ct-filtros-academicos" open={escritorio}><summary>Filtros académicos de Uniguajira</summary>
      <Link className="ct-enlace-texto" to="/tutores?elegir=1" onClick={() => setPanelAbierto(false)}>Elegir materia</Link>
      <div className="ct-busqueda-extra-tablet">
          <BarraBusqueda
          valor={busqueda}
          alCambiar={setBusqueda}
          alBuscar={() => {}}
          etiqueta="Buscar por tutor o materia"
          placeholder="Busca por tutor o materia…" />
        </div>
      <div className="ct-materia-filtro-movil">
          <CampoFormulario
          etiqueta="Materia"
          tipo="select"
          valor={borrador.materiaId}
          alCambiar={(valor) => cambiar('materiaId', valor)}
          opciones={[{ valor:'', etiqueta:'Todas las materias' }, ...materias.map((materia) => ({ valor:materia.getId(), etiqueta:materia.getNombre() }))]} />
        </div>
      <CampoFormulario
        etiqueta="Sede"
        tipo="select"
        valor={borrador.sede}
        alCambiar={(valor) => cambiar('sede', valor)}
        opciones={[{ valor:'', etiqueta:'Todas las sedes' }, ...INSTITUCION.sedes.map((valor) => ({ valor, etiqueta:valor }))]} />
      <CampoFormulario
        etiqueta="Programa"
        tipo="select"
        valor={borrador.programaId}
        alCambiar={(valor) => cambiar('programaId', valor)}
        opciones={[{ valor:'', etiqueta:'Todos los programas' }, ...datos.programas.map((programa) => ({ valor:programa.getId(), etiqueta:programa.getNombre() }))]} />
      <CampoFormulario
        etiqueta="Disponibilidad"
        tipo="select"
        valor={borrador.dia}
        alCambiar={(valor) => cambiar('dia', valor)}
        opciones={[{ valor:'', etiqueta:'Cualquier día' }, ...Object.entries(ETIQUETAS_DIA).map(([valor, etiqueta]) => ({ valor, etiqueta }))]} />
    </details>
    <p className="ct-filtro-ayuda-movil">Elige cómo quieres filtrar los tutores.
    </p>
    <Boton tipo="submit" anchoCompleto>
      {escritorio || borrador.tarifa !== 'gratis' ? 'Aplicar filtros' : 'Ver tutorías gratuitas'}
    </Boton>
    <div className="ct-filtro-limpiar-movil">
        <Boton variante="secundario" anchoCompleto alHacerClic={quitarFiltros}>Limpiar filtros
      </Boton>
      </div>
    <p className="ct-filtro-nota-escritorio">Sin pagos en la plataforma. Las tarifas son informativas.
    </p>
  </form>

  return <section className="ct-solicitante ct-buscar">
    <div className="ct-buscar-tablet">
        <header>
            <h1>Encuentra tu próximo tutor
        </h1>
            <p className="ct-texto-secundario">
          {resultados.length > 0 ? `${materiaActual?.getNombre() ?? 'Todas las materias'}, ${resultados.length} resultados` : ''}
        </p>
            <button className="ct-filtro-chip ct-filtro-tablet" type="button" aria-expanded={panelAbierto} aria-controls="filtros-tutores" onClick={abrirFiltros}>Más filtros
        </button>
          </header>
        <CampoFormulario
        etiqueta="Materia"
        tipo="select"
        valor={filtros.materiaId}
        alCambiar={elegirMateria}
        opciones={[{ valor:'', etiqueta:'Todas las materias' }, ...datos.materias.map((materia) => ({ valor:materia.getId(), etiqueta:materia.getNombre() }))]} />
      </div>
    <header className="ct-buscar-saludo">
        <div>
            <p>Hola, {usuario.getNombre().split(' ')[0]}
        </p>
            <h1>
          {soloFavoritos ? 'Tutores favoritos' : '¿Qué aprendemos hoy?'}
        </h1>
          </div>
        <Avatar nombre={usuario.getNombre()} />
      </header>
    <header className="ct-buscar-titular">
        <h1>
        {soloFavoritos ? 'Tutores favoritos' : 'Aprender se hace más fácil en comunidad.'}
      </h1>
        <p>Encuentra estudiantes que ya recorrieron el camino que estás empezando.
      </p>
      </header>
    <div className="ct-buscar-composicion">
      <aside id="filtros-tutores" className={`ct-panel-filtros${panelAbierto ? ' ct-panel-filtros-abierto' : ''}`}>
        <h2>Filtra tu búsqueda</h2>
        {escritorio && formularioFiltros}
      </aside>
      <div className="ct-buscar-resultados">
        <BarraBusqueda
          sinBoton={escritorio}
          valor={busqueda}
          alCambiar={setBusqueda}
          alBuscar={() => {}}
          etiqueta="Buscar por tutor o materia"
          placeholder={escritorio ? "Busca Cálculo, Estadística, Programación…" : "Busca una materia"} />
        <div className="ct-filtros-rapidos">
          <button className={`ct-filtro-chip${!filtros.materiaId ? ' ct-filtro-chip-activo' : ''}`} type="button" onClick={quitarFiltros}>Todas</button>
          {comunes.slice(0, 1).map((materia) => <button
            className={`ct-filtro-chip${filtros.materiaId === materia.getId() ? ' ct-filtro-chip-activo' : ''}`}
            key={materia.getId()}
            type="button"
            onClick={() => elegirMateria(materia.getId())}>
            {materia.getNombre().split(' ')[0]}
          </button>)}
          <button className="ct-filtro-chip" type="button" aria-expanded={panelAbierto} aria-controls="filtros-tutores" onClick={abrirFiltros}>Más filtros</button>
        </div>
        {resultados.length > 0 && !cargando && !error && 
        <p className="ct-conteo" aria-live="polite">
          {`${resultados.length} ${resultados.length === 1 ? 'tutor' : 'tutores'}${detalleConteo}`}
        </p>}
        {resultados.length > 0 && 
        <aside className="ct-sobre-resultado-tablet ct-dato">
            <small>Sobre este resultado
          </small>Perfil público con materias, disponibilidad y tarifa informativa. No se realizan pagos en la plataforma.
        </aside>}
        {cargando ? 
        <Cargando texto="Cargando tutores…" /> : error ? 
        <MensajeError mensaje={error} alReintentar={() => setIntento((anterior) => anterior + 1)} /> : resultados.length ? 
        <div className="ct-rejilla-tutores">
          {resultados.map(({ id, ...tutor }) => <TarjetaTutor key={id} {...tutor} />)}
        </div> :
          <ResultadoBusquedaVacia sede={sede} correo={correo} alQuitarFiltros={quitarFiltros} />}
        {resultados.length > 0 && 
        <div className="ct-comunidad">
            <i className="bi bi-shield-check" aria-hidden="true" />
            <div>
                <h2>Tu comunidad, con confianza
            </h2>
                <p>Perfiles verificados, opiniones de estudiantes y horarios claros antes de solicitar una tutoría.
            </p>
                <p>Permanencia {sede}: 
              <a href={`mailto:${correo}`}>
                {correo}
              </a>
                  </p>
              </div>
          </div>}
      </div>
    </div>
    {!escritorio && <Modal abierto={panelAbierto} titulo="Filtrar tutores" conRegreso alCerrar={() => setPanelAbierto(false)}>{formularioFiltros}</Modal>}
  </section>
}


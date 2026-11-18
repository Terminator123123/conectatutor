// Busca tutores verificados con filtros académicos, tarifa y valoración.
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { useEscritorio } from '../hooks/useEscritorio.js'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { INSTITUCION } from '../config/institucion.js'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { repositorio } from '../servicios/instancias.js'
import { ETIQUETAS_DIA, estaOcupadaEnAgenda, fechaEnColombia, proximasOcurrencias } from '../servicios/agenda.js'
import BarraBusqueda from '../componentes/ui/BarraBusqueda.jsx'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import TarjetaTutor from '../componentes/ui/TarjetaTutor.jsx'
import Avatar from '../componentes/ui/Avatar.jsx'
import Boton from '../componentes/ui/Boton.jsx'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'
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
  const inicial = { sede: soloFavoritos || !usuario ? '' : usuario.getSede(), programaId: '', materiaId: parametros.get('materia') ?? '', dia: '', tarifa: parametros.get('vista') === 'gratuitas' ? 'gratis' : '', valoracion: '', semana:'' }
  const [filtros, setFiltros] = useState(inicial)
  const [borrador, setBorrador] = useState(inicial)
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [datos, setDatos] = useState({ programas: [], materias: [], tutores: [], favoritos: [] })
  const [guardandoFavorito, setGuardandoFavorito] = useState('')
  const [errorFavorito, setErrorFavorito] = useState('')
  const navigate = useNavigate()
  // «Solo favoritos» vive en la dirección (?favoritos=1) para poder enlazarlo y quitarlo con «Todas».
  const verFavoritos = parametros.get('favoritos') === '1'
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  // Sin sesión se explora igual; favoritos y saludo solo aplican con cuenta.
  const usuarioId = usuario?.getId() ?? null

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setError('')
      try {
        const [programas, materias, perfiles, favoritos] = await Promise.all([
          repositorio.listarProgramas(), repositorio.listarMaterias(),
          repositorio.listarTutoresVerificados(filtros), usuarioId ? repositorio.listarFavoritos(usuarioId) : Promise.resolve([]),
        ])
        const tutores = await Promise.all(perfiles.filter((perfil) => perfil.getEstudiante().getId() !== usuarioId && (!soloFavoritos || favoritos.includes(perfil.getId()))).map(async (perfil) => {
          const [{ promedio, totalCalificaciones }, ocupaciones] = await Promise.all([
            repositorio.obtenerResumenTutor(perfil.getId()),
            filtros.semana ? repositorio.obtenerOcupacionTutor(perfil.getId()) : Promise.resolve([]),
          ])
          const estudiante = perfil.getEstudiante()
          const hoy = new Date(`${fechaEnColombia(new Date())}T12:00:00-05:00`)
          const finSemana = new Date(hoy.getTime() + ((7 - hoy.getUTCDay()) % 7) * 86400000)
          // Siempre al perfil completo, con su diseño; la vista resumida quedaba sin estilos.
          const ruta = `/tutores/${perfil.getId()}`
          return {
            id: perfil.getId(), usuarioId: estudiante.getId(), sede: estudiante.getSede(), nombre: estudiante.getNombre(), programa: estudiante.getPrograma().getNombre(),
            semestre: estudiante.getSemestre(), materias: perfil.getMaterias().map((materia) => materia.getNombre()),
            promedio, totalCalificaciones,
            tarifaHora: perfil.getTarifaHora(), ruta,
            disponibleEstaSemana:perfil.getDisponibilidad().some((franja) => proximasOcurrencias(franja).some(({ clave }) => clave <= fechaEnColombia(finSemana)
              && !estaOcupadaEnAgenda(ocupaciones, franja, clave))),
          }
        }))
        if (activo) setDatos({ programas, materias, tutores, favoritos })
      } catch (fallo) {
        if (activo) setError(fallo.message)
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [filtros, usuarioId, intento, soloFavoritos])

  function alternarVerFavoritos() {
    setParametros((anteriores) => {
      const siguientes = new URLSearchParams(anteriores)
      if (verFavoritos) siguientes.delete('favoritos'); else siguientes.set('favoritos', '1')
      return siguientes
    })
  }
  async function alternarFavorito(id) {
    if (!usuario) { navigate('/ingresar', { state: { desde: '/' } }); return }
    if (guardandoFavorito) return
    setGuardandoFavorito(id); setErrorFavorito('')
    try {
      const favoritos = await repositorio.alternarFavorito(usuarioId, id)
      setDatos((anteriores) => ({ ...anteriores, favoritos }))
    } catch (fallo) { setErrorFavorito(fallo.message) }
    finally { setGuardandoFavorito('') }
  }
  const tarjeta = ({ id, ...tutor }) => <TarjetaTutor key={id} {...tutor}
    favorito={datos.favoritos.includes(id)} guardando={guardandoFavorito === id} alAlternarFavorito={() => alternarFavorito(id)} />
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
    setPanelAbierto(!panelAbierto)
  }
  const texto = normalizar(busqueda.trim())
  const resultados = datos.tutores.filter((tutor) => normalizar([tutor.nombre, ...tutor.materias].join(' ')).includes(texto)
    && (!filtros.tarifa || (filtros.tarifa === 'gratis' ? tutor.tarifaHora === null : tutor.tarifaHora !== null))
    && (!filtros.valoracion || tutor.promedio >= Number(filtros.valoracion))
    && (!filtros.semana || tutor.disponibleEstaSemana)
    && (!verFavoritos || datos.favoritos.includes(tutor.id)))
  const sede = filtros.sede || usuario?.getSede() || INSTITUCION.sedes[0]
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
    <MensajeError mensaje={error} alReintentar={() => setIntento((valor) => valor + 1)} forma="tarjetas" /> : !datos.materias.length ?
    <EstadoVacio titulo="No hay materias disponibles" /> : datos.materias.filter((materia, indice, lista) => lista.findIndex((otra) => otra.getNombre() === materia.getNombre()) === indice).map((materia) => <Boton
      key={materia.getId()}
      variante={filtros.materiaId === materia.getId() ? 'primario' : 'secundario'} anchoCompleto
      alHacerClic={() => { elegirMateria(materia.getId()); setParametros({ materia:materia.getId() }) }}>
      {materia.getNombre()}
    </Boton>)}
  </section>

  if (parametros.get('vista') === 'gratuitas') return (
    <section className="ct-busqueda-gratuita">
      <h1>Aprender también es compartir.</h1>
      <span className="ct-chip-materia">Tutorías gratuitas</span>
      {!cargando && !error && resultados.length > 0 && (
        <p className="ct-conteo">
          {resultados.length} {resultados.length === 1 ? 'tutor disponible' : 'tutores disponibles'}
        </p>
      )}
      {cargando ? <Cargando texto="Cargando tutores…" /> : error ? (
        <MensajeError mensaje={error} alReintentar={() => setIntento((valor) => valor + 1)} forma="tarjetas" />
      ) : resultados.length ? (
        <div className="ct-rejilla-tutores">
          {resultados.map(tarjeta)}
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
    onSubmit={(evento) => { evento.preventDefault(); setFiltros(borrador); setPanelAbierto(false) }}>
    <h1 className="ct-filtro-titular-movil">Encuentra tu mejor opción</h1>
    <div className="ct-opciones-filtro-movil">
      {/* Cada filtro es independiente: elegir uno no cambia los otros. */}
      <CampoFormulario etiqueta="Tarifa" tipo="select" valor={borrador.tarifa} alCambiar={(valor) => cambiar('tarifa', valor)}
        opciones={[{ valor:'', etiqueta:'Cualquier tarifa' }, { valor:'gratis', etiqueta:'Solo gratuitas' }, { valor:'pago', etiqueta:'Con tarifa informativa' }]} />
      <CampoFormulario etiqueta="Valoración mínima" tipo="select" valor={borrador.valoracion} alCambiar={(valor) => cambiar('valoracion', valor)}
        opciones={[{ valor:'', etiqueta:'Todas las valoraciones' }, { valor:'4', etiqueta:'4 estrellas o más' }, { valor:'5', etiqueta:'5 estrellas' }]} />
      <CampoFormulario etiqueta="Disponibilidad" tipo="select" valor={borrador.semana} alCambiar={(valor) => cambiar('semana', valor)}
        opciones={[{ valor:'', etiqueta:'Cualquier momento' }, { valor:'1', etiqueta:'Con horario esta semana' }]} />
    </div>
    <div className="ct-campos-filtro-escritorio">
        <button type="button" className={`ct-boton ${verFavoritos ? 'btn-ct-primario' : 'btn-ct-secundario'} ct-boton-completo`} aria-pressed={verFavoritos} onClick={alternarVerFavoritos}>
          <i className={`bi ${verFavoritos ? 'bi-heart-fill' : 'bi-heart'} ct-icono-favorito`} aria-hidden="true" />Solo mis favoritos
        </button>
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
          anidada
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
      Aplicar filtros
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
            <p>{usuario ? `Hola, ${usuario.getNombre().split(' ')[0]}` : 'Tutorías entre pares'}
        </p>
            <h1>
          {soloFavoritos ? 'Tutores favoritos' : usuario ? '¿Qué aprendemos hoy?' : 'Encuentra tu tutor'}
        </h1>
          </div>
        {usuario ? <Avatar nombre={usuario.getNombre()} usuarioId={usuario.getId()} /> : <Link className="ct-boton btn-ct-secundario ct-saludo-ingresar" to="/ingresar">Ingresar</Link>}
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
          <button className={`ct-filtro-chip ct-filtro-favoritos${verFavoritos ? ' ct-filtro-chip-activo' : ''}`} type="button" aria-pressed={verFavoritos} aria-label="Solo favoritos" title="Solo favoritos" onClick={alternarVerFavoritos}>
            <i className={`bi ${verFavoritos ? 'bi-heart-fill' : 'bi-heart'}`} aria-hidden="true" />
          </button>
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
        {errorFavorito && <MensajeError mensaje={errorFavorito} />}
        {cargando ? 
        <Cargando texto="Cargando tutores…" /> : error ? 
        <MensajeError mensaje={error} alReintentar={() => setIntento((anterior) => anterior + 1)} forma="tarjetas" /> : verFavoritos && !usuario ?
        <EstadoVacio icono="bi-heart" titulo="No has iniciado sesión" texto="Inicia sesión para guardar tutores con el corazón y verlos aquí." accion={{ etiqueta: 'Iniciar sesión', ruta: '/ingresar' }} /> : verFavoritos && !datos.favoritos.length ?
        <EstadoVacio icono="bi-heart" titulo="Aún no tienes favoritos" texto="Toca el corazón de un tutor para guardarlo y encontrarlo aquí." accion={{ etiqueta: 'Ver todos los tutores', alHacerClic: alternarVerFavoritos }} /> : resultados.length ? 
        <div className="ct-rejilla-tutores">
          {resultados.map(tarjeta)}
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
                <p>Permanencia {sede}:{' '}
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


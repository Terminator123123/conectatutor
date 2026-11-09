import { formatearMoneda } from '../componentes/ui/moneda.js'
import { formatearFechaBreve } from '../componentes/ui/fechaBreve.js'
// Solicita tutorías en las franjas disponibles del tutor.
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { useEscritorio } from '../hooks/useEscritorio.js'
import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { repositorio } from '../servicios/instancias.js'
import { estaOcupada, fechaEnColombia, proximasOcurrencias } from '../servicios/agenda.js'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import Avatar from '../componentes/ui/Avatar.jsx'
import Boton from '../componentes/ui/Boton.jsx'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'
import Modal from '../componentes/ui/Modal.jsx'
import DetalleTutor from './DetalleTutor.jsx'
import '../estilos/solicitante.css'

/** @returns {import('react').ReactElement} Formulario de solicitud al modelo de dominio. */
export default function SolicitudSesion() {
  useTituloPagina('Solicitar tutoría')
  const { id } = useParams()
  const { usuario } = useAutenticacion()
  const navigate = useNavigate()
  const escritorio = useEscritorio()
  const tableta = useEscritorio(768) && !escritorio
  const [parametros, setParametros] = useSearchParams()
  const vista = parametros.get('estado') ?? ''
  function cambiarVista(valor) { setParametros(valor ? { estado:valor } : {}, { replace:true }); window.scrollTo(0, 0) }
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [intento, setIntento] = useState(0)
  const [campos, setCampos] = useState({ materia: '', franja: '', tema: '' })
  const [tocados, setTocados] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [errorServicio, setErrorServicio] = useState('')
  const [fechaElegida, setFechaElegida] = useState('')
  const [semana, setSemana] = useState(0)
  const [fechaBase] = useState(() => new Date())
  const [archivo, setArchivo] = useState('')
  const [tamanoArchivo, setTamanoArchivo] = useState(0)
  const [nombreArchivoError, setNombreArchivoError] = useState('')
  const [errorArchivo, setErrorArchivo] = useState('')
  const archivoRef = useRef(null)
  const selectorRef = useRef(null)
  const idFranja = useId()

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setErrorCarga('')
      try {
        const [perfil, sesiones] = await Promise.all([
          repositorio.obtenerPerfilTutor(id), repositorio.listarSesionesDelTutor(id),
        ])
        if (activo) {
          setDatos({ perfil, sesiones })
          const primera = perfil?.getDisponibilidad().flatMap((franja, indice) => proximasOcurrencias(franja).map((ocurrencia) => ({ ...ocurrencia, franja, indice }))).sort((a, b) => a.fecha - b.fecha).find((ocurrencia) => !estaOcupada(sesiones, ocurrencia.franja, ocurrencia.clave))
          setFechaElegida(primera?.clave ?? '')
          const diaBase = new Date(`${fechaEnColombia(fechaBase)}T12:00:00-05:00`)
          const lunes = new Date(diaBase.getTime() - ((diaBase.getUTCDay() + 6) % 7) * 86400000)
          setSemana(primera ? Math.floor((new Date(`${primera.clave}T12:00:00-05:00`) - lunes) / 604800000) : 0)
          setCampos({ materia: perfil?.getMaterias()[0]?.getId() ?? '', franja: primera ? `${primera.indice}|${primera.clave}` : '', tema: '' })
          setTocados({})
          setErrorServicio('')
        }
      } catch (error) {
        if (activo) setErrorCarga(error.message)
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [id, intento, fechaBase])

  const errores = {
    materia: campos.materia ? '' : 'Selecciona la materia.',
    franja: campos.franja ? '' : 'Elige una franja libre.',
    tema: campos.tema.trim().length >= 10 && campos.tema.trim().length <= 300 ? '' : 'Cuéntale al tutor qué quieres repasar (de 10 a 300 caracteres).',
  }
  function cambiar(nombre, valor) {
    setCampos((anteriores) => ({ ...anteriores, [nombre]: valor }))
  }
  function tocar(nombre) {
    setTocados((anteriores) => ({ ...anteriores, [nombre]: true }))
  }
  function adjuntar(evento) {
    //solucion temp por falrta de bak correguir despues//
    const elegido = evento.target.files?.[0]
    setErrorArchivo('')
    if (elegido && (elegido.size > 5 * 1024 * 1024 || !/\.(pdf|png|jpe?g)$/i.test(elegido.name))) {
      setArchivo('')
      setNombreArchivoError(elegido.name)
      setErrorArchivo('Elige un PDF o imagen de hasta 5 MB.')
      cambiarVista('archivo')
      evento.target.value = ''
      return
    }
    setArchivo(elegido?.name ?? '')
    setTamanoArchivo(elegido?.size ?? 0)
    if (elegido) cambiarVista('material')
  }

  if (cargando) return <Cargando texto="Cargando horarios…" />
  if (errorCarga) return <MensajeError mensaje={errorCarga} alReintentar={() => setIntento((anterior) => anterior + 1)} />
  if (!datos?.perfil) return <EstadoVacio
    icono="bi-person"
    titulo="No encontramos este tutor"
    texto="Vuelve a buscar un tutor que te acompañe."
    accion={{ etiqueta: 'Volver a la búsqueda', ruta: '/tutores' }} />

  const { perfil, sesiones } = datos
  const opciones = perfil.getDisponibilidad().flatMap((franja, indice) => proximasOcurrencias(franja).map(({ fecha, clave }) => ({
    id: `${indice}|${clave}`, fecha, clave, franja,
    etiqueta: `${formatearFechaBreve(fecha)} · ${franja.getHoraInicio()}–${franja.getHoraFin()}`,
    ocupada: estaOcupada(sesiones, franja, clave),
  }))).sort((a, b) => a.fecha - b.fecha)
  const hoy = new Date(`${fechaEnColombia(fechaBase)}T12:00:00-05:00`)
  const diasDesdeLunes = (hoy.getUTCDay() + 6) % 7
  const lunes = new Date(hoy.getTime() - diasDesdeLunes * 86400000)
  const numeroSemanas = Math.ceil((15 + diasDesdeLunes) / 7)
  const fechas = Array.from({ length: numeroSemanas * 7 }, (_, indice) => new Date(lunes.getTime() + indice * 86400000))
  const opcionesDelDia = opciones.filter((opcion) => opcion.clave === fechaElegida)
  const bloques = [['08:00','10:00'],['10:00','12:00'],['14:00','16:00'],['16:00','18:00']]
  const tarifa = perfil.getTarifaHora()
    const sinResenas = !sesiones.some((sesion) => sesion.getCalificacion())
  const opcionElegida = opciones.find((opcion) => opcion.id === campos.franja)
  const horasElegidas = opcionElegida ? Number(opcionElegida.franja.getHoraFin().slice(0, 2)) - Number(opcionElegida.franja.getHoraInicio().slice(0, 2)) : 0

  async function enviar(evento) {
    evento.preventDefault()
    if (enviando) return
    setTocados({ materia: true, franja: true, tema: true })
    setErrorServicio('')
    const primerError = Object.keys(errores).find((nombre) => errores[nombre])
    if (primerError) {
      if (primerError === 'tema') { cambiarVista('tema'); return }
      cambiarVista('')
      if (primerError === 'franja') selectorRef.current?.querySelector('button:not(:disabled)')?.focus()
      else evento.currentTarget.elements.namedItem(primerError)?.focus()
      return
    }
    if (sinResenas && !escritorio && !tableta && !vista) { cambiarVista('revision'); return }
    setEnviando(true)
    try {
      const reservar = async () => {
        const perfilActual = await repositorio.obtenerPerfilTutor(id)
        if (!perfilActual) throw new Error('No encontramos este tutor.')
        const materia = perfilActual.getMaterias().find((item) => item.getId() === campos.materia)
        const opcion = opciones.find((item) => item.id === campos.franja)
        const actuales = await repositorio.listarSesionesDelTutor(id)
        if (estaOcupada(actuales, opcion.franja, fechaEnColombia(opcion.fecha))) {
          setDatos((anteriores) => ({ ...anteriores, sesiones: actuales }))
          const siguiente = opciones.find((item) => item.clave === opcion.clave && item.fecha > opcion.fecha && !estaOcupada(actuales, item.franja, item.clave))
          setCampos((anteriores) => ({ ...anteriores, franja: siguiente?.id ?? '' }))
          setErrorServicio(siguiente
            ? `Esta franja acaba de reservarse. Seleccionamos ${siguiente.franja.getHoraInicio()}–${siguiente.franja.getHoraFin()}. Revisa el horario antes de enviar.`
            : 'Esta franja acaba de reservarse. No quedan franjas libres ese día. Elige otra fecha.')
          return
        }
        const sesion = usuario.solicitarSesion(perfilActual, materia, opcion.franja, opcion.fecha, campos.tema.trim())
        await repositorio.guardarSesion(sesion)
        return sesion.getId()
      }
      // El bloqueo entre pestañas mantiene juntas la relectura y el guardado.
      const reservada = navigator.locks?.request
        ? await navigator.locks.request(`ct-agenda-${id}`, reservar) : await reservar()
      if (!reservada) return
      if (sinResenas || tableta) { navigate(`/sesiones/${reservada}?resultado=enviada&nombre=${encodeURIComponent(perfil.getEstudiante().getNombre().split(' ')[0])}`, { replace:true }); return }
      navigate('/sesiones', { replace: true, state: { aviso: `Solicitud enviada. ${perfil.getEstudiante().getNombre().split(' ')[0]} revisará tu solicitud.` } })
    } catch (error) {
      setErrorServicio(error.message)
      if (error.getCodigo?.() === 'R8') cambiarVista('fecha')
    } finally {
      setEnviando(false)
    }
  }

  if (['material', 'archivo', 'tema', 'fecha', 'revision'].includes(vista)) {
    const opcion = opciones.find((item) => item.id === campos.franja)
    const fechaResumen = opcion ? `${formatearFechaBreve(opcion.fecha)}, ${opcion.franja.getHoraInicio()}–${opcion.franja.getHoraFin()}` : 'Elige la fecha y la franja en la solicitud.'
    const resumen = opcion ? `${perfil.getMaterias().find((materia) => materia.getId() === campos.materia)?.getNombre()}, ${fechaResumen}` : fechaResumen
    return <section className="ct-estado-formulario">
      {vista === 'material' || vista === 'archivo' ? 
      <span className={`ct-confirmacion-etiqueta${vista === 'archivo' ? ' ct-etiqueta-error' : ''}`}>
        {vista === 'material' ? 'Material seleccionado' : 'Error al adjuntar'}
      </span> : null}
      <h1>
        {vista === 'material' ? 'Tu material está listo' : vista === 'archivo' ? 'No pudimos adjuntar el archivo' : vista === 'tema' ? `Cuéntale a ${perfil.getEstudiante().getNombre().split(' ')[0]} qué necesitas` : vista === 'revision' ? `Solicita tu primera sesión con ${perfil.getEstudiante().getNombre().split(' ')[0]}` : 'Elige una fecha futura'}
      </h1>
      {vista === 'revision' && 
      <>
          <p className="ct-texto-secundario">
          {perfil.getEstudiante().getNombre().split(' ')[0]} acaba de llegar a ConectaTutor y todavía no tiene reseñas.
        </p>
          <div className="ct-dato">
              <small>Tutor y materia
          </small>
          {perfil.getEstudiante().getNombre()}, {perfil.getMaterias().find((materia) => materia.getId() === campos.materia)?.getNombre()}
        </div>
          <div className="ct-dato">
              <small>Fecha y horario
          </small>
          {fechaResumen}
        </div>
          <div className="ct-dato">
              <small>Tema a trabajar
          </small>
          {campos.tema}
        </div>
          <div className="ct-dato">
              <small>Tarifa
          </small>
          {tarifa === null ? `Tutoría gratuita, ${horasElegidas} horas` : `${horasElegidas} horas × ${formatearMoneda(tarifa)}/h = ${formatearMoneda(tarifa * horasElegidas)}`}
        </div>
        {errorServicio && 
        <MensajeError mensaje={errorServicio} />}
      </>}
      {vista === 'material' && 
      <>
          <p className="ct-texto-secundario">Formatos permitidos: PDF o imagen, máximo 5 MB.
        </p>
          <div className="ct-dato">
              <small>Tutor y materia
          </small>
          {perfil.getEstudiante().getNombre()}, {perfil.getMaterias().find((materia) => materia.getId() === campos.materia)?.getNombre()}
        </div>
          <div className="ct-dato">
              <small>Sesión
          </small>
          {fechaResumen}
        </div>
          <div className="ct-dato">
              <small>Archivo seleccionado
          </small>
          {archivo}, {Math.max(1, Math.round(tamanoArchivo / 1024))} KB
        </div>
          <p className="ct-texto-secundario">Archivo adjunto a la solicitud.
        </p>
        </>}
      {vista === 'archivo' && 
      <>
          <p className="ct-texto-secundario">No se pudo adjuntar el archivo. Tu tema se conserva y puedes enviar sin adjunto.
        </p>
          <CampoFormulario etiqueta="Archivo" valor={nombreArchivoError} alCambiar={() => {}} error={errorArchivo} />
        </>}
      {vista === 'tema' && 
      <>
          <div className="ct-dato">
              <small>Sesión
          </small>
          {resumen}
        </div>
          <CampoFormulario
          etiqueta="Tema a trabajar"
          valor={campos.tema}
          alCambiar={(valor) => cambiar('tema', valor)}
          error="Describe el tema antes de enviar la solicitud."
          placeholder="Escribe el tema" />
        </>}
      {vista === 'fecha' && 
      <CampoFormulario
        etiqueta="Fecha"
        valor={fechaElegida ? formatearFechaBreve(fechaElegida + "T12:00:00", true, false) : ""}
        alCambiar={() => {}}
        error={errorServicio || 'No se pueden solicitar sesiones en una fecha pasada.'} />}
      <input ref={archivoRef} type="file" accept=".pdf,.png,.jpg,.jpeg" hidden aria-label="Material de la tutoría" onChange={adjuntar} />
      <div className="ct-estado-formulario-acciones">
        {vista === 'revision' && 
        <>
            <form noValidate onSubmit={enviar}>
                <Boton tipo="submit" anchoCompleto cargando={enviando}>Enviar solicitud
            </Boton>
              </form>
            <Link className="ct-boton btn-ct-secundario" to={`/tutores/${id}`}>Volver al perfil
          </Link>
          </>}
        {vista === 'material' ? 
        <>
            <form noValidate onSubmit={enviar}>
                <Boton tipo="submit" anchoCompleto cargando={enviando}>Enviar solicitud con material
            </Boton>
              </form>
            <Boton variante="secundario" anchoCompleto alHacerClic={() => { setArchivo(''); cambiarVista('') }}>Quitar archivo y volver
          </Boton>
            <Boton variante="secundario" anchoCompleto alHacerClic={() => archivoRef.current?.click()}>Cambiar archivo
          </Boton>
          </> : vista === 'archivo' ? 
        <>
            <Boton anchoCompleto alHacerClic={() => archivoRef.current?.click()}>Adjuntar otro archivo
          </Boton>
            <Boton variante="secundario" anchoCompleto alHacerClic={() => { setErrorArchivo(''); cambiarVista('') }}>Continuar sin adjunto
          </Boton>
          </> : vista !== 'revision' && 
        <Boton anchoCompleto alHacerClic={() => cambiarVista('')}>
          {vista === 'tema' ? 'Completar el tema' : 'Elegir otra fecha'}
        </Boton>}
      </div>
    </section>
  }

  const controlMaterial = 
  <div className="ct-material-solicitud">
      <input ref={archivoRef} type="file" accept=".pdf,.png,.jpg,.jpeg" hidden aria-label="Material de la tutoría" onChange={adjuntar} />
      <Boton variante="secundario" anchoCompleto alHacerClic={() => archivoRef.current?.click()}>Adjuntar material
    </Boton>
    {archivo && 
    <p role="status">
      {archivo}
    </p>}{errorArchivo && 
    <MensajeError mensaje={errorArchivo} />}
  </div>
  const contenido = (
    <section className="ct-solicitante ct-formulario-solicitud">
      <Link className="ct-volver ct-solo-escritorio" to={`/tutores/${id}`}>← Volver al perfil</Link>
      <h1 className="ct-solo-escritorio">Solicitar tutoría</h1>
      <header className="ct-resumen-tutor">
          <Avatar nombre={perfil.getEstudiante().getNombre()} />
          <div>
              <strong>
            {perfil.getEstudiante().getNombre()}
          </strong>
              <p>
            {tarifa === null ? 'Gratuita' : `${formatearMoneda(tarifa)} por hora`}
          </p>
            </div>
        </header>
      {tableta && <p className="ct-resumen-tutor-tablet">{perfil.getEstudiante().getNombre()}, {perfil.getMaterias().find((materia) => materia.getId() === campos.materia)?.getNombre()}</p>}
      <form noValidate onSubmit={enviar} onBlur={(evento) => { if (Object.hasOwn(campos, evento.target.name)) tocar(evento.target.name) }}>
        {tableta && 
        <div className="ct-resumen-fecha-tablet">
            <div className="ct-campo">
                <label htmlFor="solicitud-fecha-tablet" className="ct-campo-etiqueta">Fecha
            </label>
                <input
              id="solicitud-fecha-tablet"
              className="ct-campo-control" readOnly
              value={opcionElegida ? formatearFechaBreve(opcionElegida.fecha, true, false) : 'Elige una fecha'} />
              </div>
            <div className="ct-campo">
                <label htmlFor="solicitud-hora-tablet" className="ct-campo-etiqueta">Horario
            </label>
                <input
              id="solicitud-hora-tablet"
              className="ct-campo-control" readOnly
              value={opcionElegida ? `${opcionElegida.franja.getHoraInicio()}–${opcionElegida.franja.getHoraFin()}` : 'Elige una franja'} />
              </div>
          </div>}
        {escritorio && 
        <div className="ct-resumen-horario">
            <p className="ct-tarifa">
            {perfil.getMaterias().find((materia) => materia.getId() === campos.materia)?.getNombre()}
          </p>
            <p>
            {opcionElegida ? `${formatearFechaBreve(opcionElegida.fecha)}, ${opcionElegida.franja.getHoraInicio()}–${opcionElegida.franja.getHoraFin()}` : 'Elige una franja disponible.'}
          </p>
          </div>}
        <details className="ct-cambiar-horario" open={!escritorio && !tableta || !campos.franja}><summary>Cambiar materia, fecha y hora</summary>
        <CampoFormulario
          etiqueta="Materia"
          nombre="materia"
          tipo="select"
          valor={campos.materia}
          alCambiar={(valor) => cambiar('materia', valor)}
          opciones={perfil.getMaterias().map((materia) => ({ valor: materia.getId(), etiqueta: materia.getNombre() }))}
          placeholder="Selecciona la materia" obligatorio
          error={tocados.materia ? errores.materia : ''}
          deshabilitado={enviando} />
        <div ref={selectorRef} aria-describedby={tocados.franja && errores.franja ? `${idFranja}-error` : undefined} onBlur={() => tocar('franja')}>
          <h2>Fecha</h2>
          <div className="ct-mes-semana">
              <button type="button" aria-label="Semana anterior" disabled={semana === 0} onClick={() => setSemana((anterior) => anterior - 1)}>←
            </button>
              <span>
              {new Intl.DateTimeFormat('es-CO', { month:'long', year:'numeric', timeZone:'America/Bogota' }).format(fechas[semana * 7]).replace(/^./, (letra) => letra.toLocaleUpperCase('es'))}
            </span>
              <button type="button" aria-label="Semana siguiente" disabled={semana === numeroSemanas - 1} onClick={() => setSemana((anterior) => anterior + 1)}>→
            </button>
            </div>
          <div className="ct-tira-fechas" role="group" aria-label="Fecha">
            {fechas.slice(semana * 7, semana * 7 + 7).map((fecha) => {
              const clave = fechaEnColombia(fecha)
              return <button
                key={clave}
                type="button"
                disabled={enviando || !opciones.some((opcion) => opcion.clave === clave)}
                aria-pressed={fechaElegida === clave}
                onClick={() => { setFechaElegida(clave); cambiar('franja', '') }}>
                  <small>
                  {new Intl.DateTimeFormat('es-CO', { weekday:'short', timeZone:'America/Bogota' }).format(fecha)}
                </small>
                  <strong>
                  {new Intl.DateTimeFormat('es-CO', { day:'numeric', timeZone:'America/Bogota' }).format(fecha)}
                </strong>
                </button>
            })}
          </div>
          <h2 id={idFranja}>Hora de inicio y fin</h2>
          {opciones.length ? <fieldset className="ct-selector-contenedor" disabled={enviando}>
            <legend className="visually-hidden">Fecha y franja</legend>
            <div className="ct-horas" role="group" aria-label="Hora de inicio y fin">{bloques.map(([inicio,fin]) => {
              const opcion = opcionesDelDia.find((item) => item.franja.getHoraInicio() === inicio && item.franja.getHoraFin() === fin)
              const ocupada = opcion?.ocupada
              const seleccionada = opcion?.id === campos.franja
              return <button
                type="button"
                key={inicio}
                disabled={!opcion || ocupada || enviando}
                className={`ct-franja${seleccionada ? ' ct-franja-seleccionada' : ''}${ocupada ? ' ct-franja-ocupada' : ''}`}
                aria-pressed={seleccionada}
                aria-label={`${inicio}–${fin}${ocupada ? ', ocupada' : !opcion ? ', no disponible' : ''}`}
                onClick={() => { cambiar('franja', opcion.id); tocar('franja') }}>
                {inicio}–{fin}
              </button>
            })}</div>
          </fieldset> : <EstadoVacio icono="bi-calendar-event" titulo="Este tutor no tiene horarios disponibles" texto="Vuelve al perfil o busca otro tutor." />}
          {tocados.franja && errores.franja && <p id={`${idFranja}-error`} className="ct-campo-error">{errores.franja}</p>}
        </div>
        </details>
        {errorServicio && <MensajeError mensaje={errorServicio} />}
        <CampoFormulario
          etiqueta={escritorio ? 'Tema' : tableta ? 'Tema a trabajar' : '¿Qué necesitas trabajar?'}
          nombre="tema"
          tipo="textarea"
          valor={campos.tema}
          alCambiar={(valor) => cambiar('tema', valor)} obligatorio
          error={tocados.tema ? errores.tema : ''}
          deshabilitado={enviando}
          ayuda={tableta || escritorio ? '' : 'Obligatorio. Incluye el tema o los ejercicios.'} />
        {!escritorio && controlMaterial}
        {tableta && 
        <div className="ct-dato ct-tarifa-resumen-tablet">
            <small>Tarifa informativa
          </small>
          {tarifa === null ? `Tutoría gratuita, ${horasElegidas} horas. Sin pago en la plataforma.` : `${horasElegidas} horas × ${formatearMoneda(tarifa)}/h = ${formatearMoneda(tarifa * horasElegidas)}. Sin pago en la plataforma.`}
        </div>}
        {escritorio && 
        <div className="ct-costo-solicitud">
            <strong>
            {opcionElegida ? `${horasElegidas} horas${tarifa === null ? ', Gratuita' : ` × ${formatearMoneda(tarifa)}/h = ${formatearMoneda(tarifa * horasElegidas)}`}` : 'Elige un horario disponible.'}
          </strong>
          {controlMaterial}
        </div>}
        <p className="ct-texto-secundario ct-informacion-solicitud">
          {escritorio ? 'Tarifa informativa. No hay cobros dentro de ConectaTutor.' : 'Sin pagos en la plataforma. Las tarifas son informativas. El tutor puede aceptar o rechazar tu solicitud.'}
        </p>
        <div className="ct-envio-fijo"><Boton tipo="submit" anchoCompleto cargando={enviando}>Enviar solicitud</Boton></div>
        {escritorio && <Boton variante="secundario" anchoCompleto deshabilitado={enviando} alHacerClic={() => navigate(`/tutores/${id}`)}>Cancelar</Boton>}
      </form>
    </section>
  )
  return escritorio ? 
  <>
      <div inert>
          <DetalleTutor tituloPagina="Solicitar tutoría" />
        </div>
      <Modal abierto
      titulo={`Solicitar tutoría con ${perfil.getEstudiante().getNombre().split(' ')[0]}`}
      alCerrar={() => { if (!enviando) navigate(`/tutores/${id}`) }}>
      {contenido}
    </Modal>
    </> : contenido
}

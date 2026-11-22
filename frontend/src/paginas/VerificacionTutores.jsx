// Revisa perfiles de tutor y presenta cifras agregadas de Permanencia por sede.
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { INSTITUCION } from '../config/institucion.js'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { repositorio } from '../servicios/instancias.js'
import { EstadoVerificacion } from '../modelo/enums.js'
import { metricasACsv } from '../servicios/metricas.js'
import { MOTIVOS_CANCELACION } from '../servicios/motivosCancelacion.js'
import { fechaEnColombia } from '../servicios/agenda.js'
import { unirNombres } from '../servicios/nombres.js'
import Avatar from '../componentes/ui/Avatar.jsx'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import Boton from '../componentes/ui/Boton.jsx'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'
import ModalMotivo from '../componentes/sesiones/ModalMotivo.jsx'
import Modal from '../componentes/ui/Modal.jsx'
import '../estilos/solicitante.css'
import '../estilos/tutor.css'

const columnas = [
  ['solicitudes', 'Solicitudes'], ['pendientes', 'Pendientes'], ['confirmadas', 'Confirmadas'],
  ['finalizadas', 'Finalizadas'], ['rechazadas', 'Rechazadas'], ['canceladas', 'Canceladas'],
  ['estudiantesAtendidos', 'Estudiantes atendidos'], ['tutoresVerificados', 'Tutores verificados'],
  ['tutoresPendientes', 'Tutores pendientes'], ['calificacionPromedio', 'Calificación promedio'],
]
/** Materias que se aprueban o rechazan en esta revisión: las nuevas, o todas si el perfil es nuevo. */
const materiasEnRevision = (perfil) => {
  const nuevas = perfil.getMateriasPorVerificar()
  return (nuevas.length ? nuevas : perfil.getMaterias()).map((materia) => materia.getNombre())
}
/** El perfil ya está publicado con otras materias y solo se revisan las nuevas. */
const soloMateriasNuevas = (perfil) => perfil.tieneMateriasAprobadas() && perfil.getMateriasPorVerificar().length > 0
const presentarValor = (fila, clave) => clave === 'calificacionPromedio' ? (fila[clave] === null ? '—' : fila[clave].toFixed(1).replace('.', ',')) : fila[clave]

/** @returns {import('react').ReactElement} Revisión institucional y panel sin datos individuales. */
export default function VerificacionTutores() {
  useTituloPagina('Coordinación')
  const { usuario } = useAutenticacion()
  const [parametros, setParametros] = useSearchParams()
  const vista = parametros.get('vista') === 'panel' ? 'panel' : 'perfiles'
  const [perfiles, setPerfiles] = useState([])
  const [metricas, setMetricas] = useState(null)
  const [sede, setSede] = useState('')
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [intento, setIntento] = useState(0)
  const [aviso, setAviso] = useState('')
  const [revision, setRevision] = useState(null)
  const tituloResultadoRef = useRef(null)
  useEffect(() => { if (aviso) tituloResultadoRef.current?.focus() }, [aviso])
  const [guardando, setGuardando] = useState('')
  const [perfilRechazo, setPerfilRechazo] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const [errorPerfil, setErrorPerfil] = useState(null)
  const [soporte, setSoporte] = useState(null)
  const [soporteDetalle, setSoporteDetalle] = useState(null)
  const [errorReferencia, setErrorReferencia] = useState('')
  const [intentoReferencia, setIntentoReferencia] = useState(0)
  const [sinReferencia, setSinReferencia] = useState(false)
  const soporteId = parametros.get('soporte')
  const perfilResultadoId = parametros.get('perfil')
  const resultadoDetalle = parametros.get('resultado')
  useEffect(() => {
    let activo = true
    if (!soporteId && !perfilResultadoId) return
    async function cargarReferencia() {
      setErrorReferencia('')
      setSinReferencia(false)
      try {
        const perfil = await repositorio.obtenerPerfilTutor(soporteId || perfilResultadoId)
        if (!activo) return
        if (!perfil) { setSinReferencia(true); return }
        if (soporteId) setSoporteDetalle(perfil)
        else {
          const rechazadas = perfil.getMateriasRechazadas()
          const parcial = perfil.getEstadoVerificacion() === EstadoVerificacion.VERIFICADO && rechazadas.length > 0
          const rechazada = parcial || perfil.getEstadoVerificacion() === EstadoVerificacion.RECHAZADO
          if (perfil.getEstadoVerificacion() !== EstadoVerificacion.VERIFICADO && !rechazada) throw new Error('La revisión de este perfil sigue pendiente.')
          const materias = parcial ? rechazadas : perfil.getMaterias().map((materia) => materia.getNombre())
          setRevision({ detallada:true, rechazada, parcial, materias, nombre:perfil.getEstudiante().getNombre(), motivo:perfil.getMotivoRechazo() ?? '', perfil })
          setAviso(parcial ? 'Materia rechazada.' : rechazada ? 'Perfil rechazado.' : 'Perfil verificado.')
        }
      } catch (fallo) { if (activo) setErrorReferencia(fallo.message) }
    }
    cargarReferencia()
    return () => { activo = false }
  }, [soporteId, perfilResultadoId, resultadoDetalle, intentoReferencia])
  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setErrorCarga('')
      try {
        if (vista === 'panel') {
          const resumen = await repositorio.obtenerMetricas()
          if (activo) setMetricas(resumen)
        } else {
          const pendientes = await repositorio.listarPerfilesPendientes()
          if (activo) setPerfiles(pendientes)
        }
      } catch (error) {
        if (activo) setErrorCarga(error.message)
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [vista, intento])

  function cambiarVista(valor) {
    setAviso(''); setRevision(null); setErrorReferencia(''); setSoporteDetalle(null)
    setParametros({ vista:valor })
  }
  function usarFlechas(evento) {
    if (!['ArrowLeft', 'ArrowRight'].includes(evento.key)) return
    evento.preventDefault()
    const botones = [...evento.currentTarget.querySelectorAll('[role="tab"]')]
    const siguiente = botones[(botones.indexOf(document.activeElement) + (evento.key === 'ArrowLeft' ? botones.length - 1 : 1)) % botones.length]
    siguiente.focus()
    siguiente.click()
  }
  function abrirRechazo(perfil) {
    setPerfilRechazo(perfil.getId())
    setMotivo('')
    setErrorAccion('')
  }
  function cerrar() { if (!guardando) setPerfilRechazo(null) }
  function mostrarSoporte(perfil) {
    setSoporte(perfil)
  }
  function mostrarDetalleSoporte(perfil) {
    setSoporte(null); setSoporteDetalle(perfil); setErrorReferencia('')
    setParametros({ vista:'perfiles', soporte:perfil.getId() })
    window.scrollTo(0, 0)
  }
  function volverPendientes() { setAviso(''); setRevision(null); setErrorReferencia(''); setSoporteDetalle(null); setParametros({ vista:'perfiles' }); window.scrollTo(0, 0) }

  async function revisar(id, rechazar, detallada = false) {
    if (guardando) return
    setGuardando(id)
    setErrorAccion('')
    setErrorPerfil(null)
    setAviso('')
    try {
      const perfil = await repositorio.obtenerPerfilTutor(id)
      if (!perfil) throw new Error('No encontramos este perfil. Vuelve a cargar la lista.')
      if (perfil.getEstadoVerificacion() !== EstadoVerificacion.PENDIENTE) {
        setPerfiles(await repositorio.listarPerfilesPendientes())
        if (detallada) setSoporteDetalle(perfil)
        if (soporte?.getId() === id) setSoporte(perfil)
        throw new Error('Otra persona ya revisó este perfil. Actualizamos la lista.')
      }
      // Lo que se revisa se toma antes de guardar: al verificar, las materias dejan de estar por verificar
      const materias = materiasEnRevision(perfil)
      const parcial = rechazar && soloMateriasNuevas(perfil)
      if (rechazar) usuario.rechazarTutor(perfil, motivo)
      else usuario.verificarTutor(perfil)
      await repositorio.guardarPerfilTutor(perfil)
      // La revisión ya quedó guardada: si falla el refresco, el perfil sale de la lista local
      try { setPerfiles(await repositorio.listarPerfilesPendientes()) }
      catch { setPerfiles((anteriores) => anteriores.filter((item) => item.getId() !== id)) }
      setPerfilRechazo(null)
      setSoporte(null)
      setAviso(parcial ? 'Materia rechazada.' : rechazar ? 'Perfil rechazado.' : 'Perfil verificado.')
      setRevision({ detallada, rechazada:rechazar, parcial, materias, nombre:perfil.getEstudiante().getNombre(), motivo:rechazar ? motivo.trim() : '', perfil })
      if (detallada) setParametros({ vista:'perfiles', resultado:rechazar ? 'no-verificado' : 'verificado', perfil:id }, { replace:true })
      window.scrollTo(0, 0)
    } catch (error) {
      if (rechazar) setErrorAccion(error.message)
      else setErrorPerfil({ id, mensaje: error.message })
    } finally {
      setGuardando('')
    }
  }

  function descargarCsv() {
    const url = URL.createObjectURL(new Blob([metricasACsv(metricas, INSTITUCION.sedes)], { type: 'text/csv;charset=utf-8' }))
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `conectatutor-metricas-${fechaEnColombia(new Date())}.csv`
    document.body.append(enlace)
    enlace.click()
    enlace.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  const filtrados = perfiles.filter((perfil) => !sede || perfil.getEstudiante().getSede() === sede)
  const perfilEnRechazo = perfiles.find((perfil) => perfil.getId() === perfilRechazo)
    ?? (soporteDetalle?.getId() === perfilRechazo ? soporteDetalle : null)
  const rechazoParcial = Boolean(perfilEnRechazo) && soloMateriasNuevas(perfilEnRechazo)
  const materiasRechazo = rechazoParcial ? materiasEnRevision(perfilEnRechazo) : []
  const modalRechazo = 
  <ModalMotivo
    abierto={perfilRechazo !== null}
    titulo={rechazoParcial ? `Rechazar ${unirNombres(materiasRechazo)}` : 'Rechazar perfil'}
    etiquetaConfirmar={rechazoParcial ? (materiasRechazo.length > 1 ? 'Rechazar materias' : 'Rechazar materia') : 'Rechazar perfil'}
    motivo={motivo}
    alCambiarMotivo={setMotivo}
    errorMotivo=""
    errorAccion={errorAccion}
    enviando={!!guardando}
    alConfirmar={() => revisar(perfilRechazo, true, Boolean(soporteId))}
    alCerrar={cerrar} />
  if ((soporteId || perfilResultadoId) && errorReferencia) return <MensajeError mensaje={errorReferencia} alReintentar={() => setIntentoReferencia((valor) => valor + 1)} forma="perfil" />
  if ((soporteId || perfilResultadoId) && sinReferencia) return <EstadoVacio icono="bi-person" titulo="No encontramos este perfil" texto="Vuelve a pendientes para consultar los perfiles disponibles." />
  if ((soporteId && soporteDetalle?.getId() !== soporteId) || (perfilResultadoId && (!revision?.detallada || revision.perfil.getId() !== perfilResultadoId))) return <Cargando texto="Cargando revisión…" />
  if (soporteId && soporteDetalle) {
    const estudiante = soporteDetalle.getEstudiante()
    const enRevision = materiasEnRevision(soporteDetalle)
    const materia = enRevision.length ? unirNombres(enRevision) : 'Sin materia seleccionada'
    const parcial = soloMateriasNuevas(soporteDetalle)
    const pendiente = soporteDetalle.getEstadoVerificacion() === EstadoVerificacion.PENDIENTE
    return <>
        <section className="ct-estado-formulario">
            <h1>Soporte académico de {estudiante.getNombre().split(' ')[0]}
        </h1>
            <p className="ct-texto-secundario">Este soporte solo lo ve el administrador. No se muestra en el perfil público.
        </p>
            <div className="ct-dato">
                <small>Solicitante
          </small>
          {estudiante.getNombre()}, {estudiante.getPrograma().getNombre()}, {estudiante.getSemestre()}.º semestre
        </div>
            <div className="ct-dato">
                <small>{enRevision.length > 1 ? `Materias por verificar (${enRevision.length})` : 'Materia por verificar'}
          </small>
          {materia}
        </div>
        {parcial &&
        <div className="ct-dato">
                <small>Materias ya aprobadas
          </small>
          {unirNombres(soporteDetalle.getMaterias().filter((item) => !soporteDetalle.getMateriasPorVerificar().includes(item)).map((item) => item.getNombre()))}
        </div>}
            <div className="ct-dato">
                <small>Documento adjunto
          </small>Constancia académica de {materia}
          <small>Documento de muestra.
          </small>
              </div>
        {pendiente && enRevision.length > 1 &&
        <p className="ct-texto-secundario">Al verificar se aprueban las {enRevision.length} materias. Revisa el soporte de cada una; si alguna no corresponde, rechaza y escribe cuál en el motivo.
        </p>}
        {errorPerfil?.id === soporteDetalle.getId() && 
        <MensajeError mensaje={errorPerfil.mensaje} />}
        <div className="ct-estado-formulario-acciones">
          {pendiente && 
          <>
                    <Boton anchoCompleto cargando={!!guardando} alHacerClic={() => revisar(soporteDetalle.getId(), false, true)}>Verificar a {estudiante.getNombre().split(' ')[0]}
            </Boton>
                    <Boton variante="secundario" anchoCompleto deshabilitado={!!guardando} alHacerClic={() => abrirRechazo(soporteDetalle)}>{parcial ? (enRevision.length > 1 ? 'Rechazar materias nuevas' : 'Rechazar materia nueva') : 'Rechazar verificación'}
            </Boton>
                  </>}
          <Boton variante="secundario" anchoCompleto deshabilitado={!!guardando} alHacerClic={volverPendientes}>Volver a pendientes
          </Boton>
              </div>
          </section>
      {modalRechazo}
    </>
  }
  if (vista === 'perfiles' && aviso && revision?.detallada) return <section className="ct-estado-formulario">
      <span className={revision.rechazada ? 'ct-paso' : 'ct-confirmacion-etiqueta'}>
      {revision.parcial ? 'Materia no aprobada' : revision.rechazada ? 'Perfil no verificado' : 'Verificación completada'}
    </span>
      <h1 ref={tituloResultadoRef} tabIndex={-1}>
      {revision.rechazada ? 'Se necesita un soporte actualizado' : revision.nombre.split(' ')[0] + ': perfil verificado'}
    </h1>
      <p className="ct-texto-secundario">
      {revision.parcial ? `El soporte no permite confirmar ${unirNombres(revision.materias)}. Sale de su oferta y el perfil sigue verificado con sus demás materias.` : revision.rechazada ? 'El soporte no permite confirmar la materia. El perfil no recibe la insignia.' : 'Su perfil ya muestra la insignia de tutor verificado.'}
    </p>
      <div className="ct-dato">
          <small>Tutor
      </small>
      {revision.nombre}
    </div>
      <div className="ct-dato">
          <small>
        {revision.rechazada ? 'Motivo' : revision.materias.length > 1 ? 'Materias aprobadas' : 'Materia'}
      </small>
      {revision.rechazada ? revision.motivo : unirNombres(revision.materias) || 'Sin materia seleccionada'}
    </div>
      <div className="ct-estado-formulario-acciones">
          <Boton anchoCompleto alHacerClic={() => revision.rechazada ? mostrarDetalleSoporte(revision.perfil) : volverPendientes()}>
        {revision.rechazada ? 'Volver al soporte' : 'Volver a pendientes'}
      </Boton>
        </div>
    </section>

  return <section className="ct-solicitante ct-tutor">
    <span className="ct-etiqueta-admin">SOLO ADMINISTRACIÓN</span>
    <h1 className="ct-solo-escritorio">Coordinación</h1>
    <div role="tablist" aria-label="Vistas de Coordinación" className="ct-pestanas" onKeyDown={usarFlechas}>
      {[['perfiles', 'Perfiles por verificar'], ['panel', 'Panel de permanencia']].map(([valor, etiqueta]) => <button
        key={valor}
        type="button"
        role="tab"
        id={`coordinacion-tab-${valor}`}
        aria-selected={vista === valor}
        aria-controls={`coordinacion-panel-${valor}`}
        tabIndex={vista === valor ? 0 : -1}
        disabled={!!guardando}
        onClick={() => cambiarVista(valor)}>
        {etiqueta}
      </button>)}
    </div>
    <div role="tabpanel" id="coordinacion-panel-perfiles" aria-labelledby="coordinacion-tab-perfiles" hidden={vista !== 'perfiles'}>
      {vista === 'perfiles' && <>
        <h2 ref={tituloResultadoRef} tabIndex={-1}>{aviso ? revision?.rechazada ? 'Revisión completada' : 'Verificación completada' : 'Perfiles por revisar'}</h2>
        <p className="ct-texto-secundario">{filtrados.length} {filtrados.length === 1 ? 'perfil pendiente' : 'perfiles pendientes'}</p>
        {aviso && 
        <div role="status" className="ct-aviso">
            <strong>
            {revision?.parcial ? `${revision.nombre.split(' ')[0]}: ${unirNombres(revision.materias)} no aprobada${revision.materias.length > 1 ? 's' : ''}` : revision?.rechazada ? 'Perfil no verificado' : `${revision?.nombre.split(' ')[0]}: perfil verificado`}
          </strong>
            <p>
            {revision?.rechazada ? revision.motivo : `Materias aprobadas: ${unirNombres(revision?.materias ?? [])}.`}
          </p>
          </div>}
        {!aviso && 
        <>
            <div className="ct-herramientas-admin">
                <Link className="ct-boton btn-ct-secundario" to="/admin/materias">Gestionar materias
            </Link>
                <Link className="ct-boton btn-ct-secundario" to="/admin/reportes">Revisar reportes
            </Link>
              </div>
        <div className="ct-filtro-sede">
            <CampoFormulario
            etiqueta="Sede"
            tipo="select"
            valor={sede}
            alCambiar={setSede}
            opciones={[{ valor: '', etiqueta: 'Todas las sedes' }, ...INSTITUCION.sedes.map((valor) => ({ valor, etiqueta: valor }))]} />
          </div>
        </>}
        {errorPerfil && !filtrados.some((perfil) => perfil.getId() === errorPerfil.id) && <MensajeError mensaje={errorPerfil.mensaje} />}
        {cargando ? 
        <Cargando texto="Cargando perfiles…" /> : errorCarga ? 
        <MensajeError mensaje={errorCarga} alReintentar={() => setIntento((valor) => valor + 1)} forma="tarjetas" /> : !filtrados.length ? 
        <EstadoVacio icono="bi-shield-check" titulo="No hay perfiles por verificar" texto="Cuando un estudiante active su perfil de tutor, aparecerá aquí." /> : 
        <div className="ct-lista-perfiles">
          {filtrados.map((perfil) => {
          const estudiante = perfil.getEstudiante()
          return <article key={perfil.getId()} className="ct-revision-perfil">
            <header className="ct-perfil-encabezado">
                <Avatar nombre={estudiante.getNombre()} usuarioId={estudiante.getId()} />
                <div className="ct-perfil-identidad">
                    <h3>
                  {estudiante.getNombre()}
                </h3>
                    <p className="ct-texto-secundario">
                  {estudiante.getPrograma().getNombre()} · {estudiante.getSemestre()}.º semestre · {estudiante.getSede()}
                </p>
                  </div>
              </header>
            <p className="ct-materias-revision" title={perfil.getMaterias().map((materia) => materia.getNombre()).join(', ')}>
              {soloMateriasNuevas(perfil) ? `Por verificar: ${materiasEnRevision(perfil).join(', ')}` : perfil.getMaterias().map((materia) => materia.getNombre()).join(', ')}
            </p>
            {(!perfil.getMaterias().length || !perfil.getDisponibilidad().length) && <p>Este perfil todavía no tiene materias u horarios.</p>}
            <Boton variante="secundario" anchoCompleto alHacerClic={() => mostrarSoporte(perfil)}>Ver soporte académico</Boton>
            <div className="ct-acciones">
                <Boton cargando={guardando === perfil.getId() && !perfilRechazo} deshabilitado={!!guardando} alHacerClic={() => revisar(perfil.getId(), false)}>Verificar
              </Boton>
                <Boton variante="secundario" deshabilitado={!!guardando} alHacerClic={() => abrirRechazo(perfil)}>Rechazar
              </Boton>
              </div>
            {errorPerfil?.id === perfil.getId() && <MensajeError mensaje={errorPerfil.mensaje} />}
          </article>
        })}</div>}
        {aviso && 
        <>
            <p className="ct-texto-secundario ct-aviso-solicitud">Los soportes académicos no se muestran en el perfil público.
          </p>
            <Boton variante="secundario" alHacerClic={volverPendientes}>Volver a pendientes
          </Boton>
          </>}
      </>}
    </div>
    <div role="tabpanel" id="coordinacion-panel-panel" aria-labelledby="coordinacion-tab-panel" hidden={vista !== 'panel'}>
      {vista === 'panel' && <>
        <h2>Panel de permanencia</h2>
        <p className="ct-texto-secundario">{INSTITUCION.dependenciaVerificadora}</p>
        <p>Cifras agregadas de ConectaTutor. No se muestran datos de estudiantes individuales.</p>
        {cargando ? <Cargando texto="Cargando cifras…" /> : errorCarga ? <MensajeError mensaje={errorCarga} alReintentar={() => setIntento((valor) => valor + 1)} forma="tarjetas" /> : metricas && <>
          <div className="ct-indicadores">
            {[['solicitudes', 'Solicitudes'], ['finalizadas', 'Tutorías realizadas'], ['estudiantesAtendidos', 'Estudiantes atendidos'], ['tutoresVerificados', 'Tutores verificados']].map(([clave, etiqueta]) => <div key={clave} className="ct-indicador">
                  <strong>
                {metricas.total[clave]}
              </strong>
                  <span>
                {etiqueta}
              </span>
                </div>)}
          </div>
          <div className="ct-tabla-sedes" tabIndex={0} aria-label="Tabla por sede, desplazable">
            <table><caption>Por sede</caption><thead><tr><th scope="col">Sede</th>{columnas.map(([clave, etiqueta]) => <th scope="col" key={clave}>{etiqueta}</th>)}</tr></thead>
              <tbody>
                {INSTITUCION.sedes.map((nombre) => <tr key={nombre}>
                      <th scope="row">
                    {nombre}
                  </th>
                  {columnas.map(([clave]) => <td key={clave}>
                    {presentarValor(metricas.porSede[nombre], clave)}
                  </td>)}
                </tr>)}
              </tbody>
              <tfoot><tr><th scope="row">Total</th>{columnas.map(([clave]) => <td key={clave}>{presentarValor(metricas.total, clave)}</td>)}</tr></tfoot>
            </table>
          </div>
          {metricas.motivosCancelacion && <section className="ct-motivos-cancelacion" aria-labelledby="titulo-motivos">
            <h3 id="titulo-motivos">¿Por qué se cancelan las tutorías?</h3>
            <p className="ct-texto-secundario">Respuestas de la encuesta al cancelar. Una cancelación puede marcar varias razones.</p>
            {(() => {
              const filas = Object.entries(MOTIVOS_CANCELACION).map(([clave, texto]) => [texto, metricas.motivosCancelacion[clave] ?? 0])
              const mayor = Math.max(1, ...filas.map(([, cantidad]) => cantidad))
              return <ul>{filas.sort((x, y) => y[1] - x[1]).map(([texto, cantidad]) => <li key={texto}>
                <span>{texto}</span><strong>{cantidad}</strong>
                <span className="ct-barra-motivo" aria-hidden="true"><span style={{ width: `${(cantidad / mayor) * 100}%` }} /></span>
              </li>)}</ul>
            })()}
          </section>}
          <Boton variante="secundario" icono="bi-download" alHacerClic={descargarCsv}>Descargar CSV</Boton>
        </>}
      </>}
    </div>
    {modalRechazo}
    <Modal
      abierto={soporte !== null}
      titulo="Soporte académico"
      alCerrar={() => { if (!guardando) setSoporte(null) }}
      pie={<><Boton cargando={!!guardando} deshabilitado={soporte?.getEstadoVerificacion() !== EstadoVerificacion.PENDIENTE} alHacerClic={() => revisar(soporte.getId(),
         false)}>Verificar perfil</Boton><Boton variante="secundario" deshabilitado={!!guardando} alHacerClic={() => setSoporte(null)}>Volver a pendientes</Boton></>}>
      {soporte && 
      <>
          <span className="ct-etiqueta-admin">SOPORTE ACADÉMICO
        </span>
          <h2>
          {soporte.getEstudiante().getNombre()}
        </h2>
          <p>
          {soporte.getEstudiante().getPrograma().getNombre()} · {soporte.getEstudiante().getSemestre()}.º semestre
        </p>
          <div className="ct-dato">
              <i className="bi bi-journal-check" aria-hidden="true" />
              <h3>Constancia académica
          </h3>
              <p>{materiasEnRevision(soporte).length > 1 ? 'Asignaturas por verificar' : 'Asignatura'}: {unirNombres(materiasEnRevision(soporte)) || 'Sin materia seleccionada'}
          </p>
              <p>Estado: documento recibido
          </p>
              <p>Validación: {soporte.getEstadoVerificacion() === EstadoVerificacion.PENDIENTE ? 'pendiente' : soporte.getEstadoVerificacion() === EstadoVerificacion.VERIFICADO ? 'verificada' : 'no verificada'}
          </p>
              <p className="ct-texto-secundario">{materiasEnRevision(soporte).length > 1 ? 'Al verificar se aprueban todas estas materias. Revisa que el soporte corresponda a cada una.' : 'Revisa que el soporte corresponda a la materia antes de verificar al tutor.'}
          </p>
              <small>Documento de muestra.
          </small>
              <Boton variante="secundario" anchoCompleto alHacerClic={() => mostrarDetalleSoporte(soporte)}>Ver detalle del soporte
          </Boton>
            </div>
        {errorPerfil?.id === soporte.getId() && 
        <MensajeError mensaje={errorPerfil.mensaje} />}
      </>}
    </Modal>
  </section>
}

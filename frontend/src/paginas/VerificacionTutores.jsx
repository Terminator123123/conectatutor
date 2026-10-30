// Revisa perfiles de tutor y presenta cifras agregadas de Permanencia por sede.
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { INSTITUCION } from '../config/institucion.js'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { repositorio } from '../servicios/instancias.js'
import { EstadoVerificacion } from '../modelo/enums.js'
import { calcularMetricas, metricasACsv } from '../servicios/metricas.js'
import { ETIQUETAS_DIA, fechaEnColombia, formatearFranja } from '../servicios/agenda.js'
import Avatar from '../componentes/ui/Avatar.jsx'
import ChipMateria from '../componentes/ui/ChipMateria.jsx'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import Boton from '../componentes/ui/Boton.jsx'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'
import ModalMotivo from '../componentes/sesiones/ModalMotivo.jsx'
import '../estilos/solicitante.css'
import '../estilos/tutor.css'

const columnas = [
  ['solicitudes', 'Solicitudes'], ['pendientes', 'Pendientes'], ['confirmadas', 'Confirmadas'],
  ['finalizadas', 'Finalizadas'], ['rechazadas', 'Rechazadas'], ['canceladas', 'Canceladas'],
  ['estudiantesAtendidos', 'Estudiantes atendidos'], ['tutoresVerificados', 'Tutores verificados'],
  ['tutoresPendientes', 'Tutores pendientes'], ['calificacionPromedio', 'Calificación promedio'],
]
const presentarValor = (fila, clave) => clave === 'calificacionPromedio' ? (fila[clave] === null ? '—' : fila[clave].toFixed(1).replace('.', ',')) : fila[clave]
const ordenarFranjas = (a, b) => Object.keys(ETIQUETAS_DIA).indexOf(a.getDia()) - Object.keys(ETIQUETAS_DIA).indexOf(b.getDia()) || a.getHoraInicio().localeCompare(b.getHoraInicio())

/** @returns {import('react').ReactElement} Revisión institucional y panel sin datos individuales. */
export default function VerificacionTutores() {
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
  const [guardando, setGuardando] = useState('')
  const [perfilRechazo, setPerfilRechazo] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const [errorPerfil, setErrorPerfil] = useState(null)
  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setErrorCarga('')
      try {
        if (vista === 'panel') {
          const [sesiones, tutores] = await Promise.all([repositorio.listarSesiones(), repositorio.listarPerfilesTutor()])
          if (activo) setMetricas(calcularMetricas(sesiones, tutores, INSTITUCION.sedes))
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
    setParametros((anteriores) => { const nuevos = new URLSearchParams(anteriores); nuevos.set('vista', valor); return nuevos })
  }
  function usarFlechas(evento) {
    if (!['ArrowLeft', 'ArrowRight'].includes(evento.key)) return
    evento.preventDefault()
    const botones = [...evento.currentTarget.querySelectorAll('[role="tab"]')]
    const siguiente = botones[(botones.indexOf(document.activeElement) + 1) % botones.length]
    siguiente.focus()
    siguiente.click()
  }
  function abrirRechazo(perfil) {
    setPerfilRechazo(perfil.getId())
    setMotivo('')
    setErrorAccion('')
  }
  function cerrar() { if (!guardando) setPerfilRechazo(null) }

  async function revisar(id, rechazar) {
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
        throw new Error('Otra persona ya revisó este perfil. Actualizamos la lista.')
      }
      if (rechazar) usuario.rechazarTutor(perfil, motivo)
      else usuario.verificarTutor(perfil)
      await repositorio.guardarPerfilTutor(perfil)
      setPerfiles(await repositorio.listarPerfilesPendientes())
      setPerfilRechazo(null)
      setAviso(rechazar ? 'Perfil rechazado.' : 'Perfil verificado.')
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

  return <section className="ct-solicitante ct-tutor">
    <h1>Coordinación</h1>
    <p className="ct-texto-secundario">{INSTITUCION.dependenciaVerificadora}</p>
    <div role="status" className={aviso ? 'ct-aviso' : undefined}>{aviso}</div>
    <div role="tablist" aria-label="Vistas de Coordinación" className="ct-pestanas" onKeyDown={usarFlechas}>
      {[['perfiles', 'Perfiles por verificar'], ['panel', 'Panel de permanencia']].map(([valor, etiqueta]) => <button key={valor} type="button" role="tab" id={`coordinacion-tab-${valor}`} aria-selected={vista === valor} aria-controls={`coordinacion-panel-${valor}`} tabIndex={vista === valor ? 0 : -1} disabled={!!guardando} onClick={() => cambiarVista(valor)}>{etiqueta}</button>)}
    </div>
    <div role="tabpanel" id="coordinacion-panel-perfiles" aria-labelledby="coordinacion-tab-perfiles" hidden={vista !== 'perfiles'}>
      {vista === 'perfiles' && <>
        <h2>Perfiles por verificar</h2>
        <div className="ct-filtro-sede"><CampoFormulario etiqueta="Sede" tipo="select" valor={sede} alCambiar={setSede} opciones={[{ valor: '', etiqueta: 'Todas las sedes' }, ...INSTITUCION.sedes.map((valor) => ({ valor, etiqueta: valor }))]} /></div>
        {errorPerfil && !filtrados.some((perfil) => perfil.getId() === errorPerfil.id) && <MensajeError mensaje={errorPerfil.mensaje} />}
        {cargando ? <Cargando texto="Cargando perfiles…" /> : errorCarga ? <MensajeError mensaje={errorCarga} alReintentar={() => setIntento((valor) => valor + 1)} /> : !filtrados.length ? <EstadoVacio icono="bi-shield-check" titulo="No hay perfiles por verificar" texto="Cuando un estudiante active su perfil de tutor, aparecerá aquí." /> : <div className="ct-lista-perfiles">{filtrados.map((perfil) => {
          const estudiante = perfil.getEstudiante()
          return <article key={perfil.getId()} className="ct-revision-perfil">
            <header className="ct-perfil-encabezado"><Avatar nombre={estudiante.getNombre()} tamano={64} /><div className="ct-perfil-identidad"><h3>{estudiante.getNombre()}</h3><p>{estudiante.getCorreo()}</p><p className="ct-texto-secundario">{estudiante.getPrograma().getNombre()} · {estudiante.getSemestre()}.º semestre · {estudiante.getSede()}</p></div></header>
            <p>{perfil.getBiografia()}</p>
            <div className="ct-materias">{perfil.getMaterias().map((materia) => <ChipMateria key={materia.getId()} nombre={materia.getNombre()} />)}</div>
            <ul className="ct-horarios">{perfil.getDisponibilidad().sort(ordenarFranjas).map((franja) => <li key={franja.toString()}>{formatearFranja(franja)}</li>)}</ul>
            {(!perfil.getMaterias().length || !perfil.getDisponibilidad().length) && <p>Este perfil todavía no tiene materias u horarios.</p>}
            <div className="ct-acciones"><Boton cargando={guardando === perfil.getId() && !perfilRechazo} deshabilitado={!!guardando} alHacerClic={() => revisar(perfil.getId(), false)}>Verificar</Boton><Boton variante="secundario" deshabilitado={!!guardando} alHacerClic={() => abrirRechazo(perfil)}>Rechazar</Boton></div>
            {errorPerfil?.id === perfil.getId() && <MensajeError mensaje={errorPerfil.mensaje} />}
          </article>
        })}</div>}
      </>}
    </div>
    <div role="tabpanel" id="coordinacion-panel-panel" aria-labelledby="coordinacion-tab-panel" hidden={vista !== 'panel'}>
      {vista === 'panel' && <>
        <h2>Panel de permanencia</h2>
        <p>Cifras agregadas de ConectaTutor. No se muestran datos de estudiantes individuales.</p>
        {cargando ? <Cargando texto="Cargando cifras…" /> : errorCarga ? <MensajeError mensaje={errorCarga} alReintentar={() => setIntento((valor) => valor + 1)} /> : metricas && <>
          <div className="ct-indicadores">{[['solicitudes', 'Solicitudes'], ['finalizadas', 'Tutorías realizadas'], ['estudiantesAtendidos', 'Estudiantes atendidos'], ['tutoresVerificados', 'Tutores verificados']].map(([clave, etiqueta]) => <div key={clave} className="ct-indicador"><strong>{metricas.total[clave]}</strong><span>{etiqueta}</span></div>)}</div>
          <div className="ct-tabla-sedes" tabIndex={0} aria-label="Tabla por sede, desplazable">
            <table><caption>Por sede</caption><thead><tr><th scope="col">Sede</th>{columnas.map(([clave, etiqueta]) => <th scope="col" key={clave}>{etiqueta}</th>)}</tr></thead>
              <tbody>{INSTITUCION.sedes.map((nombre) => <tr key={nombre}><th scope="row">{nombre}</th>{columnas.map(([clave]) => <td key={clave}>{presentarValor(metricas.porSede[nombre], clave)}</td>)}</tr>)}</tbody>
              <tfoot><tr><th scope="row">Total</th>{columnas.map(([clave]) => <td key={clave}>{presentarValor(metricas.total, clave)}</td>)}</tr></tfoot>
            </table>
          </div>
          <Boton variante="secundario" icono="bi-download" alHacerClic={descargarCsv}>Descargar CSV</Boton>
        </>}
      </>}
    </div>
    <ModalMotivo abierto={perfilRechazo !== null} titulo="Rechazar perfil" etiquetaConfirmar="Rechazar perfil" motivo={motivo} alCambiarMotivo={setMotivo} errorMotivo="" errorAccion={errorAccion} enviando={!!guardando} alConfirmar={() => revisar(perfilRechazo, true)} alCerrar={cerrar} />
  </section>
}

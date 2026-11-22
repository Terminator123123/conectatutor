import { formatearMoneda, interpretarMoneda } from '../componentes/ui/moneda.js'
// Administra la oferta del estudiante tutor y su revisión por Coordinación.
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { INSTITUCION } from '../config/institucion.js'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { repositorio } from '../servicios/instancias.js'
import { ETIQUETAS_DIA } from '../servicios/agenda.js'
import { unirNombres } from '../servicios/nombres.js'
import FranjaHoraria from '../modelo/FranjaHoraria.js'
import { EstadoVerificacion } from '../modelo/enums.js'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import Boton from '../componentes/ui/Boton.jsx'
import ChipEstado from '../componentes/ui/ChipEstado.jsx'
import ChipMateria from '../componentes/ui/ChipMateria.jsx'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'
import Avatar from '../componentes/ui/Avatar.jsx'
import FotoPerfil from '../componentes/cuenta/FotoPerfil.jsx'
import CambioClave from '../componentes/cuenta/CambioClave.jsx'
import '../estilos/solicitante.css'
import '../estilos/tutor.css'

const bloques = [['08:00','10:00'], ['10:00','12:00'], ['14:00','16:00'], ['16:00','18:00']]
const opcionesDias = Object.entries(ETIQUETAS_DIA).map(([valor, etiqueta]) => ({ valor, etiqueta }))

/** @returns {import('react').ReactElement} Datos personales y edición de la oferta propia. */
export default function MiPerfil() {
  useTituloPagina('Mi perfil')
  const { usuario, cerrarSesion, actualizarUsuario } = useAutenticacion()
  const navigate = useNavigate()
  const usuarioId = usuario.getId()
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [intento, setIntento] = useState(0)
  const [biografia, setBiografia] = useState('')
  const [biografiaTocada, setBiografiaTocada] = useState(false)
  const [programaId, setProgramaId] = useState('')
  const [materias, setMaterias] = useState([])
  const [materiaId, setMateriaId] = useState('')
  const [cargandoMaterias, setCargandoMaterias] = useState(false)
  const [errorMaterias, setErrorMaterias] = useState('')
  const [intentoMaterias, setIntentoMaterias] = useState(0)
  const [tarifa, setTarifa] = useState('')
  const [parametros, setParametros] = useSearchParams()
  const editando = parametros.get('editar') === '1'
  function setEditando(valor) {
    setParametros((anteriores) => { const nuevos = new URLSearchParams(anteriores); if (valor) nuevos.set('editar', '1'); else nuevos.delete('editar'); return nuevos })
  }
  const [editandoMaterias, setEditandoMaterias] = useState(false)
  const [guardando, setGuardando] = useState('')
  const [errores, setErrores] = useState({})
  const [aviso, setAviso] = useState('')
  const [horarioManual, setHorarioManual] = useState({ dia:opcionesDias[0].valor, inicio:'08:00', fin:'10:00' })
  const [errorHorarioManual, setErrorHorarioManual] = useState('')

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setErrorCarga('')
      try {
        const [estudiante, programas] = await Promise.all([repositorio.obtenerUsuario(usuarioId), repositorio.listarProgramas()])
        if (!estudiante) throw new Error('No encontramos tus datos. Vuelve a ingresar.')
        if (activo) {
          setDatos({ estudiante, programas })
          setBiografia(estudiante.getPerfilTutor()?.getBiografia() ?? '')
          setTarifa(estudiante.getPerfilTutor()?.getTarifaHora() == null ? '' : formatearMoneda(estudiante.getPerfilTutor().getTarifaHora()))
          setProgramaId(estudiante.getPrograma().getId())
        }
      } catch (error) {
        if (activo) setErrorCarga(error.message)
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [usuarioId, intento])

  useEffect(() => {
    if (!programaId) return
    let activo = true
    async function cargar() {
      setCargandoMaterias(true)
      setErrorMaterias('')
      try {
        const resultado = await repositorio.listarMaterias(programaId)
        if (activo) setMaterias(resultado)
      } catch (error) {
        if (activo) setErrorMaterias(error.message)
      } finally {
        if (activo) setCargandoMaterias(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [programaId, intentoMaterias])


  const errorBiografia = biografia.trim().length >= 20 && biografia.trim().length <= 500 ? '' : 'Escribe entre 20 y 500 caracteres.'

  async function actuar(clave, seccion, mensaje, modificar) {
    if (guardando) return
    setGuardando(clave)
    setErrores((actuales) => ({ ...actuales, [seccion]: '' }))
    setAviso('')
    try {
      const estudiante = await repositorio.obtenerUsuario(usuarioId)
      if (!estudiante) throw new Error('No encontramos tus datos. Vuelve a ingresar.')
      const perfil = estudiante.esTutor() ? await repositorio.obtenerPerfilTutor(estudiante.getPerfilTutor().getId()) : null
      const actualizado = modificar(perfil, estudiante) ?? perfil
      if (!actualizado) throw new Error('No encontramos tu perfil. Vuelve a cargar la página.')
      const guardado = await repositorio.guardarPerfilTutor(actualizado)
      // Lo guardado ya está confirmado: si falla la lectura posterior se muestra la respuesta del guardado
      let actualizadoUsuario
      try { actualizadoUsuario = await repositorio.obtenerUsuario(usuarioId) }
      catch { actualizadoUsuario = guardado.getEstudiante() }
      setDatos((anteriores) => ({ ...anteriores, estudiante: actualizadoUsuario }))
      try { await actualizarUsuario() } catch { /* la sesión se vuelve a leer al navegar */ }
      setAviso(mensaje)
      if (clave === 'activar' || clave === 'biografia') setBiografia(actualizado.getBiografia())
      if (clave === 'activar') window.scrollTo(0, 0)
      if (clave === 'materia') setMateriaId('')
      return true
    } catch (error) {
      setErrores((actuales) => ({ ...actuales, [seccion]: error.message }))
      return false
    } finally {
      setGuardando('')
    }
  }

  function guardarBiografia(evento, activar) {
    evento.preventDefault()
    setBiografiaTocada(true)
    if (errorBiografia) { evento.currentTarget.querySelector('textarea')?.focus(); return }
    actuar(activar ? 'activar' : 'biografia', 'biografia', activar ? 'Enviamos tu perfil a revisión.' : 'Biografía guardada.',
      (perfil, estudiante) => activar ? estudiante.activarPerfilTutor(biografia.trim()) : perfil.cambiarBiografia(biografia))
  }

  function cambiarTarifa(texto) {
    const importe = interpretarMoneda(texto)
    setTarifa(importe === null ? '' : Number.isFinite(importe) ? formatearMoneda(importe) : texto)
  }

  async function guardarPerfil() {
    setBiografiaTocada(true)
    if (errorBiografia) return
    const guardado = await actuar('perfil', 'perfil', 'Perfil guardado.', (actual) => {
      actual.cambiarBiografia(biografia)
      actual.cambiarTarifa(interpretarMoneda(tarifa))
    })
    if (guardado) { setParametros({ guardado:'1' }, { replace:true }); window.scrollTo(0, 0) }
    return guardado
  }

  if (cargando) return <Cargando texto="Cargando tu perfil…" />
  if (errorCarga) return <MensajeError mensaje={errorCarga} alReintentar={() => setIntento((valor) => valor + 1)} forma="perfil" />
  if (!datos) return <EstadoVacio icono="bi-person" titulo="No encontramos tu perfil" texto="Vuelve a ingresar para consultar tus datos." />
  const { estudiante, programas } = datos
  const perfil = estudiante.getPerfilTutor()
  const correo = INSTITUCION.canalesPermanencia[estudiante.getSede()]
  const estado = perfil?.getEstadoVerificacion()

  if (parametros.get('guardado') === '1') return <section className="ct-estado-formulario">
    <span className="ct-confirmacion-etiqueta">Cambios guardados</span><h1>{perfil ? 'Tu perfil quedó actualizado' : 'Tu perfil está actualizado'}</h1>
    <p className="ct-texto-secundario" role="status">
      {perfil ? 'La disponibilidad se mantiene. Revisa el perfil público o sigue gestionando tus solicitudes.' : 'Tus cambios quedaron guardados.'}
    </p>
    {perfil ? 
    <>
        <div className="ct-dato">
            <small>Tutor
        </small>
        {estudiante.getNombre()}, {estudiante.getSemestre()}.º semestre
      </div>
        <div className="ct-dato">
            <small>Materias
        </small>
        {perfil.getMaterias().map((materia) => materia.getNombre()).join(', ') || 'Sin materias seleccionadas'}
      </div>
        <div className="ct-dato">
            <small>Tarifa
        </small>
        {perfil.getTarifaHora() === null ? 'Gratuita' : formatearMoneda(perfil.getTarifaHora()) + ' por hora'}
      </div>
      </> : 
    <>
        <div className="ct-dato">
            <small>Nombre
        </small>
        {estudiante.getNombre()}
      </div>
        <div className="ct-dato">
            <small>Programa y semestre
        </small>
        {estudiante.getPrograma().getNombre()}, {estudiante.getSemestre()}.º semestre
      </div>
      </>}
    <div className="ct-estado-formulario-acciones">
        <Link className="ct-boton btn-ct-primario" to={perfil ? `/tutores/${perfil.getId()}` : '/tutores'}>
        {perfil ? 'Ver perfil público' : 'Buscar tutores'}
      </Link>
        <Link className="ct-boton btn-ct-secundario" to={perfil ? '/solicitudes' : '/perfil?editar=1'}>
        {perfil ? 'Ver solicitudes' : 'Editar perfil'}
      </Link>
      </div>
  </section>

  function verHorario(valor) { setParametros(valor ? { horario:valor } : {}, { replace:true }); setErrorHorarioManual(''); window.scrollTo(0, 0) }
  async function guardarHorario(evento) {
    evento.preventDefault()
    setErrorHorarioManual('')
    try {
      const franja = new FranjaHoraria({ dia:horarioManual.dia, horaInicio:horarioManual.inicio, horaFin:horarioManual.fin })
      if (!bloques.some(([inicio, fin]) => inicio === horarioManual.inicio && fin === horarioManual.fin)) throw new Error('Elige uno de los bloques de dos horas de la disponibilidad semanal.')
      if (await actuar('horario', 'horarios', 'Disponibilidad guardada.', (actual) => actual.agregarFranja(franja))) verHorario('')
    } catch (fallo) { setErrorHorarioManual(fallo.message); window.scrollTo(0, 0) }
  }
  if (perfil && parametros.has('horario')) {
    if (parametros.get('horario') === 'resumen' && !perfil.getDisponibilidad().length) return <section className="ct-estado-formulario">
        <h1>Agrega tu primer horario
      </h1>
        <p className="ct-texto-secundario">Todavía no ofreces franjas disponibles. Los estudiantes no podrán solicitarte una sesión hasta que agregues una.
      </p>
        <div className="ct-estado-formulario-acciones">
            <Boton anchoCompleto alHacerClic={() => verHorario('agregar')}>Agregar horario
        </Boton>
          </div>
      </section>
    if (errorHorarioManual && horarioManual.inicio >= horarioManual.fin) return <section className="ct-estado-formulario">
        <h1>La hora final debe ser posterior
      </h1>
        <div className="ct-dato">
            <small>Día
        </small>
        {ETIQUETAS_DIA[horarioManual.dia]}
      </div>
        <div className="ct-dato">
            <small>Inicio
        </small>
        {horarioManual.inicio}
      </div>
        <CampoFormulario
        etiqueta="Final"
        valor={horarioManual.fin}
        alCambiar={(fin) => setHorarioManual((anterior) => ({ ...anterior, fin }))}
        error="El final no puede ser anterior o igual al inicio." />
        <div className="ct-estado-formulario-acciones">
            <Boton anchoCompleto alHacerClic={() => setErrorHorarioManual('')}>Corregir horario
        </Boton>
          </div>
      </section>
    return <form className="ct-estado-formulario" noValidate onSubmit={guardarHorario}>
        <h1>Agrega un horario disponible
      </h1>
        <CampoFormulario
        etiqueta="Día"
        tipo="select"
        valor={horarioManual.dia}
        alCambiar={(dia) => setHorarioManual((anterior) => ({ ...anterior, dia }))}
        opciones={opcionesDias} />
        <CampoFormulario
        etiqueta="Inicio"
        tipo="select"
        opciones={["08:00", "10:00", "14:00", "16:00"].map((hora) => ({ valor:hora, etiqueta:hora }))}
        valor={horarioManual.inicio}
        alCambiar={(inicio) => setHorarioManual((anterior) => ({ ...anterior, inicio }))} />
        <CampoFormulario
        etiqueta="Final"
        tipo="select"
        opciones={["10:00", "12:00", "14:00", "16:00", "18:00"].map((hora) => ({ valor:hora, etiqueta:hora }))}
        valor={horarioManual.fin}
        alCambiar={(fin) => setHorarioManual((anterior) => ({ ...anterior, fin }))} />
      {(errorHorarioManual || errores.horarios) && 
      <MensajeError mensaje={errorHorarioManual || errores.horarios} />}
      <div className="ct-estado-formulario-acciones">
            <Boton tipo="submit" anchoCompleto cargando={!!guardando}>Agregar horario
        </Boton>
            <Boton variante="secundario" anchoCompleto alHacerClic={() => verHorario('')}>Volver a mi perfil
        </Boton>
          </div>
      </form>
  }

  if (parametros.get('completar') === '1') return <section className="ct-completar-perfil">
    <span className="ct-etiqueta-admin">PASO 2 DE 2</span>
    <h1>Hagámoslo personal.</h1>
    <p className="ct-texto-secundario">Cuéntanos qué estudias para encontrar el apoyo que necesitas.</p>
    <Avatar nombre={estudiante.getNombre()} usuarioId={estudiante.getId()} tamano={72} />
    <div className="ct-completar-campos">
      {[['Nombre completo', estudiante.getNombre()], ['Programa académico', estudiante.getPrograma().getNombre()], ['Semestre', estudiante.getSemestre() + '.º semestre']].map(([etiqueta, valor], indice) => <div className="ct-campo" key={etiqueta}>
            <label htmlFor={'completar-' + indice} className="ct-campo-etiqueta">
          {etiqueta}
        </label>
            <input id={'completar-' + indice} className="ct-campo-control" value={valor} readOnly />
          </div>)}
    </div>
    <p className="ct-texto-secundario">Para corregir tus datos académicos, consulta a Permanencia desde Mi perfil.</p>
    <div className="ct-completar-extras">
        <Link className="ct-boton btn-ct-secundario" to="/perfil?editar=1">Editar mi perfil
      </Link>
        <Boton variante="secundario" anchoCompleto alHacerClic={() => { cerrarSesion(); navigate('/') }}>Cerrar sesión
      </Boton>
      </div>
    <Link className="ct-boton btn-ct-primario ct-boton-completo" to="/tutores">Guardar perfil</Link>
  </section>

  if (editando) return <section className="ct-editar-perfil">
    <h1>Configuración de la cuenta</h1>
    <p className="ct-nota-universidad"><i className="bi bi-bank" aria-hidden="true" /> Tu nombre, correo, programa, semestre y sede los registra la Universidad de La Guajira. Aquí puedes cambiar tu foto y tu contraseña{perfil ? ', y tu biografía y tarifa de tutor' : ''}.</p>
    <div className="ct-editar-campos">{[
      ['nombre','Nombre completo',estudiante.getNombre()],
      ['correo','Correo institucional (tu usuario)',estudiante.getCorreo()],
      ['programa','Programa académico',estudiante.getPrograma().getNombre()],
      ['semestre','Semestre',estudiante.getSemestre() + '.º semestre'],
      ['sede','Sede',estudiante.getSede()],
    ].map(([clave, etiqueta, valor]) => <div className="ct-campo" key={clave}>
        <label className="ct-campo-etiqueta" htmlFor={'perfil-' + clave}>
        {etiqueta}
      </label>
        <input id={'perfil-' + clave} className="ct-campo-control" value={valor} readOnly />
      </div>)}
    </div>
    <p>Estos datos los actualiza la Universidad. Si algo está mal, escribe a Permanencia: <a className="ct-enlace-texto" href={`mailto:${correo}`}>{correo}</a></p>
    {perfil && <CampoFormulario etiqueta="Biografía" tipo="textarea" valor={biografia} alCambiar={setBiografia} error={biografiaTocada ? errorBiografia : ''} deshabilitado={!!guardando} />}
    {perfil && 
    <>
        <div className="ct-campo">
            <label className="ct-campo-etiqueta" htmlFor="perfil-materias">Materias
        </label>
            <input id="perfil-materias" className="ct-campo-control" value={perfil.getMaterias().map((materia) => materia.getNombre()).join(', ')} readOnly />
            <Link className="ct-enlace-texto" to="/perfil">Editar materias desde mi oferta
        </Link>
          </div>
        <CampoFormulario
        etiqueta="Tarifa por hora (opcional)"
        valor={tarifa}
        alCambiar={cambiarTarifa}
        ayuda="Déjala vacía si tus tutorías son gratuitas."
        deshabilitado={!!guardando} />
      </>}
    <FotoPerfil usuario={estudiante} />
    <CambioClave />
    <Boton variante="secundario" anchoCompleto alHacerClic={() => { cerrarSesion(); navigate('/') }}>Cerrar sesión</Boton>
    {errores.perfil && <MensajeError mensaje={errores.perfil} />}
    {perfil ? <div className="ct-editar-acciones">
        <Boton anchoCompleto
        cargando={!!guardando}
        alHacerClic={async () => { if (!perfil || await guardarPerfil()) { setParametros({ guardado:'1' }, { replace:true }); window.scrollTo(0, 0) } }}>Guardar cambios
      </Boton>
        <Boton anchoCompleto variante="secundario" alHacerClic={() => setEditando(false)}>Cancelar edición
      </Boton>
      </div> : <Boton anchoCompleto variante="secundario" alHacerClic={() => setEditando(false)}>Volver a mi perfil</Boton>}
  </section>

  return <section className="ct-solicitante ct-tutor">
    <h1 className="ct-solo-escritorio">{perfil ? 'Mi perfil de tutor' : 'Mi perfil'}</h1>
    <div role="status" className={aviso ? 'ct-aviso' : undefined}>{aviso}</div>
    <header className="ct-mi-identidad">
      <Avatar nombre={estudiante.getNombre()} usuarioId={estudiante.getId()} tamano={72} />
      <div>
          <h1>
          {estudiante.getNombre()}
        </h1>
          <p>
          {estudiante.getPrograma().getNombre()} · {estudiante.getSemestre()}.º semestre · {estudiante.getSede()}
        </p>
        {perfil && 
        <ChipEstado estado={estado} />}
      </div>
    </header>
    <Boton variante="secundario" anchoCompleto alHacerClic={() => setEditando(!editando)}>{editando ? 'Volver a mi perfil' : 'Editar datos del perfil'}</Boton>
    {!perfil && <Link className="ct-boton btn-ct-secundario ct-boton-completo" to="/perfil?completar=1">Completar perfil</Link>}
    {!perfil ? <section className="ct-tutor-seccion">
      <h2>Quiero ser tutor</h2>
      <p>Comparte lo que sabes con estudiantes de tu sede. Coordinación revisa cada perfil antes de que aparezca en la búsqueda.</p>
      <form noValidate onSubmit={(evento) => guardarBiografia(evento, true)} className="ct-tutor-formulario">
        <div onBlur={() => setBiografiaTocada(true)}>
            <CampoFormulario
            etiqueta="Cuéntales cómo acompañas"
            tipo="textarea"
            valor={biografia}
            alCambiar={setBiografia}
            error={biografiaTocada ? errorBiografia : ''}
            ayuda="Entre 20 y 500 caracteres." obligatorio
            deshabilitado={!!guardando} />
          </div>
        {errores.biografia && <MensajeError mensaje={errores.biografia} />}
        <Boton tipo="submit" cargando={guardando === 'activar'} deshabilitado={!!guardando}>Activar perfil de tutor</Boton>
      </form>
    </section> : <>
      {(estado !== EstadoVerificacion.VERIFICADO || perfil.getMateriasRechazadas().length > 0) && <section className="ct-tutor-seccion"><h2>Estado de verificación</h2><ChipEstado estado={estado} />
        <p className="mt-3">
          {estado === EstadoVerificacion.PENDIENTE
            ? (perfil.tieneMateriasAprobadas()
              ? `Coordinación está revisando ${unirNombres(perfil.getMateriasPorVerificar().map((materia) => materia.getNombre()))}. Mientras tanto sigues apareciendo en la búsqueda con tus materias ya aprobadas; cada materia nueva se publica cuando la aprueben.`
              : 'Coordinación está revisando tu perfil. Mientras tanto no apareces en la búsqueda.')
            : estado === EstadoVerificacion.VERIFICADO ? 'Tu perfil está verificado. Ya apareces en la búsqueda.' : `Coordinación no aprobó tu perfil. Motivo: ${perfil.getMotivoRechazo() ?? 'Consulta con Coordinación.'}`}
        </p>
        {estado !== EstadoVerificacion.RECHAZADO && perfil.getMateriasRechazadas().length > 0 &&
        <p>{`Coordinación no aprobó ${unirNombres(perfil.getMateriasRechazadas())}, así que salió de tu oferta. Motivo: ${perfil.getMotivoRechazo() ?? 'Consulta con Coordinación.'} Tus demás materias siguen publicadas; si vuelves a agregar alguna, pasará otra vez a revisión.`}</p>}
        {(!perfil.getMaterias().length || !perfil.getDisponibilidad().length) && <p>Agrega al menos una materia y un horario para que puedan solicitarte.</p>}
        {estado === EstadoVerificacion.RECHAZADO && 
        <Boton
          variante="secundario"
          cargando={guardando === 'revision'}
          deshabilitado={!!guardando}
          alHacerClic={() => actuar('revision', 'revision', 'Enviamos tu perfil a revisión.', (actual) => actual.solicitarNuevaRevision())}>Pedir nueva revisión
        </Boton>}
        {errores.revision && <MensajeError mensaje={errores.revision} />}
      </section>}
      <section className="ct-tutor-seccion ct-biografia-propia">
        <form noValidate onSubmit={(evento) => guardarBiografia(evento, false)} className="ct-tutor-formulario">
          <div onBlur={() => setBiografiaTocada(true)}>
              <CampoFormulario
              etiqueta="Biografía"
              tipo="textarea"
              valor={biografia}
              alCambiar={setBiografia}
              error={biografiaTocada ? errorBiografia : ''}
              ayuda="Entre 20 y 500 caracteres." obligatorio
              deshabilitado={!!guardando} />
            </div>
          {errores.biografia && <MensajeError mensaje={errores.biografia} />}
        </form>
      </section>
      <section className="ct-tutor-seccion ct-oferta-propia"><h2>Materias</h2>
        <button className="ct-materias-abrir" type="button" aria-expanded={editandoMaterias} onClick={() => setEditandoMaterias(!editandoMaterias)}>
          {perfil.getMaterias().map((materia) => materia.getNombre()).join(', ') || 'Agregar materias'}
        </button>
        {editandoMaterias && <>
        <fieldset disabled={!!guardando} className="ct-selector-contenedor">
            <legend className="visually-hidden">Materias ofrecidas
          </legend>
            <div className="ct-materias">
            {perfil.getMaterias().map((materia) => <ChipMateria
              key={materia.getId()}
              nombre={materia.getNombre()}
              alQuitar={() => actuar(`quitar-${materia.getId()}`, 'materias', 'Materia quitada.', (actual) => actual.quitarMateria(materia))} />)}
          </div>
          </fieldset>
        {!perfil.getMaterias().length && <p className="ct-texto-secundario">Todavía no ofreces materias.</p>}
        <form
          className="ct-tutor-formulario"
          onSubmit={(evento) => { evento.preventDefault(); if (materiaId) actuar('materia',
             'materias',
             'Materia agregada.',
             (actual) => actual.agregarMateria(materias.find((materia) => materia.getId() === materiaId))) }}>
          <div className="ct-campos-tutor">
              <CampoFormulario
              etiqueta="Programa"
              tipo="select"
              valor={programaId}
              alCambiar={(valor) => { setProgramaId(valor); setMateriaId('') }}
              opciones={programas.map((programa) => ({ valor: programa.getId(), etiqueta: programa.getNombre() }))}
              deshabilitado={!!guardando} />
            <CampoFormulario
              etiqueta="Materia"
              tipo="select"
              valor={materiaId}
              alCambiar={setMateriaId}
              placeholder="Selecciona una materia"
              opciones={materias.filter((materia) => !perfil.ofrece(materia)).map((materia) => ({ valor: materia.getId(), etiqueta: materia.getNombre() }))}
              deshabilitado={!!guardando || cargandoMaterias || !!errorMaterias} />
            </div>
          {cargandoMaterias && <Cargando texto="Cargando materias…" />}
          {errorMaterias && <MensajeError mensaje={errorMaterias} alReintentar={() => setIntentoMaterias((valor) => valor + 1)} />}
          {!cargandoMaterias && !errorMaterias && !materias.filter((materia) => !perfil.ofrece(materia)).length && <EstadoVacio titulo="No hay materias disponibles" texto="Todas las materias de este programa ya están en tu oferta o aún no hay materias registradas." />}
          {errores.materias && <MensajeError mensaje={errores.materias} />}
          <Boton
            tipo="submit"
            variante="secundario"
            cargando={guardando === 'materia'}
            deshabilitado={!materiaId || !!guardando || cargandoMaterias || !!errorMaterias}>Agregar materia
          </Boton>
        </form>
        </>}
      </section>
      <section className="ct-tutor-seccion">
        <form
          className="ct-tutor-formulario"
          onSubmit={(evento) => { evento.preventDefault(); actuar('tarifa', 'tarifa', 'Tarifa guardada.', (actual) => actual.cambiarTarifa(interpretarMoneda(tarifa))) }}>
          <CampoFormulario
            etiqueta="Tarifa por hora (opcional)"
            nombre="tarifa"
            valor={tarifa}
            alCambiar={cambiarTarifa}
            ayuda="Déjala vacía si tus tutorías son gratuitas."
            deshabilitado={!!guardando} />
          {errores.tarifa && <MensajeError mensaje={errores.tarifa} />}
        </form>
      </section>
      <section className="ct-tutor-seccion"><h2>Tu disponibilidad semanal</h2>
        <p className="ct-texto-secundario">Selecciona las franjas en las que puedes enseñar.</p>
        <div className="ct-disponibilidad" role="group" aria-label="Disponibilidad semanal">
          {opcionesDias.map(({ valor }, indice) => <strong key={valor} aria-hidden="true">{['L','M','X','J','V','S','D'][indice]}</strong>)}
          {bloques.flatMap(([horaInicio,horaFin]) => opcionesDias.map(({ valor:dia, etiqueta }) => {
            const franja = new FranjaHoraria({ dia, horaInicio, horaFin })
            const activa = perfil.estaDisponible(franja)
            return <button
              key={dia + horaInicio}
              type="button"
              aria-label={`${etiqueta} ${horaInicio}–${horaFin}`}
              aria-pressed={activa}
              disabled={!!guardando}
              onClick={() => actuar('horario', 'horarios', 'Disponibilidad guardada.', (actual) => {
                // Se aplica lo que el botón mostraba al hacer clic, no lo contrario de lo guardado: repetir el clic no revierte un guardado
                if (activa && actual.estaDisponible(franja)) actual.quitarFranja(franja)
                if (!activa && !actual.estaDisponible(franja)) actual.agregarFranja(franja)
                return actual
              })}>
              {horaInicio.slice(0,2)}h
            </button>
          }))}
        </div>
        <div className="ct-resumen-disponibilidad">{bloques.map(([inicio, fin]) => {
          const dias = opcionesDias.filter(({ valor }) => perfil.getDisponibilidad().some((franja) => franja.getDia() === valor && franja.getHoraInicio() === inicio && franja.getHoraFin() === fin)).map(({ etiqueta }) => etiqueta)
          return dias.length ? <p key={inicio}>{dias.join(' y ')} {inicio}–{fin}</p> : null
        })}</div>
        {!perfil.getDisponibilidad().length && <p className="ct-texto-secundario">Todavía no tienes horarios disponibles.</p>}
        <Link className="ct-enlace-texto" to={`/perfil?horario=${perfil.getDisponibilidad().length ? 'agregar' : 'resumen'}`}>
          {perfil.getDisponibilidad().length ? 'Agregar otro horario' : 'Agregar tu primer horario'}
        </Link>
        {errores.horarios && <MensajeError mensaje={errores.horarios} />}
      </section>
      {errores.perfil && <MensajeError mensaje={errores.perfil} />}
      <Boton anchoCompleto cargando={guardando === 'perfil'} deshabilitado={!!guardando} alHacerClic={guardarPerfil}>Guardar perfil</Boton>
      <Link className="ct-boton btn-ct-secundario ct-boton-completo" to="/solicitudes">Ver solicitudes</Link>
      <Link className="ct-boton btn-ct-secundario ct-boton-completo" to="/sesiones?vista=resumen-tutor">Mis sesiones</Link>
    </>}
    <p className="ct-apoyo">Permanencia {estudiante.getSede()}: <a href={`mailto:${correo}`}>{correo}</a></p>
    <Link className="ct-enlace-texto" to="/favoritos">Tutores favoritos</Link>
    <Link className="ct-enlace-texto" to="/notificaciones">Notificaciones</Link>
    <a className="ct-enlace-texto" href={INSTITUCION.urlTratamientoDatos} target="_blank" rel="noreferrer">Aviso de privacidad</a>
    <Link className="ct-boton btn-ct-secundario ct-boton-completo" to="/perfil?editar=1"><i className="bi bi-gear" aria-hidden="true" /> Configuración de la cuenta</Link>
    <Boton variante="secundario" anchoCompleto alHacerClic={() => { cerrarSesion(); navigate('/') }}>Salir</Boton>
  </section>
}

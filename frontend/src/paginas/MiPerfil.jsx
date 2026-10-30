// Administra la oferta del estudiante tutor y su revisión por Coordinación.
import { useEffect, useState } from 'react'
import { INSTITUCION } from '../config/institucion.js'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { repositorio } from '../servicios/instancias.js'
import { ETIQUETAS_DIA, formatearFranja } from '../servicios/agenda.js'
import FranjaHoraria from '../modelo/FranjaHoraria.js'
import { EstadoVerificacion } from '../modelo/enums.js'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import Boton from '../componentes/ui/Boton.jsx'
import ChipEstado from '../componentes/ui/ChipEstado.jsx'
import ChipMateria from '../componentes/ui/ChipMateria.jsx'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'
import '../estilos/solicitante.css'
import '../estilos/tutor.css'

const horas = Array.from({ length: 33 }, (_, indice) => {
  const minutos = 360 + indice * 30
  const valor = `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
  return { valor, etiqueta: valor }
})
const opcionesDias = Object.entries(ETIQUETAS_DIA).map(([valor, etiqueta]) => ({ valor, etiqueta }))
const ordenarFranjas = (a, b) => Object.keys(ETIQUETAS_DIA).indexOf(a.getDia()) - Object.keys(ETIQUETAS_DIA).indexOf(b.getDia()) || a.getHoraInicio().localeCompare(b.getHoraInicio())

/** @returns {import('react').ReactElement} Datos personales y edición de la oferta propia. */
export default function MiPerfil() {
  const { usuario } = useAutenticacion()
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
  const [horario, setHorario] = useState({ dia: opcionesDias[0].valor, horaInicio: '08:00', horaFin: '09:00' })
  const [guardando, setGuardando] = useState('')
  const [errores, setErrores] = useState({})
  const [aviso, setAviso] = useState('')

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
      await repositorio.guardarPerfilTutor(actualizado)
      const actualizadoUsuario = await repositorio.obtenerUsuario(usuarioId)
      setDatos((anteriores) => ({ ...anteriores, estudiante: actualizadoUsuario }))
      setAviso(mensaje)
      if (clave === 'activar' || clave === 'biografia') setBiografia(actualizado.getBiografia())
      if (clave === 'materia') setMateriaId('')
    } catch (error) {
      setErrores((actuales) => ({ ...actuales, [seccion]: error.message }))
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

  if (cargando) return <Cargando texto="Cargando tu perfil…" />
  if (errorCarga) return <MensajeError mensaje={errorCarga} alReintentar={() => setIntento((valor) => valor + 1)} />
  if (!datos) return <EstadoVacio icono="bi-person" titulo="No encontramos tu perfil" texto="Vuelve a ingresar para consultar tus datos." />
  const { estudiante, programas } = datos
  const perfil = estudiante.getPerfilTutor()
  const correo = INSTITUCION.canalesPermanencia[estudiante.getSede()]
  const estado = perfil?.getEstadoVerificacion()
  const cambiarHorario = (nombre, valor) => setHorario((anterior) => ({ ...anterior, [nombre]: valor }))

  return <section className="ct-solicitante ct-tutor">
    <h1>Mi perfil</h1>
    <div role="status" className={aviso ? 'ct-aviso' : undefined}>{aviso}</div>
    <section className="ct-tutor-seccion">
      <h2>Tus datos</h2>
      <dl className="ct-datos-personales">{[
        ['Nombre', estudiante.getNombre()], ['Correo institucional', estudiante.getCorreo()],
        ['Programa', estudiante.getPrograma().getNombre()], ['Semestre', `${estudiante.getSemestre()}.º semestre`], ['Sede', estudiante.getSede()],
      ].map(([etiqueta, valor]) => <div key={etiqueta}><dt>{etiqueta}</dt><dd>{valor}</dd></div>)}</dl>
      <p className="ct-texto-secundario ct-apoyo">Para corregir estos datos, escribe al Área de Permanencia de tu sede: <a href={`mailto:${correo}`}>{correo}</a></p>
    </section>
    {!perfil ? <section className="ct-tutor-seccion">
      <h2>Quiero ser tutor</h2>
      <p>Comparte lo que sabes con estudiantes de tu sede. Coordinación revisa cada perfil antes de que aparezca en la búsqueda.</p>
      <form noValidate onSubmit={(evento) => guardarBiografia(evento, true)} className="ct-tutor-formulario">
        <div onBlur={() => setBiografiaTocada(true)}><CampoFormulario etiqueta="Cuéntales cómo acompañas" tipo="textarea" valor={biografia} alCambiar={setBiografia} error={biografiaTocada ? errorBiografia : ''} ayuda="Entre 20 y 500 caracteres." obligatorio deshabilitado={!!guardando} /></div>
        {errores.biografia && <MensajeError mensaje={errores.biografia} />}
        <Boton tipo="submit" cargando={guardando === 'activar'} deshabilitado={!!guardando}>Activar perfil de tutor</Boton>
      </form>
    </section> : <>
      <section className="ct-tutor-seccion"><h2>Estado de verificación</h2><ChipEstado estado={estado} />
        <p className="mt-3">{estado === EstadoVerificacion.PENDIENTE ? 'Coordinación está revisando tu perfil. Mientras tanto no apareces en la búsqueda.' : estado === EstadoVerificacion.VERIFICADO ? 'Tu perfil está verificado. Ya apareces en la búsqueda.' : `Coordinación no aprobó tu perfil. Motivo: ${perfil.getMotivoRechazo() ?? 'Consulta con Coordinación.'}`}</p>
        {(!perfil.getMaterias().length || !perfil.getDisponibilidad().length) && <p>Agrega al menos una materia y un horario para que puedan solicitarte.</p>}
        {estado === EstadoVerificacion.RECHAZADO && <Boton variante="secundario" cargando={guardando === 'revision'} deshabilitado={!!guardando} alHacerClic={() => actuar('revision', 'revision', 'Enviamos tu perfil a revisión.', (actual) => actual.solicitarNuevaRevision())}>Pedir nueva revisión</Boton>}
        {errores.revision && <MensajeError mensaje={errores.revision} />}
      </section>
      <section className="ct-tutor-seccion"><h2>Biografía</h2>
        <form noValidate onSubmit={(evento) => guardarBiografia(evento, false)} className="ct-tutor-formulario">
          <div onBlur={() => setBiografiaTocada(true)}><CampoFormulario etiqueta="Biografía" tipo="textarea" valor={biografia} alCambiar={setBiografia} error={biografiaTocada ? errorBiografia : ''} ayuda="Entre 20 y 500 caracteres." obligatorio deshabilitado={!!guardando} /></div>
          {errores.biografia && <MensajeError mensaje={errores.biografia} />}
          <Boton tipo="submit" cargando={guardando === 'biografia'} deshabilitado={!!guardando}>Guardar biografía</Boton>
        </form>
      </section>
      <section className="ct-tutor-seccion"><h2>Materias que ofreces</h2>
        <fieldset disabled={!!guardando} className="ct-selector-contenedor"><legend className="visually-hidden">Materias ofrecidas</legend><div className="ct-materias">{perfil.getMaterias().map((materia) => <ChipMateria key={materia.getId()} nombre={materia.getNombre()} alQuitar={() => actuar(`quitar-${materia.getId()}`, 'materias', 'Materia quitada.', (actual) => actual.quitarMateria(materia))} />)}</div></fieldset>
        {!perfil.getMaterias().length && <p className="ct-texto-secundario">Todavía no ofreces materias.</p>}
        <form className="ct-tutor-formulario" onSubmit={(evento) => { evento.preventDefault(); if (materiaId) actuar('materia', 'materias', 'Materia agregada.', (actual) => actual.agregarMateria(materias.find((materia) => materia.getId() === materiaId))) }}>
          <div className="ct-campos-tutor"><CampoFormulario etiqueta="Programa" tipo="select" valor={programaId} alCambiar={(valor) => { setProgramaId(valor); setMateriaId('') }} opciones={programas.map((programa) => ({ valor: programa.getId(), etiqueta: programa.getNombre() }))} deshabilitado={!!guardando} />
            <CampoFormulario etiqueta="Materia" tipo="select" valor={materiaId} alCambiar={setMateriaId} placeholder="Selecciona una materia" opciones={materias.filter((materia) => !perfil.ofrece(materia)).map((materia) => ({ valor: materia.getId(), etiqueta: materia.getNombre() }))} deshabilitado={!!guardando || cargandoMaterias || !!errorMaterias} /></div>
          {cargandoMaterias && <Cargando texto="Cargando materias…" />}
          {errorMaterias && <MensajeError mensaje={errorMaterias} alReintentar={() => setIntentoMaterias((valor) => valor + 1)} />}
          {errores.materias && <MensajeError mensaje={errores.materias} />}
          <Boton tipo="submit" variante="secundario" cargando={guardando === 'materia'} deshabilitado={!materiaId || !!guardando || cargandoMaterias || !!errorMaterias}>Agregar materia</Boton>
        </form>
      </section>
      <section className="ct-tutor-seccion"><h2>Horarios disponibles</h2>
        {perfil.getDisponibilidad().length ? <ul className="ct-horarios">{perfil.getDisponibilidad().sort(ordenarFranjas).map((franja) => <li key={franja.toString()}><span>{formatearFranja(franja)}</span><Boton variante="secundario" cargando={guardando === `quitar-${franja.toString()}`} deshabilitado={!!guardando} alHacerClic={() => actuar(`quitar-${franja.toString()}`, 'horarios', 'Horario quitado.', (actual) => actual.quitarFranja(franja))}>Quitar</Boton></li>)}</ul> : <p className="ct-texto-secundario">Todavía no tienes horarios disponibles.</p>}
        <form className="ct-tutor-formulario" onSubmit={(evento) => { evento.preventDefault(); actuar('horario', 'horarios', 'Horario agregado.', (actual) => actual.agregarFranja(new FranjaHoraria(horario))) }}>
          <div className="ct-campos-tutor ct-campos-horario"><CampoFormulario etiqueta="Día" tipo="select" valor={horario.dia} alCambiar={(valor) => cambiarHorario('dia', valor)} opciones={opcionesDias} deshabilitado={!!guardando} />
            <CampoFormulario etiqueta="Desde" tipo="select" valor={horario.horaInicio} alCambiar={(valor) => cambiarHorario('horaInicio', valor)} opciones={horas} deshabilitado={!!guardando} />
            <CampoFormulario etiqueta="Hasta" tipo="select" valor={horario.horaFin} alCambiar={(valor) => cambiarHorario('horaFin', valor)} opciones={horas} deshabilitado={!!guardando} /></div>
          {errores.horarios && <MensajeError mensaje={errores.horarios} />}
          <Boton tipo="submit" cargando={guardando === 'horario'} deshabilitado={!!guardando}>Agregar horario</Boton>
        </form>
      </section>
    </>}
  </section>
}

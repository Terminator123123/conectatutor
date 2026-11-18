// Propone cambios de horario y muestra la respuesta de la contraparte
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { useSesion } from '../hooks/useSesion.js'
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { EstadoSesion } from '../modelo/enums.js'
import { repositorio } from '../servicios/instancias.js'
import { proximasOcurrencias, estaOcupadaEnAgenda, fechaEnColombia } from '../servicios/agenda.js'
import { formatearFechaBreve } from '../componentes/ui/fechaBreve.js'
import { formatearMoneda } from '../componentes/ui/moneda.js'
import Boton from '../componentes/ui/Boton.jsx'
import DatoSesion from '../componentes/ui/DatoSesion.jsx'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'
import '../estilos/solicitante.css'

export default function ReprogramarSesion() {
  useTituloPagina('Reprogramar sesión')
  const { id } = useParams()
  const { usuario } = useAutenticacion()
  const { sesion, cargando, error, reintentar } = useSesion(id, usuario.getId())
  const perfilId = sesion?.getId() === id ? sesion.getTutor().getId() : null
  const [opciones, setOpciones] = useState([])
  const [seleccion, setSeleccion] = useState('')
  const [motivo, setMotivo] = useState('')
  const [etapa, setEtapa] = useState('propuesta')
  const [propuesta, setPropuesta] = useState(null)
  const [errorPropuesta, setErrorPropuesta] = useState('')
  const [errorHorarios, setErrorHorarios] = useState('')
  const [cargandoHorarios, setCargandoHorarios] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [intento, setIntento] = useState(0)
  const [sesionVigente, setSesionVigente] = useState(null)
  const propuestaAnterior = useRef(null)
  const vigente = sesionVigente?.getId() === id ? sesionVigente : sesion?.getId() === id ? sesion : null

  useEffect(() => {
    if (!perfilId) return
    let activo = true
    async function cargar() {
      setCargandoHorarios(true)
      setErrorPropuesta('')
      setErrorHorarios('')
      try {
        const [perfil, ocupaciones, pendiente, actual] = await Promise.all([
          repositorio.obtenerPerfilTutor(perfilId), repositorio.obtenerOcupacionTutor(perfilId),
          repositorio.obtenerReprogramacion(id), repositorio.obtenerSesion(id),
        ])
        if (!perfil || !actual) throw new Error('No encontramos los datos actuales de esta tutoría.')
        const fechaActual = fechaEnColombia(actual.getFecha())
        const franjaActual = actual.getFranja()
        const ajenas = ocupaciones.filter((reserva) => !(reserva.fecha === fechaActual
          && reserva.franja.dia === franjaActual.getDia()
          && reserva.franja.horaInicio === franjaActual.getHoraInicio()
          && reserva.franja.horaFin === franjaActual.getHoraFin()))
        const disponibles = perfil.getDisponibilidad().flatMap((franja, indice) => (
          proximasOcurrencias(franja).map(({ fecha, clave }) => ({
            id: `${indice}-${clave}`, fecha, franja,
            etiqueta: `${formatearFechaBreve(fecha)}, ${franja.getHoraInicio()}–${franja.getHoraFin()}`,
          }))
        )).filter((opcion) => !(fechaEnColombia(opcion.fecha) === fechaActual && opcion.franja.esIgualA(franjaActual))
            && !estaOcupadaEnAgenda(ajenas, opcion.franja, fechaEnColombia(opcion.fecha)))
          .sort((a, b) => a.fecha - b.fecha)
        if (activo) {
          if (propuestaAnterior.current?.sesionId !== id) {
            propuestaAnterior.current = null
            setMotivo('')
          }
          setSesionVigente(actual)
          setOpciones(disponibles)
          setSeleccion('')
          if (pendiente) {
            const cargada = {
              ...pendiente,
              sesionId: id,
              opcion: { fecha: pendiente.fecha, franja: pendiente.franja, etiqueta: `${formatearFechaBreve(pendiente.fecha)}, ${pendiente.franja.getHoraInicio()}–${pendiente.franja.getHoraFin()}` },
            }
            propuestaAnterior.current = cargada
            setPropuesta(cargada)
            setEtapa(pendiente.esMia ? 'pendiente' : 'respuesta')
          } else if (propuestaAnterior.current) {
            const anterior = propuestaAnterior.current.opcion
            if (fechaEnColombia(actual.getFecha()) === fechaEnColombia(anterior.fecha) && actual.getFranja().esIgualA(anterior.franja)) {
              setEtapa('aceptada')
            } else {
              propuestaAnterior.current = null
              setPropuesta(null)
              setEtapa('propuesta')
            }
          } else {
            setPropuesta(null)
            setEtapa('propuesta')
          }
        }
      } catch (fallo) {
        if (activo) setErrorHorarios(fallo.message)
      } finally {
        if (activo) setCargandoHorarios(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [perfilId, id, intento])

  async function enviarPropuesta(evento) {
    evento.preventDefault()
    if (guardando) return
    const opcion = opciones.find((item) => item.id === seleccion) ?? opciones[0]
    if (!opcion) { setErrorPropuesta('No hay otro horario disponible.'); return }
    if (motivo.trim() && (motivo.trim().length < 5 || motivo.trim().length > 300)) { setErrorPropuesta('Escribe un motivo de entre 5 y 300 caracteres, o déjalo vacío.'); return }
    setGuardando(true)
    setErrorPropuesta('')
    try {
      const enviada = await repositorio.proponerReprogramacion(id, { fecha: opcion.fecha, franja: opcion.franja, motivo: motivo.trim() })
      const guardada = { ...enviada, opcion, sesionId: id }
      propuestaAnterior.current = guardada
      setPropuesta(guardada)
      setEtapa('pendiente')
      window.scrollTo(0, 0)
    } catch (fallo) {
      setErrorPropuesta(fallo.message)
    } finally {
      setGuardando(false)
    }
  }

  async function responder(aceptada) {
    if (guardando || propuesta?.esMia !== false) return
    setGuardando(true)
    setErrorPropuesta('')
    try {
      const actual = await repositorio.responderReprogramacion(id, aceptada)
      setSesionVigente(actual)
      setEtapa(aceptada ? 'aceptada' : 'rechazada')
      window.scrollTo(0, 0)
    } catch (fallo) {
      setErrorPropuesta(fallo.message)
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <Cargando texto="Cargando sesión…" />
  if (error) return <MensajeError mensaje={error} alReintentar={reintentar} forma="formulario" />
  if (!vigente || vigente.getEstado() !== EstadoSesion.CONFIRMADA) {
    return <EstadoVacio titulo="La sesión debe estar confirmada" texto="Consulta tus sesiones para proponer otro horario." accion={{ etiqueta: 'Mis sesiones', ruta: '/sesiones' }} />
  }
  const propia = vigente.getSolicitante().getId() === usuario.getId()
  const persona = propia ? vigente.getTutor().getEstudiante() : vigente.getSolicitante()
  const nombre = persona.getNombre().split(' ')[0]
  const materia = vigente.getMateria().getNombre()
  const horarioActual = `${formatearFechaBreve(vigente.getFecha())}, ${vigente.getFranja().getHoraInicio()}–${vigente.getFranja().getHoraFin()}`
  const rutaSesion = `/sesiones/${id}?estado=confirmada`
  const tarifa = vigente.getTutor().getTarifaHora()
  const aMinutos = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3))
  const duracion = ((aMinutos(vigente.getFranja().getHoraFin()) - aMinutos(vigente.getFranja().getHoraInicio())) / 60).toLocaleString('es-CO')
  const descripcionTarifa = tarifa === null ? `Tutoría gratuita, ${duracion} horas` : `${duracion} horas × ${formatearMoneda(tarifa)}/h`
  const titulos = {
    propuesta: 'Propón otro horario', pendiente: `${nombre} revisará tu propuesta`,
    respuesta: `${nombre} propone un cambio`,
    aceptada: 'Tu tutoría tiene nuevo horario', rechazada: 'Se mantiene el horario original',
  }
  const descripciones = {
    propuesta: `La sesión actual seguirá confirmada hasta que ${nombre} acepte el cambio.`,
    pendiente: 'El horario original aún está vigente. La tutoría no cambia hasta recibir su aceptación.',
    respuesta: 'Se propone un nuevo horario. Si aceptas, se reemplaza; si rechazas, se conserva el original.',
    aceptada: 'El nuevo horario quedó confirmado y guardado en tu sesión.',
    rechazada: 'La propuesta se rechazó. La sesión sigue confirmada en el horario original.',
  }
  const etiquetas = {
    pendiente: 'Cambio pendiente de respuesta', respuesta: 'Propuesta por revisar',
    aceptada: 'Reprogramación confirmada', rechazada: 'Propuesta rechazada',
  }

  return (
    <section className="ct-estado-formulario ct-reprogramar">
      {etiquetas[etapa] && <span className={etapa === 'aceptada' ? 'ct-confirmacion-etiqueta' : 'ct-paso'}>{etiquetas[etapa]}</span>}
      <h1>{titulos[etapa]}</h1>
      <p className="ct-texto-secundario">{descripciones[etapa]}</p>
      {errorPropuesta && <MensajeError mensaje={errorPropuesta} alReintentar={() => setIntento((valor) => valor + 1)} />}
      {cargandoHorarios ? <Cargando texto="Consultando horarios y propuestas…" /> : errorHorarios ? <MensajeError mensaje={errorHorarios} alReintentar={() => setIntento((valor) => valor + 1)} /> : <>
      {etapa === 'propuesta' ? (
        <form className="ct-reprogramar-formulario" onSubmit={enviarPropuesta}>
          <DatoSesion etiqueta="Tutor y materia">{persona.getNombre()}, {materia}</DatoSesion>
          <DatoSesion etiqueta="Horario actual">{horarioActual}</DatoSesion>
          {opciones.length ? (
            <CampoFormulario
              etiqueta="Nuevo horario disponible" tipo="select"
              valor={seleccion || opciones[0]?.id || ''} alCambiar={setSeleccion}
              opciones={opciones.map((opcion) => ({ valor: opcion.id, etiqueta: opcion.etiqueta }))}
              deshabilitado={guardando || !opciones.length}
            />
          ) : <EstadoVacio titulo="No hay otro horario disponible" texto="Conserva el horario actual o vuelve a consultar más tarde." />}
          <CampoFormulario etiqueta="Motivo (opcional)" tipo="textarea" valor={motivo} alCambiar={setMotivo} deshabilitado={guardando} />
          <p className="ct-demostracion">El horario actual se conserva hasta que la otra parte acepte.</p>
          <div className="ct-estado-formulario-acciones">
            <Boton tipo="submit" anchoCompleto cargando={guardando} deshabilitado={cargandoHorarios || !opciones.length}>Enviar propuesta</Boton>
            <Link className="ct-boton btn-ct-secundario" to={rutaSesion}>Conservar horario actual</Link>
          </div>
        </form>
      ) : (
        <>
          {etapa === 'pendiente' ? (
            <>
              <DatoSesion etiqueta="Horario confirmado">{horarioActual}</DatoSesion>
              <DatoSesion etiqueta="Horario propuesto">{propuesta.opcion.etiqueta}</DatoSesion>
              <DatoSesion etiqueta="Sesión">{persona.getNombre()}, {materia}, {tarifa === null ? 'Gratuita' : formatearMoneda(tarifa) + '/h'}</DatoSesion>
            </>
          ) : etapa === 'respuesta' ? (
            <>
              <DatoSesion etiqueta={propia ? 'Tutor' : 'Solicitante'}>{persona.getNombre()}</DatoSesion>
              <DatoSesion etiqueta="Sesión actual">{materia}, {horarioActual}</DatoSesion>
              <DatoSesion etiqueta="Propuesta">{propuesta.opcion.etiqueta}</DatoSesion>
              <DatoSesion etiqueta={`Motivo de ${nombre}`}>{propuesta.motivo || 'Sin motivo adicional'}</DatoSesion>
            </>
          ) : (
            <>
              <DatoSesion etiqueta="Tutor y materia">{persona.getNombre()}, {materia}</DatoSesion>
              <DatoSesion etiqueta={etapa === 'aceptada' ? 'Horario confirmado' : 'Horario vigente'}>
                {etapa === 'aceptada' ? propuesta.opcion.etiqueta : horarioActual}
              </DatoSesion>
              <DatoSesion etiqueta={etapa === 'aceptada' ? 'Tarifa' : 'Resultado del cambio'}>
                {etapa === 'aceptada' ? descripcionTarifa : 'El horario vigente no cambió.'}
              </DatoSesion>
            </>
          )}
          <p className="ct-demostracion">{etapa === 'aceptada' ? 'Consulta la sesión para ver su horario actualizado.' : 'La sesión conserva su horario mientras la propuesta está pendiente o se rechaza.'}</p>
          <div className="ct-estado-formulario-acciones">
            {etapa === 'pendiente' && (
              <>
                <Boton anchoCompleto alHacerClic={() => setIntento((valor) => valor + 1)}>Consultar respuesta de {nombre}</Boton>
                <Link className="ct-boton btn-ct-secundario" to={rutaSesion}>Ver sesión vigente</Link>
              </>
            )}
            {etapa === 'respuesta' && (
              <>
                <Boton anchoCompleto cargando={guardando} alHacerClic={() => responder(true)}>Aceptar nuevo horario</Boton>
                <Boton anchoCompleto variante="secundario" deshabilitado={guardando} alHacerClic={() => responder(false)}>Rechazar cambio</Boton>
              </>
            )}
            {etapa === 'aceptada' && (
              <>
                <Link className="ct-boton btn-ct-primario" to="/notificaciones">Ver notificaciones</Link>
                <Link className="ct-boton btn-ct-secundario" to="/sesiones">Volver a mis sesiones</Link>
              </>
            )}
            {etapa === 'rechazada' && (
              <>
                <Link className="ct-boton btn-ct-primario" to={rutaSesion}>Ver sesión confirmada</Link>
                <Boton anchoCompleto variante="secundario" alHacerClic={() => { propuestaAnterior.current = null; setPropuesta(null); setEtapa('propuesta'); setIntento((valor) => valor + 1); window.scrollTo(0, 0) }}>Proponer otro cambio</Boton>
              </>
            )}
          </div>
        </>
      )}
      </>}
    </section>
  )
}

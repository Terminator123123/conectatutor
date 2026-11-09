// Recorre una propuesta demostrativa sin modificar la sesión persistida.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { useSesion } from '../hooks/useSesion.js'
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { EstadoSesion } from '../modelo/enums.js'
import { repositorio } from '../servicios/instancias.js'
import { proximasOcurrencias, estaOcupada, fechaEnColombia } from '../servicios/agenda.js'
import { formatearFechaBreve } from '../componentes/ui/fechaBreve.js'
import { formatearMoneda } from '../componentes/ui/moneda.js'
import Boton from '../componentes/ui/Boton.jsx'
import DatoSesion from '../componentes/ui/DatoSesion.jsx'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'
import '../estilos/solicitante.css'

/** @returns {import('react').ReactElement} Propuesta, respuesta y resultados simulados. */
export default function ReprogramarSesion() {
  useTituloPagina('Reprogramar sesión')
  const { id } = useParams()
  const { usuario } = useAutenticacion()
  const { sesion, cargando, error, reintentar } = useSesion(id, usuario.getId())
  const perfilId = sesion?.getTutor().getId()
  const [opciones, setOpciones] = useState([])
  const [seleccion, setSeleccion] = useState('')
  const [motivo, setMotivo] = useState('')
  const [etapa, setEtapa] = useState('propuesta')
  const [propuesta, setPropuesta] = useState(null)
  const [errorPropuesta, setErrorPropuesta] = useState('')
  const [cargandoHorarios, setCargandoHorarios] = useState(true)

  useEffect(() => {
    if (!perfilId) return
    let activo = true
    async function cargar() {
      setCargandoHorarios(true)
      try {
        const perfil = await repositorio.obtenerPerfilTutor(perfilId)
        const sesiones = await repositorio.listarSesionesDelTutor(perfilId)
        const disponibles = perfil.getDisponibilidad().flatMap((franja, indice) => (
          proximasOcurrencias(franja).map(({ fecha, clave }) => ({
            id: `${indice}-${clave}`, fecha, franja,
            etiqueta: `${formatearFechaBreve(fecha)}, ${franja.getHoraInicio()}–${franja.getHoraFin()}`,
          }))
        )).filter((opcion) => !estaOcupada(sesiones, opcion.franja, fechaEnColombia(opcion.fecha)))
          .sort((a, b) => a.fecha - b.fecha)
        if (activo) setOpciones(disponibles)
      } catch (fallo) {
        if (activo) setErrorPropuesta(fallo.message)
      } finally {
        if (activo) setCargandoHorarios(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [perfilId])

  function enviarPropuesta(evento) {
    //solucion temp por falrta de bak correguir despues//
    evento.preventDefault()
    const opcion = opciones.find((item) => item.id === seleccion) ?? opciones[0]
    if (!opcion) { setErrorPropuesta('No hay otro horario disponible.'); return }
    if (motivo.trim().length < 5) { setErrorPropuesta('Escribe el motivo (al menos 5 caracteres).'); return }
    setPropuesta({ opcion, motivo: motivo.trim() })
    setErrorPropuesta('')
    setEtapa('pendiente')
    window.scrollTo(0, 0)
  }

  function responder(aceptada) {
    //solucion temp por falrta de bak correguir despues//
    setEtapa(aceptada ? 'aceptada' : 'rechazada')
    window.scrollTo(0, 0)
  }

  function verRespuesta() {
    //solucion temp por falrta de bak correguir despues//
    setEtapa('respuesta')
    window.scrollTo(0, 0)
  }

  if (cargando) return <Cargando texto="Cargando sesión…" />
  if (error) return <MensajeError mensaje={error} alReintentar={reintentar} />
  if (!sesion || sesion.getEstado() !== EstadoSesion.CONFIRMADA) {
    return <EstadoVacio titulo="La sesión debe estar confirmada" texto="Consulta tus sesiones para proponer otro horario." accion={{ etiqueta: 'Mis sesiones', ruta: '/sesiones' }} />
  }
  const propia = sesion.getSolicitante().getId() === usuario.getId()
  const persona = propia ? sesion.getTutor().getEstudiante() : sesion.getSolicitante()
  const nombre = persona.getNombre().split(' ')[0]
  const materia = sesion.getMateria().getNombre()
  const horarioActual = `${formatearFechaBreve(sesion.getFecha())}, ${sesion.getFranja().getHoraInicio()}–${sesion.getFranja().getHoraFin()}`
  const rutaSesion = `/sesiones/${id}?estado=confirmada`
  const tarifa = sesion.getTutor().getTarifaHora()
  const descripcionTarifa = tarifa === null ? 'Tutoría gratuita, 2 horas' : `2 horas × ${formatearMoneda(tarifa)}/h`
  const titulos = {
    propuesta: 'Propón otro horario', pendiente: `${nombre} revisará tu propuesta`,
    respuesta: `${nombre}, ${usuario.getNombre().split(' ')[0]} propone un cambio`,
    aceptada: 'Tu tutoría tiene nuevo horario', rechazada: 'Se mantiene el horario original',
  }
  const descripciones = {
    propuesta: `La sesión actual seguirá confirmada hasta que ${nombre} acepte el cambio.`,
    pendiente: 'El horario original aún está vigente. La tutoría no cambia hasta recibir su aceptación.',
    respuesta: 'Se propone un nuevo horario. Si aceptas, se reemplaza; si rechazas, se conserva el original.',
    aceptada: `${nombre} aceptó el cambio en esta demostración. Se muestra el nuevo horario propuesto.`,
    rechazada: `${nombre} no puede atender la nueva franja. La sesión sigue confirmada en el horario original.`,
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
      {etapa === 'propuesta' ? (
        <form className="ct-reprogramar-formulario" onSubmit={enviarPropuesta}>
          <DatoSesion etiqueta="Tutor y materia">{persona.getNombre()}, {materia}</DatoSesion>
          <DatoSesion etiqueta="Horario actual">{horarioActual}</DatoSesion>
          {cargandoHorarios ? <Cargando texto="Consultando horarios…" /> : (
            <CampoFormulario
              etiqueta="Nuevo horario disponible" tipo="select"
              valor={seleccion || opciones[0]?.id || ''} alCambiar={setSeleccion}
              opciones={opciones.map((opcion) => ({ valor: opcion.id, etiqueta: opcion.etiqueta }))}
              deshabilitado={!opciones.length}
            />
          )}
          <CampoFormulario etiqueta="Motivo" tipo="textarea" valor={motivo} alCambiar={setMotivo} />
          {errorPropuesta && <MensajeError mensaje={errorPropuesta} />}
          <p className="ct-demostracion">Demostración: el cambio no modifica tu sesión guardada.</p>
          <div className="ct-estado-formulario-acciones">
            <Boton tipo="submit" anchoCompleto deshabilitado={cargandoHorarios || !opciones.length}>Enviar propuesta</Boton>
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
              <DatoSesion etiqueta={propia ? 'Solicitante' : 'Tutor'}>{usuario.getNombre()}</DatoSesion>
              <DatoSesion etiqueta="Sesión actual">{materia}, {horarioActual}</DatoSesion>
              <DatoSesion etiqueta="Propuesta">{propuesta.opcion.etiqueta}</DatoSesion>
              <DatoSesion etiqueta={`Motivo de ${usuario.getNombre().split(' ')[0]}`}>{propuesta.motivo}</DatoSesion>
            </>
          ) : (
            <>
              <DatoSesion etiqueta="Tutor y materia">{persona.getNombre()}, {materia}</DatoSesion>
              <DatoSesion etiqueta={etapa === 'aceptada' ? 'Horario confirmado' : 'Horario vigente'}>
                {etapa === 'aceptada' ? propuesta.opcion.etiqueta : horarioActual}
              </DatoSesion>
              <DatoSesion etiqueta={etapa === 'aceptada' ? 'Tarifa' : 'Motivo de rechazo'}>
                {etapa === 'aceptada' ? descripcionTarifa : 'No puedo atender en la nueva franja.'}
              </DatoSesion>
            </>
          )}
          <p className="ct-demostracion">Demostración: la sesión original se conserva.</p>
          <div className="ct-estado-formulario-acciones">
            {etapa === 'pendiente' && (
              <>
                <Boton anchoCompleto alHacerClic={verRespuesta}>Ver respuesta de {nombre}</Boton>
                <Link className="ct-boton btn-ct-secundario" to={rutaSesion}>Ver sesión vigente</Link>
              </>
            )}
            {etapa === 'respuesta' && (
              <>
                <Boton anchoCompleto alHacerClic={() => responder(true)}>Aceptar nuevo horario</Boton>
                <Boton anchoCompleto variante="secundario" alHacerClic={() => responder(false)}>Rechazar cambio</Boton>
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
                <Boton anchoCompleto variante="secundario" alHacerClic={() => { setEtapa('propuesta'); window.scrollTo(0, 0) }}>Proponer otro cambio</Boton>
              </>
            )}
          </div>
        </>
      )}
    </section>
  )
}

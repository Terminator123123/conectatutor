// Solicita tutorías en las franjas disponibles del tutor.
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { repositorio } from '../servicios/instancias.js'
import { estaOcupada, fechaEnColombia, formatearFecha, proximasOcurrencias } from '../servicios/agenda.js'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import SelectorFranja from '../componentes/ui/SelectorFranja.jsx'
import Boton from '../componentes/ui/Boton.jsx'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'
import '../estilos/solicitante.css'

/** @returns {import('react').ReactElement} Formulario de solicitud al modelo de dominio. */
export default function SolicitudSesion() {
  useTituloPagina('Solicitar tutoría')
  const { id } = useParams()
  const { usuario } = useAutenticacion()
  const navigate = useNavigate()
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [intento, setIntento] = useState(0)
  const [campos, setCampos] = useState({ materia: '', franja: '', tema: '' })
  const [tocados, setTocados] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [errorServicio, setErrorServicio] = useState('')
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
          setCampos({ materia: '', franja: '', tema: '' })
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
  }, [id, intento])

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

  if (cargando) return <Cargando texto="Cargando horarios…" />
  if (errorCarga) return <MensajeError mensaje={errorCarga} alReintentar={() => setIntento((anterior) => anterior + 1)} />
  if (!datos?.perfil) return <EstadoVacio icono="bi-person" titulo="No encontramos este tutor" texto="Vuelve a buscar un tutor que te acompañe." accion={{ etiqueta: 'Volver a la búsqueda', ruta: '/tutores' }} />

  const { perfil, sesiones } = datos
  const opciones = perfil.getDisponibilidad().flatMap((franja, indice) => proximasOcurrencias(franja).map(({ fecha, clave }) => ({
    id: `${indice}|${clave}`, fecha, franja,
    etiqueta: `${formatearFecha(fecha)} · ${franja.getHoraInicio()}–${franja.getHoraFin()}`,
    ocupada: estaOcupada(sesiones, franja, clave),
  }))).sort((a, b) => a.fecha - b.fecha)

  async function enviar(evento) {
    evento.preventDefault()
    if (enviando) return
    setTocados({ materia: true, franja: true, tema: true })
    setErrorServicio('')
    const primerError = Object.keys(errores).find((nombre) => errores[nombre])
    if (primerError) {
      if (primerError === 'franja') selectorRef.current?.querySelector('button:not(:disabled)')?.focus()
      else evento.currentTarget.elements.namedItem(primerError)?.focus()
      return
    }
    setEnviando(true)
    try {
      const reservar = async () => {
        const materia = perfil.getMaterias().find((item) => item.getId() === campos.materia)
        const opcion = opciones.find((item) => item.id === campos.franja)
        const actuales = await repositorio.listarSesionesDelTutor(id)
        if (estaOcupada(actuales, opcion.franja, fechaEnColombia(opcion.fecha))) {
          setDatos((anteriores) => ({ ...anteriores, sesiones: actuales }))
          setCampos((anteriores) => ({ ...anteriores, franja: '' }))
          setErrorServicio('Alguien acaba de reservar esa franja. Elige otra.')
          return
        }
        const sesion = usuario.solicitarSesion(perfil, materia, opcion.franja, opcion.fecha, campos.tema.trim())
        await repositorio.guardarSesion(sesion)
        return true
      }
      // El bloqueo entre pestañas mantiene juntas la relectura y el guardado.
      const reservada = navigator.locks?.request
        ? await navigator.locks.request(`ct-agenda-${id}`, reservar) : await reservar()
      if (!reservada) return
      navigate('/sesiones', { replace: true, state: { aviso: 'Solicitud enviada. Queda pendiente hasta que el tutor la acepte.' } })
    } catch (error) {
      setErrorServicio(error.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="ct-solicitante ct-formulario-solicitud">
      <Link className="ct-volver" to={`/tutores/${id}`}>← Volver al perfil</Link>
      <h1>Solicitar tutoría</h1><p>Con {perfil.getEstudiante().getNombre()}</p>
      <form noValidate onSubmit={enviar} onBlur={(evento) => { if (Object.hasOwn(campos, evento.target.name)) tocar(evento.target.name) }}>
        <CampoFormulario etiqueta="Materia" nombre="materia" tipo="select" valor={campos.materia} alCambiar={(valor) => cambiar('materia', valor)} opciones={perfil.getMaterias().map((materia) => ({ valor: materia.getId(), etiqueta: materia.getNombre() }))} placeholder="Selecciona la materia" obligatorio error={tocados.materia ? errores.materia : ''} deshabilitado={enviando} />
        <div ref={selectorRef} aria-describedby={tocados.franja && errores.franja ? `${idFranja}-error` : undefined} onBlur={() => tocar('franja')}>
          <p id={idFranja}>Fecha y franja</p>
          {opciones.length ? <fieldset className="ct-selector-contenedor" disabled={enviando}>
            <legend className="visually-hidden">Fecha y franja</legend>
            <SelectorFranja franjas={opciones.map(({ id: clave, etiqueta, ocupada }) => ({ id: clave, etiqueta, ocupada }))} seleccionada={campos.franja} alSeleccionar={(valor) => { cambiar('franja', valor); tocar('franja') }} etiqueta="Fecha y franja" />
          </fieldset> : <EstadoVacio icono="bi-calendar-event" titulo="Este tutor no tiene horarios disponibles" texto="Vuelve al perfil o busca otro tutor." />}
          {tocados.franja && errores.franja && <p id={`${idFranja}-error`} className="ct-campo-error">{errores.franja}</p>}
        </div>
        <CampoFormulario etiqueta="Tema" nombre="tema" tipo="textarea" valor={campos.tema} alCambiar={(valor) => cambiar('tema', valor)} obligatorio error={tocados.tema ? errores.tema : ''} deshabilitado={enviando} ayuda="Entre 10 y 300 caracteres." />
        {errorServicio && <MensajeError mensaje={errorServicio} />}
        <Boton tipo="submit" anchoCompleto cargando={enviando}>Enviar solicitud</Boton>
        <p className="ct-texto-secundario">La tutoría es gratuita. El tutor puede aceptarla o rechazarla.</p>
      </form>
    </section>
  )
}

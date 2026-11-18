// Lista completa de la campana: avisos de las sesiones y recordatorios guardados por la API.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { repositorio } from '../servicios/instancias.js'
import { haceCuanto, ICONOS_NOTIFICACION } from '../servicios/notificaciones.js'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'
import '../estilos/solicitante.css'

/** @returns {import('react').ReactElement} Notificaciones de la cuenta. */
export default function Notificaciones() {
  useTituloPagina('Notificaciones')
  const [datos, setDatos] = useState({ sinLeer: 0, notificaciones: [] })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setError('')
      try {
        const lista = await repositorio.listarNotificaciones()
        if (!activo) return
        setDatos(lista)
        // Verlas aquí también las marca como leídas; se conserva el resaltado de esta visita.
        if (lista.sinLeer > 0) await repositorio.marcarNotificacionesLeidas()
      } catch (fallo) {
        if (activo) setError(fallo.message)
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [intento])

  if (cargando) return <Cargando texto="Cargando notificaciones…" />
  if (error) return <MensajeError mensaje={error} alReintentar={() => setIntento((valor) => valor + 1)} forma="lista" />
  const { notificaciones } = datos
  return (
    <section className="ct-notificaciones-pagina" aria-labelledby="titulo-notificaciones">
      <h1 id="titulo-notificaciones">Notificaciones</h1>
      <p className="ct-texto-secundario">Te avisamos cuando responden tus solicitudes, cuando alguien cancela o propone otra fecha, y te recordamos tus tutorías un día y una hora antes.</p>
      {notificaciones.length ? <ul className="ct-notificaciones-lista">
        {notificaciones.map((notificacion) => <li key={notificacion.id} className={notificacion.leida ? '' : 'ct-notificacion-nueva'}>
          <Link to={notificacion.ruta}>
            <i className={`bi ${ICONOS_NOTIFICACION[notificacion.tipo] ?? 'bi-bell'}`} aria-hidden="true" />
            <span>
              <strong>{notificacion.titulo}</strong>
              {notificacion.texto && <small>{notificacion.texto}</small>}
              <small className="ct-notificacion-hora">{haceCuanto(notificacion.createdAt)}</small>
            </span>
          </Link>
        </li>)}
      </ul> : <EstadoVacio icono="bi-bell" titulo="No tienes notificaciones" texto="Cuando tengas solicitudes o tutorías, te avisaremos aquí." accion={{ etiqueta: 'Buscar tutores', ruta: '/tutores' }} />}
    </section>
  )
}

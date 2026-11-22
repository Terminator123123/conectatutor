// Campana de notificaciones: avisos de las sesiones y recordatorios. Se actualiza sola cada minuto.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { repositorio } from '../../servicios/instancias.js'
import { haceCuanto, ICONOS_NOTIFICACION } from '../../servicios/notificaciones.js'

const CADA_MINUTO = 60000

/** @returns {import('react').ReactElement} Botón de campana con su lista desplegable. */
export default function Campana() {
  const { pathname } = useLocation()
  const [datos, setDatos] = useState({ sinLeer: 0, notificaciones: [] })
  const [abierta, setAbierta] = useState(false)
  const contenedor = useRef(null)

  const cargar = useCallback(async () => {
    // Consulta automática: no cuenta como uso, así una pestaña abandonada vence a los 30 minutos (RQNF005)
    try { setDatos(await repositorio.listarNotificaciones({ automatica: true })) } catch { /* sin conexión: se intenta en el próximo minuto */ }
  }, [])

  // Al cambiar de pantalla y cada minuto mientras la pestaña está a la vista.
  useEffect(() => {
    let activo = true
    const actualizar = () => { if (activo && document.visibilityState === 'visible') cargar() }
    actualizar()
    const intervalo = setInterval(actualizar, CADA_MINUTO)
    document.addEventListener('visibilitychange', actualizar)
    return () => { activo = false; clearInterval(intervalo); document.removeEventListener('visibilitychange', actualizar) }
  }, [cargar, pathname])

  useEffect(() => {
    if (!abierta) return undefined
    const fuera = (evento) => { if (!contenedor.current?.contains(evento.target)) setAbierta(false) }
    const escape = (evento) => { if (evento.key === 'Escape') setAbierta(false) }
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', escape) }
  }, [abierta])

  async function alternar() {
    const abrir = !abierta
    setAbierta(abrir)
    // Al abrirla se dan por vistas; los puntos de "nueva" se conservan mientras está abierta.
    if (abrir && datos.sinLeer > 0) {
      try { await repositorio.marcarNotificacionesLeidas(); setDatos((anteriores) => ({ ...anteriores, sinLeer: 0 })) } catch { /* se reintenta al abrirla de nuevo */ }
    }
  }

  const recientes = datos.notificaciones.slice(0, 8)
  return <div className="ct-campana" ref={contenedor}>
    <button type="button" className="ct-campana-boton" aria-expanded={abierta} aria-haspopup="true" onClick={alternar}
      aria-label={datos.sinLeer ? `Notificaciones, ${datos.sinLeer} sin leer` : 'Notificaciones'}>
      <i className={`bi ${datos.sinLeer ? 'bi-bell-fill' : 'bi-bell'}`} aria-hidden="true" />
      {datos.sinLeer > 0 && <span className="ct-campana-contador" aria-hidden="true">{datos.sinLeer > 9 ? '9+' : datos.sinLeer}</span>}
    </button>
    {abierta && <div className="ct-campana-panel" role="region" aria-label="Notificaciones">
      <header><strong>Notificaciones</strong><Link to="/notificaciones" onClick={() => setAbierta(false)}>Ver todas</Link></header>
      {recientes.length ? <ul>
        {recientes.map((notificacion) => <li key={notificacion.id} className={notificacion.leida ? '' : 'ct-notificacion-nueva'}>
          <Link to={notificacion.ruta} onClick={() => setAbierta(false)}>
            <i className={`bi ${ICONOS_NOTIFICACION[notificacion.tipo] ?? 'bi-bell'}`} aria-hidden="true" />
            <span>
              <strong>{notificacion.titulo}</strong>
              {notificacion.texto && <small>{notificacion.texto}</small>}
              <small className="ct-notificacion-hora">{haceCuanto(notificacion.createdAt)}</small>
            </span>
          </Link>
        </li>)}
      </ul> : <p className="ct-campana-vacia">No tienes notificaciones. Aquí te avisaremos de tus solicitudes y te recordaremos tus tutorías.</p>}
    </div>}
  </div>
}

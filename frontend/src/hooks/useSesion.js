// Carga una sesión únicamente cuando la cuenta participa en ella.
import { useEffect, useState } from 'react'
import { repositorio } from '../servicios/instancias.js'

/** @param {string} id Sesión que se consulta.
 * @param {string} usuarioId Participante autenticado.
 * @returns {object} Sesión, carga, error y reintento. */
export function useSesion(id, usuarioId) {
  const [sesion, setSesion] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true); setError('')
      try {
        const sesiones = await repositorio.listarSesionesDe(usuarioId)
        if (activo) setSesion(sesiones.find((item) => item.getId() === id) ?? null)
      } catch (fallo) { if (activo) setError(fallo.message) }
      finally { if (activo) setCargando(false) }
    }
    cargar()
    return () => { activo = false }
  }, [id, usuarioId, intento])
  return { sesion, cargando, error, reintentar:() => setIntento((valor) => valor + 1) }
}


// Detecta el ancho donde el prototipo utiliza diálogos sobre la vista principal.
import { useEffect, useState } from 'react'

/** @param {number} [anchoMinimo=1100] Punto de cambio de la composición.
 * @returns {boolean} Si la ventana alcanza el ancho indicado. */
export function useEscritorio(anchoMinimo = 1100) {
  const textoConsulta = `(min-width:${anchoMinimo}px)`
  const [escritorio, setEscritorio] = useState(() => window.matchMedia(textoConsulta).matches)
  useEffect(() => {
    const consulta = window.matchMedia(textoConsulta)
    const actualizar = () => setEscritorio(consulta.matches)
    consulta.addEventListener('change', actualizar)
    return () => consulta.removeEventListener('change', actualizar)
  }, [textoConsulta])
  return escritorio
}

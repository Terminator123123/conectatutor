// Encabezado blanco con regreso accesible para las pantallas internas.
import { useNavigate } from 'react-router-dom'

/** @param {object} props Título y ruta de regreso opcional.
 * @returns {import('react').ReactElement} Encabezado móvil del prototipo. */
export default function EncabezadoPagina({ titulo, ruta, alVolver }) {
  const navigate = useNavigate()
  function volver() {
    if (alVolver) alVolver()
    else if (ruta) navigate(ruta)
    else if (window.history.state?.idx > 0) navigate(-1)
    else navigate('/')
  }
  return <header className="ct-encabezado-pagina">
    <button type="button" aria-label="Volver" onClick={volver}><i className="bi bi-arrow-left" aria-hidden="true" /></button>
    <h1>{titulo}</h1>
  </header>
}

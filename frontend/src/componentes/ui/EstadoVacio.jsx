// Explica una lista vacía y presenta una acción opcional para continuar.
import { Link } from 'react-router-dom'
import Boton from './Boton.jsx'

/**
 * Muestra un estado vacío a partir de textos y acciones de la página.
 * @param {object} props Propiedades del estado vacío.
 * @param {string} props.icono Clase bi-* del icono decorativo.
 * @param {string} props.titulo Título del estado.
 * @param {string} props.texto Explicación del estado.
 * @param {{etiqueta: string, alHacerClic?: function, ruta?: string}} [props.accion] Acción o enlace opcional.
 * @returns {import('react').ReactElement} Estado vacío con acción opcional.
 */
export default function EstadoVacio({ icono, titulo, texto, accion }) {
  return (
    <div className="ct-estado-vacio">
      <i className={`bi ${icono}`} aria-hidden="true" />
      <h3>{titulo}</h3>
      <p>{texto}</p>
      {accion && (accion.ruta !== undefined ? (
        <Link className="btn-ct-secundario ct-boton" to={accion.ruta}>{accion.etiqueta}</Link>
      ) : (
        <Boton variante="secundario" alHacerClic={accion.alHacerClic}>{accion.etiqueta}</Boton>
      ))}
    </div>
  )
}

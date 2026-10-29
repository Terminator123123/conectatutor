// Presenta un error y permite reintentar la acción cuando se proporciona una función.
import Boton from './Boton.jsx'

/**
 * Muestra un mensaje de error como alerta accesible.
 * @param {object} props Propiedades de la alerta.
 * @param {string} props.mensaje Explicación del error para el usuario.
 * @param {function(): void} [props.alReintentar] Acción opcional para reintentar.
 * @returns {import('react').ReactElement} Alerta con acción opcional.
 */
export default function MensajeError({ mensaje, alReintentar }) {
  return (
    <div className="ct-mensaje-error" role="alert">
      <div className="ct-mensaje-error-contenido">
        <i className="bi bi-exclamation-circle" aria-hidden="true" />
        <p>{mensaje}</p>
      </div>
      {alReintentar && (
        <Boton variante="secundario" alHacerClic={alReintentar}>Reintentar</Boton>
      )}
    </div>
  )
}

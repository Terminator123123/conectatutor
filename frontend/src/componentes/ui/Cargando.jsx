// Comunica un estado de carga mediante un indicador y texto accesible.

/**
 * Muestra un estado de carga que los lectores de pantalla pueden anunciar.
 * @param {object} props Propiedades del indicador.
 * @param {string} [props.texto='Cargando…'] Texto visible del estado.
 * @returns {import('react').ReactElement} Estado de carga.
 */
export default function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="ct-cargando" role="status">
      <span className="spinner-border" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  )
}

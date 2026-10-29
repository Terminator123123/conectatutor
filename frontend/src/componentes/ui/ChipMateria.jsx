// Presenta una materia y una acción opcional para retirarla de una selección.

/**
 * Muestra el nombre de una materia sin depender del modelo de dominio.
 * @param {object} props Propiedades de la materia.
 * @param {string} props.nombre Nombre visible de la materia.
 * @param {function(): void} [props.alQuitar] Acción opcional para quitarla.
 * @returns {import('react').ReactElement} Etiqueta de materia.
 */
export default function ChipMateria({ nombre, alQuitar }) {
  return (
    <span className={`ct-chip-materia${alQuitar ? ' ct-chip-materia-eliminable' : ''}`}>
      <span>{nombre}</span>
      {alQuitar && (
        <button className="ct-chip-quitar" type="button" aria-label={`Quitar ${nombre}`} onClick={alQuitar}>
          <i className="bi bi-x" aria-hidden="true" />
        </button>
      )}
    </span>
  )
}

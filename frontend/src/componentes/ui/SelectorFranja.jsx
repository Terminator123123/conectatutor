// Permite elegir una franja libre y distingue las franjas ocupadas.

/**
 * Renderiza una selección controlada sin almacenar reglas del dominio.
 * @param {object} props Propiedades del selector.
 * @param {{id: string, etiqueta: string, ocupada: boolean}[]} props.franjas Franjas disponibles para mostrar.
 * @param {string|null} props.seleccionada Identificador de la franja seleccionada.
 * @param {function(string): void} props.alSeleccionar Recibe el identificador elegido.
 * @param {string} props.etiqueta Nombre accesible del grupo.
 * @returns {import('react').ReactElement|null} Rejilla de franjas o nada si no existen.
 */
export default function SelectorFranja({ franjas, seleccionada, alSeleccionar, etiqueta }) {
  if (franjas.length === 0) return null

  return (
    <div className="ct-selector-franja" role="group" aria-label={etiqueta}>
      {franjas.map((franja) => {
        const activa = !franja.ocupada && seleccionada === franja.id
        return (
          <button
            className={`ct-franja${activa ? ' ct-franja-seleccionada' : ''}${franja.ocupada ? ' ct-franja-ocupada' : ''}`}
            key={franja.id}
            type="button"
            disabled={franja.ocupada}
            aria-pressed={activa}
            onClick={() => alSeleccionar(franja.id)}
          >
            {franja.etiqueta}
            {franja.ocupada && <span className="visually-hidden"> (ocupada)</span>}
          </button>
        )
      })}
    </div>
  )
}

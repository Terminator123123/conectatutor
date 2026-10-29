// Presenta un formulario de búsqueda controlado y accesible por teclado.
import { useId } from 'react'

/**
 * Ejecuta la búsqueda al enviar el formulario sin recargar la página.
 * @param {object} props Propiedades de la búsqueda.
 * @param {string} [props.valor=''] Texto controlado de la búsqueda.
 * @param {function(string): void} props.alCambiar Recibe el texto introducido.
 * @param {function(): void} props.alBuscar Acción que se ejecuta al enviar.
 * @param {string} props.etiqueta Etiqueta para lectores de pantalla.
 * @param {string} [props.placeholder] Texto orientativo del campo vacío.
 * @returns {import('react').ReactElement} Formulario de búsqueda.
 */
export default function BarraBusqueda({ valor = '', alCambiar, alBuscar, etiqueta, placeholder }) {
  const id = useId()

  function buscar(evento) {
    evento.preventDefault()
    alBuscar()
  }

  return (
    <form className="ct-busqueda" role="search" onSubmit={buscar}>
      <label htmlFor={id} className="visually-hidden">{etiqueta}</label>
      <input
        id={id}
        className="ct-campo-control ct-busqueda-entrada"
        type="search"
        value={valor}
        onChange={(evento) => alCambiar(evento.target.value)}
        placeholder={placeholder}
      />
      <button className="ct-busqueda-boton btn-ct-primario" type="submit" aria-label="Buscar">
        <i className="bi bi-search" aria-hidden="true" />
      </button>
    </form>
  )
}

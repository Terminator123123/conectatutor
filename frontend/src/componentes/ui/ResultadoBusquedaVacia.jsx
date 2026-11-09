// Presenta el estado vacío de búsqueda con la composición del prototipo.
import Boton from './Boton.jsx'

/** @returns {import('react').ReactElement} Tarjeta vacía con apoyo institucional. */
export default function ResultadoBusquedaVacia({ sede, correo, alQuitarFiltros }) {
  return (
    <section className="ct-busqueda-vacia" role="status">
      <i className="bi bi-search" aria-hidden="true" />
      <h2>Aún no hay coincidencias</h2>
      <p>Prueba con otra materia o explora todos los tutores de la comunidad.</p>
      <Boton variante="secundario" anchoCompleto alHacerClic={alQuitarFiltros}>
        Ver todos los tutores
      </Boton>
      <p className="ct-busqueda-vacia-apoyo">Permanencia {sede}: <a href={`mailto:${correo}`}>{correo}</a></p>
    </section>
  )
}

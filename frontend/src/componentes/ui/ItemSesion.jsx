// Presenta el estado, la identidad, la fecha y las acciones de una sesión.
import Avatar from './Avatar.jsx'
import ChipEstado from './ChipEstado.jsx'

/** @param {object} props Datos de presentación sin dependencias del dominio.
 * @returns {import('react').ReactElement} Tarjeta de sesión del prototipo. */
export default function ItemSesion({ nombre, materia, fecha, franja, estado, children }) {
  return <article className="ct-item-sesion">
    <ChipEstado estado={estado} />
    <div className="ct-item-identidad"><Avatar nombre={nombre} /><div><p className="ct-item-nombre">{nombre}</p><p className="ct-item-materia">{materia}</p></div></div>
    <p className="ct-item-fecha"><i className="bi bi-calendar-event" aria-hidden="true" />{fecha}</p>
    <p className="ct-item-hora"><i className="bi bi-clock" aria-hidden="true" />{franja}</p>
    {children && <div className="ct-item-acciones">{children}</div>}
  </article>
}


// Presenta el resumen de una sesión y las acciones que proporciona la página.
import Avatar from './Avatar.jsx'
import ChipEstado from './ChipEstado.jsx'

/**
 * Organiza los datos ya formateados de una sesión.
 * @param {object} props Datos de presentación de la sesión.
 * @param {string} props.nombre Nombre de la otra persona.
 * @param {string} props.materia Nombre de la materia.
 * @param {string} props.fecha Fecha formateada por la página.
 * @param {string} props.franja Franja formateada por la página.
 * @param {string} props.estado Estado de la sesión.
 * @param {import('react').ReactNode} [props.children] Acciones opcionales.
 * @returns {import('react').ReactElement} Fila de sesión.
 */
export default function ItemSesion({ nombre, materia, fecha, franja, estado, children }) {
  return (
    <article className="ct-item-sesion">
      <div className="ct-item-sesion-cabecera">
        <Avatar nombre={nombre} tamano={40} />
        <div className="ct-item-datos">
          <p className="ct-item-nombre">{nombre}</p>
          <p className="ct-item-materia">{materia}</p>
          <p className="ct-item-fecha">{fecha} · {franja}</p>
        </div>
        <div className="ct-item-estado"><ChipEstado estado={estado} /></div>
      </div>
      {children && <div className="ct-item-acciones">{children}</div>}
    </article>
  )
}

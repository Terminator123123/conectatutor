// Representa a una persona mediante las iniciales de su nombre.

/**
 * Muestra un avatar decorativo junto al nombre que presenta el componente padre.
 * @param {object} props Propiedades del avatar.
 * @param {string} props.nombre Nombre del que se toman las dos primeras iniciales.
 * @param {number} [props.tamano=48] Diámetro del avatar en píxeles.
 * @returns {import('react').ReactElement} Avatar circular.
 */
export default function Avatar({ nombre, tamano = 48 }) {
  const iniciales = nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map((palabra) => palabra[0].toUpperCase()).join('')

  return (
    <span
      className="ct-avatar"
      style={{ '--ct-avatar-tamano': `${tamano}px` }}
      aria-hidden="true"
    >
      {iniciales}
    </span>
  )
}

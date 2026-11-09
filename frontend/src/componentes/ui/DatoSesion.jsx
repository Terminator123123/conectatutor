// Presenta una etiqueta y un contenido de lectura del kit.
/** @returns {import('react').ReactElement} Dato adaptable de sesión. */
export default function DatoSesion({ etiqueta, children }) {
  return <div className="ct-dato"><small>{etiqueta}</small>{children}</div>
}

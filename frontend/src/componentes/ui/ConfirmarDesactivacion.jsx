// Solicita confirmar el cambio local de estado de una materia.
import Boton from './Boton.jsx'
import DatoSesion from './DatoSesion.jsx'

/** @returns {import('react').ReactElement} Confirmación demostrativa del catálogo. */
export default function ConfirmarDesactivacion({ nombre, alConfirmar, alConservar, guardando = false }) {
  return (
    <section className="ct-estado-formulario ct-desactivar-materia">
      <span className="ct-paso">Confirmación necesaria</span>
      <h1>¿Desactivar {nombre}?</h1>
      <p className="ct-texto-secundario">Dejará de aparecer para nuevas selecciones. Las sesiones anteriores conservarán su materia.</p>
      <DatoSesion etiqueta="Materia">{nombre}</DatoSesion>
      <DatoSesion etiqueta="Estado propuesto">Inactiva</DatoSesion>
      <p className="ct-demostracion">El cambio se guardará en el catálogo de materias.</p>
      <div className="ct-estado-formulario-acciones">
        <Boton anchoCompleto cargando={guardando} alHacerClic={alConfirmar}>Confirmar desactivación</Boton>
        <Boton anchoCompleto variante="secundario" deshabilitado={guardando} alHacerClic={alConservar}>Conservar activa</Boton>
      </div>
    </section>
  )
}

// Presenta el año y los datos institucionales del pie de página.
import { INSTITUCION } from '../../config/institucion.js'

const anioActual = new Date().getFullYear()

function PiePagina() {
  return (
    <footer className="ct-pie">
      <div className="container d-flex flex-wrap justify-content-between gap-2 py-3">
        <span>© {anioActual} · {INSTITUCION.nombre}</span>
        <a href={INSTITUCION.urlTratamientoDatos}>Tratamiento de datos</a>
      </div>
    </footer>
  )
}

export default PiePagina

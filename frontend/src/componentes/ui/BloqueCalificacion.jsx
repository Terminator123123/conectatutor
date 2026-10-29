// Muestra una calificación o permite seleccionar un puntaje mediante estrellas.
import { useState } from 'react'

const puntajes = [1, 2, 3, 4, 5]

/**
 * Presenta estrellas decorativas o botones de calificación accesibles.
 * @param {object} props Propiedades de la calificación.
 * @param {number} [props.promedio=0] Promedio que se muestra en modo de lectura.
 * @param {number} [props.total=0] Número de tutorías calificadas.
 * @param {boolean} [props.editable=false] Activa la selección de puntaje.
 * @param {number} [props.valor=0] Puntaje controlado de la selección.
 * @param {function(number): void} [props.alCambiar] Recibe el puntaje seleccionado.
 * @param {'normal'|'grande'} [props.tamano='normal'] Tamaño de las estrellas editables.
 * @returns {import('react').ReactElement} Calificación o etiqueta de tutor nuevo.
 */
export default function BloqueCalificacion({
  promedio = 0, total = 0, editable = false, valor = 0, alCambiar, tamano = 'normal',
}) {
  const [valorHover, setValorHover] = useState(null)
  const [valorFoco, setValorFoco] = useState(null)

  if (editable) {
    const destacado = valorHover ?? valorFoco ?? valor

    return (
      <div
        className={`ct-calificacion-editable${tamano === 'grande' ? ' ct-calificacion-grande' : ''}`}
        role="group"
        aria-label="Calificación"
        onMouseLeave={() => setValorHover(null)}
      >
        {puntajes.map((puntaje) => (
          <button
            className="ct-calificacion-estrella"
            key={puntaje}
            type="button"
            aria-label={`Calificar con ${puntaje} de 5`}
            aria-pressed={valor === puntaje}
            onMouseEnter={() => setValorHover(puntaje)}
            onFocus={() => setValorFoco(puntaje)}
            onBlur={() => setValorFoco(null)}
            onClick={() => alCambiar(puntaje)}
          >
            <i className={`bi ${puntaje <= destacado ? 'bi-star-fill' : 'bi-star'}`} aria-hidden="true" />
          </button>
        ))}
      </div>
    )
  }

  if (total === 0) return <span className="ct-tutor-nuevo">Tutor nuevo</span>

  const promedioFormateado = promedio.toFixed(1)

  return (
    <div
      className="ct-calificacion-lectura"
      role="img"
      aria-label={`Calificación ${promedioFormateado} de 5, ${total} tutorías`}
    >
      <span className="ct-calificacion-estrellas" aria-hidden="true">
        {puntajes.map((puntaje) => {
          const icono = promedio >= puntaje ? 'bi-star-fill' : promedio >= puntaje - 0.5 ? 'bi-star-half' : 'bi-star'
          return <i className={`bi ${icono}`} key={puntaje} />
        })}
      </span>
      <span aria-hidden="true">{promedioFormateado}</span>
      <span className="ct-calificacion-total" aria-hidden="true">({total} tutorías)</span>
    </div>
  )
}

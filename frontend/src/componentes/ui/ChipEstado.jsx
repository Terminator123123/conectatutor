// Identifica visualmente un estado de sesión o de verificación.
import { EstadoSesion, EstadoVerificacion } from '../../modelo/enums.js'

const estados = {
  [EstadoSesion.PENDIENTE]: { etiqueta: 'Pendiente', color: 'var(--ct-advertencia)' },
  [EstadoSesion.CONFIRMADA]: { etiqueta: 'Confirmada', color: 'var(--ct-exito)' },
  [EstadoSesion.FINALIZADA]: { etiqueta: 'Finalizada', color: 'var(--ct-texto-secundario)' },
  [EstadoSesion.CANCELADA]: { etiqueta: 'Cancelada', color: 'var(--ct-error)' },
  [EstadoSesion.RECHAZADA]: { etiqueta: 'Rechazada', color: 'var(--ct-error)' },
  [EstadoVerificacion.VERIFICADO]: { etiqueta: 'Verificado', color: 'var(--ct-exito)' },
  [EstadoVerificacion.RECHAZADO]: { etiqueta: 'Rechazado', color: 'var(--ct-error)' },
}

/**
 * Muestra una etiqueta conocida o el valor original de un estado desconocido.
 * @param {object} props Propiedades del estado.
 * @param {string} props.estado Valor de EstadoSesion o EstadoVerificacion.
 * @returns {import('react').ReactElement} Etiqueta de estado.
 */
export default function ChipEstado({ estado }) {
  const variante = Object.hasOwn(estados, estado)
    ? estados[estado]
    : { etiqueta: estado, color: 'var(--ct-texto-secundario)' }

  return (
    <span className="ct-chip-estado" style={{ '--ct-chip-color': variante.color }}>
      {variante.etiqueta}
    </span>
  )
}

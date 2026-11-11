import mongoose from 'mongoose'
import { DiaSemana } from '../utils/enums.js'

const FORMATO_HORA = /^(?:[01]\d|2[0-3]):[0-5]\d$/

/**
 * Franja horaria: día de la semana con hora de inicio y de fin.
 * Es un objeto de valor, no tiene vida propia: se guarda embebida en la
 * disponibilidad del perfil de tutor y copiada dentro de cada sesión.
 */
export const franjaSchema = new mongoose.Schema(
  {
    dia: {
      type: String,
      required: [true, 'La franja necesita un día'],
      enum: { values: Object.values(DiaSemana), message: 'Selecciona un día válido para la franja horaria' },
    },
    horaInicio: {
      type: String,
      required: [true, 'La franja necesita una hora de inicio'],
      match: [FORMATO_HORA, 'La hora de inicio debe tener el formato HH:MM'],
    },
    horaFin: {
      type: String,
      required: [true, 'La franja necesita una hora de fin'],
      match: [FORMATO_HORA, 'La hora de fin debe tener el formato HH:MM'],
      validate: {
        // "08:00" < "10:00": con el formato HH:MM el orden de texto es el orden del reloj.
        validator(horaFin) {
          return this.horaInicio < horaFin
        },
        message: 'La hora de inicio debe ser anterior a la hora de fin',
      },
    },
  },
  { _id: false },
)

/**
 * Indica si dos franjas se cruzan en el tiempo (regla R9).
 * @param {{dia: string, horaInicio: string, horaFin: string}} a
 * @param {{dia: string, horaInicio: string, horaFin: string}} b
 * @returns {boolean}
 */
export function franjasSeSolapan(a, b) {
  return a.dia === b.dia && a.horaInicio < b.horaFin && b.horaInicio < a.horaFin
}

/**
 * Indica si dos franjas son exactamente la misma.
 * @returns {boolean}
 */
export function franjasSonIguales(a, b) {
  return a.dia === b.dia && a.horaInicio === b.horaInicio && a.horaFin === b.horaFin
}

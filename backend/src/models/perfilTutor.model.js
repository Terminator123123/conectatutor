import mongoose from 'mongoose'
import { EstadoVerificacion } from '../utils/enums.js'
import { aplicarSalidaJson } from '../utils/salidaJson.js'
import { franjaSchema, franjasSeSolapan } from './franja.schema.js'

/**
 * Perfil de tutor (entidades PERFIL_TUTOR, TUTOR_MATERIA y FRANJA_HORARIA del modelo E-R).
 *
 * - Un estudiante tiene como máximo un perfil: `estudiante` es único.
 * - La relación N:M con materias se guarda como un arreglo de referencias.
 * - La disponibilidad va embebida: una franja no existe sin su perfil.
 * - El promedio de calificaciones NO se guarda: se calcula a partir de las sesiones.
 */
const perfilTutorSchema = new mongoose.Schema(
  {
    estudiante: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: [true, 'El perfil debe pertenecer a un estudiante'],
      unique: true,
    },
    biografia: {
      type: String,
      required: [true, 'La biografía es obligatoria'],
      trim: true,
      minlength: [20, 'La biografía necesita al menos 20 caracteres'],
      maxlength: [500, 'La biografía admite hasta 500 caracteres'],
    },
    // R10: null significa que la tutoría es gratuita; si se cobra, es un valor mayor que cero.
    tarifaHora: {
      type: Number,
      default: null,
      max: [500000, 'La tarifa por hora no puede superar 500000'],
      validate: {
        validator: (valor) => valor === null || valor > 0,
        message: 'La tarifa debe ser mayor que cero; déjala vacía si la tutoría es gratuita',
      },
    },
    estadoVerificacion: {
      type: String,
      enum: { values: Object.values(EstadoVerificacion), message: 'Estado de verificación no válido' },
      default: EstadoVerificacion.PENDIENTE,
      index: true,
    },
    // Solo tiene valor cuando el estado es RECHAZADO.
    motivoRechazo: { type: String, default: null, trim: true, maxlength: [300, 'El motivo admite hasta 300 caracteres'] },
    materias: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Materia' }],
      default: [],
      validate: {
        validator(materias) {
          return new Set(materias.map(String)).size === materias.length
        },
        message: 'Una materia no puede repetirse en el perfil',
      },
    },
    // Materias que Coordinación ya revisó. Una materia nueva queda por verificar hasta que
    // Coordinación la apruebe; solo las aprobadas aparecen en la oferta pública.
    materiasAprobadas: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Materia' }],
      default: [],
    },
    disponibilidad: {
      type: [franjaSchema],
      default: [],
      validate: {
        // R9: dos franjas de un mismo tutor no se pueden solapar.
        validator(franjas) {
          return franjas.every((franja, indice) =>
            franjas.slice(indice + 1).every((otra) => !franjasSeSolapan(franja, otra)),
          )
        },
        message: 'Dos franjas de la disponibilidad no se pueden solapar',
      },
    },
  },
  { timestamps: true, collection: 'perfilesTutor' },
)

perfilTutorSchema.index({ materias: 1 })

aplicarSalidaJson(perfilTutorSchema)

export const PerfilTutor = mongoose.model('PerfilTutor', perfilTutorSchema)

/** Ids de las materias ofrecidas que Coordinación todavía no aprobó. */
export function materiasSinAprobar(perfil) {
  const aprobadas = new Set((perfil.materiasAprobadas ?? []).map((materia) => String(materia._id ?? materia)))
  return perfil.materias.filter((materia) => !aprobadas.has(String(materia._id ?? materia)))
}

/**
 * Perfiles verificados antes de guardar las materias aprobadas: se toman como aprobadas
 * las que ofrecían en ese momento, una sola vez.
 */
export async function prepararAprobaciones() {
  for await (const perfil of PerfilTutor.find({ estadoVerificacion: EstadoVerificacion.VERIFICADO, materiasAprobadas: { $exists: false } }).select('materias').cursor()) {
    await PerfilTutor.updateOne(
      { _id: perfil._id, materiasAprobadas: { $exists: false } },
      { $set: { materiasAprobadas: perfil.materias } },
      { timestamps: false },
    )
  }
}

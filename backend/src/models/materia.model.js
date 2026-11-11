import mongoose from 'mongoose'
import { aplicarSalidaJson } from '../utils/salidaJson.js'

/**
 * Materia del catálogo (entidad MATERIA del modelo E-R).
 * `activa` permite que el administrador la retire del catálogo sin borrarla:
 * las sesiones antiguas siguen apuntando a ella.
 */
const materiaSchema = new mongoose.Schema(
  {
    codigo: {
      type: String,
      required: [true, 'La materia necesita un código'],
      trim: true,
      uppercase: true,
      unique: true,
      maxlength: [20, 'El código de la materia admite hasta 20 caracteres'],
    },
    nombre: {
      type: String,
      required: [true, 'La materia necesita un nombre'],
      trim: true,
      minlength: [3, 'El nombre de la materia necesita al menos 3 caracteres'],
      maxlength: [120, 'El nombre de la materia admite hasta 120 caracteres'],
    },
    programa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Programa',
      required: [true, 'La materia debe pertenecer a un programa'],
      index: true,
    },
    activa: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'materias' },
)

aplicarSalidaJson(materiaSchema)

export const Materia = mongoose.model('Materia', materiaSchema)

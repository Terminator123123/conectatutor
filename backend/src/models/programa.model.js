import mongoose from 'mongoose'
import { aplicarSalidaJson } from '../utils/salidaJson.js'

/** Programa académico de Uniguajira (entidad PROGRAMA del modelo E-R). */
const programaSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El programa necesita un nombre'],
      trim: true,
      unique: true,
      maxlength: [120, 'El nombre del programa admite hasta 120 caracteres'],
    },
    facultad: {
      type: String,
      required: [true, 'El programa necesita una facultad'],
      trim: true,
      maxlength: [120, 'El nombre de la facultad admite hasta 120 caracteres'],
    },
  },
  { timestamps: true, collection: 'programas' },
)

aplicarSalidaJson(programaSchema)

export const Programa = mongoose.model('Programa', programaSchema)

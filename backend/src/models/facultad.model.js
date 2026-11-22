import mongoose from 'mongoose'
import { aplicarSalidaJson } from '../utils/salidaJson.js'

/**
 * Facultad de Uniguajira. Cada programa guarda el nombre de su facultad,
 * que debe coincidir con una de esta colección.
 */
const facultadSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'La facultad necesita un nombre'],
      trim: true,
      unique: true,
      maxlength: [120, 'El nombre de la facultad admite hasta 120 caracteres'],
    },
  },
  { timestamps: true, collection: 'facultades' },
)

aplicarSalidaJson(facultadSchema)

export const Facultad = mongoose.model('Facultad', facultadSchema)

/** Crea las facultades que usan los programas y todavía no existen. Se puede repetir sin duplicar. */
export async function prepararFacultades() {
  const Programa = mongoose.model('Programa')
  for (const nombre of await Programa.distinct('facultad')) {
    await Facultad.updateOne({ nombre }, { $setOnInsert: { nombre } }, { upsert: true })
  }
}

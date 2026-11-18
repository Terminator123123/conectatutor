import mongoose from 'mongoose'
import { TipoNotificacion } from '../utils/enums.js'
import { aplicarSalidaJson } from '../utils/salidaJson.js'

/**
 * Notificación de la campana (RQF022). Se crea cuando la otra parte actúa sobre una
 * sesión, y como recordatorio antes de una tutoría o al terminar su horario.
 */
const notificacionSchema = new mongoose.Schema(
  {
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
    sesion: { type: mongoose.Schema.Types.ObjectId, ref: 'Sesion', default: null },
    tipo: { type: String, required: true, enum: Object.values(TipoNotificacion) },
    titulo: { type: String, required: true, maxlength: 160 },
    texto: { type: String, default: '', maxlength: 300 },
    // Pantalla del frontend a la que lleva la notificación.
    ruta: { type: String, default: '/sesiones', maxlength: 200 },
    leida: { type: Boolean, default: false },
    // Evita repetir un mismo recordatorio: una clave por usuario, sesión y momento.
    clave: { type: String, default: undefined },
  },
  { timestamps: true, collection: 'notificaciones' },
)

notificacionSchema.index({ usuario: 1, createdAt: -1 })
notificacionSchema.index({ usuario: 1, clave: 1 }, { unique: true, partialFilterExpression: { clave: { $type: 'string' } } })

aplicarSalidaJson(notificacionSchema, ['clave', 'usuario'])

export const Notificacion = mongoose.model('Notificacion', notificacionSchema)

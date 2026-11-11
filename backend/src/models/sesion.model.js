import mongoose from 'mongoose'
import { ESTADOS_QUE_OCUPAN_FRANJA, EstadoSesion } from '../utils/enums.js'
import { aplicarSalidaJson } from '../utils/salidaJson.js'
import { franjaSchema } from './franja.schema.js'

/**
 * Calificación (entidad CALIFICACION del modelo E-R).
 * Va embebida en la sesión: no existe sin ella y es como máximo una.
 */
const calificacionSchema = new mongoose.Schema(
  {
    // R7: entero de 1 a 5.
    puntaje: {
      type: Number,
      required: [true, 'El puntaje es obligatorio'],
      min: [1, 'El puntaje debe estar entre 1 y 5'],
      max: [5, 'El puntaje debe estar entre 1 y 5'],
      validate: { validator: Number.isInteger, message: 'El puntaje debe ser un número entero' },
    },
    resena: { type: String, default: '', trim: true, maxlength: [500, 'La reseña admite hasta 500 caracteres'] },
    fecha: { type: Date, default: Date.now },
  },
  { _id: false },
)

/**
 * Sesión de tutoría (entidad SESION del modelo E-R).
 * Referencia al perfil de tutor, no al usuario: quien atiende es el perfil.
 */
const sesionSchema = new mongoose.Schema(
  {
    solicitante: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: [true, 'La sesión necesita un solicitante'],
      index: true,
    },
    tutor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PerfilTutor',
      required: [true, 'La sesión necesita un tutor'],
      index: true,
    },
    materia: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Materia',
      required: [true, 'La sesión necesita una materia'],
    },
    // Día calendario de la tutoría, guardado a las 00:00 UTC. La hora está en la franja.
    fecha: { type: Date, required: [true, 'La sesión necesita una fecha'] },
    // Copia de la franja del tutor en el momento de solicitar.
    franja: { type: franjaSchema, required: [true, 'La sesión necesita una franja'] },
    tema: {
      type: String,
      required: [true, 'Describe el tema de la tutoría'],
      trim: true,
      minlength: [10, 'El tema necesita al menos 10 caracteres'],
      maxlength: [300, 'El tema admite hasta 300 caracteres'],
    },
    estado: {
      type: String,
      enum: { values: Object.values(EstadoSesion), message: 'Estado de sesión no válido' },
      default: EstadoSesion.PENDIENTE,
      index: true,
    },
    // Motivo del rechazo o de la cancelación.
    motivo: { type: String, default: null, trim: true, maxlength: [300, 'El motivo admite hasta 300 caracteres'] },
    calificacion: { type: calificacionSchema, default: null },
  },
  { timestamps: true, collection: 'sesiones' },
)

/**
 * Sin doble reserva (RQNF012): mientras una sesión esté PENDIENTE o CONFIRMADA,
 * nadie más puede tener otra con el mismo tutor, el mismo día y la misma hora.
 * Lo garantiza la base de datos con un índice único parcial, así que funciona
 * aunque dos solicitudes lleguen exactamente al mismo tiempo.
 */
sesionSchema.index(
  { tutor: 1, fecha: 1, 'franja.horaInicio': 1 },
  {
    unique: true,
    name: 'franja_ocupada_unica',
    partialFilterExpression: { estado: { $in: ESTADOS_QUE_OCUPAN_FRANJA } },
  },
)

aplicarSalidaJson(sesionSchema)

export const Sesion = mongoose.model('Sesion', sesionSchema)

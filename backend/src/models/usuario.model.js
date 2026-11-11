import mongoose from 'mongoose'
import { INSTITUCION } from '../config/institucion.js'
import { RolUsuario } from '../utils/enums.js'
import { aplicarSalidaJson } from '../utils/salidaJson.js'

/**
 * Indica si un correo pertenece al dominio institucional (regla R8).
 * @param {string} correo
 * @returns {boolean}
 */
export function esCorreoInstitucional(correo) {
  if (typeof correo !== 'string') return false
  const partes = correo.trim().toLowerCase().split('@')
  return partes.length === 2 && /^[a-z0-9._-]+$/.test(partes[0]) && partes[1] === INSTITUCION.dominioCorreo
}

/**
 * Usuario (entidad USUARIO del modelo E-R).
 *
 * La herencia Usuario -> Estudiante / Administrador se guarda en UNA sola colección
 * con un discriminador: el campo `tipo` dice de qué subclase es cada documento.
 */
const usuarioSchema = new mongoose.Schema(
  {
    // Discriminador: lo fijan los modelos Estudiante y Administrador. Se declara aquí
    // para que el modelo base no deje guardar un usuario sin tipo o con uno inventado.
    tipo: {
      type: String,
      required: [true, 'El tipo de usuario es obligatorio'],
      enum: { values: Object.values(RolUsuario), message: 'El tipo de usuario no es válido' },
    },
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      minlength: [3, 'El nombre necesita al menos 3 caracteres'],
      maxlength: [80, 'El nombre admite hasta 80 caracteres'],
    },
    correoInstitucional: {
      type: String,
      required: [true, 'El correo institucional es obligatorio'],
      trim: true,
      lowercase: true,
      unique: true,
      validate: {
        validator: esCorreoInstitucional,
        message: `El correo debe ser institucional (@${INSTITUCION.dominioCorreo})`,
      },
    },
    // Resultado de bcrypt. `select: false`: no viaja en las consultas salvo que se pida a propósito.
    claveHash: { type: String, required: [true, 'La contraseña es obligatoria'], select: false },
    // Ley 1581 de 2012: se guarda cuándo aceptó el tratamiento de sus datos.
    consentimientoDatos: {
      aceptado: { type: Boolean, default: false },
      fecha: { type: Date, default: null },
    },
  },
  { timestamps: true, collection: 'usuarios', discriminatorKey: 'tipo' },
)

aplicarSalidaJson(usuarioSchema, ['claveHash'])

export const Usuario = mongoose.model('Usuario', usuarioSchema)

/** Estudiante: puede solicitar tutorías y, si activa su perfil, dictarlas. */
export const Estudiante = Usuario.discriminator(
  'Estudiante',
  new mongoose.Schema({
    semestre: {
      type: Number,
      required: [true, 'El semestre es obligatorio'],
      min: [1, 'El semestre debe estar entre 1 y ' + INSTITUCION.semestreMaximo],
      max: [INSTITUCION.semestreMaximo, 'El semestre debe estar entre 1 y ' + INSTITUCION.semestreMaximo],
      validate: { validator: Number.isInteger, message: 'El semestre debe ser un número entero' },
    },
    sede: {
      type: String,
      required: [true, 'La sede es obligatoria'],
      enum: { values: INSTITUCION.sedes, message: 'Selecciona una sede de Uniguajira' },
    },
    programa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Programa',
      required: [true, 'El programa es obligatorio'],
    },
  }),
  RolUsuario.ESTUDIANTE,
)

/** Administrador: funcionario que verifica a los tutores. */
export const Administrador = Usuario.discriminator(
  'Administrador',
  new mongoose.Schema({
    dependencia: {
      type: String,
      required: [true, 'La dependencia es obligatoria'],
      trim: true,
      maxlength: [160, 'La dependencia admite hasta 160 caracteres'],
    },
  }),
  RolUsuario.ADMINISTRADOR,
)

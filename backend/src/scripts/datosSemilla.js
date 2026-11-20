import { INSTITUCION } from '../config/institucion.js'
import { DiaSemana, EstadoSesion, EstadoVerificacion } from '../utils/enums.js'

// Datos de demostración. Los programas y las materias son los reales de Uniguajira (src/datos/catalogoUniguajira.js)
// (primeros semestres de cada plan de estudios); las personas son ficticias.

export { MATERIAS, PROGRAMAS } from '../datos/catalogoUniguajira.js'

const correo = (usuario) => `${usuario}@${INSTITUCION.dominioCorreo}`

/** Estudiantes de demostración (personas ficticias). */
export const ESTUDIANTES = [
  { nombre: 'Andrea Salcedo', correoInstitucional: correo('andrea.salcedo'), semestre: 6, programa: 'Ingeniería de Sistemas', sede: 'Riohacha' },
  { nombre: 'Bruno Valdés', correoInstitucional: correo('bruno.valdes'), semestre: 5, programa: 'Administración de Empresas', sede: 'Maicao' },
  { nombre: 'Carolina Rueda', correoInstitucional: correo('carolina.rueda'), semestre: 7, programa: 'Biología', sede: 'Riohacha' },
  { nombre: 'Diego Manrique', correoInstitucional: correo('diego.manrique'), semestre: 4, programa: 'Psicología', sede: 'Villanueva' },
  { nombre: 'Elena Lozano', correoInstitucional: correo('elena.lozano'), semestre: 2, programa: 'Ingeniería de Sistemas', sede: 'Riohacha' },
  { nombre: 'Felipe Castaño', correoInstitucional: correo('felipe.castano'), semestre: 3, programa: 'Administración de Empresas', sede: 'Fonseca' },
]

/** Administrador de demostración (persona ficticia). */
export const ADMINISTRADOR = {
  nombre: 'Gabriela Montes',
  correoInstitucional: correo('gabriela.montes'),
  dependencia: INSTITUCION.dependenciaVerificadora,
}

/**
 * Perfiles de tutor. Cada tutor ofrece todas las materias de su programa.
 * El de Diego queda PENDIENTE para mostrar la verificación en la demostración.
 */
export const PERFILES_TUTOR = [
  {
    estudiante: correo('andrea.salcedo'),
    biografia: 'Acompaño ejercicios de programación y explico los conceptos con ejemplos.',
    tarifaHora: 35000,
    estadoVerificacion: EstadoVerificacion.VERIFICADO,
    disponibilidad: [{ dia: DiaSemana.LUNES, horaInicio: '08:00', horaFin: '10:00' }],
  },
  {
    estudiante: correo('bruno.valdes'),
    biografia: 'Apoyo el estudio de administración y contabilidad con ejercicios prácticos.',
    tarifaHora: null,
    estadoVerificacion: EstadoVerificacion.VERIFICADO,
    disponibilidad: [{ dia: DiaSemana.LUNES, horaInicio: '10:00', horaFin: '12:00' }],
  },
  {
    estudiante: correo('carolina.rueda'),
    biografia: 'Comparto estrategias para comprender los fundamentos de biología y sus aplicaciones.',
    tarifaHora: null,
    estadoVerificacion: EstadoVerificacion.VERIFICADO,
    disponibilidad: [{ dia: DiaSemana.LUNES, horaInicio: '14:00', horaFin: '16:00' }],
  },
  {
    estudiante: correo('diego.manrique'),
    biografia: 'Me interesa acompañar a estudiantes que comienzan a estudiar psicología.',
    tarifaHora: null,
    estadoVerificacion: EstadoVerificacion.PENDIENTE,
    disponibilidad: [{ dia: DiaSemana.LUNES, horaInicio: '16:00', horaFin: '18:00' }],
  },
]

/**
 * Sesiones de demostración: una en cada estado. Todas las fechas son lunes,
 * porque la disponibilidad de los tutores de ejemplo es de ese día.
 */
export const SESIONES = [
  {
    solicitante: correo('elena.lozano'),
    tutor: correo('andrea.salcedo'),
    materia: 'SIS-04',
    fecha: '2026-11-23',
    tema: 'Repasar variables y estructuras de control',
    estado: EstadoSesion.PENDIENTE,
  },
  {
    solicitante: correo('felipe.castano'),
    tutor: correo('bruno.valdes'),
    materia: 'ADM-02',
    fecha: '2026-11-30',
    tema: 'Preparar ejercicios de planeación',
    estado: EstadoSesion.CONFIRMADA,
  },
  {
    solicitante: correo('elena.lozano'),
    tutor: correo('carolina.rueda'),
    materia: 'BIO-05',
    fecha: '2026-11-02',
    tema: 'Comprender la estructura y función de las células',
    estado: EstadoSesion.FINALIZADA,
    calificacion: {
      puntaje: 5,
      resena: 'La explicación fue clara y pude resolver los ejercicios.',
      fecha: '2026-11-02T21:00:00.000Z',
    },
  },
  {
    solicitante: correo('felipe.castano'),
    tutor: correo('andrea.salcedo'),
    materia: 'SIS-07',
    fecha: '2026-11-09',
    tema: 'Repasar funciones y estructuras de control',
    estado: EstadoSesion.CANCELADA,
    motivo: 'El solicitante necesita cambiar la fecha.',
  },
  {
    solicitante: correo('felipe.castano'),
    tutor: correo('bruno.valdes'),
    materia: 'ADM-02',
    fecha: '2026-10-26',
    tema: 'Resolver dudas del taller de planeación',
    estado: EstadoSesion.FINALIZADA,
  },
]

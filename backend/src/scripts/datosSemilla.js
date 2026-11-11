import { INSTITUCION } from '../config/institucion.js'
import { DiaSemana, EstadoSesion, EstadoVerificacion } from '../utils/enums.js'

// Datos de demostración. Los programas y las materias son los reales de Uniguajira
// (primeros semestres de cada plan de estudios); las personas son ficticias.

/** Programas. Fuente: uniguajira.edu.co/ofertas-academicas (consultado el 2026-10-29). */
export const PROGRAMAS = [
  { nombre: 'Ingeniería de Sistemas', facultad: 'Facultad de Ingeniería' },
  { nombre: 'Administración de Empresas', facultad: 'Facultad de Ciencias Económicas y Administrativas' },
  { nombre: 'Biología', facultad: 'Facultad de Ciencias Básicas y Aplicadas' },
  { nombre: 'Psicología', facultad: 'Facultad de Ciencias Sociales y Humanas' },
]

/** Materias. El código es interno de la aplicación: el plan de estudios no publica códigos. */
export const MATERIAS = [
  { codigo: 'SIS-01', nombre: 'Cálculo Diferencial', programa: 'Ingeniería de Sistemas' },
  { codigo: 'SIS-02', nombre: 'Lógica y Teoría de Conjuntos', programa: 'Ingeniería de Sistemas' },
  { codigo: 'SIS-03', nombre: 'Introducción a la Ingeniería de Sistemas', programa: 'Ingeniería de Sistemas' },
  { codigo: 'SIS-04', nombre: 'Algoritmo y Programación I', programa: 'Ingeniería de Sistemas' },
  { codigo: 'SIS-05', nombre: 'Cálculo Integral', programa: 'Ingeniería de Sistemas' },
  { codigo: 'SIS-06', nombre: 'Álgebra Lineal', programa: 'Ingeniería de Sistemas' },
  { codigo: 'SIS-07', nombre: 'Algoritmo y Programación II', programa: 'Ingeniería de Sistemas' },
  { codigo: 'SIS-08', nombre: 'Estructura de Datos I', programa: 'Ingeniería de Sistemas' },
  { codigo: 'ADM-01', nombre: 'Fundamentos de Matemáticas', programa: 'Administración de Empresas' },
  { codigo: 'ADM-02', nombre: 'Fundamentos de Administración', programa: 'Administración de Empresas' },
  { codigo: 'ADM-03', nombre: 'Fundamentos en Economía', programa: 'Administración de Empresas' },
  { codigo: 'ADM-04', nombre: 'Contabilidad Financiera', programa: 'Administración de Empresas' },
  { codigo: 'ADM-05', nombre: 'Cálculo Diferencial', programa: 'Administración de Empresas' },
  { codigo: 'ADM-06', nombre: 'Procesos Administrativos I', programa: 'Administración de Empresas' },
  { codigo: 'ADM-07', nombre: 'Microeconomía', programa: 'Administración de Empresas' },
  { codigo: 'ADM-08', nombre: 'Contabilidad de Costos', programa: 'Administración de Empresas' },
  { codigo: 'BIO-01', nombre: 'Biología General', programa: 'Biología' },
  { codigo: 'BIO-02', nombre: 'Lab. Biología General', programa: 'Biología' },
  { codigo: 'BIO-03', nombre: 'Fundamentos de Matemáticas', programa: 'Biología' },
  { codigo: 'BIO-04', nombre: 'Fundamentos de Química', programa: 'Biología' },
  { codigo: 'BIO-05', nombre: 'Biología Celular', programa: 'Biología' },
  { codigo: 'BIO-06', nombre: 'Biofísica I', programa: 'Biología' },
  { codigo: 'BIO-07', nombre: 'Cálculo I', programa: 'Biología' },
  { codigo: 'BIO-08', nombre: 'Química Inorgánica', programa: 'Biología' },
  { codigo: 'PSI-01', nombre: 'Psicobiología', programa: 'Psicología' },
  { codigo: 'PSI-02', nombre: 'Antropología Social', programa: 'Psicología' },
  { codigo: 'PSI-03', nombre: 'Historia y Fundamentos de la Psicología', programa: 'Psicología' },
  { codigo: 'PSI-04', nombre: 'Percepción y Atención', programa: 'Psicología' },
  { codigo: 'PSI-05', nombre: 'Competencias Comunicativas', programa: 'Psicología' },
  { codigo: 'PSI-06', nombre: 'Desarrollo Personal', programa: 'Psicología' },
  { codigo: 'PSI-07', nombre: 'Psicofisiología', programa: 'Psicología' },
  { codigo: 'PSI-08', nombre: 'Epistemología de las Ciencias Sociales', programa: 'Psicología' },
]

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

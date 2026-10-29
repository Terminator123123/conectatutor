import Administrador from '../modelo/Administrador.js'
import Estudiante from '../modelo/Estudiante.js'
import FranjaHoraria from '../modelo/FranjaHoraria.js'
import Materia from '../modelo/Materia.js'
import Programa from '../modelo/Programa.js'
import { DiaSemana } from '../modelo/enums.js'

/**
 * Construye los datos académicos de ejemplo con personas ficticias y referencias compartidas.
 * @param {string} dominioCorreo Dominio que se utilizará en los correos de las cuentas.
 * @returns {Promise<{programas: Programa[], materias: Materia[], usuarios: import('../modelo/Usuario.js').default[], perfilesTutor: import('../modelo/PerfilTutor.js').default[], sesiones: import('../modelo/Sesion.js').default[], clavesHash: Object<string, string>}>} Colecciones de instancias y hashes por identificador de usuario.
 */
export async function crearDatosIniciales(dominioCorreo) {
  const dominio = dominioCorreo.trim().toLowerCase()

  const programas = [
    // EJEMPLO: reemplazar con dato de Uniguajira
    { nombre: 'Ingeniería de Sistemas', facultad: 'Facultad de ejemplo A' },
    // EJEMPLO: reemplazar con dato de Uniguajira
    { nombre: 'Administración de Empresas', facultad: 'Facultad de ejemplo B' },
    // EJEMPLO: reemplazar con dato de Uniguajira
    { nombre: 'Licenciatura en Matemáticas', facultad: 'Facultad de ejemplo C' },
  ].map((datos) => new Programa(datos))

  const materias = [
    // EJEMPLO: reemplazar con dato de Uniguajira
    { codigo: 'EJ-SIS-01', nombre: 'Fundamentos de programación', programa: programas[0] },
    // EJEMPLO: reemplazar con dato de Uniguajira
    { codigo: 'EJ-SIS-02', nombre: 'Programación orientada a objetos', programa: programas[0] },
    // EJEMPLO: reemplazar con dato de Uniguajira
    { codigo: 'EJ-SIS-03', nombre: 'Bases de datos', programa: programas[0] },
    // EJEMPLO: reemplazar con dato de Uniguajira
    { codigo: 'EJ-SIS-04', nombre: 'Estructuras de datos', programa: programas[0] },
    // EJEMPLO: reemplazar con dato de Uniguajira
    { codigo: 'EJ-ADM-01', nombre: 'Fundamentos de administración', programa: programas[1] },
    // EJEMPLO: reemplazar con dato de Uniguajira
    { codigo: 'EJ-ADM-02', nombre: 'Contabilidad básica', programa: programas[1] },
    // EJEMPLO: reemplazar con dato de Uniguajira
    { codigo: 'EJ-ADM-03', nombre: 'Microeconomía', programa: programas[1] },
    // EJEMPLO: reemplazar con dato de Uniguajira
    { codigo: 'EJ-ADM-04', nombre: 'Estadística aplicada', programa: programas[1] },
    // EJEMPLO: reemplazar con dato de Uniguajira
    { codigo: 'EJ-MAT-01', nombre: 'Álgebra lineal', programa: programas[2] },
    // EJEMPLO: reemplazar con dato de Uniguajira
    { codigo: 'EJ-MAT-02', nombre: 'Cálculo diferencial', programa: programas[2] },
    // EJEMPLO: reemplazar con dato de Uniguajira
    { codigo: 'EJ-MAT-03', nombre: 'Geometría analítica', programa: programas[2] },
    // EJEMPLO: reemplazar con dato de Uniguajira
    { codigo: 'EJ-MAT-04', nombre: 'Lógica matemática', programa: programas[2] },
  ].map((datos) => new Materia(datos))

  const estudiantes = [
    { nombre: 'Andrea Salcedo', correo: 'andrea.salcedo', semestre: 6, programa: programas[0] },
    { nombre: 'Bruno Valdés', correo: 'bruno.valdes', semestre: 5, programa: programas[1] },
    { nombre: 'Carolina Rueda', correo: 'carolina.rueda', semestre: 7, programa: programas[2] },
    { nombre: 'Diego Manrique', correo: 'diego.manrique', semestre: 4, programa: programas[0] },
    { nombre: 'Elena Lozano', correo: 'elena.lozano', semestre: 2, programa: programas[0] },
    { nombre: 'Felipe Castaño', correo: 'felipe.castano', semestre: 3, programa: programas[1] },
  ].map(({ nombre, correo, semestre, programa }) => new Estudiante({
    nombre,
    correoInstitucional: `${correo}@${dominio}`,
    semestre,
    programa,
  }))

  const administrador = new Administrador({
    nombre: 'Gabriela Montes',
    correoInstitucional: `gabriela.montes@${dominio}`,
    dependencia: 'PENDIENTE UNIGUAJIRA',
  })

  const biografias = [
    'Acompaño ejercicios de programación y explico los conceptos con ejemplos.',
    'Apoyo el estudio de administración y contabilidad con ejercicios prácticos.',
    'Comparto estrategias para resolver ejercicios de álgebra y cálculo.',
    'Me interesa acompañar a estudiantes que comienzan a programar.',
  ]
  const franjas = estudiantes.slice(0, 4).map((_, indice) => new FranjaHoraria({
    dia: DiaSemana.LUNES,
    horaInicio: `${String(9 + indice).padStart(2, '0')}:00`,
    horaFin: `${String(10 + indice).padStart(2, '0')}:00`,
  }))

  const perfilesTutor = estudiantes.slice(0, 4).map((estudiante, indice) => {
    const perfil = estudiante.activarPerfilTutor(biografias[indice])

    for (const materia of materias) {
      if (materia.getPrograma().getId() === estudiante.getPrograma().getId()) {
        perfil.agregarMateria(materia)
      }
    }

    perfil.agregarFranja(franjas[indice])

    if (indice < 3) {
      administrador.verificarTutor(perfil)
    }

    return perfil
  })

  const pendiente = estudiantes[4].solicitarSesion(
    perfilesTutor[0], materias[0], franjas[0],
    new Date('2026-11-02T09:00:00-05:00'), 'Repasar variables y estructuras de control',
  )
  const confirmada = estudiantes[5].solicitarSesion(
    perfilesTutor[1], materias[4], franjas[1],
    new Date('2026-11-09T10:00:00-05:00'), 'Preparar ejercicios de planeación',
  )
  confirmada.confirmar()

  const finalizada = estudiantes[4].solicitarSesion(
    perfilesTutor[2], materias[8], franjas[2],
    new Date('2026-11-16T11:00:00-05:00'), 'Practicar operaciones con matrices',
  )
  finalizada.confirmar()
  finalizada.finalizar()
  finalizada.calificar(5, 'La explicación fue clara y pude resolver los ejercicios.')

  const cancelada = estudiantes[5].solicitarSesion(
    perfilesTutor[0], materias[1], franjas[0],
    new Date('2026-11-23T09:00:00-05:00'), 'Repasar clases y objetos',
  )
  cancelada.cancelar('El solicitante necesita cambiar la fecha.')

  const usuarios = [...estudiantes, administrador]
  // Hash SHA-256 de Demo1234 para las cuentas de esta demo académica.
  const resumen = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('Demo1234'))
  const claveHash = Array.from(new Uint8Array(resumen), (octeto) => octeto.toString(16).padStart(2, '0')).join('')
  const clavesHash = Object.fromEntries(usuarios.map((usuario) => [usuario.getId(), claveHash]))

  return {
    programas,
    materias,
    usuarios,
    perfilesTutor,
    sesiones: [pendiente, confirmada, finalizada, cancelada],
    clavesHash,
  }
}

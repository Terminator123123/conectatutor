import Administrador from '../modelo/Administrador.js'
import Estudiante from '../modelo/Estudiante.js'
import FranjaHoraria from '../modelo/FranjaHoraria.js'
import Materia from '../modelo/Materia.js'
import Programa from '../modelo/Programa.js'
import { DiaSemana } from '../modelo/enums.js'
import { INSTITUCION } from '../config/institucion.js'

/**
 * Construye los datos académicos oficiales con personas ficticias y referencias compartidas.
 * @param {string} dominioCorreo Dominio que se utilizará en los correos de las cuentas.
 * @returns {Promise<{programas: Programa[], materias: Materia[], usuarios: import('../modelo/Usuario.js').default[], perfilesTutor: import('../modelo/PerfilTutor.js').default[], sesiones: import('../modelo/Sesion.js').default[], clavesHash: Object<string, string>}>} Colecciones de instancias y hashes por identificador de usuario.
 */
export async function crearDatosIniciales(dominioCorreo) {
  const dominio = dominioCorreo.trim().toLowerCase()

  const programas = [
    // Fuente: https://uniguajira.edu.co/ofertas-academicas/facultades/facultad-de-ingenieria/programa-de-ingenieria-de-sistemas/
    { nombre: 'Ingeniería de Sistemas', facultad: 'Facultad de Ingeniería' },
    // Fuente: https://uniguajira.edu.co/ofertas-academicas/facultades/facultad-de-ciencias-economicas-y-administrativas/programa-de-administracion-de-empresa/
    { nombre: 'Administración de Empresas', facultad: 'Facultad de Ciencias Económicas y Administrativas' },
    // Fuente: https://uniguajira.edu.co/ofertas-academicas/facultades/facultad-de-ciencias-basicas-y-aplicadas/programa-de-biologia/
    { nombre: 'Biología', facultad: 'Facultad de Ciencias Básicas y Aplicadas' },
    // Fuente: https://uniguajira.edu.co/ofertas-academicas/facultades/facultad-de-ciencias-sociales-y-humanas/programa-de-psicologia/
    { nombre: 'Psicología', facultad: 'Facultad de Ciencias Sociales y Humanas' },
  ].map((datos) => new Programa(datos))

  // Código interno de la app; el plan de estudios no publica códigos.
  const materias = [
    { codigo: 'SIS-01', nombre: 'Cálculo Diferencial', programa: programas[0] },
    { codigo: 'SIS-02', nombre: 'Lógica y Teoría de Conjuntos', programa: programas[0] },
    { codigo: 'SIS-03', nombre: 'Introducción a la Ingeniería de Sistemas', programa: programas[0] },
    { codigo: 'SIS-04', nombre: 'Algoritmo y Programación I', programa: programas[0] },
    { codigo: 'SIS-05', nombre: 'Cálculo Integral', programa: programas[0] },
    { codigo: 'SIS-06', nombre: 'Álgebra Lineal', programa: programas[0] },
    { codigo: 'SIS-07', nombre: 'Algoritmo y Programación II', programa: programas[0] },
    { codigo: 'SIS-08', nombre: 'Estructura de Datos I', programa: programas[0] },
    { codigo: 'ADM-01', nombre: 'Fundamentos de Matemáticas', programa: programas[1] },
    { codigo: 'ADM-02', nombre: 'Fundamentos de Administración', programa: programas[1] },
    { codigo: 'ADM-03', nombre: 'Fundamentos en Economía', programa: programas[1] },
    { codigo: 'ADM-04', nombre: 'Contabilidad Financiera', programa: programas[1] },
    { codigo: 'ADM-05', nombre: 'Cálculo Diferencial', programa: programas[1] },
    { codigo: 'ADM-06', nombre: 'Procesos Administrativos I', programa: programas[1] },
    { codigo: 'ADM-07', nombre: 'Microeconomía', programa: programas[1] },
    { codigo: 'ADM-08', nombre: 'Contabilidad de Costos', programa: programas[1] },
    { codigo: 'BIO-01', nombre: 'Biología General', programa: programas[2] },
    { codigo: 'BIO-02', nombre: 'Lab. Biología General', programa: programas[2] },
    { codigo: 'BIO-03', nombre: 'Fundamentos de Matemáticas', programa: programas[2] },
    { codigo: 'BIO-04', nombre: 'Fundamentos de Química', programa: programas[2] },
    { codigo: 'BIO-05', nombre: 'Biología Celular', programa: programas[2] },
    { codigo: 'BIO-06', nombre: 'Biofísica I', programa: programas[2] },
    { codigo: 'BIO-07', nombre: 'Cálculo I', programa: programas[2] },
    { codigo: 'BIO-08', nombre: 'Química Inorgánica', programa: programas[2] },
    { codigo: 'PSI-01', nombre: 'Psicobiología', programa: programas[3] },
    { codigo: 'PSI-02', nombre: 'Antropología Social', programa: programas[3] },
    { codigo: 'PSI-03', nombre: 'Historia y Fundamentos de la Psicología', programa: programas[3] },
    { codigo: 'PSI-04', nombre: 'Percepción y Atención', programa: programas[3] },
    { codigo: 'PSI-05', nombre: 'Competencias Comunicativas', programa: programas[3] },
    { codigo: 'PSI-06', nombre: 'Desarrollo Personal', programa: programas[3] },
    { codigo: 'PSI-07', nombre: 'Psicofisiología', programa: programas[3] },
    { codigo: 'PSI-08', nombre: 'Epistemología de las Ciencias Sociales', programa: programas[3] },
  ].map((datos) => new Materia(datos))

  const estudiantes = [
    { nombre: 'Andrea Salcedo', correo: 'andrea.salcedo', semestre: 6, programa: programas[0], sede: INSTITUCION.sedes[0] },
    { nombre: 'Bruno Valdés', correo: 'bruno.valdes', semestre: 5, programa: programas[1], sede: INSTITUCION.sedes[1] },
    { nombre: 'Carolina Rueda', correo: 'carolina.rueda', semestre: 7, programa: programas[2], sede: INSTITUCION.sedes[0] },
    { nombre: 'Diego Manrique', correo: 'diego.manrique', semestre: 4, programa: programas[3], sede: INSTITUCION.sedes[2] },
    { nombre: 'Elena Lozano', correo: 'elena.lozano', semestre: 2, programa: programas[0], sede: INSTITUCION.sedes[0] },
    { nombre: 'Felipe Castaño', correo: 'felipe.castano', semestre: 3, programa: programas[1], sede: INSTITUCION.sedes[3] },
  ].map(({ nombre, correo, semestre, programa, sede }) => new Estudiante({
    nombre,
    correoInstitucional: `${correo}@${dominio}`,
    semestre,
    programa,
    sede,
  }))

  const administrador = new Administrador({
    nombre: 'Gabriela Montes',
    correoInstitucional: `gabriela.montes@${dominio}`,
    dependencia: INSTITUCION.dependenciaVerificadora,
  })

  const biografias = [
    'Acompaño ejercicios de programación y explico los conceptos con ejemplos.',
    'Apoyo el estudio de administración y contabilidad con ejercicios prácticos.',
    'Comparto estrategias para comprender los fundamentos de biología y sus aplicaciones.',
    'Me interesa acompañar a estudiantes que comienzan a estudiar psicología.',
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
    perfilesTutor[0], materias[3], franjas[0],
    new Date('2026-11-02T09:00:00-05:00'), 'Repasar variables y estructuras de control',
  )
  const confirmada = estudiantes[5].solicitarSesion(
    perfilesTutor[1], materias[9], franjas[1],
    new Date('2026-11-09T10:00:00-05:00'), 'Preparar ejercicios de planeación',
  )
  confirmada.confirmar()

  const finalizada = estudiantes[4].solicitarSesion(
    perfilesTutor[2], materias[20], franjas[2],
    new Date('2026-11-16T11:00:00-05:00'), 'Comprender la estructura y función de las células',
  )
  finalizada.confirmar()
  finalizada.finalizar()
  finalizada.calificar(5, 'La explicación fue clara y pude resolver los ejercicios.')

  const cancelada = estudiantes[5].solicitarSesion(
    perfilesTutor[0], materias[6], franjas[0],
    new Date('2026-11-23T09:00:00-05:00'), 'Repasar funciones y estructuras de control',
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
